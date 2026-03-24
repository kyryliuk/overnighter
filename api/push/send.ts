import type { VercelRequest, VercelResponse } from '@vercel/node'
import { timingSafeEqual } from 'crypto'
import { z } from 'zod'
import * as webpush from 'web-push'
import { createServiceClient } from '../_supabase'

const SendSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1),
  body: z.string().min(1),
  url: z.string().min(1).optional(),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only', status: 405 })
  }

  // System-level Bearer token auth (constant-time comparison)
  const authHeader = req.headers['authorization']
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  const expected = process.env.PUSH_ADMIN_TOKEN
  if (
    !token ||
    !expected ||
    token.length !== expected.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  ) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid admin token', status: 401 })
  }

  const parsed = SendSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_BODY',
      message: parsed.error.errors.map((e) => e.message).join(', '),
      status: 400,
    })
  }

  const { VAPID_PRIVATE_KEY, VITE_VAPID_PUBLIC_KEY, VAPID_SUBJECT } = process.env
  if (!VAPID_PRIVATE_KEY || !VITE_VAPID_PUBLIC_KEY || !VAPID_SUBJECT) {
    return res.status(500).json({ error: 'CONFIGURATION_ERROR', message: 'Server misconfigured', status: 500 })
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  try {
    const supabase = createServiceClient()
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', parsed.data.userId)

    if (fetchError) throw fetchError

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ sent: 0, failed: 0 })
    }

    const payload = JSON.stringify({
      title: parsed.data.title,
      options: {
        body: parsed.data.body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: { url: parsed.data.url },
      },
    })

    let sent = 0
    let failed = 0

    for (const sub of subscriptions) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }

      try {
        await webpush.sendNotification(pushSubscription, payload)
        sent++
      } catch (err: unknown) {
        failed++
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 410 || statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
      }
    }

    return res.status(200).json({ sent, failed })
  } catch (error) {
    console.error('[api/push/send]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
