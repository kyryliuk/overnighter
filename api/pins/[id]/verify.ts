import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdminAuth } from '../../_middleware'

// Story 5.2 will implement full report verification logic
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'PATCH only', status: 405 })
  }

  if (!requireAdminAuth(req, res)) return

  const { id } = req.query

  try {
    // TODO: Story 5.2 — close/verify issue report, update pin status
    return res.status(200).json({ message: 'verified', id })
  } catch (error) {
    console.error('[api/pins/[id]/verify]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
