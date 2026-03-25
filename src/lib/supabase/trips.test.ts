import { describe, expect, it } from 'vitest'
import { dbTripStopToTripStop, dbTripToTrip } from './trips'
import type { DbTrip, DbTripStop } from './types'

const DESTINATION_SNAPSHOT = {
  id: 'place-destination',
  name: 'Moab',
  latitude: 38.5733,
  longitude: -109.5498,
}

const WAYPOINT_SNAPSHOT = {
  id: 'place-waypoint',
  name: 'Fruita',
  latitude: 39.1589,
  longitude: -108.7289,
}

function createDbTripStop(overrides: Partial<DbTripStop> = {}): DbTripStop {
  return {
    id: 'stop-1',
    trip_id: 'trip-1',
    stop_order: 0,
    stop_kind: 'waypoint',
    source: 'saved',
    pin_id: 'pin-1',
    place_snapshot: WAYPOINT_SNAPSHOT,
    notes: 'overnight stop',
    created_at: '2026-03-25T00:00:00.000Z',
    updated_at: '2026-03-25T01:00:00.000Z',
    ...overrides,
  }
}

function createDbTrip(overrides: Partial<DbTrip & { trip_stops?: DbTripStop[] | null }> = {}) {
  return {
    id: 'trip-1',
    user_id: 'user-1',
    title: 'Desert loop',
    notes: 'Bring water',
    status: 'draft',
    origin_snapshot: null,
    destination_snapshot: DESTINATION_SNAPSHOT,
    route_mode: 'corridor',
    stop_count: 2,
    revision: 3,
    is_public: false,
    share_token: null,
    source_trip_id: null,
    source_share_token: null,
    created_at: '2026-03-25T00:00:00.000Z',
    updated_at: '2026-03-25T02:00:00.000Z',
    trip_stops: [
      createDbTripStop({ id: 'stop-2', stop_order: 1, stop_kind: 'destination', source: 'manual', pin_id: null, place_snapshot: DESTINATION_SNAPSHOT, notes: '' }),
      createDbTripStop(),
    ],
    ...overrides,
  }
}

describe('dbTripStopToTripStop', () => {
  it('maps snake_case fields into trip stop domain fields', () => {
    const tripStop = dbTripStopToTripStop(createDbTripStop())

    expect(tripStop).toEqual({
      id: 'stop-1',
      stopOrder: 0,
      stopKind: 'waypoint',
      source: 'saved',
      pinId: 'pin-1',
      place: WAYPOINT_SNAPSHOT,
      notes: 'overnight stop',
      createdAt: '2026-03-25T00:00:00.000Z',
      updatedAt: '2026-03-25T01:00:00.000Z',
    })
  })
})

describe('dbTripToTrip', () => {
  it('maps trips and sorts normalized stops by stop order', () => {
    const trip = dbTripToTrip(createDbTrip())

    expect(trip.id).toBe('trip-1')
    expect(trip.destination).toEqual(DESTINATION_SNAPSHOT)
    expect(trip.stopCount).toBe(2)
    expect(trip.revision).toBe(3)
    expect(trip.stops.map((stop) => stop.stopOrder)).toEqual([0, 1])
    expect(trip.stops[0].place).toEqual(WAYPOINT_SNAPSHOT)
    expect(trip.stops[1].stopKind).toBe('destination')
  })

  it('throws when the destination snapshot is malformed', () => {
    expect(() =>
      dbTripToTrip(
        createDbTrip({
          destination_snapshot: { id: 'bad' },
        }),
      ),
    ).toThrow('Invalid trip destination snapshot')
  })
})
