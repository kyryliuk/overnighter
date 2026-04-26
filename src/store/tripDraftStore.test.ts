import { describe, it, expect, beforeEach } from 'vitest'
import { useTripDraftStore, INITIAL_TRIP_DRAFT_STATE } from './tripDraftStore'
import type { Trip, TripStop } from '@/types/trip'

function resetStore() {
  localStorage.clear()
  useTripDraftStore.setState({ ...INITIAL_TRIP_DRAFT_STATE })
}

const makeTrip = (overrides?: Partial<Trip>): Trip => ({
  id: 'trip-1',
  title: 'My Route',
  notes: 'Some notes',
  status: 'draft',
  origin: { id: 'origin-1', name: 'Origin', latitude: 25.0, longitude: -80.0 },
  destination: { id: 'dest-1', name: 'Destination', latitude: 26.0, longitude: -81.0 },
  routeMode: 'corridor',
  stopCount: 1,
  revision: 3,
  isPublic: false,
  shareToken: null,
  sourceTripId: null,
  sourceShareToken: null,
  createdAt: '2024-06-01T00:00:00Z',
  updatedAt: '2024-06-15T12:00:00Z',
  stops: [],
  ...overrides,
})

const makeWaypointStop = (stopOrder: number): TripStop => ({
  id: `stop-${stopOrder}`,
  stopOrder,
  stopKind: 'waypoint',
  source: 'manual',
  pinId: null,
  place: { id: `place-${stopOrder}`, name: `Stop ${stopOrder}`, latitude: 25.5, longitude: -80.5 },
  notes: '',
  createdAt: '2024-06-01T00:00:00Z',
  updatedAt: '2024-06-01T00:00:00Z',
})

