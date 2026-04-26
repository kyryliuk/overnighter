import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useTripDraftStore, INITIAL_TRIP_DRAFT_STATE } from '@/store/tripDraftStore'
import {
  appendPendingTripMutation,
  clearPendingTripMutations,
  readPendingTripMutations,
} from '@/lib/offline/pendingTripMutations'
import type { Trip } from '@/types/trip'
import { useOfflineTripQueue } from './useOfflineTripQueue'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => mockIsOnline,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}))

vi.mock('./api', () => ({
  createTrip: (...args: unknown[]) => mockCreateTrip(...args),
  updateTrip: (...args: unknown[]) => mockUpdateTrip(...args),
  updateTripStatus: (...args: unknown[]) => mockUpdateTripStatus(...args),
  deleteTrip: (...args: unknown[]) => mockDeleteTrip(...args),
}))

let mockIsOnline = false
let mockAuth = {
  isAuthenticated: true,
  session: { access_token: 'tok-1', user: { id: 'user-1' } },
}

const mockCreateTrip = vi.fn()
const mockUpdateTrip = vi.fn()
const mockUpdateTripStatus = vi.fn()
const mockDeleteTrip = vi.fn()

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TRIP_ID = 'trip-flush-1'

const BASE_TRIP: Trip = {
  id: TRIP_ID,
  title: 'Desert Loop',
  notes: '',
  status: 'draft',
  origin: null,
  destination: { id: 'dest-1', name: 'Quartzsite', latitude: 33.66, longitude: -114.23 },
  routeMode: 'corridor',
  stopCount: 1,
  revision: 1,
  isPublic: false,
  shareToken: null,
  sourceTripId: null,
  sourceShareToken: null,
  createdAt: '2026-04-01T10:00:00Z',
  updatedAt: '2026-04-01T10:00:00Z',
  stops: [],
}

