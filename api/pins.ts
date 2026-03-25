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

interface DbRadiusRow {
  id: string
  name: string
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
  location: string | null
  created_at: string
  updated_at: string
  distance_m: number
}

function mapRadiusPin(db: DbRadiusRow) {
  return {
    id: db.id,
    name: db.name,
    description: db.description,
    latitude: db.latitude,
    longitude: db.longitude,
    pinType: db.pin_type,
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

interface DbPinRow {
  id: string
  name: string
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
  is_archived: boolean
  location: string | null
  created_at: string
  updated_at: string
}

function mapPin(db: DbPinRow) {
  return {
    id: db.id,
    name: db.name,
    description: db.description,
    latitude: db.latitude,
    longitude: db.longitude,
    pinType: db.pin_type,
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

  const [{ data, error }, { data: total, error: countError }] = await Promise.all([
    supabase.rpc('search_pins_by_radius', {
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

  if (error || countError) {
    console.error('[api/pins] radius search error', error || countError)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }

  const pins = (data as DbRadiusRow[]).map(mapRadiusPin)
  return res.status(200).json({ pins, total: total ?? 0, limit, offset })
}

async function handleGetAllPins(res: VercelResponse) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('pins').select('*').eq('is_archived', false)

  if (error) {
    console.error('[api/pins] getAllPins error', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }

  const pins = (data as DbPinRow[]).map(mapPin)
  return res.status(200).json({ pins, total: pins.length, limit: pins.length, offset: 0 })
}
