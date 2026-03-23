import { describe, it, expect } from 'vitest'
import {
  normalizeRidbFacility,
  normalizeOverpassElement,
  type RidbFacility,
  type OverpassElement,
} from './_normalize'

// ── Helper builders ────────────────────────────────────────────────────────

function ridbFacility(overrides: Partial<RidbFacility> = {}): RidbFacility {
  return {
    FacilityID: 'F001',
    FacilityName: 'Test Campground',
    FacilityLatitude: 37.5,
    FacilityLongitude: -107.5,
    FacilityDescription: 'Nice spot',
    ParentOrgID: '128', // USFS default
    ACTIVITY: [],
    ...overrides,
  }
}

function overpassNode(overrides: Partial<OverpassElement> = {}): OverpassElement {
  return {
    type: 'node',
    id: 12345,
    lat: 38.0,
    lon: -105.0,
    tags: {},
    ...overrides,
  }
}

// ── normalizeRidbFacility ──────────────────────────────────────────────────

describe('normalizeRidbFacility', () => {
  it('maps USFS org (128) to pin_type usfs', () => {
    const result = normalizeRidbFacility(ridbFacility({ ParentOrgID: '128' }))
    expect(result?.pin_type).toBe('usfs')
  })

  it('maps NPS org (129) to pin_type nps', () => {
    const result = normalizeRidbFacility(ridbFacility({ ParentOrgID: '129' }))
    expect(result?.pin_type).toBe('nps')
  })

  it('maps BLM org (131) to pin_type blm', () => {
    const result = normalizeRidbFacility(ridbFacility({ ParentOrgID: '131' }))
    expect(result?.pin_type).toBe('blm')
  })

  it('returns null for unknown org ID', () => {
    const result = normalizeRidbFacility(ridbFacility({ ParentOrgID: '999' }))
    expect(result).toBeNull()
  })

  it('returns null when latitude is 0 (missing)', () => {
    const result = normalizeRidbFacility(ridbFacility({ FacilityLatitude: 0 }))
    expect(result).toBeNull()
  })

  it('returns null when longitude is 0 (missing)', () => {
    const result = normalizeRidbFacility(ridbFacility({ FacilityLongitude: 0 }))
    expect(result).toBeNull()
  })

  it('uses FacilityID as source_id', () => {
    const result = normalizeRidbFacility(ridbFacility({ FacilityID: 'FAC-9999' }))
    expect(result?.source_id).toBe('FAC-9999')
  })

  it('sets badge_state to grey for new synced pins', () => {
    const result = normalizeRidbFacility(ridbFacility())
    expect(result?.badge_state).toBe('grey')
  })

  it('sets overnight amenity when ACTIVITY contains camping', () => {
    const result = normalizeRidbFacility(ridbFacility({
      ACTIVITY: [{ ActivityName: 'Camping' }],
    }))
    expect(result?.amenities.overnight).toBe(true)
  })

  it('sets electric amenity when ACTIVITY contains electric', () => {
    const result = normalizeRidbFacility(ridbFacility({
      ACTIVITY: [{ ActivityName: 'Electric Hookup' }],
    }))
    expect(result?.amenities.electric).toBe(true)
  })

  it('all amenities false when ACTIVITY is empty', () => {
    const result = normalizeRidbFacility(ridbFacility({ ACTIVITY: [] }))
    expect(result?.amenities.overnight).toBe(false)
    expect(result?.amenities.dump).toBe(false)
    expect(result?.amenities.water).toBe(false)
  })
})

// ── normalizeOverpassElement ───────────────────────────────────────────────

describe('normalizeOverpassElement', () => {
  it('returns null when lat is undefined', () => {
    const result = normalizeOverpassElement(overpassNode({ lat: undefined }))
    expect(result).toBeNull()
  })

  it('returns null when lon is undefined', () => {
    const result = normalizeOverpassElement(overpassNode({ lon: undefined }))
    expect(result).toBeNull()
  })

  it('maps drinking_water amenity to amenities.water = true', () => {
    const result = normalizeOverpassElement(
      overpassNode({ tags: { amenity: 'drinking_water' } })
    )
    expect(result?.amenities.water).toBe(true)
    expect(result?.pin_type).toBe('overpass')
  })

  it('maps fuel amenity to amenities.fuel = true', () => {
    const result = normalizeOverpassElement(
      overpassNode({ tags: { amenity: 'fuel' } })
    )
    expect(result?.amenities.fuel).toBe(true)
  })

  it('maps waste_disposal amenity to amenities.dump = true', () => {
    const result = normalizeOverpassElement(
      overpassNode({ tags: { amenity: 'waste_disposal' } })
    )
    expect(result?.amenities.dump).toBe(true)
  })

  it('maps camp_site tourism to amenities.overnight = true', () => {
    const result = normalizeOverpassElement(
      overpassNode({ tags: { tourism: 'camp_site' } })
    )
    expect(result?.amenities.overnight).toBe(true)
  })

  it('uses OSM node id as source_id', () => {
    const result = normalizeOverpassElement(overpassNode({ id: 99887766 }))
    expect(result?.source_id).toBe('99887766')
  })

  it('uses name tag as pin name when available', () => {
    const result = normalizeOverpassElement(
      overpassNode({ tags: { name: 'River Spring', amenity: 'drinking_water' } })
    )
    expect(result?.name).toBe('River Spring')
  })

  it('falls back to OSM {id} name when no name tag', () => {
    const result = normalizeOverpassElement(overpassNode({ id: 12345, tags: {} }))
    expect(result?.name).toBe('OSM 12345')
  })

  it('sets badge_state to grey', () => {
    const result = normalizeOverpassElement(overpassNode({ tags: { amenity: 'fuel' } }))
    expect(result?.badge_state).toBe('grey')
  })
})
