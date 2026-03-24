import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdminAuth } from '../../_middleware'
import { createServiceClient } from '../../_supabase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'GET only', status: 405 })
  }

  if (!requireAdminAuth(req, res)) return

  const supabase = createServiceClient()

  try {
    // Use separate count queries to avoid fetching all rows
    const statuses = ['pending', 'approved', 'rejected', 'changes_requested'] as const
    const results = await Promise.all(
      statuses.map(async (status) => {
        const { count, error } = await supabase
          .from('spot_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('status', status)
        if (error) throw error
        return [status, count ?? 0] as const
      })
    )

    const counts: Record<string, number> = { all: 0 }
    for (const [status, count] of results) {
      counts[status] = count
      counts.all += count
    }

    return res.status(200).json(counts)
  } catch (error) {
    console.error('[api/admin/spot-submissions/counts]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