describe('useTripDraftStore', () => {
  beforeEach(resetStore)

  describe('initial state', () => {
    it('starts empty', () => {
      const state = useTripDraftStore.getState()
      expect(state.activeTripId).toBeNull()
      expect(state.draftsById).toEqual({})
      expect(state.dirtyTripIds).toEqual([])
      expect(state.pendingSyncCount).toBe(0)
      expect(state.lastSyncedAt).toBeNull()
    })
  })

  describe('setActiveTripId', () => {
    it('sets to a string', () => {
      useTripDraftStore.getState().setActiveTripId('trip-1')
      expect(useTripDraftStore.getState().activeTripId).toBe('trip-1')
    })

    it('sets to null', () => {
      useTripDraftStore.getState().setActiveTripId('trip-1')
      useTripDraftStore.getState().setActiveTripId(null)
      expect(useTripDraftStore.getState().activeTripId).toBeNull()
    })
  })

  describe('upsertDraft', () => {
    it('creates a new draft when none exists', () => {
      useTripDraftStore.getState().upsertDraft('trip-1', { title: 'New Trip' })
      const draft = useTripDraftStore.getState().draftsById['trip-1']
      expect(draft).toBeDefined()
      expect(draft.title).toBe('New Trip')
      expect(draft.tripId).toBe('trip-1')
    })

    it('applies defaults for unspecified fields', () => {
      useTripDraftStore.getState().upsertDraft('trip-1', { title: 'Only Title' })
      const draft = useTripDraftStore.getState().draftsById['trip-1']
      expect(draft.notes).toBe('')
      expect(draft.origin).toBeNull()
      expect(draft.destination).toBeNull()
      expect(draft.stops).toEqual([])
    })

    it('merges partial updates preserving existing fields', () => {
      useTripDraftStore.getState().upsertDraft('trip-1', { title: 'First Title', notes: 'Original notes' })
      useTripDraftStore.getState().upsertDraft('trip-1', { title: 'Updated Title' })
      const draft = useTripDraftStore.getState().draftsById['trip-1']
      expect(draft.title).toBe('Updated Title')
      expect(draft.notes).toBe('Original notes')
    })

    it('does not affect other drafts', () => {
      useTripDraftStore.getState().upsertDraft('trip-1', { title: 'Trip A' })
      useTripDraftStore.getState().upsertDraft('trip-2', { title: 'Trip B' })
      expect(useTripDraftStore.getState().draftsById['trip-1'].title).toBe('Trip A')
      expect(useTripDraftStore.getState().draftsById['trip-2'].title).toBe('Trip B')
    })
  })

  describe('hydrateDraftFromServer', () => {
    it('creates draft from Trip data when not dirty', () => {
      const trip = makeTrip()
      useTripDraftStore.getState().hydrateDraftFromServer(trip)
      const draft = useTripDraftStore.getState().draftsById['trip-1']
      expect(draft.title).toBe('My Route')
      expect(draft.notes).toBe('Some notes')
      expect(draft.lastSyncedRevision).toBe(3)
      expect(draft.lastSyncedAt).toBe('2024-06-15T12:00:00Z')
    })

    it('maps only waypoint stops (filters destination stops)', () => {
      const stops: TripStop[] = [
        makeWaypointStop(0),
        { ...makeWaypointStop(1), stopKind: 'destination' },
      ]
      const trip = makeTrip({ stops })
      useTripDraftStore.getState().hydrateDraftFromServer(trip)
      const draft = useTripDraftStore.getState().draftsById['trip-1']
      expect(draft.stops).toHaveLength(1)
      expect(draft.stops[0].id).toBe('stop-0')
    })

    it('sorts waypoint stops by stopOrder', () => {
      const stops: TripStop[] = [makeWaypointStop(2), makeWaypointStop(0), makeWaypointStop(1)]
      const trip = makeTrip({ stops })
      useTripDraftStore.getState().hydrateDraftFromServer(trip)
      const draft = useTripDraftStore.getState().draftsById['trip-1']
      expect(draft.stops.map((s) => s.stopOrder)).toEqual([0, 1, 2])
    })

    it('does NOT overwrite an existing dirty draft', () => {
      useTripDraftStore.getState().upsertDraft('trip-1', { title: 'Local Edit' })
      useTripDraftStore.getState().markDirty('trip-1')

      const trip = makeTrip({ title: 'Server Title' })
      useTripDraftStore.getState().hydrateDraftFromServer(trip)

      const draft = useTripDraftStore.getState().draftsById['trip-1']
      expect(draft.title).toBe('Local Edit')
    })

    it('sets origin and destination from Trip', () => {
      const trip = makeTrip()
      useTripDraftStore.getState().hydrateDraftFromServer(trip)
      const draft = useTripDraftStore.getState().draftsById['trip-1']
      expect(draft.origin?.name).toBe('Origin')
      expect(draft.destination?.name).toBe('Destination')
    })
  })

  describe('markDirty / markClean', () => {
    it('markDirty adds tripId to dirtyTripIds', () => {
      useTripDraftStore.getState().markDirty('trip-1')
      expect(useTripDraftStore.getState().dirtyTripIds).toContain('trip-1')
    })

    it('markDirty is idempotent — calling twice does not duplicate', () => {
      useTripDraftStore.getState().markDirty('trip-1')
      useTripDraftStore.getState().markDirty('trip-1')
      expect(useTripDraftStore.getState().dirtyTripIds.filter((id) => id === 'trip-1')).toHaveLength(1)
    })

    it('markClean removes tripId from dirtyTripIds', () => {
      useTripDraftStore.getState().markDirty('trip-1')
      useTripDraftStore.getState().markDirty('trip-2')
      useTripDraftStore.getState().markClean('trip-1')
      expect(useTripDraftStore.getState().dirtyTripIds).not.toContain('trip-1')
      expect(useTripDraftStore.getState().dirtyTripIds).toContain('trip-2')
    })

    it('markClean is a no-op when tripId is not dirty', () => {
      expect(() => useTripDraftStore.getState().markClean('not-dirty')).not.toThrow()
      expect(useTripDraftStore.getState().dirtyTripIds).toEqual([])
    })
  })

  describe('removeDraft', () => {
    it('removes from draftsById', () => {
      useTripDraftStore.getState().upsertDraft('trip-1', { title: 'To Remove' })
      useTripDraftStore.getState().removeDraft('trip-1')
      expect(useTripDraftStore.getState().draftsById['trip-1']).toBeUndefined()
    })

    it('removes from dirtyTripIds', () => {
      useTripDraftStore.getState().upsertDraft('trip-1', { title: 'T' })
      useTripDraftStore.getState().markDirty('trip-1')
      useTripDraftStore.getState().removeDraft('trip-1')
      expect(useTripDraftStore.getState().dirtyTripIds).not.toContain('trip-1')
    })

    it('clears activeTripId when it matches', () => {
      useTripDraftStore.getState().setActiveTripId('trip-1')
      useTripDraftStore.getState().upsertDraft('trip-1', { title: 'T' })
      useTripDraftStore.getState().removeDraft('trip-1')
      expect(useTripDraftStore.getState().activeTripId).toBeNull()
    })

    it('does not clear activeTripId for a different trip', () => {
      useTripDraftStore.getState().setActiveTripId('trip-2')
      useTripDraftStore.getState().upsertDraft('trip-1', { title: 'T' })
      useTripDraftStore.getState().removeDraft('trip-1')
      expect(useTripDraftStore.getState().activeTripId).toBe('trip-2')
    })

    it('leaves other drafts intact', () => {
      useTripDraftStore.getState().upsertDraft('trip-1', { title: 'Keep' })
      useTripDraftStore.getState().upsertDraft('trip-2', { title: 'Remove' })
      useTripDraftStore.getState().removeDraft('trip-2')
      expect(useTripDraftStore.getState().draftsById['trip-1'].title).toBe('Keep')
    })
  })

  describe('setPendingSyncCount / setLastSyncedAt', () => {
    it('sets pendingSyncCount', () => {
      useTripDraftStore.getState().setPendingSyncCount(5)
      expect(useTripDraftStore.getState().pendingSyncCount).toBe(5)
    })

    it('sets lastSyncedAt', () => {
      const now = '2024-06-15T12:00:00Z'
      useTripDraftStore.getState().setLastSyncedAt(now)
      expect(useTripDraftStore.getState().lastSyncedAt).toBe(now)
    })
  })
})
