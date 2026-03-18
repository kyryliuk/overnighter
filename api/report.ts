import type { VercelRequest, VercelResponse } from '@vercel/node'

// Story 4.4 will implement full issue report logic
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only', status: 405 })
  }

  try {
    // TODO: Story 4.4 — validate body, write issue_reports row, degrade badge
    return res.status(200).json({ message: 'ok' })
  } catch (error) {
    console.error('[api/report]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
