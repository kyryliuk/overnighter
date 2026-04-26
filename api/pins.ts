import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { createServiceClient } from './_supabase'

const RadiusSearchSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusM: z.coerce.number().int().min(100).max(500000),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
})

/**
 * Unified radius row shape — returned by both `search_pins_by_radius` (regular)
 * and `search_water_taps_by_radius` (water_tap) RPCs.
 * `pin_category` may be undefined for rows from the pre-6.6 `search_pins_by_radius` RPC.
 */
interface DbRadiusRow {
  id: string
  name: string
  description: string | null
  latitude: number
  longitude: number
  pin_type: string
  pin_category?: string | null
  source_id: string | null
  max_length_ft: number | null
  max_height_ft: number | null
  website: string | null
  phone: string | null
  elevation_m: number | null
  amenities: Record<string, boolean>
  badge_state: string
  last_check_in_at: string | null
  recent_check_in_count: number
  is_verified: boolean
  is_flagged: boolean
  location: string | null
  created_at: string
  updated_at: string
  distance_m: number
}

/**
 * Row shape returned by the `map_pins` view (migration 034).
 * Used by handleGetAllPins for the non-spatial fallback path.
 */
interface DbMapPinRow {
  id: string
  location: string | null
  pin_category: string
  place_name: string
  description: string | null
  latitude: number
  longitude: number
  pin_type: string
  source_id: string | null
  max_length_ft: number | null
  max_height_ft: number | null
  website: string | null
  phone: string | null
  elevation_m: number | null
  amenities: Record<string, boolean>
  badge_state: string
  last_check_in_at: string | null
  recent_check_in_count: number
  is_verified: boolean
  is_flagged: boolean
  created_at: string
  updated_at: string
}

function mapRadiusPin(db: DbRadiusRow, category = 'regular') {
  return {
    id: db.id,
    name: db.name,
    description: db.description,
    latitude: db.latitude,
    longitude: db.longitude,
    pinType: db.pin_type,
    pinCategory: db.pin_category ?? category,
    sourceId: db.source_id,
    maxLengthFt: db.max_length_ft,
    maxHeightFt: db.max_height_ft,
    website: db.website,
    phone: db.phone,
    elevationM: db.elevation_m,
    amenities: db.amenities,
    badgeState: db.badge_state,
    lastCheckInAt: db.last_check_in_at,
    recentCheckInCount: db.recent_check_in_count,
    isVerified: db.is_verified,
    isFlagged: db.is_flagged,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    distanceM: Math.round(db.distance_m),
  }
}

function mapMapPin(db: DbMapPinRow) {
  return {
    id: db.id,
    name: db.place_name,
    description: db.description,
    latitude: db.latitude,
    longitude: db.longitude,
    pinType: db.pin_type,
    pinCategory: db.pin_category,
    sourceId: db.source_id,
    maxLengthFt: db.max_length_ft,
    maxHeightFt: db.max_height_ft,
    website: db.website,
    phone: db.phone,
    elevationM: db.elevation_m,
    amenities: db.amenities,
    badgeState: db.badge_state,
    lastCheckInAt: db.last_check_in_at,
    recentCheckInCount: db.recent_check_in_count,
    isVerified: db.is_verified,
    isFlagged: db.is_flagged,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'GET only', status: 405 })
  }

  const hasRadiusParams =
    req.query.lat !== undefined &&
    req.query.lng !== undefined &&
    req.query.radiusM !== undefined

  if (!hasRadiusParams) {
    return handleGetAllPins(res)
  }

  return handleRadiusSearch(req, res)
}

async function handleRadiusSearch(req: VercelRequest, res: VercelResponse) {
  const parsed = RadiusSearchSchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_PARAMS',
      message: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      status: 400,
    })
  }

  const { lat, lng, radiusM, limit, offset } = parsed.data
  const supabase = createServiceClient()

  // Fire regular pins, water tap pins, and regular pin count in parallel
  const [regularResult, waterTapResult, countResult] = await Promise.all([
    supabase.rpc('search_pins_by_radius', {
      p_lat: lat,
      p_lng: lng,
      p_radius_m: radiusM,
      p_limit: limit,
      p_offset: offset,
    }),
    supabase.rpc('search_water_taps_by_radius', {
      p_lat: lat,
      p_lng: lng,
      p_radius_m: radiusM,
      p_limit: limit,
      p_offset: offset,
    }),
    supabase.rpc('count_pins_by_radius', {
      p_lat: lat,
      p_lng: lng,
      p_radius_m: radiusM,
    }),
  ])

  if (regularResult.error || countResult.error) {
    console.error('[api/pins] radius search error', regularResult.error || countResult.error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }

  // Water tap radius query is best-effort — log error but don't fail the request
  if (waterTapResult.error) {
    console.error('[api/pins] water tap radius search error (non-fatal)', waterTapResult.error)
  }

  const regularPins = (regularResult.data as DbRadiusRow[]).map((r) => mapRadiusPin(r, 'regular'))
  const waterTapPins = waterTapResult.error
    ? []
    : (waterTapResult.data as DbRadiusRow[]).map((r) => mapRadiusPin(r, 'water_tap'))

  // Merge and sort by distance for a consistent spatial ordering
  const allPins = [...regularPins, ...waterTapPins].sort((a, b) => a.distanceM - b.distanceM)

  const regularCount: number = countResult.data ?? 0
  const total = regularCount + waterTapPins.length

  return res.status(200).json({ pins: allPins, total, limit, offset })
}

async function handleGetAllPins(res: VercelResponse) {
  const supabase = createServiceClient()

  // Query the unified map_pins view — returns both 'regular' and 'water_tap' pins
  const { data, error } = await supabase.from('map_pins').select('*')

  if (error) {
    console.error('[api/pins] getAllPins error', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }

  const pins = (data as DbMapPinRow[]).map(mapMapPin)
  return res.status(200).json({ pins, total: pins.length, limit: pins.length, offset: 0 })
}
