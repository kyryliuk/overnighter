import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdminAuth } from '../_middleware'

// Story 5.2 will implement full pin deletion logic
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'DELETE only', status: 405 })
  }

  if (!requireAdminAuth(req, res)) return

  const { id } = req.query

  try {
    // TODO: Story 5.2 — delete pin from pins table
    return res.status(200).json({ message: 'deleted', id })
  } catch (error) {
    console.error('[api/pins/[id]]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
