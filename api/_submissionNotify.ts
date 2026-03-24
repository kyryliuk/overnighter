import type { SupabaseClient } from '@supabase/supabase-js'

interface SubmissionNotifyParams {
  userId: string
  submissionName: string
  action: 'approve' | 'reject' | 'request_changes'
  adminNotes?: string | null
  publishedPinId?: string | null
}

export async function notifySubmissionStatusChange(
  supabase: SupabaseClient,
  params: SubmissionNotifyParams,
): Promise<void> {
  const { userId, submissionName, action, adminNotes, publishedPinId } = params

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('user_id')
    .eq('user_id', userId)
    .limit(1)

  if (!subscriptions?.length) return

  let title: string
  let body: string
  let url: string

  switch (action) {
    case 'approve':
      title = submissionName
      body = 'Your spot was approved and is now live on the map!'
      url = publishedPinId ? `/pin/${publishedPinId}` : '/suggest-spot'
      break
    case 'reject':
      title = submissionName
      body = adminNotes
        ? `Your submission was not approved. ${adminNotes}`
        : 'Your submission was not approved.'
      url = '/suggest-spot'
      break
    case 'request_changes':
      title = submissionName
      body = 'Changes requested on your submission — check the feedback.'
      url = '/suggest-spot'
      break
  }

  const sendUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}/api/push/send`
    : 'http://localhost:3000/api/push/send'
  const adminToken = process.env.PUSH_ADMIN_TOKEN

  if (!adminToken) {
    console.error('[_submissionNotify] PUSH_ADMIN_TOKEN not configured')
    return
  }

  fetch(sendUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ userId, title, body, url }),
  }).catch((err) => {
    console.error('[_submissionNotify] push send failed', err)
  })
}
