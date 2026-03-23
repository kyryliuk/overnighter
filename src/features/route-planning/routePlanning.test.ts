import { describe, expect, it } from 'vitest'
import { buildDirectionsUrl } from '@/lib/maps/googleMaps'
import type { Pin } from '@/types/pin'
import { DEFAULT_RIG_PROFILE } from '@/types/rigProfile'
import type { TripPlanPlace } from '@/types/tripPlan'
import { appendUniqueWaypoint, buildRouteSuggestions, moveWaypoint } from './routePlanning'

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
      destination: { latitude: 39.1, longitude: -105.2 },
      rigProfile: DEFAULT_RIG_PROFILE,
      pins: [makePin({ id: 'good', latitude: 39.05, longitude: -105.1 })],
    })

    expect(suggestions).toEqual([])
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
