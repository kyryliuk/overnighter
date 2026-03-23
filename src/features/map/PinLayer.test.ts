import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { doesPinFitRig, doesPinMatchFilters } from './PinLayer'
import type { Pin } from '@/types/pin'
import type { RigProfile } from '@/types/rigProfile'
import type * as L from 'leaflet'

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted so vars are available when vi.mock factory runs
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const mockMarkerOn = vi.fn().mockReturnThis()
  const mockMarkerAddTo = vi.fn().mockReturnThis()
  const mockMarkerRemove = vi.fn()
  const mockMarkerInstance = {
    on: mockMarkerOn,
    addTo: mockMarkerAddTo,
    remove: mockMarkerRemove,
  }
  const mockCreatePinMarker = vi.fn(() => mockMarkerInstance)
  return { mockMarkerOn, mockMarkerAddTo, mockMarkerRemove, mockCreatePinMarker, mockMarkerInstance }
})

vi.mock('./PinMarker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./PinMarker')>()
  return {
    ...actual,
    createPinMarker: mocks.mockCreatePinMarker,
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePin(overrides: Partial<Pin> = {}): Pin {
  return {
    id: 'pin-1',
    name: 'Test Spot',
    description: null,
    latitude: 40.0,
    longitude: -90.0,
    pinType: 'community',
    sourceId: null,
    maxLengthFt: null,
    maxHeightFt: null,
    amenities: {
      water: false,
      dump: false,
      electric: false,
      shower: false,
      fuel: false,
      propane: false,
      overnight: true,
    },
    badgeState: 'grey',
    lastCheckInAt: null,
    recentCheckInCount: 0,
    isVerified: false,
    isFlagged: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeProfile(overrides: Partial<RigProfile> = {}): RigProfile {
  return { rigType: 'Class A', lengthFt: 35, heightFt: 12.5, ...overrides }
}

// ---------------------------------------------------------------------------
// Existing doesPinFitRig tests — DO NOT CHANGE
// ---------------------------------------------------------------------------

describe('doesPinFitRig', () => {
  it('returns true when rigProfile has no rigType (no profile set)', () => {
    const pin = makePin({ maxLengthFt: 20, maxHeightFt: 10 })
    const profile = makeProfile({ rigType: null })
    expect(doesPinFitRig(pin, profile)).toBe(true)
  })

  it('returns true when pin has no length or height constraints', () => {
    const pin = makePin({ maxLengthFt: null, maxHeightFt: null })
    const profile = makeProfile({ lengthFt: 50, heightFt: 14 })
    expect(doesPinFitRig(pin, profile)).toBe(true)
  })

  it('returns true when rig length exactly equals pin max length', () => {
    const pin = makePin({ maxLengthFt: 35, maxHeightFt: null })
    const profile = makeProfile({ lengthFt: 35 })
    expect(doesPinFitRig(pin, profile)).toBe(true)
  })

  it('returns true when rig length is under pin max length', () => {
    const pin = makePin({ maxLengthFt: 40, maxHeightFt: null })
    const profile = makeProfile({ lengthFt: 35 })
    expect(doesPinFitRig(pin, profile)).toBe(true)
  })

  it('returns false when rig length exceeds pin max length', () => {
    const pin = makePin({ maxLengthFt: 30, maxHeightFt: null })
    const profile = makeProfile({ lengthFt: 35 })
    expect(doesPinFitRig(pin, profile)).toBe(false)
  })

  it('returns true when rig height exactly equals pin max height', () => {
    const pin = makePin({ maxLengthFt: null, maxHeightFt: 13 })
    const profile = makeProfile({ heightFt: 13 })
    expect(doesPinFitRig(pin, profile)).toBe(true)
  })

  it('returns false when rig height exceeds pin max height', () => {
    const pin = makePin({ maxLengthFt: null, maxHeightFt: 11 })
    const profile = makeProfile({ heightFt: 13 })
    expect(doesPinFitRig(pin, profile)).toBe(false)
  })

  it('returns false when both length and height exceed pin constraints', () => {
    const pin = makePin({ maxLengthFt: 30, maxHeightFt: 11 })
    const profile = makeProfile({ lengthFt: 40, heightFt: 13 })
    expect(doesPinFitRig(pin, profile)).toBe(false)
  })

  it('returns false when only length exceeds (height is ok)', () => {
    const pin = makePin({ maxLengthFt: 30, maxHeightFt: 14 })
    const profile = makeProfile({ lengthFt: 40, heightFt: 12 })
    expect(doesPinFitRig(pin, profile)).toBe(false)
  })

  it('returns false when only height exceeds (length is ok)', () => {
    const pin = makePin({ maxLengthFt: 40, maxHeightFt: 11 })
    const profile = makeProfile({ lengthFt: 30, heightFt: 13 })
    expect(doesPinFitRig(pin, profile)).toBe(false)
  })

  it('returns true when rigProfile.lengthFt is null (user did not set length)', () => {
    const pin = makePin({ maxLengthFt: 20, maxHeightFt: null })
    const profile = makeProfile({ lengthFt: null })
    expect(doesPinFitRig(pin, profile)).toBe(true)
  })

  it('returns true when rigProfile.heightFt is null (user did not set height)', () => {
    const pin = makePin({ maxLengthFt: null, maxHeightFt: 10 })
    const profile = makeProfile({ heightFt: null })
    expect(doesPinFitRig(pin, profile)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// doesPinMatchFilters — Story 2.5 amenity filter tests
// ---------------------------------------------------------------------------

describe('doesPinMatchFilters', () => {
  it('returns true for any pin when no filters are active', () => {
    const pin = makePin({ amenities: { water: false, dump: false, electric: false, shower: false, fuel: false, propane: false, overnight: false } })
    expect(doesPinMatchFilters(pin, [])).toBe(true)
  })

  it('returns true for a pin with water=true when only water filter is active', () => {
    const pin = makePin({ amenities: { water: true, dump: false, electric: false, shower: false, fuel: false, propane: false, overnight: false } })
    expect(doesPinMatchFilters(pin, ['water'])).toBe(true)
  })

  it('returns false for a pin with water=false when water filter is active', () => {
    const pin = makePin({ amenities: { water: false, dump: true, electric: false, shower: false, fuel: false, propane: false, overnight: false } })
    expect(doesPinMatchFilters(pin, ['water'])).toBe(false)
  })

  it('applies AND logic — returns true only when pin has BOTH water and dump', () => {
    const pin = makePin({ amenities: { water: true, dump: true, electric: false, shower: false, fuel: false, propane: false, overnight: false } })
    expect(doesPinMatchFilters(pin, ['water', 'dump'])).toBe(true)
  })

  it('applies AND logic — returns false when pin has water but not dump', () => {
    const pin = makePin({ amenities: { water: true, dump: false, electric: false, shower: false, fuel: false, propane: false, overnight: false } })
    expect(doesPinMatchFilters(pin, ['water', 'dump'])).toBe(false)
  })

  it('returns false when filter is active but pin lacks that amenity field entirely (treated as false)', () => {
    const pin = makePin({ amenities: { water: false, dump: false, electric: false, shower: false, fuel: false, propane: false, overnight: false } })
    expect(doesPinMatchFilters(pin, ['electric'])).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// PinLayer component — new tests for Story 2.2
// ---------------------------------------------------------------------------

let PinLayer: React.ComponentType<{
  map: L.Map
  pins: Pin[]
  rigProfile: RigProfile
  isLoading: boolean
}>

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('./PinLayer')
  PinLayer = mod.default
})

const mockMap = {} as L.Map

describe('PinLayer component', () => {
  it('calls createPinMarker (not circleMarker) for each pin when not loading', () => {
    const pins = [makePin({ id: 'pin-a' }), makePin({ id: 'pin-b' })]
    const profile = makeProfile()
    render(
      React.createElement(PinLayer, { map: mockMap, pins, rigProfile: profile, isLoading: false }),
    )
    expect(mocks.mockCreatePinMarker).toHaveBeenCalledTimes(2)
    expect(mocks.mockCreatePinMarker).toHaveBeenCalledWith(pins[0], profile)
    expect(mocks.mockCreatePinMarker).toHaveBeenCalledWith(pins[1], profile)
  })

  it('does not call createPinMarker when isLoading is true', () => {
    render(
      React.createElement(PinLayer, {
        map: mockMap,
        pins: [makePin()],
        rigProfile: makeProfile(),
        isLoading: true,
      }),
    )
    expect(mocks.mockCreatePinMarker).not.toHaveBeenCalled()
  })

  it('adds each marker to the map', () => {
    render(
      React.createElement(PinLayer, {
        map: mockMap,
        pins: [makePin()],
        rigProfile: makeProfile(),
        isLoading: false,
      }),
    )
    expect(mocks.mockMarkerAddTo).toHaveBeenCalledWith(mockMap)
  })
})
