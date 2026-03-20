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
  badge_state: 'green' | 'yellow' | 'red' | 'grey'
  last_check_in_at: null
  recent_check_in_count: number
  is_verified: boolean
  is_flagged: boolean
}

// ---------------------------------------------------------------------------
// Shared amenity detection helpers — reusable across all sync sources
// ---------------------------------------------------------------------------

/** Returns true if any activity name contains one of the given substrings (case-insensitive). */
export function hasActivity(activities: string[], ...terms: string[]): boolean {
  return activities.some((a) => terms.some((t) => a.includes(t)))
}

/**
 * Convert a simple HTML string (as returned by RIDB) to Markdown.
 * Handles the subset of tags RIDB actually uses: h1-h3, p, strong, em, a, br, ul/ol/li.
 */
export function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<\/?(ul|ol)[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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
 * Pins from official government sources (BLM/USFS/NPS) are marked is_verified=true.
 */
export function normalizeRidbFacility(facility: RidbFacility): DbPinInsert | null {
  if (!facility.FacilityLatitude || !facility.FacilityLongitude) return null

  const pinType = RIDB_ORG_TO_SOURCE[facility.ParentOrgID]
  if (!pinType) return null

  const activities = (facility.ACTIVITY ?? []).map((a) => a.ActivityName.toLowerCase())

  const amenities: Record<string, boolean> = {
    overnight: hasActivity(activities, 'camping', 'overnight', 'rv camping', 'tent camping'),
    dump:      hasActivity(activities, 'dump station', 'dump'),
    water:     hasActivity(activities, 'drinking water', 'water hookup', 'water'),
    electric:  hasActivity(activities, 'electricity hookup', 'electrical hookup', 'electric hookup', 'electric'),
    shower:    hasActivity(activities, 'shower'),
    fuel:      hasActivity(activities, 'gas station', 'fuel'),
    propane:   hasActivity(activities, 'propane'),
    toilets:   hasActivity(activities, 'flush toilet', 'vault toilet', 'pit toilet', 'toilet', 'restroom'),
    pets:      hasActivity(activities, 'pets allowed', 'pet friendly', 'leashed pets', 'dogs allowed'),
  }

  return {
    name:                  facility.FacilityName,
    description:           facility.FacilityDescription ? htmlToMarkdown(facility.FacilityDescription) : null,
    latitude:              facility.FacilityLatitude,
    longitude:             facility.FacilityLongitude,
    pin_type:              pinType,
    source_id:             facility.FacilityID,
    max_length_ft:         null,
    max_height_ft:         null,
    amenities,
    badge_state:           'green',
    last_check_in_at:      null,
    recent_check_in_count: 0,
    is_verified:           true,
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
    water:     amenity === 'drinking_water' || tags['drinking_water'] === 'yes',
    fuel:      amenity === 'fuel',
    propane:   false,
    electric:  tags['electric_hookup'] === 'yes' || tags['electricity'] === 'yes',
    shower:    amenity === 'shower' || tags['shower'] === 'yes',
    toilets:   amenity === 'toilets' || tags['toilets'] === 'yes' || tags['toilets:disposal'] !== undefined,
    pets:      tags['dogs'] === 'yes' || tags['dog'] === 'yes' || tags['pets'] === 'yes',
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
