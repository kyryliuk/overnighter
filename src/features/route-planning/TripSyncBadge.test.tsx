import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useTripDraftStore, INITIAL_TRIP_DRAFT_STATE } from '@/store/tripDraftStore'
import {
  appendPendingTripMutation,
  clearPendingTripMutations,
  PENDING_TRIP_MUTATIONS_UPDATED_EVENT,
} from '@/lib/offline/pendingTripMutations'
import { TripSyncBadge } from './TripSyncBadge'

const TRIP_ID = 'trip-xyz'

const PENDING_MUTATION = {
  id: 'mut-badge-1',
  kind: 'update' as const,
  tripId: TRIP_ID,
  queuedAt: '2026-04-01T10:00:00Z',
}

describe('TripSyncBadge', () => {
  beforeEach(() => {
    useTripDraftStore.setState({ ...INITIAL_TRIP_DRAFT_STATE })
    clearPendingTripMutations()
  })

  it('renders "Synced" when trip is clean and queue is empty', () => {
    render(<TripSyncBadge tripId={TRIP_ID} />)
    expect(screen.getByTestId('trip-sync-indicator')).toHaveTextContent('Synced')
  })

  it('renders "Local draft" when trip is dirty but not queued', () => {
    useTripDraftStore.setState({ dirtyTripIds: [TRIP_ID] })
    render(<TripSyncBadge tripId={TRIP_ID} />)
    expect(screen.getByTestId('trip-sync-indicator')).toHaveTextContent('Local draft')
  })

  it('renders "Sync pending" when trip is dirty and has a queue item', () => {
    useTripDraftStore.setState({ dirtyTripIds: [TRIP_ID] })
    appendPendingTripMutation(PENDING_MUTATION)
    render(<TripSyncBadge tripId={TRIP_ID} />)
    expect(screen.getByTestId('trip-sync-indicator')).toHaveTextContent('Sync pending')
  })

  it('has aria-live="polite" on the wrapper for screen reader announcements', () => {
    render(<TripSyncBadge tripId={TRIP_ID} />)
    const wrapper = screen.getByTestId('trip-sync-indicator')
    expect(wrapper).toHaveAttribute('aria-live', 'polite')
  })

  it('has aria-atomic="true" on the wrapper', () => {
    render(<TripSyncBadge tripId={TRIP_ID} />)
    const wrapper = screen.getByTestId('trip-sync-indicator')
    expect(wrapper).toHaveAttribute('aria-atomic', 'true')
  })

  it('updates from "Local draft" to "Sync pending" when queue event fires', () => {
    useTripDraftStore.setState({ dirtyTripIds: [TRIP_ID] })
    render(<TripSyncBadge tripId={TRIP_ID} />)
    expect(screen.getByTestId('trip-sync-indicator')).toHaveTextContent('Local draft')

    act(() => {
      appendPendingTripMutation(PENDING_MUTATION)
    })

    expect(screen.getByTestId('trip-sync-indicator')).toHaveTextContent('Sync pending')
  })

  it('updates from "Sync pending" to "Synced" when trip is marked clean', () => {
    useTripDraftStore.setState({ dirtyTripIds: [TRIP_ID] })
    appendPendingTripMutation(PENDING_MUTATION)
    render(<TripSyncBadge tripId={TRIP_ID} />)
    expect(screen.getByTestId('trip-sync-indicator')).toHaveTextContent('Sync pending')

    act(() => {
      useTripDraftStore.getState().markClean(TRIP_ID)
    })

    expect(screen.getByTestId('trip-sync-indicator')).toHaveTextContent('Synced')
  })
})
