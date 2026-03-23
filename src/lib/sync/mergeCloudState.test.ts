import { describe, expect, it } from 'vitest'
import { mergeRigProfileState, mergeSavedSpots } from './mergeCloudState'
import type { Pin } from '@/types/pin'

const STUB_PIN: Pin = {
  id: 'pin-1',
  name: 'Local spot',
  description: null,
  latitude: 35,
  longitude: -110,
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
    big_rig: false,
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
  createdAt: '2026-03-23T00:00:00.000Z',
  updatedAt: '2026-03-23T00:00:00.000Z',
}

describe('mergeRigProfileState', () => {
  it('prefers remote state when local state has never been updated', () => {
    const merged = mergeRigProfileState(
      {
        rigProfile: { rigType: null, lengthFt: null, heightFt: null },
        onboardingDismissed: false,
        updatedAt: null,
      },
      {
        rigProfile: { rigType: 'Class B', lengthFt: 20, heightFt: 7 },
        onboardingDismissed: true,
        updatedAt: '2026-03-23T12:00:00.000Z',
      },
    )

    expect(merged.rigProfile.rigType).toBe('Class B')
    expect(merged.onboardingDismissed).toBe(true)
  })

  it('keeps local state when it is newer than the remote copy', () => {
    const merged = mergeRigProfileState(
      {
        rigProfile: { rigType: 'Class A', lengthFt: 35, heightFt: 12.5 },
        onboardingDismissed: false,
        updatedAt: '2026-03-23T13:00:00.000Z',
      },
      {
        rigProfile: { rigType: 'Class C', lengthFt: 28, heightFt: 11 },
        onboardingDismissed: true,
        updatedAt: '2026-03-23T12:00:00.000Z',
      },
    )

    expect(merged.rigProfile.rigType).toBe('Class A')
    expect(merged.onboardingDismissed).toBe(false)
  })
})

describe('mergeSavedSpots', () => {
  it('returns a set union of local and remote saved spots', () => {
    const merged = mergeSavedSpots(
      [STUB_PIN],
      [{ ...STUB_PIN, id: 'pin-2', name: 'Remote spot' }],
    )

    expect(merged.map((pin) => pin.id)).toEqual(['pin-2', 'pin-1'])
  })

  it('prefers the local snapshot when the same pin exists in both sets', () => {
    const merged = mergeSavedSpots(
      [STUB_PIN],
      [{ ...STUB_PIN, name: 'Remote copy' }],
    )

    expect(merged).toHaveLength(1)
    expect(merged[0].name).toBe('Local spot')
  })
})
