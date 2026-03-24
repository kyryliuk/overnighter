import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { requireUserAuth } from '../_auth'
import { createServiceClient } from '../_supabase'

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    return handleSubscribe(req, res)
  }
  if (req.method === 'DELETE') {
    return handleUnsubscribe(req, res)
  }
  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST or DELETE only', status: 405 })
}

async function handleSubscribe(req: VercelRequest, res: VercelResponse) {
  const user = await requireUserAuth(req, res)
  if (!user) return

  const parsed = SubscribeSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_BODY',
      message: parsed.error.errors.map((e) => e.message).join(', '),
      status: 400,
    })
  }

  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.p256dh,
        auth: parsed.data.auth,
      },
      { onConflict: 'endpoint' },
    )

    if (error) throw error

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('[api/push/subscribe][POST]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}

async function handleUnsubscribe(req: VercelRequest, res: VercelResponse) {
  const user = await requireUserAuth(req, res)
  if (!user) return

  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from('push_subscriptions').delete().eq('user_id', user.id)

    if (error) throw error

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('[api/push/subscribe][DELETE]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
