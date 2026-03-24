import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { createServiceClient } from '../_supabase'

export const config = { api: { bodyParser: false } }

function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function mapStripeStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'trialing':
      return 'trialing'
    case 'active':
      return 'premium'
    case 'canceled':
    case 'past_due':
    case 'unpaid':
      return 'expired'
    default:
      return 'free'
  }
}

async function updateSubscriptionStatus(
  supabase: ReturnType<typeof createServiceClient>,
  stripe: Stripe,
  stripeCustomerId: string,
  subscriptionStatus: string,
) {
  const { data: profile, error: findError } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', stripeCustomerId)
    .single()

  if (findError || !profile) {
    // Email fallback: customer may not have stripe_customer_id set yet (race with checkout)
    const customer = await stripe.customers.retrieve(stripeCustomerId)
    if (customer.deleted || !('email' in customer) || !customer.email) {
      console.error('[webhook] Profile not found and customer has no email', stripeCustomerId)
      return
    }

    const { data: profileByEmail } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', customer.email)
      .single()

    if (!profileByEmail) {
      console.error('[webhook] Profile not found by customer ID or email', stripeCustomerId, customer.email)
      return
    }

    // Set stripe_customer_id for future lookups
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: stripeCustomerId, subscription_status: subscriptionStatus })
      .eq('id', profileByEmail.id)

    const { error: authError } = await supabase.auth.admin.updateUserById(profileByEmail.id, {
      app_metadata: { subscription_status: subscriptionStatus },
    })
    if (authError) {
      console.error('[webhook] Failed to refresh JWT claims (email fallback)', authError)
    }
    return
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ subscription_status: subscriptionStatus })
    .eq('id', profile.id)

  if (updateError) {
    console.error('[webhook] Failed to update subscription status', updateError)
  }

  // Refresh JWT custom claims so useSubscription() picks up change on next token refresh
  const { error: authError } = await supabase.auth.admin.updateUserById(profile.id, {
    app_metadata: { subscription_status: subscriptionStatus },
  })

  if (authError) {
    console.error('[webhook] Failed to refresh JWT claims', authError)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only', status: 405 })
  }

  const signature = req.headers['stripe-signature']
  if (!signature) {
    return res.status(400).json({ error: 'MISSING_SIGNATURE', message: 'Missing stripe-signature header', status: 400 })
  }

  let event: Stripe.Event

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[api/stripe/webhook] Missing required Stripe environment variables')
    return res.status(500).json({ error: 'CONFIGURATION_ERROR', message: 'Server misconfigured', status: 500 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  try {
    const rawBody = await getRawBody(req)
    event = stripe.webhooks.constructEvent(rawBody, signature as string, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (error) {
    console.error('[api/stripe/webhook] Signature verification failed', error)
    return res.status(400).json({ error: 'INVALID_SIGNATURE', message: 'Invalid webhook signature', status: 400 })
  }

  const supabase = createServiceClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const customerId = session.customer as string

        let status: string = 'premium'
        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          status = subscription.status === 'trialing' ? 'trialing' : 'premium'
        }

        await updateSubscriptionStatus(supabase, stripe, customerId, status)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const status = mapStripeStatus(subscription.status)
        await updateSubscriptionStatus(supabase, stripe, customerId, status)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        await updateSubscriptionStatus(supabase, stripe, customerId, 'expired')
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        await updateSubscriptionStatus(supabase, stripe, customerId, 'expired')
        break
      }

      default:
        console.info('[api/stripe/webhook] Unhandled event type:', event.type)
    }

    return res.status(200).json({ received: true })
  } catch (error) {
    console.error('[api/stripe/webhook]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
