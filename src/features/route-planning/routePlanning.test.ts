import { describe, expect, it } from 'vitest'
import { buildDirectionsUrl, GOOGLE_MAPS_MAX_WAYPOINTS } from '@/lib/maps/googleMaps'
import type { Pin } from '@/types/pin'
import { DEFAULT_RIG_PROFILE } from '@/types/rigProfile'
import type { Trip } from '@/types/trip'
import type { TripPlanPlace } from '@/types/tripPlan'
import {
  appendTripWaypoint,
  appendUniqueWaypoint,
  buildDuplicateTripPayload,
  buildTripCorridorPreview,
  buildRouteSuggestions,
  compactTripWaypointOrders,
  DEFAULT_ROUTE_SUGGESTION_LIMIT,
  MAX_TRIP_STOPS_MESSAGE,
  MIN_ROUTE_SUGGESTION_TRIP_DISTANCE_MILES,
  moveWaypoint,
  pinToTripWaypointInput,
  removeTripWaypoint,
} from './routePlanning'

function makePin(overrides: Partial<Pin> = {}): Pin {
  return {
    id: 'pin-1',
    name: 'Test Pin',
    description: null,
    latitude: 39,
    longitude: -104,
    pinType: 'community',
    sourceId: null,
    maxLengthFt: null,
    maxHeightFt: null,
    website: null,
    phone: null,
    elevationM: null,
    amenities: {
      water: false,
      dump: false,
      electric: false,
      shower: false,
      fuel: false,
      propane: false,
      overnight: true,
      toilets: false,
      pets: false,
      wifi: false,
      kitchen: false,
      restaurant: false,
      big_rig: true,
      tent: false,
      hiking: false,
      fishing: false,
      swimming: false,
      boating: false,
      biking: false,
      ohv: false,
      climbing: false,
      winter_sports: false,
      hunting: false,
      wildlife: false,
      horseback: false,
      hot_springs: false,
    },
    badgeState: 'green',
    lastCheckInAt: null,
    recentCheckInCount: 0,
    isVerified: true,
    isFlagged: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('buildDirectionsUrl', () => {
  it('builds a Google Maps directions URL with waypoints', () => {
    const url = buildDirectionsUrl({
      origin: { latitude: 39, longitude: -105 },
      destination: { latitude: 41, longitude: -110 },
      waypoints: [
        { latitude: 40, longitude: -106 },
        { latitude: 40.5, longitude: -108 },
      ],
    })

    expect(url).toContain('https://www.google.com/maps/dir/?')
    expect(url).toContain('origin=39%2C-105')
    expect(url).toContain('destination=41%2C-110')
    expect(url).toContain('waypoints=40%2C-106%7C40.5%2C-108')
  })

  it('omits the origin when current location is unavailable', () => {
    const url = buildDirectionsUrl({
      destination: { latitude: 41, longitude: -110 },
    })

    expect(url).toContain('destination=41%2C-110')
    expect(url).not.toContain('origin=')
  })

  it('acts as a safety-net cap at GOOGLE_MAPS_MAX_WAYPOINTS — callers should guard before reaching this limit', () => {
    const waypoints = Array.from({ length: GOOGLE_MAPS_MAX_WAYPOINTS + 2 }, (_, i) => ({
      latitude: 39 + i * 0.5,
      longitude: -105 - i * 0.5,
    }))

    const url = buildDirectionsUrl({
      destination: { latitude: 41, longitude: -110 },
      waypoints,
    })

    const waypointsParam = new URL(url).searchParams.get('waypoints') ?? ''
    expect(waypointsParam.split('|')).toHaveLength(GOOGLE_MAPS_MAX_WAYPOINTS)
  })
})

describe('buildRouteSuggestions', () => {
  it('returns rig-fit overnight stops near the trip corridor', () => {
    const suggestions = buildRouteSuggestions({
      origin: { latitude: 39, longitude: -105 },
      destination: { latitude: 41, longitude: -109 },
      rigProfile: { ...DEFAULT_RIG_PROFILE, rigType: 'Class A', lengthFt: 34, heightFt: 12 },
      pins: [
        makePin({ id: 'good', name: 'Great Stop', latitude: 40, longitude: -107 }),
        makePin({ id: 'tiny', name: 'Too Small', latitude: 40.1, longitude: -107.2, maxLengthFt: 20 }),
        makePin({ id: 'far', name: 'Far Away', latitude: 43, longitude: -100 }),
        makePin({ id: 'stale', name: 'Stale Stop', latitude: 40.2, longitude: -107.1, badgeState: 'red' }),
      ],
    })

    expect(suggestions.map((suggestion) => suggestion.pin.id)).toEqual(['good', 'stale'])
  })

  it('returns no suggestions when the trip is too short', () => {
    const suggestions = buildRouteSuggestions({
      origin: { latitude: 39, longitude: -105 },
      destination: { latitude: 39, longitude: -105 + (MIN_ROUTE_SUGGESTION_TRIP_DISTANCE_MILES / 400) },
      rigProfile: DEFAULT_RIG_PROFILE,
      pins: [makePin({ id: 'good', latitude: 39.05, longitude: -105.1 })],
    })

    expect(suggestions).toEqual([])
  })

  it('prefers lower-penalty suggestions and respects the requested limit', () => {
    const suggestions = buildRouteSuggestions({
      origin: { latitude: 39, longitude: -105 },
      destination: { latitude: 41, longitude: -109 },
      rigProfile: DEFAULT_RIG_PROFILE,
      limit: 2,
      pins: [
        makePin({ id: 'best', name: 'Best Stop', latitude: 40, longitude: -107, badgeState: 'green', isVerified: true }),
        makePin({ id: 'good', name: 'Good Stop', latitude: 40.05, longitude: -107.05, badgeState: 'yellow', isVerified: true }),
        makePin({ id: 'worse', name: 'Worse Stop', latitude: 40.1, longitude: -107.1, badgeState: 'red', isVerified: false }),
      ],
    })

    expect(DEFAULT_ROUTE_SUGGESTION_LIMIT).toBeGreaterThanOrEqual(2)
    expect(suggestions).toHaveLength(2)
    expect(suggestions.map((suggestion) => suggestion.pin.id)).toEqual(['best', 'good'])
    expect(suggestions[0].score).toBeLessThan(suggestions[1].score)
  })
})

describe('trip waypoint helpers', () => {
  const WAYPOINTS: TripPlanPlace[] = [
    { id: 'a', name: 'Alpha', latitude: 1, longitude: 1 },
    { id: 'b', name: 'Bravo', latitude: 2, longitude: 2 },
    { id: 'c', name: 'Charlie', latitude: 3, longitude: 3 },
  ]

  it('adds a waypoint when it is not already selected', () => {
    const next = appendUniqueWaypoint(WAYPOINTS.slice(0, 1), WAYPOINTS[1])
    expect(next.map((waypoint) => waypoint.id)).toEqual(['a', 'b'])
  })

  it('removes a waypoint when it is already selected', () => {
    const next = appendUniqueWaypoint(WAYPOINTS.slice(0, 2), WAYPOINTS[1])
    expect(next.map((waypoint) => waypoint.id)).toEqual(['a'])
  })

  it('moves a waypoint up or down while preserving the rest', () => {
    expect(moveWaypoint(WAYPOINTS, 2, 'up').map((waypoint) => waypoint.id)).toEqual(['a', 'c', 'b'])
    expect(moveWaypoint(WAYPOINTS, 0, 'down').map((waypoint) => waypoint.id)).toEqual(['b', 'a', 'c'])
  })
})

describe('normalized trip stop helpers', () => {
  it('appends a new normalized waypoint with the next sequential stopOrder', () => {
    const first = pinToTripWaypointInput(makePin({ id: 'pin-a', name: 'Alpha' }), 'saved')
    const second = pinToTripWaypointInput(makePin({ id: 'pin-b', name: 'Bravo' }), 'manual')

    const afterFirst = appendTripWaypoint([], first, { destinationId: 'pin-dest' })
    const afterSecond = appendTripWaypoint(afterFirst.stops, second, { destinationId: 'pin-dest' })

    expect(afterFirst.error).toBeNull()
    expect(afterSecond.error).toBeNull()
    expect(afterSecond.stops).toEqual([
      expect.objectContaining({ stopOrder: 0, source: 'saved', pinId: 'pin-a', place: expect.objectContaining({ id: 'pin-a' }) }),
      expect.objectContaining({ stopOrder: 1, source: 'manual', pinId: 'pin-b', place: expect.objectContaining({ id: 'pin-b' }) }),
    ])
  })

  it('blocks duplicate place ids including the destination', () => {
    const first = pinToTripWaypointInput(makePin({ id: 'pin-a', name: 'Alpha' }))

    expect(appendTripWaypoint([first], pinToTripWaypointInput(makePin({ id: 'pin-a', name: 'Alpha Again' })), { destinationId: 'pin-dest' }).error)
      .toBe('That stop is already part of this route.')
    expect(appendTripWaypoint([], pinToTripWaypointInput(makePin({ id: 'pin-dest', name: 'Destination' })), { destinationId: 'pin-dest' }).error)
      .toBe('That stop is already part of this route.')
  })

  it('blocks duplicate place ids when the origin matches the next stop', () => {
    const first = pinToTripWaypointInput(makePin({ id: 'pin-a', name: 'Alpha' }))

    expect(
      appendTripWaypoint(
        [first],
        pinToTripWaypointInput(makePin({ id: 'pin-origin', name: 'Flagstaff' })),
        { originId: 'pin-origin', destinationId: 'pin-dest' },
      ).error,
    ).toBe('That stop is already part of this route.')
  })

  it('blocks additions beyond the 12-stop total limit', () => {
    const currentStops = Array.from({ length: 11 }, (_, index) => ({
      ...pinToTripWaypointInput(makePin({ id: `pin-${index}`, name: `Stop ${index}` })),
      stopOrder: index,
    }))

    const result = appendTripWaypoint(currentStops, pinToTripWaypointInput(makePin({ id: 'pin-extra', name: 'Extra Stop' })), { destinationId: 'pin-dest' })

    expect(result.error).toBe(MAX_TRIP_STOPS_MESSAGE)
    expect(result.stops).toHaveLength(11)
  })

  it('removes a waypoint and compacts remaining stopOrder values', () => {
    const currentStops = [
      { ...pinToTripWaypointInput(makePin({ id: 'pin-a', name: 'Alpha' })), id: 'stop-a', stopOrder: 0 },
      { ...pinToTripWaypointInput(makePin({ id: 'pin-b', name: 'Bravo' })), id: 'stop-b', stopOrder: 1 },
      { ...pinToTripWaypointInput(makePin({ id: 'pin-c', name: 'Charlie' })), id: 'stop-c', stopOrder: 2 },
    ]

    expect(removeTripWaypoint(currentStops, 'stop-b')).toEqual([
      expect.objectContaining({ id: 'stop-a', stopOrder: 0, place: expect.objectContaining({ id: 'pin-a' }) }),
      expect.objectContaining({ id: 'stop-c', stopOrder: 1, place: expect.objectContaining({ id: 'pin-c' }) }),
    ])
  })

  it('reorders normalized waypoints while preserving metadata and compact stopOrder values', () => {
    const currentStops = [
      { ...pinToTripWaypointInput(makePin({ id: 'pin-a', name: 'Alpha' }), 'saved'), id: 'stop-a', stopOrder: 0, notes: 'alpha notes' },
      { ...pinToTripWaypointInput(makePin({ id: 'pin-b', name: 'Bravo' }), 'manual'), id: 'stop-b', stopOrder: 1, notes: 'bravo notes' },
      { ...pinToTripWaypointInput(makePin({ id: 'pin-c', name: 'Charlie' }), 'imported'), id: 'stop-c', stopOrder: 2, notes: 'charlie notes' },
    ]

    expect(compactTripWaypointOrders(moveWaypoint(currentStops, 2, 'up'))).toEqual([
      expect.objectContaining({ id: 'stop-a', stopOrder: 0, source: 'saved', notes: 'alpha notes' }),
      expect.objectContaining({ id: 'stop-c', stopOrder: 1, source: 'imported', notes: 'charlie notes' }),
      expect.objectContaining({ id: 'stop-b', stopOrder: 2, source: 'manual', notes: 'bravo notes' }),
    ])
  })

  it('builds corridor preview points and numbered stop markers in route order', () => {
    const preview = buildTripCorridorPreview({
      origin: { id: 'origin', name: 'Flagstaff', latitude: 35.1983, longitude: -111.6513 },
      destination: { id: 'dest', name: 'Quartzsite', latitude: 33.6639, longitude: -114.229 },
      stops: [
        {
          id: 'stop-b',
          stopOrder: 1,
          stopKind: 'waypoint',
          source: 'manual',
          pinId: 'pin-b',
          place: { id: 'pin-b', name: 'Kingman', latitude: 35.1894, longitude: -114.053 },
          notes: '',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'stop-a',
          stopOrder: 0,
          stopKind: 'waypoint',
          source: 'saved',
          pinId: 'pin-a',
          place: { id: 'pin-a', name: 'Lake Havasu', latitude: 34.4839, longitude: -114.3225 },
          notes: '',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'dest-stop',
          stopOrder: 2,
          stopKind: 'destination',
          source: 'manual',
          pinId: null,
          place: { id: 'dest', name: 'Quartzsite', latitude: 33.6639, longitude: -114.229 },
          notes: '',
          createdAt: '',
          updatedAt: '',
        },
      ],
    })

    expect(preview.linePoints).toEqual([
      { latitude: 35.1983, longitude: -111.6513 },
      { latitude: 34.4839, longitude: -114.3225 },
      { latitude: 35.1894, longitude: -114.053 },
      { latitude: 33.6639, longitude: -114.229 },
    ])
    expect(preview.stopMarkers).toEqual([
      { stopOrder: 0, name: 'Lake Havasu', latitude: 34.4839, longitude: -114.3225 },
      { stopOrder: 1, name: 'Kingman', latitude: 35.1894, longitude: -114.053 },
    ])
  })
})

describe('buildDuplicateTripPayload', () => {
  const BASE_TRIP: Trip = {
    id: 'trip-abc',
    title: 'Desert Loop',
    notes: 'Great overnight stops',
    status: 'draft',
    origin: { id: 'origin-1', name: 'Flagstaff', latitude: 35.1983, longitude: -111.6513 },
    destination: { id: 'dest-1', name: 'Quartzsite', latitude: 33.6639, longitude: -114.229 },
    routeMode: 'corridor',
    stopCount: 3,
    revision: 1,
    isPublic: true,
    shareToken: 'tok-123',
    sourceTripId: null,
    sourceShareToken: null,
    createdAt: '2026-03-24T10:00:00.000Z',
    updatedAt: '2026-03-24T11:00:00.000Z',
    stops: [
      {
        id: 'stop-1',
        stopOrder: 0,
        stopKind: 'waypoint',
        source: 'saved',
        pinId: 'saved-1',
        place: { id: 'saved-1', name: 'Lake Havasu', latitude: 34.4839, longitude: -114.3225 },
        notes: 'Top off fuel',
        createdAt: '2026-03-24T10:00:00.000Z',
        updatedAt: '2026-03-24T11:00:00.000Z',
      },
      {
        id: 'stop-2',
        stopOrder: 1,
        stopKind: 'waypoint',
        source: 'manual',
        pinId: 'pin-k',
        place: { id: 'pin-k', name: 'Kingman', latitude: 35.1894, longitude: -114.053 },
        notes: 'Stretch break',
        createdAt: '2026-03-24T10:00:00.000Z',
        updatedAt: '2026-03-24T11:00:00.000Z',
      },
      {
        id: 'stop-dest',
        stopOrder: 2,
        stopKind: 'destination',
        source: 'manual',
        pinId: null,
        place: { id: 'dest-1', name: 'Quartzsite', latitude: 33.6639, longitude: -114.229 },
        notes: '',
        createdAt: '2026-03-24T10:00:00.000Z',
        updatedAt: '2026-03-24T11:00:00.000Z',
      },
    ],
  }

  it('appends " (copy)" suffix to the title', () => {
    const payload = buildDuplicateTripPayload(BASE_TRIP)
    expect(payload.title).toBe('Desert Loop (copy)')
  })

  it('copies notes, origin, destination, and routeMode', () => {
    const payload = buildDuplicateTripPayload(BASE_TRIP)
    expect(payload.notes).toBe('Great overnight stops')
    expect(payload.origin).toEqual(BASE_TRIP.origin)
    expect(payload.destination).toEqual(BASE_TRIP.destination)
    expect(payload.routeMode).toBe('corridor')
  })

  it('maps waypoint stops only — excludes destination stop and omits server-assigned id', () => {
    const payload = buildDuplicateTripPayload(BASE_TRIP)
    expect(payload.stops).toHaveLength(2)
    expect(payload.stops![0]).toEqual({
      stopOrder: 0,
      source: 'saved',
      pinId: 'saved-1',
      place: { id: 'saved-1', name: 'Lake Havasu', latitude: 34.4839, longitude: -114.3225 },
      notes: 'Top off fuel',
    })
    expect(payload.stops![1]).toEqual({
      stopOrder: 1,
      source: 'manual',
      pinId: 'pin-k',
      place: { id: 'pin-k', name: 'Kingman', latitude: 35.1894, longitude: -114.053 },
      notes: 'Stretch break',
    })
    // No server-assigned id on any stop
    for (const stop of payload.stops!) {
      expect(stop).not.toHaveProperty('id')
    }
  })

  it('sets sourceTripId to the original trip id', () => {
    const payload = buildDuplicateTripPayload(BASE_TRIP)
    expect(payload.sourceTripId).toBe('trip-abc')
  })

  it('does NOT copy isPublic, shareToken, status, or id', () => {
    const payload = buildDuplicateTripPayload(BASE_TRIP)
    expect(payload).not.toHaveProperty('isPublic')
    expect(payload).not.toHaveProperty('shareToken')
    expect(payload).not.toHaveProperty('status')
    expect(payload).not.toHaveProperty('id')
  })

  it('truncates title to 160 chars max when original title is very long', () => {
    const longTitle = 'A'.repeat(200)
    const trip = { ...BASE_TRIP, title: longTitle }
    const payload = buildDuplicateTripPayload(trip)
    expect(payload.title!.length).toBe(160)
    expect(payload.title!.endsWith(' (copy)')).toBe(true)
  })

  it('re-indexes stopOrder from 0 for waypoint stops', () => {
    const payload = buildDuplicateTripPayload(BASE_TRIP)
    expect(payload.stops!.map((s) => s.stopOrder)).toEqual([0, 1])
  })

  it('handles a trip with only a destination stop (0 waypoints)', () => {
    const destinationOnlyTrip: Trip = {
      ...BASE_TRIP,
      stopCount: 1,
      stops: [
        {
          id: 'stop-dest',
          stopOrder: 0,
          stopKind: 'destination',
          source: 'manual',
          pinId: null,
          place: { id: 'dest-1', name: 'Quartzsite', latitude: 33.6639, longitude: -114.229 },
          notes: '',
          createdAt: '2026-03-24T10:00:00.000Z',
          updatedAt: '2026-03-24T11:00:00.000Z',
        },
      ],
    }
    const payload = buildDuplicateTripPayload(destinationOnlyTrip)
    expect(payload.stops).toEqual([])
    expect(payload.destination).toEqual(destinationOnlyTrip.destination)
    expect(payload.sourceTripId).toBe('trip-abc')
  })
})
