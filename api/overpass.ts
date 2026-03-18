import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServiceClient } from './_supabase'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function buildOverpassQuery(s: string, w: string, n: string, e: string): string {
  return `[out:json][timeout:30];
(
  node["amenity"="drinking_water"](${s},${w},${n},${e});
  node["amenity"="waste_disposal"](${s},${w},${n},${e});
  node["amenity"="fuel"](${s},${w},${n},${e});
  node["amenity"="shower"][access!="private"](${s},${w},${n},${e});
  node["tourism"="camp_site"](${s},${w},${n},${e});
  node["tourism"="caravan_site"](${s},${w},${n},${e});
);
out body;`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'GET only', status: 405 })
  }

  const bbox = Array.isArray(req.query.bbox) ? req.query.bbox[0] : req.query.bbox
  if (!bbox) {
    return res.status(400).json({ error: 'MISSING_BBOX', message: 'bbox query param required', status: 400 })
  }
  const parts = bbox.split(',')
  if (parts.length !== 4 || parts.some(p => isNaN(Number(p)))) {
    return res.status(400).json({ error: 'INVALID_BBOX', message: 'bbox must be south,west,north,east', status: 400 })
  }

  try {
    const supabase = createServiceClient()

    // Check cache
    const { data: cached } = await supabase
      .from('overpass_cache')
      .select('payload, cached_at')
      .eq('bbox_key', bbox)
      .single()

    if (cached) {
      const ageMs = Date.now() - new Date(cached.cached_at as string).getTime()
      if (ageMs < CACHE_TTL_MS) {
        return res.status(200).json(cached.payload)
      }
    }

    // Cache miss or stale — fetch from Overpass
    const [s, w, n, e] = parts
    const query = buildOverpassQuery(s, w, n, e)
    const overpassRes = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    })
    if (!overpassRes.ok) throw new Error(`Overpass ${overpassRes.status}: ${await overpassRes.text()}`)
    const payload = await overpassRes.json()

    // Upsert to cache
    await supabase
      .from('overpass_cache')
      .upsert({ bbox_key: bbox, payload, cached_at: new Date().toISOString() }, { onConflict: 'bbox_key' })

    return res.status(200).json(payload)
  } catch (error) {
    console.error('[api/overpass]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
