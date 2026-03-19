import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdminAuth } from '../_middleware'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'GET only', status: 405 })
  }
  if (!requireAdminAuth(req, res)) return
  return res.status(200).json({ ok: true })
}
