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
    const supabase = createServiceClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    const customerId = profile?.stripe_customer_id as string | null

    if (!customerId) {
      return res.status(400).json({ error: 'NO_SUBSCRIPTION', message: 'No subscription found', status: 400 })
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('[api/stripe/portal] Missing required Stripe environment variables')
      return res.status(500).json({ error: 'CONFIGURATION_ERROR', message: 'Server misconfigured', status: 500 })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || ''

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/account`,
    })

    return res.status(200).json({ url: session.url })
  } catch (error) {
    console.error('[api/stripe/portal][POST]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
