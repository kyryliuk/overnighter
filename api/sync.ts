import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdminAuth } from './_middleware'

// Story 2.4 will implement full BLM/USFS/NPS sync logic
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only', status: 405 })
  }

  if (!requireAdminAuth(req, res)) return

  try {
    // TODO: Story 2.4 — fetch BLM/USFS/NPS APIs, normalize, upsert to pins table
    return res.status(200).json({ message: 'sync triggered', synced: 0 })
  } catch (error) {
    console.error('[api/sync]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
