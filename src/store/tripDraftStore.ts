import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Trip, TripPlaceSnapshot, TripWaypointInput } from '@/types/trip'

export interface TripDraft {
  tripId: string
  title: string
  notes: string
  origin: TripPlaceSnapshot | null
  destination: TripPlaceSnapshot | null
  stops: TripWaypointInput[]
  lastSyncedRevision: number | null
  lastSyncedAt: string | null
}

interface TripDraftStore {
  activeTripId: string | null
  draftsById: Record<string, TripDraft>
  dirtyTripIds: string[]
  pendingSyncCount: number
  lastSyncedAt: string | null
  hydrated: boolean

  setActiveTripId: (tripId: string | null) => void
  upsertDraft: (tripId: string, partial: Partial<Omit<TripDraft, 'tripId'>>) => void
  hydrateDraftFromServer: (trip: Trip) => void
  markDirty: (tripId: string) => void
  markClean: (tripId: string) => void
  removeDraft: (tripId: string) => void
  setPendingSyncCount: (count: number) => void
  setLastSyncedAt: (at: string) => void
  markHydrated: () => void
}

export const INITIAL_TRIP_DRAFT_STATE: Omit<
  TripDraftStore,
  | 'setActiveTripId'
  | 'upsertDraft'
  | 'hydrateDraftFromServer'
  | 'markDirty'
  | 'markClean'
  | 'removeDraft'
  | 'setPendingSyncCount'
  | 'setLastSyncedAt'
  | 'markHydrated'
> = {
  activeTripId: null,
  draftsById: {},
  dirtyTripIds: [],
  pendingSyncCount: 0,
  lastSyncedAt: null,
  hydrated: false,
}

export const useTripDraftStore = create<TripDraftStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_TRIP_DRAFT_STATE,

      setActiveTripId: (tripId) => set({ activeTripId: tripId }),

      upsertDraft: (tripId, partial) =>
        set((state) => {
          const defaults: TripDraft = {
            tripId,
            title: '',
            notes: '',
            origin: null,
            destination: null,
            stops: [],
            lastSyncedRevision: null,
            lastSyncedAt: null,
          }
          return {
            draftsById: {
              ...state.draftsById,
              [tripId]: { ...defaults, ...state.draftsById[tripId], ...partial },
            },
          }
        }),

      hydrateDraftFromServer: (trip) => {
        if (get().dirtyTripIds.includes(trip.id)) return
        set((state) => ({
          draftsById: {
            ...state.draftsById,
            [trip.id]: {
              tripId: trip.id,
              title: trip.title,
              notes: trip.notes,
              origin: trip.origin,
              destination: trip.destination,
              stops: trip.stops
                .filter((s) => s.stopKind === 'waypoint')
                .sort((a, b) => a.stopOrder - b.stopOrder)
                .map((s) => ({
                  id: s.id,
                  stopOrder: s.stopOrder,
                  source: s.source,
                  pinId: s.pinId,
                  place: s.place,
                  notes: s.notes,
                })),
              lastSyncedRevision: trip.revision,
              lastSyncedAt: trip.updatedAt,
            },
          },
        }))
      },

      markDirty: (tripId) =>
        set((state) => ({
          dirtyTripIds: state.dirtyTripIds.includes(tripId)
            ? state.dirtyTripIds
            : [...state.dirtyTripIds, tripId],
        })),

      markClean: (tripId) =>
        set((state) => ({
          dirtyTripIds: state.dirtyTripIds.filter((id) => id !== tripId),
        })),

      removeDraft: (tripId) =>
        set((state) => {
          const { [tripId]: _removed, ...rest } = state.draftsById
          return {
            draftsById: rest,
            dirtyTripIds: state.dirtyTripIds.filter((id) => id !== tripId),
            activeTripId: state.activeTripId === tripId ? null : state.activeTripId,
          }
        }),

      setPendingSyncCount: (count) => set({ pendingSyncCount: count }),
      setLastSyncedAt: (at) => set({ lastSyncedAt: at }),
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'trip-draft-store',
      partialize: (state) => ({
        draftsById: state.draftsById,
        dirtyTripIds: state.dirtyTripIds,
        pendingSyncCount: state.pendingSyncCount,
        lastSyncedAt: state.lastSyncedAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated()
      },
    },
  ),
)
