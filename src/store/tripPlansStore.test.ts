import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTripPlansStore } from './tripPlansStore'

describe('tripPlansStore', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'trip-123') })
    useTripPlansStore.setState({ tripPlans: [], hasHydrated: true })
  })

  it('creates a new trip draft', () => {
    const id = useTripPlansStore.getState().saveTripPlan({
      title: 'Desert run',
      notes: 'First overnight plan',
      destination: { id: 'dest', name: 'Quartzsite', latitude: 33.6639, longitude: -114.2297 },
      stops: [{ id: 'stop-1', name: 'Pilot', latitude: 34, longitude: -113 }],
    })

    expect(id).toBe('trip-123')
    expect(useTripPlansStore.getState().tripPlans).toHaveLength(1)
    expect(useTripPlansStore.getState().tripPlans[0]).toMatchObject({
      id: 'trip-123',
      title: 'Desert run',
      notes: 'First overnight plan',
      destination: { id: 'dest', name: 'Quartzsite' },
      stops: [{ id: 'stop-1', name: 'Pilot' }],
      isPublic: false,
      shareToken: null,
      sourceTrip: null,
    })
  })

  it('updates an existing trip draft in place', () => {
    useTripPlansStore.getState().saveTripPlan({
      title: 'Desert run',
      notes: 'Leave before sunset',
      destination: { id: 'dest', name: 'Quartzsite', latitude: 33.6639, longitude: -114.2297 },
      stops: [],
    })

    useTripPlansStore.getState().saveTripPlan({
      id: 'trip-123',
      title: 'Desert run updated',
      notes: 'Updated route note',
      destination: { id: 'dest', name: 'Quartzsite', latitude: 33.6639, longitude: -114.2297 },
      stops: [{ id: 'stop-2', name: 'Water stop', latitude: 34, longitude: -113 }],
    })

    expect(useTripPlansStore.getState().tripPlans).toHaveLength(1)
    expect(useTripPlansStore.getState().tripPlans[0]).toMatchObject({
      id: 'trip-123',
      title: 'Desert run updated',
      notes: 'Updated route note',
      stops: [{ id: 'stop-2', name: 'Water stop' }],
    })
  })

  it('preserves share metadata when updating an existing trip draft', () => {
    useTripPlansStore.getState().saveTripPlan({
      title: 'Shared trip',
      notes: 'Carry extra water.',
      destination: { id: 'dest', name: 'Quartzsite', latitude: 33.6639, longitude: -114.2297 },
      stops: [],
      isPublic: true,
      shareToken: 'share-123',
    })

    useTripPlansStore.getState().saveTripPlan({
      id: 'trip-123',
      title: 'Shared trip updated',
      notes: 'Carry extra water.',
      destination: { id: 'dest', name: 'Quartzsite', latitude: 33.6639, longitude: -114.2297 },
      stops: [],
    })

    expect(useTripPlansStore.getState().tripPlans[0]).toMatchObject({
      isPublic: true,
      shareToken: 'share-123',
    })
  })

  it('clears share metadata when explicitly requested', () => {
    useTripPlansStore.getState().saveTripPlan({
      title: 'Shared trip',
      notes: 'Old shared note',
      destination: { id: 'dest', name: 'Quartzsite', latitude: 33.6639, longitude: -114.2297 },
      stops: [],
      isPublic: true,
      shareToken: 'share-123',
    })

    useTripPlansStore.getState().saveTripPlan({
      id: 'trip-123',
      title: 'Shared trip',
      notes: 'Old shared note',
      destination: { id: 'dest', name: 'Quartzsite', latitude: 33.6639, longitude: -114.2297 },
      stops: [],
      isPublic: false,
      shareToken: null,
    })

    expect(useTripPlansStore.getState().tripPlans[0]).toMatchObject({
      isPublic: false,
      shareToken: null,
    })
  })

  it('preserves remix attribution when updating an imported trip draft', () => {
    useTripPlansStore.getState().saveTripPlan({
      title: 'Shared trip copy',
      notes: 'Imported from a friend',
      destination: { id: 'dest', name: 'Quartzsite', latitude: 33.6639, longitude: -114.2297 },
      stops: [],
      sourceTrip: {
        shareToken: 'share-123',
        title: 'Original shared trip',
      },
    })

    useTripPlansStore.getState().saveTripPlan({
      id: 'trip-123',
      title: 'Shared trip copy updated',
      notes: 'Imported from a friend',
      destination: { id: 'dest', name: 'Quartzsite', latitude: 33.6639, longitude: -114.2297 },
      stops: [{ id: 'stop-2', name: 'Fuel stop', latitude: 34, longitude: -113 }],
    })

    expect(useTripPlansStore.getState().tripPlans[0]).toMatchObject({
      title: 'Shared trip copy updated',
      sourceTrip: {
        shareToken: 'share-123',
        title: 'Original shared trip',
      },
    })
  })

  it('preserves trip notes when updating a draft without replacing the note', () => {
    useTripPlansStore.getState().saveTripPlan({
      title: 'Note keeper',
      notes: 'Best for a late arrival.',
      destination: { id: 'dest', name: 'Quartzsite', latitude: 33.6639, longitude: -114.2297 },
      stops: [],
    })

    useTripPlansStore.getState().saveTripPlan({
      id: 'trip-123',
      title: 'Note keeper updated',
      destination: { id: 'dest', name: 'Quartzsite', latitude: 33.6639, longitude: -114.2297 },
      stops: [],
    })

    expect(useTripPlansStore.getState().tripPlans[0]).toMatchObject({
      title: 'Note keeper updated',
      notes: 'Best for a late arrival.',
    })
  })
})
