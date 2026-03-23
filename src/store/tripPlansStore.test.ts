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
      destination: { id: 'dest', name: 'Quartzsite', latitude: 33.6639, longitude: -114.2297 },
      stops: [{ id: 'stop-1', name: 'Pilot', latitude: 34, longitude: -113 }],
    })

    expect(id).toBe('trip-123')
    expect(useTripPlansStore.getState().tripPlans).toHaveLength(1)
    expect(useTripPlansStore.getState().tripPlans[0]).toMatchObject({
      id: 'trip-123',
      title: 'Desert run',
      destination: { id: 'dest', name: 'Quartzsite' },
      stops: [{ id: 'stop-1', name: 'Pilot' }],
    })
  })

  it('updates an existing trip draft in place', () => {
    useTripPlansStore.getState().saveTripPlan({
      title: 'Desert run',
      destination: { id: 'dest', name: 'Quartzsite', latitude: 33.6639, longitude: -114.2297 },
      stops: [],
    })

    useTripPlansStore.getState().saveTripPlan({
      id: 'trip-123',
      title: 'Desert run updated',
      destination: { id: 'dest', name: 'Quartzsite', latitude: 33.6639, longitude: -114.2297 },
      stops: [{ id: 'stop-2', name: 'Water stop', latitude: 34, longitude: -113 }],
    })

    expect(useTripPlansStore.getState().tripPlans).toHaveLength(1)
    expect(useTripPlansStore.getState().tripPlans[0]).toMatchObject({
      id: 'trip-123',
      title: 'Desert run updated',
      stops: [{ id: 'stop-2', name: 'Water stop' }],
    })
  })
})
