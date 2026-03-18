import { describe, it, expect } from 'vitest'
import { doesPinFitRig } from './PinLayer'
import type { Pin } from '@/types/pin'
import type { RigProfile } from '@/types/rigProfile'

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
