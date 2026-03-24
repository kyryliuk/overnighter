import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { requireUserAuth } from '../_auth'
import { createServiceClient } from '../_supabase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only', status: 405 })
  }

  const user = await requireUserAuth(req, res)
  if (!user) return

  try {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID_ANNUAL) {
      console.error('[api/stripe/checkout] Missing required Stripe environment variables')
      return res.status(500).json({ error: 'CONFIGURATION_ERROR', message: 'Server misconfigured', status: 500 })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const supabase = createServiceClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id as string | null

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)

      if (updateError) throw updateError
    }

    const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || ''

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID_ANNUAL, quantity: 1 }],
      subscription_data: { trial_period_days: 30 },
      success_url: `${origin}/premium-welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/`,
      customer: customerId,
    })

    return res.status(200).json({ url: session.url })
  } catch (error) {
    console.error('[api/stripe/checkout][POST]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
