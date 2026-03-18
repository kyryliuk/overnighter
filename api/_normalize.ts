// ---------------------------------------------------------------------------
// Normalization functions: external API responses → Supabase pin insert rows
// Pure functions — no Supabase calls, no HTTP calls, testable in isolation.
//
// Note: Types are defined here (not imported from src/) because api/ files
// compile under tsconfig.api.json which does not include src/ paths.
// ---------------------------------------------------------------------------

export type PinTypeValue = 'blm' | 'usfs' | 'nps' | 'overpass' | 'community'

/** Shape for inserting a new pin row — excludes auto-generated fields */
export interface DbPinInsert {
  name: string
  description: string | null
  latitude: number
  longitude: number
  pin_type: PinTypeValue
  source_id: string
  max_length_ft: number | null
  max_height_ft: number | null
  amenities: Record<string, boolean>
  badge_state: 'grey'
  last_check_in_at: null
  recent_check_in_count: number
  is_verified: boolean
  is_flagged: boolean
}

// ---------------------------------------------------------------------------
// RIDB (recreation.gov) normalization
// ---------------------------------------------------------------------------

/** ParentOrgID → pin_type mapping (verified against RIDB API documentation) */
const RIDB_ORG_TO_SOURCE: Record<string, PinTypeValue | undefined> = {
  '128': 'usfs', // US Forest Service
  '129': 'nps',  // National Park Service
  '131': 'blm',  // Bureau of Land Management
}

export interface RidbFacility {
  FacilityID: string
  FacilityName: string
  FacilityLatitude: number
  FacilityLongitude: number
  FacilityDescription?: string
  ParentOrgID: string
  ACTIVITY?: Array<{ ActivityName: string }>
}

/**
 * Normalize a single RIDB facility record to a Supabase insert row.
 * Returns null if the facility lacks coordinates or has an unknown org.
 */
export function normalizeRidbFacility(facility: RidbFacility): DbPinInsert | null {
  if (!facility.FacilityLatitude || !facility.FacilityLongitude) return null

  const pinType = RIDB_ORG_TO_SOURCE[facility.ParentOrgID]
  if (!pinType) return null

  const activities = (facility.ACTIVITY ?? []).map((a) => a.ActivityName.toLowerCase())

  const amenities: Record<string, boolean> = {
    overnight: activities.some((a) => a.includes('camping') || a.includes('overnight')),
    dump:      activities.some((a) => a.includes('dump')),
    water:     activities.some((a) => a.includes('water')),
    fuel:      false,
    propane:   false,
    electric:  activities.some((a) => a.includes('electric')),
    shower:    activities.some((a) => a.includes('shower')),
  }

  return {
    name:                  facility.FacilityName,
    description:           facility.FacilityDescription ?? null,
    latitude:              facility.FacilityLatitude,
    longitude:             facility.FacilityLongitude,
    pin_type:              pinType,
    source_id:             facility.FacilityID,
    max_length_ft:         null,
    max_height_ft:         null,
    amenities,
    badge_state:           'grey',
    last_check_in_at:      null,
    recent_check_in_count: 0,
    is_verified:           false,
    is_flagged:            false,
  }
}

// ---------------------------------------------------------------------------
// OpenStreetMap Overpass normalization
// ---------------------------------------------------------------------------

export interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  tags?: Record<string, string>
}

/**
 * Normalize a single Overpass element to a Supabase insert row.
 * Returns null if the element lacks coordinates.
 */
export function normalizeOverpassElement(el: OverpassElement): DbPinInsert | null {
  if (el.lat === undefined || el.lon === undefined) return null

  const tags = el.tags ?? {}
  const amenity = tags['amenity'] ?? ''
  const tourism = tags['tourism'] ?? ''

  const amenities: Record<string, boolean> = {
    overnight: tourism === 'camp_site' || tourism === 'caravan_site',
    dump:      amenity === 'waste_disposal',
    water:     amenity === 'drinking_water',
    fuel:      amenity === 'fuel',
    propane:   false,
    electric:  false,
    shower:    amenity === 'shower',
  }

  const name = tags['name'] ?? tags['operator'] ?? `OSM ${el.id}`

  return {
    name,
    description:           null,
    latitude:              el.lat,
    longitude:             el.lon,
    pin_type:              'overpass',
    source_id:             String(el.id),
    max_length_ft:         null,
    max_height_ft:         null,
    amenities,
    badge_state:           'grey',
    last_check_in_at:      null,
    recent_check_in_count: 0,
    is_verified:           false,
    is_flagged:            false,
  }
}
