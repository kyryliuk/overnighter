import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTripDraftStore, INITIAL_TRIP_DRAFT_STATE } from '@/store/tripDraftStore'
import {
  appendPendingTripMutation,
  clearPendingTripMutations,
  PENDING_TRIP_MUTATIONS_UPDATED_EVENT,
} from '@/lib/offline/pendingTripMutations'
import { useTripSyncStatus } from './useTripSyncStatus'

const TRIP_ID = 'trip-abc'

const PENDING_MUTATION = {
  id: 'mut-1',
  kind: 'update' as const,
  tripId: TRIP_ID,
  queuedAt: '2026-04-01T10:00:00Z',
}

describe('useTripSyncStatus', () => {
  beforeEach(() => {
    useTripDraftStore.setState({ ...INITIAL_TRIP_DRAFT_STATE })
    clearPendingTripMutations()
  })

  it('returns "synced" for null tripId', () => {
    const { result } = renderHook(() => useTripSyncStatus(null))
    expect(result.current).toBe('synced')
  })

  it('returns "synced" for undefined tripId', () => {
    const { result } = renderHook(() => useTripSyncStatus(undefined))
    expect(result.current).toBe('synced')
  })

  it('returns "synced" when trip is not in dirtyTripIds and queue is empty', () => {
    const { result } = renderHook(() => useTripSyncStatus(TRIP_ID))
    expect(result.current).toBe('synced')
  })

  it('returns "synced" when trip is not dirty even if another trip has a queue item', () => {
    appendPendingTripMutation({ ...PENDING_MUTATION, tripId: 'trip-other' })
    const { result } = renderHook(() => useTripSyncStatus(TRIP_ID))
    expect(result.current).toBe('synced')
  })

  it('returns "local-draft" when trip is dirty but has no pending queue item', () => {
    useTripDraftStore.setState({ dirtyTripIds: [TRIP_ID] })
    const { result } = renderHook(() => useTripSyncStatus(TRIP_ID))
    expect(result.current).toBe('local-draft')
  })

  it('returns "sync-pending" when trip is dirty AND has a matching queue item', () => {
    useTripDraftStore.setState({ dirtyTripIds: [TRIP_ID] })
    appendPendingTripMutation(PENDING_MUTATION)
    const { result } = renderHook(() => useTripSyncStatus(TRIP_ID))
    expect(result.current).toBe('sync-pending')
  })

  it('transitions from "local-draft" to "sync-pending" when queue item is appended', () => {
    useTripDraftStore.setState({ dirtyTripIds: [TRIP_ID] })
    const { result } = renderHook(() => useTripSyncStatus(TRIP_ID))
    expect(result.current).toBe('local-draft')

    act(() => {
      appendPendingTripMutation(PENDING_MUTATION)
    })

    expect(result.current).toBe('sync-pending')
  })

  it('transitions from "sync-pending" to "local-draft" when queue item is removed', () => {
    useTripDraftStore.setState({ dirtyTripIds: [TRIP_ID] })
    appendPendingTripMutation(PENDING_MUTATION)
    const { result } = renderHook(() => useTripSyncStatus(TRIP_ID))
    expect(result.current).toBe('sync-pending')

    act(() => {
      clearPendingTripMutations()
    })

    expect(result.current).toBe('local-draft')
  })

  it('transitions from "local-draft" to "synced" when markClean is called', () => {
    useTripDraftStore.setState({ dirtyTripIds: [TRIP_ID] })
    const { result } = renderHook(() => useTripSyncStatus(TRIP_ID))
    expect(result.current).toBe('local-draft')

    act(() => {
      useTripDraftStore.getState().markClean(TRIP_ID)
    })

    expect(result.current).toBe('synced')
  })

  it('reflects correct state on first render after page-reload scenario (eager init)', () => {
    // Simulate: trip was dirty + queued before component mounted
    useTripDraftStore.setState({ dirtyTripIds: [TRIP_ID] })
    appendPendingTripMutation(PENDING_MUTATION)

    // No event fired — hook must get the state from lazy useState initializer
    const { result } = renderHook(() => useTripSyncStatus(TRIP_ID))
    expect(result.current).toBe('sync-pending')
  })
})
