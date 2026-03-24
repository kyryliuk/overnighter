import { describe, expect, it } from 'vitest'
import { mergeRigProfileState, mergeSavedSpots, mergeTripPlans } from './mergeCloudState'
import type { Pin } from '@/types/pin'
import type { TripPlan } from '@/types/tripPlan'

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

  it('returns local state when remote is null', () => {
    const local = {
      rigProfile: { rigType: 'Class A' as const, lengthFt: 35, heightFt: 12.5 },
      onboardingDismissed: true,
      updatedAt: '2026-03-23T12:00:00.000Z',
    }
    const merged = mergeRigProfileState(local, null)
    expect(merged).toBe(local)
  })

  it('returns remote when both local and remote are empty defaults', () => {
    const merged = mergeRigProfileState(
      {
        rigProfile: { rigType: null, lengthFt: null, heightFt: null },
        onboardingDismissed: false,
        updatedAt: null,
      },
      {
        rigProfile: { rigType: null, lengthFt: null, heightFt: null },
        onboardingDismissed: false,
        updatedAt: null,
      },
    )
    expect(merged.rigProfile.rigType).toBeNull()
    expect(merged.onboardingDismissed).toBe(false)
  })

  it('keeps local state when timestamps are equal', () => {
    const merged = mergeRigProfileState(
      {
        rigProfile: { rigType: 'Class A', lengthFt: 35, heightFt: 12.5 },
        onboardingDismissed: false,
        updatedAt: '2026-03-23T12:00:00.000Z',
      },
      {
        rigProfile: { rigType: 'Class B', lengthFt: 20, heightFt: 7 },
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

  it('returns remote spots unmodified when local array is empty', () => {
    const remoteSpots = [
      { ...STUB_PIN, id: 'pin-r1', name: 'Remote spot 1' },
      { ...STUB_PIN, id: 'pin-r2', name: 'Remote spot 2' },
    ]
    const merged = mergeSavedSpots([], remoteSpots)
    expect(merged).toHaveLength(2)
    expect(merged.map((p) => p.id)).toEqual(['pin-r1', 'pin-r2'])
  })

  it('returns local spots when remote array is empty', () => {
    const merged = mergeSavedSpots([{ ...STUB_PIN, id: 'pin-l1', name: 'Local spot 1' }], [])
    expect(merged).toHaveLength(1)
    expect(merged[0].name).toBe('Local spot 1')
  })

  it('returns empty array when both arrays are empty', () => {
    const merged = mergeSavedSpots([], [])
    expect(merged).toHaveLength(0)
  })
})

describe('mergeTripPlans', () => {
  const LOCAL_PLAN: TripPlan = {
    id: 'trip-1',
    title: 'Local trip',
    notes: 'Leave early for the canyon pass.',
    destination: { id: 'dest-1', name: 'Quartzsite', latitude: 33.6, longitude: -114.2 },
    stops: [],
    isPublic: false,
    shareToken: null,
    sourceTrip: null,
    createdAt: '2026-03-23T10:00:00.000Z',
    updatedAt: '2026-03-23T12:00:00.000Z',
  }

  it('returns a set union of local and remote trip plans', () => {
    const merged = mergeTripPlans(
      [LOCAL_PLAN],
      [{ ...LOCAL_PLAN, id: 'trip-2', title: 'Remote trip' }],
    )

    expect(merged.map((plan) => plan.id)).toEqual(['trip-2', 'trip-1'])
  })

  it('prefers the newer updated trip plan when the same id exists in both sets', () => {
    const merged = mergeTripPlans(
      [LOCAL_PLAN],
      [{ ...LOCAL_PLAN, title: 'Remote trip', updatedAt: '2026-03-23T11:00:00.000Z' }],
    )

    expect(merged).toHaveLength(1)
    expect(merged[0].title).toBe('Local trip')
  })

  it('returns remote plans when local array is empty', () => {
    const remotePlans = [{ ...LOCAL_PLAN, id: 'trip-r1', title: 'Remote trip' }]
    const merged = mergeTripPlans([], remotePlans)
    expect(merged).toHaveLength(1)
    expect(merged[0].title).toBe('Remote trip')
  })

  it('returns local plans when remote array is empty', () => {
    const merged = mergeTripPlans([LOCAL_PLAN], [])
    expect(merged).toHaveLength(1)
    expect(merged[0].title).toBe('Local trip')
  })

  it('returns empty array when both arrays are empty', () => {
    const merged = mergeTripPlans([], [])
    expect(merged).toHaveLength(0)
  })
})
