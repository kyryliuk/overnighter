import type { SupabaseClient } from '@supabase/supabase-js'

const STATUS_LABELS: Record<string, string> = {
  still_open: 'still open',
  closed: 'reported closed',
  changed: 'conditions changed',
}

export async function notifySubscribers(
  supabase: SupabaseClient,
  pinId: string,
  pinName: string,
  checkInStatus: string,
): Promise<void> {
  const { data: savedSpotRows, error: savedErr } = await supabase
    .from('saved_spots')
    .select('user_id')
    .eq('pin_id', pinId)
  if (savedErr || !savedSpotRows?.length) return

  const userIds = [...new Set(savedSpotRows.map((r: { user_id: string }) => r.user_id))]
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('user_id')
    .in('user_id', userIds)
  if (!subscriptions?.length) return
  const subscribedUserIds = [...new Set(subscriptions.map((s: { user_id: string }) => s.user_id))]

  const sendUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}/api/push/send`
    : 'http://localhost:3000/api/push/send'
  const adminToken = process.env.PUSH_ADMIN_TOKEN
  if (!adminToken) {
    console.error('[_pushNotify] PUSH_ADMIN_TOKEN not configured')
    return
  }

  const statusLabel = STATUS_LABELS[checkInStatus] ?? checkInStatus
  const title = pinName
  const body = `New check-in — ${statusLabel}`
  const url = `/pin/${pinId}`

  await Promise.allSettled(
    subscribedUserIds.map((userId) =>
      fetch(sendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ userId, title, body, url }),
      }),
    ),
  )
}
