import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdminAuth } from './_middleware'
import { createServiceClient } from './_supabase'
import { normalizeRidbFacility } from './_normalize'
import type { RidbFacility } from './_normalize'

const RIDB_BASE = 'https://ridb.recreation.gov/api/v1/facilities'
const PAGE_SIZE = 50

interface RidbResponse {
  RECDATA: RidbFacility[]
  METADATA: { RESULTS: { CURRENT_COUNT: number; TOTAL_COUNT: number } }
}

async function fetchRidbPage(apiKey: string, offset: number): Promise<RidbResponse> {
  const url = `${RIDB_BASE}?apikey=${apiKey}&activity=9&full=true&limit=${PAGE_SIZE}&offset=${offset}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`RIDB API ${res.status}: ${await res.text()}`)
  return res.json() as Promise<RidbResponse>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only', status: 405 })
  }

  if (!requireAdminAuth(req, res)) return

  const apiKey = process.env.RIDB_API_KEY ?? ''
  const supabase = createServiceClient()
  let offset = 0
  let totalSynced = 0

  try {
    while (true) {
      const data = await fetchRidbPage(apiKey, offset)
      const rows = data.RECDATA
        .map(normalizeRidbFacility)
        .filter((r): r is NonNullable<ReturnType<typeof normalizeRidbFacility>> => r !== null)

      if (rows.length > 0) {
        const { error } = await supabase
          .from('pins')
          .upsert(rows, { onConflict: 'pin_type,source_id' })
        if (error) throw new Error(`Supabase upsert: ${error.message}`)
        totalSynced += rows.length
      }

      if (data.METADATA.RESULTS.CURRENT_COUNT < PAGE_SIZE) break
      offset += PAGE_SIZE
    }

    // Flag pins not updated in last 48h as stale (NFR-I1)
    // Only flag grey pins — don't override green/yellow from real check-ins
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    await supabase
      .from('pins')
      .update({ badge_state: 'red' })
      .lt('updated_at', cutoff)
      .eq('badge_state', 'grey')

    return res.status(200).json({ message: 'sync complete', synced: totalSynced })
  } catch (error) {
    console.error('[api/sync]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
