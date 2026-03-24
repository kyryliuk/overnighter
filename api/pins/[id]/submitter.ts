import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServiceClient } from '../../_supabase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'GET only', status: 405 })
  }

  const pinId = req.query.id
  if (typeof pinId !== 'string') {
    return res.status(400).json({ error: 'INVALID_ID', message: 'Pin id is required', status: 400 })
  }

  const supabase = createServiceClient()

  try {
    const { data, error } = await supabase
      .from('spot_submissions')
      .select('user_id')
      .eq('published_pin_id', pinId)
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return res.status(200).json({ submitter: null })
    }

    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(data.user_id)
    if (userError || !user) {
      return res.status(200).json({ submitter: null })
    }

    const displayName =
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'A community member'

    return res.status(200).json({ submitter: displayName })
  } catch (error) {
    console.error('[api/pins/:id/submitter]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
