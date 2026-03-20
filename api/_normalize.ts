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
  website: string | null
  phone: string | null
  elevation_m: number | null
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

/** Returns true if the plain-text description contains one of the given substrings (case-insensitive). */
export function hasText(text: string, ...terms: string[]): boolean {
  const lower = text.toLowerCase()
  return terms.some((t) => lower.includes(t.toLowerCase()))
}

/**
 * Detect entertainment/outdoor activities from both an activities array and
 * a free-text description. Used for RIDB sync where descriptions are rich.
 */
export function detectEntertainmentAmenities(
  activities: string[],
  descriptionText: string,
): Record<string, boolean> {
  const a = (acts: string[], ...terms: string[]) => hasActivity(acts, ...terms)
  const t = (...terms: string[]) => hasText(descriptionText, ...terms)

  return {
    hiking:       a(activities, 'hiking', 'backpacking', 'hiking trail', 'trail running', 'difficult hiking', 'trails')
                  || t('hiking', 'backpacking', 'trail', 'trekking'),
    fishing:      a(activities, 'fishing', 'fly fishing', 'ice fishing', 'crawfishing')
                  || t('fishing', 'angling', 'trout', 'bass fishing'),
    swimming:     a(activities, 'swimming', 'accessible swimming', 'beach camping', 'beachcombing', 'clam digging', 'swimming site')
                  || t('swimming', 'swim beach', 'swimming hole'),
    boating:      a(activities, 'boating', 'kayaking', 'canoeing', 'paddling', 'rafting', 'motor boat',
                    'non-motorized boating', 'sailing', 'paddle boating', 'sea kayaking',
                    'jet skiing', 'water skiing', 'windsurfing', 'surfing', 'tubing', 'whitewater rafting',
                    'river trips', 'water activities', 'water sports', 'marina', 'boat rental')
                  || t('kayak', 'canoe', 'boat ramp', 'boat launch', 'paddling', 'rafting'),
    biking:       a(activities, 'biking', 'mountain biking', 'e-biking', 'fat tire biking')
                  || t('biking', 'cycling', 'bike trail', 'mountain bike'),
    ohv:          a(activities, 'off highway vehicle', 'off road vehicle', 'all terrain', 'ohv use', 'snowmobile')
                  || t('ohv', 'atv', 'off-road', 'off highway', 'dirt bike'),
    climbing:     a(activities, 'climbing', 'rock climbing', 'mountain climbing', 'ice climbing', 'bouldering', 'canyoneering')
                  || t('rock climbing', 'bouldering', 'canyoneering', 'rappelling'),
    winter_sports: a(activities, 'skiing', 'snowboarding', 'snowshoeing', 'snowmobile', 'snow tubing',
                     'sledding', 'ice skating', 'cross country skiing', 'downhill skiing', 'skate skiing',
                     'skijoring', 'snow fat tire biking', 'dog mushing', 'winter sports')
                  || t('ski', 'snowboard', 'snowshoe', 'cross-country skiing', 'nordic'),
    hunting:      a(activities, 'hunting', 'trapping', 'recreational shooting', 'shooting range', 'archery')
                  || t('hunting', 'deer hunting', 'elk hunting', 'waterfowl'),
    wildlife:     a(activities, 'wildlife viewing', 'bird watching', 'birding', 'wild horse viewing',
                    'whale watching', 'fish viewing site', 'star gazing', 'stargazing')
                  || t('wildlife', 'birding', 'birdwatch', 'nature viewing', 'stargazing'),
    horseback:    a(activities, 'horseback riding', 'horse camping')
                  || t('horseback', 'equestrian', 'horse trail', 'horse camp'),
    hot_springs:  a(activities, 'hot springs soaking', 'hot springs')
                  || t('hot spring', 'hot springs', 'thermal'),
  }
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
  FacilityPhone?: string
  FacilityWebURL?: string
  FacilityElevation?: number
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

  const descText = facility.FacilityDescription ?? ''

  const amenities: Record<string, boolean> = {
    // Infrastructure
    overnight:  hasActivity(activities, 'camping', 'overnight', 'rv camping', 'tent camping'),
    dump:       hasActivity(activities, 'dump station', 'dump'),
    water:      hasActivity(activities, 'drinking water', 'water hookup', 'water'),
    electric:   hasActivity(activities, 'electricity hookup', 'electrical hookup', 'electric hookup', 'electric'),
    shower:     hasActivity(activities, 'shower'),
    fuel:       hasActivity(activities, 'gas station', 'fuel'),
    propane:    hasActivity(activities, 'propane'),
    toilets:    hasActivity(activities, 'flush toilet', 'vault toilet', 'pit toilet', 'toilet', 'restroom'),
    pets:       hasActivity(activities, 'pets allowed', 'pet friendly', 'leashed pets', 'dogs allowed', 'dogs on leash'),
    wifi:       hasActivity(activities, 'wifi', 'wireless internet', 'internet'),
    kitchen:    hasActivity(activities, 'kitchen'),
    restaurant: hasActivity(activities, 'restaurant', 'food service', 'dining'),
    big_rig:    hasActivity(activities, 'rv camping', 'rv park', 'rv hookup', 'recreational vehicles', 'long term visitor area'),
    tent:       hasActivity(activities, 'tent camping', 'tent only', 'dispersed camping', 'beach camping'),
    // Entertainment — detected from both activities list and description text
    ...detectEntertainmentAmenities(activities, descText),
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
    website:               facility.FacilityWebURL ?? null,
    phone:                 facility.FacilityPhone ?? null,
    elevation_m:           facility.FacilityElevation ?? null,
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
    // Infrastructure
    overnight:     tourism === 'camp_site' || tourism === 'caravan_site',
    dump:          amenity === 'waste_disposal',
    water:         amenity === 'drinking_water' || tags['drinking_water'] === 'yes',
    fuel:          amenity === 'fuel',
    propane:       false,
    electric:      tags['electric_hookup'] === 'yes' || tags['electricity'] === 'yes',
    shower:        amenity === 'shower' || tags['shower'] === 'yes',
    toilets:       amenity === 'toilets' || tags['toilets'] === 'yes' || tags['toilets:disposal'] !== undefined,
    pets:          tags['dogs'] === 'yes' || tags['dog'] === 'yes' || tags['pets'] === 'yes',
    wifi:          tags['internet_access'] === 'wlan' || tags['wifi'] === 'yes',
    kitchen:       false,
    restaurant:    amenity === 'restaurant' || amenity === 'cafe' || amenity === 'fast_food',
    big_rig:       tourism === 'caravan_site',
    tent:          tourism === 'camp_site',
    // Entertainment — OSM tags
    hiking:        tags['hiking'] === 'yes' || tags['route'] === 'hiking',
    fishing:       tags['fishing'] === 'yes',
    swimming:      tags['swimming'] === 'yes' || amenity === 'swimming_pool' || tags['leisure'] === 'swimming_area',
    boating:       tags['boat'] === 'yes' || tags['leisure'] === 'marina' || tags['leisure'] === 'slipway',
    biking:        tags['bicycle'] === 'yes' || tags['mtb'] === 'yes',
    ohv:           tags['atv'] === 'yes' || tags['4wd_only'] === 'yes',
    climbing:      tags['climbing'] === 'yes' || tags['sport'] === 'climbing',
    winter_sports: tags['ski'] === 'yes' || tags['sport'] === 'skiing',
    hunting:       tags['hunting'] === 'yes',
    wildlife:      tags['wildlife'] === 'yes' || tags['bird_watching'] === 'yes',
    horseback:     tags['horse'] === 'yes' || tags['equestrian'] === 'yes',
    hot_springs:   tags['natural'] === 'hot_spring' || tags['amenity'] === 'hot_spring',
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
    website:               tags['website'] ?? tags['url'] ?? null,
    phone:                 tags['phone'] ?? tags['contact:phone'] ?? null,
    elevation_m:           null,
    amenities,
    badge_state:           'grey',
    last_check_in_at:      null,
    recent_check_in_count: 0,
    is_verified:           false,
    is_flagged:            false,
  }
}
