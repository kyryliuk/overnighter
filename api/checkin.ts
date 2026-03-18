import type { VercelRequest, VercelResponse } from '@vercel/node'

// Story 4.3 will implement full check-in logic
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only', status: 405 })
  }

  try {
    // TODO: Story 4.3 — validate body, write check_ins row, recalculate badge
    return res.status(200).json({ message: 'ok' })
  } catch (error) {
    console.error('[api/checkin]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
