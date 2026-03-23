import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdminAuth } from '../_middleware'
import { createServiceClient } from '../_supabase'
import { mapSpotSubmission, type ApiDbSpotSubmission } from '../_spot-submissions'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'GET only', status: 405 })
  }

  if (!requireAdminAuth(req, res)) return

  const supabase = createServiceClient()

  try {
    const { data, error } = await supabase
      .from('spot_submissions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) throw error
    return res.status(200).json((data as ApiDbSpotSubmission[]).map(mapSpotSubmission))
  } catch (error) {
    console.error('[api/admin/spot-submissions]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