const UPDATE_MUTATION = {
  id: 'mut-upd-1',
  kind: 'update' as const,
  tripId: TRIP_ID,
  payload: {
    title: 'Updated Desert Loop',
    destination: BASE_TRIP.destination,
  },
  queuedAt: '2026-04-02T10:00:00Z',
}

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useOfflineTripQueue', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    mockIsOnline = false
    mockAuth = {
      isAuthenticated: true,
      session: { access_token: 'tok-1', user: { id: 'user-1' } },
    }
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    useTripDraftStore.setState({ ...INITIAL_TRIP_DRAFT_STATE })
    clearPendingTripMutations()
    mockCreateTrip.mockReset()
    mockUpdateTrip.mockReset()
    mockUpdateTripStatus.mockReset()
    mockDeleteTrip.mockReset()
    localStorage.removeItem('pendingTripMutations_flushing')
  })

  afterEach(() => {
    queryClient.clear()
    vi.clearAllMocks()
  })

  it('does nothing when queue is empty and online', async () => {
    mockIsOnline = true
    const { result } = renderHook(() => useOfflineTripQueue(), {
      wrapper: makeWrapper(queryClient),
    })
    await waitFor(() => expect(result.current.isFlushing).toBe(false))
    expect(mockUpdateTrip).not.toHaveBeenCalled()
  })

  it('flushes update mutation on reconnect and marks trip clean', async () => {
    appendPendingTripMutation(UPDATE_MUTATION)
    useTripDraftStore.setState({ dirtyTripIds: [TRIP_ID] })
    const updatedTrip = { ...BASE_TRIP, revision: 2, updatedAt: '2026-04-02T11:00:00Z' }
    mockUpdateTrip.mockResolvedValue(updatedTrip)

    mockIsOnline = true
    const { result } = renderHook(() => useOfflineTripQueue(), {
      wrapper: makeWrapper(queryClient),
    })

    await waitFor(() => expect(mockUpdateTrip).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.isFlushing).toBe(false))

    expect(readPendingTripMutations()).toHaveLength(0)
    expect(useTripDraftStore.getState().dirtyTripIds).not.toContain(TRIP_ID)
  })

  it('detects conflict when cached revision is newer than lastSyncedRevision', async () => {
    appendPendingTripMutation(UPDATE_MUTATION)
    // Trip is dirty with lastSyncedRevision = 1
    useTripDraftStore.setState({
      dirtyTripIds: [TRIP_ID],
      draftsById: {
        [TRIP_ID]: {
          tripId: TRIP_ID,
          title: 'Local changes',
          notes: '',
          origin: null,
          destination: BASE_TRIP.destination,
          stops: [],
          lastSyncedRevision: 1,
          lastSyncedAt: '2026-04-01T10:00:00Z',
        },
      },
    })
    // Cached trip has revision 2 (server moved ahead)
    queryClient.setQueryData(['trips', 'user-1', TRIP_ID], { ...BASE_TRIP, revision: 2 })

    mockIsOnline = true
    renderHook(() => useOfflineTripQueue(), {
      wrapper: makeWrapper(queryClient),
    })

    await waitFor(() =>
      expect(useTripDraftStore.getState().conflictedTripIds).toContain(TRIP_ID),
    )

    // Mutation NOT sent — still in queue
    expect(mockUpdateTrip).not.toHaveBeenCalled()
    expect(readPendingTripMutations()).toHaveLength(1)
  })

  it('flushes update when cached revision matches lastSyncedRevision (no conflict)', async () => {
    appendPendingTripMutation(UPDATE_MUTATION)
    useTripDraftStore.setState({
      dirtyTripIds: [TRIP_ID],
      draftsById: {
        [TRIP_ID]: {
          tripId: TRIP_ID,
          title: 'Local changes',
          notes: '',
          origin: null,
          destination: BASE_TRIP.destination,
          stops: [],
          lastSyncedRevision: 1,
          lastSyncedAt: '2026-04-01T10:00:00Z',
        },
      },
    })
    // Cached trip has same revision — safe to flush
    queryClient.setQueryData(['trips', 'user-1', TRIP_ID], { ...BASE_TRIP, revision: 1 })
    const updatedTrip = { ...BASE_TRIP, revision: 2 }
    mockUpdateTrip.mockResolvedValue(updatedTrip)

    mockIsOnline = true
    renderHook(() => useOfflineTripQueue(), {
      wrapper: makeWrapper(queryClient),
    })

    await waitFor(() => expect(mockUpdateTrip).toHaveBeenCalledTimes(1))
    expect(readPendingTripMutations()).toHaveLength(0)
    expect(useTripDraftStore.getState().conflictedTripIds).not.toContain(TRIP_ID)
  })

  it('flushes delete mutation and removes draft', async () => {
    appendPendingTripMutation({
      id: 'mut-del-1',
      kind: 'delete',
      tripId: TRIP_ID,
      queuedAt: '2026-04-02T10:00:00Z',
    })
    useTripDraftStore.setState({
      dirtyTripIds: [TRIP_ID],
      draftsById: {
        [TRIP_ID]: {
          tripId: TRIP_ID,
          title: 'Trip to delete',
          notes: '',
          origin: null,
          destination: BASE_TRIP.destination,
          stops: [],
          lastSyncedRevision: 1,
          lastSyncedAt: null,
        },
      },
    })
    mockDeleteTrip.mockResolvedValue(undefined)

    mockIsOnline = true
    renderHook(() => useOfflineTripQueue(), {
      wrapper: makeWrapper(queryClient),
    })

    await waitFor(() => expect(mockDeleteTrip).toHaveBeenCalledTimes(1))
    expect(readPendingTripMutations()).toHaveLength(0)
    expect(useTripDraftStore.getState().draftsById[TRIP_ID]).toBeUndefined()
  })

  it('flushes updateStatus mutation and marks trip clean', async () => {
    appendPendingTripMutation({
      id: 'mut-status-1',
      kind: 'updateStatus',
      tripId: TRIP_ID,
      payload: { status: 'archived' },
      queuedAt: '2026-04-02T10:00:00Z',
    })
    useTripDraftStore.setState({ dirtyTripIds: [TRIP_ID] })
    mockUpdateTripStatus.mockResolvedValue({ ...BASE_TRIP, status: 'archived' })

    mockIsOnline = true
    renderHook(() => useOfflineTripQueue(), {
      wrapper: makeWrapper(queryClient),
    })

    await waitFor(() => expect(mockUpdateTripStatus).toHaveBeenCalledTimes(1))
    expect(readPendingTripMutations()).toHaveLength(0)
    expect(useTripDraftStore.getState().dirtyTripIds).not.toContain(TRIP_ID)
  })

  it('flushes create mutation and removes placeholder draft', async () => {
    const TEMP_TRIP_ID = 'temp-uuid-1234'
    appendPendingTripMutation({
      id: 'mut-create-1',
      kind: 'create',
      tripId: TEMP_TRIP_ID,
      payload: { title: 'New offline trip', destination: BASE_TRIP.destination },
      queuedAt: '2026-04-02T10:00:00Z',
    })
    useTripDraftStore.setState({
      dirtyTripIds: [TEMP_TRIP_ID],
      draftsById: {
        [TEMP_TRIP_ID]: {
          tripId: TEMP_TRIP_ID,
          title: 'New offline trip',
          notes: '',
          origin: null,
          destination: BASE_TRIP.destination,
          stops: [],
          lastSyncedRevision: null,
          lastSyncedAt: null,
        },
      },
    })
    const serverTrip = { ...BASE_TRIP, id: 'real-server-id', title: 'New offline trip' }
    mockCreateTrip.mockResolvedValue(serverTrip)

    mockIsOnline = true
    renderHook(() => useOfflineTripQueue(), {
      wrapper: makeWrapper(queryClient),
    })

    await waitFor(() => expect(mockCreateTrip).toHaveBeenCalledTimes(1))
    expect(readPendingTripMutations()).toHaveLength(0)
    expect(useTripDraftStore.getState().draftsById[TEMP_TRIP_ID]).toBeUndefined()
    expect(useTripDraftStore.getState().dirtyTripIds).not.toContain(TEMP_TRIP_ID)
  })

  it('skips mutation on 4xx error and removes from queue', async () => {
    appendPendingTripMutation(UPDATE_MUTATION)
    useTripDraftStore.setState({ dirtyTripIds: [TRIP_ID] })
    mockUpdateTrip.mockRejectedValue(new Error('400 Bad Request'))

    mockIsOnline = true
    renderHook(() => useOfflineTripQueue(), {
      wrapper: makeWrapper(queryClient),
    })

    await waitFor(() => expect(mockUpdateTrip).toHaveBeenCalledTimes(1))
    expect(readPendingTripMutations()).toHaveLength(0)
  })

  it('leaves mutation in queue on 5xx error (retry later)', async () => {
    appendPendingTripMutation(UPDATE_MUTATION)
    useTripDraftStore.setState({ dirtyTripIds: [TRIP_ID] })
    mockUpdateTrip.mockRejectedValue(new Error('500 Server Error'))

    mockIsOnline = true
    renderHook(() => useOfflineTripQueue(), {
      wrapper: makeWrapper(queryClient),
    })

    await waitFor(() => expect(mockUpdateTrip).toHaveBeenCalledTimes(1))
    expect(readPendingTripMutations()).toHaveLength(1)
  })

  it('does not flush when not authenticated', async () => {
    mockAuth = { isAuthenticated: false, session: null as unknown as typeof mockAuth['session'] }
    appendPendingTripMutation(UPDATE_MUTATION)

    mockIsOnline = true
    renderHook(() => useOfflineTripQueue(), {
      wrapper: makeWrapper(queryClient),
    })

    await new Promise((r) => setTimeout(r, 50))
    expect(mockUpdateTrip).not.toHaveBeenCalled()
  })

  it('flushes mutations in FIFO order (first appended is first sent)', async () => {
    const TRIP_ID_A = 'trip-fifo-a'
    const TRIP_ID_B = 'trip-fifo-b'
    appendPendingTripMutation({
      id: 'mut-a',
      kind: 'update',
      tripId: TRIP_ID_A,
      payload: { title: 'A' },
      queuedAt: '2026-04-02T10:00:00Z',
    })
    appendPendingTripMutation({
      id: 'mut-b',
      kind: 'update',
      tripId: TRIP_ID_B,
      payload: { title: 'B' },
      queuedAt: '2026-04-02T10:00:01Z',
    })
    useTripDraftStore.setState({ dirtyTripIds: [TRIP_ID_A, TRIP_ID_B] })

    const callOrder: string[] = []
    mockUpdateTrip.mockImplementation((_, tripId: string) => {
      callOrder.push(tripId)
      return Promise.resolve({ ...BASE_TRIP, id: tripId, revision: 2 })
    })

    mockIsOnline = true
    renderHook(() => useOfflineTripQueue(), {
      wrapper: makeWrapper(queryClient),
    })

    await waitFor(() => expect(mockUpdateTrip).toHaveBeenCalledTimes(2))
    expect(callOrder).toEqual([TRIP_ID_A, TRIP_ID_B])
  })

  it('hydrateDraftFromServer updates lastSyncedRevision after successful flush', async () => {
    appendPendingTripMutation(UPDATE_MUTATION)
    useTripDraftStore.setState({
      dirtyTripIds: [TRIP_ID],
      draftsById: {
        [TRIP_ID]: {
          tripId: TRIP_ID,
          title: 'Local changes',
          notes: '',
          origin: null,
          destination: BASE_TRIP.destination,
          stops: [],
          lastSyncedRevision: 1,
          lastSyncedAt: '2026-04-01T10:00:00Z',
        },
      },
    })
    const updatedTrip = { ...BASE_TRIP, revision: 2, updatedAt: '2026-04-02T11:00:00Z' }
    mockUpdateTrip.mockResolvedValue(updatedTrip)

    mockIsOnline = true
    renderHook(() => useOfflineTripQueue(), {
      wrapper: makeWrapper(queryClient),
    })

    await waitFor(() => expect(mockUpdateTrip).toHaveBeenCalledTimes(1))
    await waitFor(() => {
      const draft = useTripDraftStore.getState().draftsById[TRIP_ID]
      return expect(draft?.lastSyncedRevision).toBe(2)
    })
    expect(useTripDraftStore.getState().dirtyTripIds).not.toContain(TRIP_ID)
  })

  it('exposes triggerFlush that can be called manually', async () => {
    appendPendingTripMutation(UPDATE_MUTATION)
    useTripDraftStore.setState({ dirtyTripIds: [TRIP_ID] })
    mockUpdateTrip.mockResolvedValue({ ...BASE_TRIP, revision: 2 })
    // Start offline so no automatic flush on mount
    mockIsOnline = false

    const { result } = renderHook(() => useOfflineTripQueue(), {
      wrapper: makeWrapper(queryClient),
    })

    await new Promise((r) => setTimeout(r, 50))
    expect(mockUpdateTrip).not.toHaveBeenCalled()

    // Manually trigger while online
    mockIsOnline = true
    await act(async () => {
      await result.current.triggerFlush()
    })

    await waitFor(() => expect(mockUpdateTrip).toHaveBeenCalledTimes(1))
    expect(readPendingTripMutations()).toHaveLength(0)
  })
})
