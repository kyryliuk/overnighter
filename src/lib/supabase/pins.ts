import { supabase } from '@/lib/supabase/client'
import type { DbPin } from '@/lib/supabase/types'
import type { Pin, PinAmenities, BadgeColor, PinSource } from '@/types/pin'

export function dbPinToPin(db: DbPin): Pin {
  return {
    id: db.id,
    name: db.name,
    description: db.description,
    latitude: db.latitude,
    longitude: db.longitude,
    pinType: db.pin_type as PinSource,
    sourceId: db.source_id,
    maxLengthFt: db.max_length_ft,
    maxHeightFt: db.max_height_ft,
    website: db.website,
    phone: db.phone,
    elevationM: db.elevation_m,
    amenities: db.amenities as unknown as PinAmenities,
    badgeState: db.badge_state as BadgeColor,
    lastCheckInAt: db.last_check_in_at,
    recentCheckInCount: db.recent_check_in_count,
    isVerified: db.is_verified,
    isFlagged: db.is_flagged,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  }
}

export async function getAllPins(): Promise<Pin[]> {
  const { data, error } = await supabase.from('pins').select('*').eq('is_archived', false)
  if (error) throw new Error(`Failed to fetch pins: ${error.message}`)
  return (data as DbPin[]).map(dbPinToPin)
}

export interface RadiusPin extends Pin {
  distanceM: number
}

export interface RadiusSearchResult {
  pins: RadiusPin[]
  total: number
  limit: number
  offset: number
}

export async function fetchPinsByRadius(
  lat: number,
  lng: number,
  radiusM: number,
  limit = 200,
  offset = 0,
): Promise<RadiusSearchResult> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radiusM: String(radiusM),
    limit: String(limit),
    offset: String(offset),
  })
  const res = await fetch(`/api/pins?${params}`)
  if (!res.ok) throw new Error(`Radius search failed: ${res.status}`)
  return res.json()
}
