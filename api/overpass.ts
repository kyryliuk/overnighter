import type { VercelRequest, VercelResponse } from '@vercel/node'

// Story 2.4 will implement full Overpass proxy with 24h cache
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'GET only', status: 405 })
  }

  try {
    // TODO: Story 2.4 — check overpass_cache table, fetch from Overpass API if stale
    return res.status(200).json({ elements: [] })
  } catch (error) {
    console.error('[api/overpass]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
