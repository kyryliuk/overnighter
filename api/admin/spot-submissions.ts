import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdminAuth } from '../_middleware'
import { createServiceClient } from '../_supabase'
import { mapSpotSubmission, type ApiDbSpotSubmission } from '../_spot-submissions'

const VALID_STATUSES = ['pending', 'approved', 'rejected', 'changes_requested'] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'GET only', status: 405 })
  }

  if (!requireAdminAuth(req, res)) return

  const supabase = createServiceClient()
  const statusFilter = req.query.status as string | undefined
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1)
  const limit = 20
  const offset = (page - 1) * limit

  try {
    let query = supabase
      .from('spot_submissions')
      .select('*', { count: 'exact' })

    if (statusFilter && VALID_STATUSES.includes(statusFilter as typeof VALID_STATUSES[number])) {
      query = query.eq('status', statusFilter)
    }

    query = query
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) throw error

    return res.status(200).json({
      submissions: (data as ApiDbSpotSubmission[]).map(mapSpotSubmission),
      total: count ?? 0,
      page,
      pageSize: limit,
      hasMore: (count ?? 0) > offset + limit,
    })
  } catch (error) {
    console.error('[api/admin/spot-submissions]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
