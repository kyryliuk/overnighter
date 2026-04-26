import { describe, it, expect } from 'vitest'
import { transformLegacyPlan } from './backfill-legacy-trip-plans'
import type { LegacyRow } from './backfill-legacy-trip-plans'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NOW = '2024-01-15T10:00:00Z'

function makeRow(overrides: Partial<LegacyRow> = {}): LegacyRow {
  return {
    user_id: 'user-uuid-1',
    plan_id: 'plan-abc-123',
    plan_snapshot: {
      title: 'My Road Trip',
      notes: 'Some notes',
      destination: { id: 'dest-1', name: 'Yellowstone NP', latitude: 44.4280, longitude: -110.5885 },
      stops: [
        { id: 'stop-1', name: 'Salt Lake City', latitude: 40.7608, longitude: -111.8910 },
        { id: 'stop-2', name: 'Twin Falls', latitude: 42.5628, longitude: -114.4609 },
      ],
      isPublic: false,
      shareToken: null,
      sourceTrip: null,
    },
    is_public: false,
    share_token: null,
    updated_at: NOW,
    ...overrides,
  }
}

// ─── transformLegacyPlan ─────────────────────────────────────────────────────

describe('transformLegacyPlan', () => {
  it('converts a valid plan with 2 waypoints into a trips row and 3 stop rows', () => {
    const result = transformLegacyPlan(makeRow())

    expect(result).not.toBeNull()
    const { trip, stops } = result!

    // trips row
    expect(trip.user_id).toBe('user-uuid-1')
    expect(trip.title).toBe('My Road Trip')
    expect(trip.notes).toBe('Some notes')
    expect(trip.status).toBe('draft')
    expect(trip.route_mode).toBe('corridor')
    expect(trip.stop_count).toBe(3)           // 2 waypoints + 1 destination
    expect(trip.revision).toBe(1)
    expect(trip.origin_snapshot).toBeNull()
    expect(trip.destination_snapshot).toEqual({
      id: 'dest-1', name: 'Yellowstone NP', latitude: 44.4280, longitude: -110.5885,
    })

    // stop rows
    expect(stops).toHaveLength(3)
    expect(stops[0]).toMatchObject({ stop_order: 0, stop_kind: 'waypoint', source: 'imported', notes: '' })
    expect(stops[0].place_snapshot).toMatchObject({ name: 'Salt Lake City' })
    expect(stops[1]).toMatchObject({ stop_order: 1, stop_kind: 'waypoint', source: 'imported' })
    expect(stops[1].place_snapshot).toMatchObject({ name: 'Twin Falls' })
    expect(stops[2]).toMatchObject({ stop_order: 2, stop_kind: 'destination', source: 'imported' })
    expect(stops[2].place_snapshot).toMatchObject({ name: 'Yellowstone NP' })
  })

  it('handles a plan with 0 waypoints — 1 stop (destination only), stop_count = 1', () => {
    const row = makeRow({
      plan_snapshot: {
        title: 'Simple Trip',
        notes: '',
        destination: { id: 'd-1', name: 'Zion NP', latitude: 37.2982, longitude: -113.0263 },
        stops: [],
      },
    })

    const result = transformLegacyPlan(row)

    expect(result).not.toBeNull()
    expect(result!.trip.stop_count).toBe(1)
    expect(result!.stops).toHaveLength(1)
    expect(result!.stops[0]).toMatchObject({
      stop_order: 0,
      stop_kind: 'destination',
      source: 'imported',
    })
  })

  it('preserves is_public=true and share_token on the trips row', () => {
    const row = makeRow({
      is_public: true,
      share_token: 'tok-xyz',
      plan_snapshot: {
        title: 'Public Trip',
        destination: { id: 'd-1', name: 'Grand Canyon', latitude: 36.1069, longitude: -112.1129 },
        stops: [],
        isPublic: true,
        shareToken: 'tok-xyz',
      },
    })

    const result = transformLegacyPlan(row)

    expect(result).not.toBeNull()
    expect(result!.trip.is_public).toBe(true)
    expect(result!.trip.share_token).toBe('tok-xyz')
  })

  it('maps sourceTrip.shareToken → source_share_token on the trips row', () => {
    const row = makeRow({
      plan_snapshot: {
        title: 'Imported from share',
        destination: { id: 'd-1', name: 'Arches NP', latitude: 38.7331, longitude: -109.5925 },
        stops: [],
        sourceTrip: { shareToken: 'origin-token-123', title: 'Original Trip' },
      },
    })

    const result = transformLegacyPlan(row)

    expect(result).not.toBeNull()
    expect(result!.trip.source_share_token).toBe('origin-token-123')
    expect(result!.trip.source_trip_id).toBeNull()
  })

  it('sets legacy_plan_id to the plan_id from the legacy row', () => {
    const row = makeRow({ plan_id: 'plan-id-99' })

    const result = transformLegacyPlan(row)

    expect(result).not.toBeNull()
    expect(result!.trip.legacy_plan_id).toBe('plan-id-99')
  })

  it('returns null when destination is missing', () => {
    const row = makeRow({
      plan_snapshot: {
        title: 'Bad Trip',
        stops: [],
        // no destination
      },
    })

    expect(transformLegacyPlan(row)).toBeNull()
  })

  it('returns null when destination is missing latitude', () => {
    const row = makeRow({
      plan_snapshot: {
        destination: { id: 'd-1', name: 'Bad Place', longitude: -110.0 }, // no latitude
        stops: [],
      },
    })

    expect(transformLegacyPlan(row)).toBeNull()
  })

  it('uses fallback title "Imported trip" when title is missing or blank', () => {
    const rowNoTitle = makeRow({
      plan_snapshot: {
        destination: { id: 'd-1', name: 'Glacier NP', latitude: 48.6, longitude: -113.7 },
        stops: [],
      },
    })

    const rowBlankTitle = makeRow({
      plan_snapshot: {
        title: '   ',
        destination: { id: 'd-1', name: 'Glacier NP', latitude: 48.6, longitude: -113.7 },
        stops: [],
      },
    })

    expect(transformLegacyPlan(rowNoTitle)!.trip.title).toBe('Imported trip')
    expect(transformLegacyPlan(rowBlankTitle)!.trip.title).toBe('Imported trip')
  })

  it('silently drops individual malformed waypoints without failing the entire trip', () => {
    const row = makeRow({
      plan_snapshot: {
        title: 'Partial Stops',
        destination: { id: 'd-1', name: 'Bryce Canyon', latitude: 37.5930, longitude: -112.1871 },
        stops: [
          { id: 's-1', name: 'Good Stop', latitude: 38.0, longitude: -111.0 },
          { bad: 'data' },  // malformed
          null,             // null entry
        ],
      },
    })

    const result = transformLegacyPlan(row)

    expect(result).not.toBeNull()
    // 1 valid waypoint + destination
    expect(result!.trip.stop_count).toBe(2)
    expect(result!.stops).toHaveLength(2)
    expect(result!.stops[0].stop_kind).toBe('waypoint')
    expect(result!.stops[1].stop_kind).toBe('destination')
  })

  it('preserves created_at and updated_at from the legacy row updated_at', () => {
    const row = makeRow({ updated_at: '2023-06-01T08:00:00Z' })

    const result = transformLegacyPlan(row)

    expect(result).not.toBeNull()
    expect(result!.trip.created_at).toBe('2023-06-01T08:00:00Z')
    expect(result!.trip.updated_at).toBe('2023-06-01T08:00:00Z')
    expect(result!.stops[0].created_at).toBe('2023-06-01T08:00:00Z')
  })
})
