# Story 4.1: Local Draft Store and Pending Mutation Queue

Status: done

## Story

As a **premium user**,
I want route edits to save locally first,
so that I do not lose trip work when connectivity drops or the app reloads.

## Context

Phase 3 Epics 1–3 delivered the full premium route-planning experience: normalized `trips` + `trip_stops` schema, a gated **My Routes** workspace, the corridor-stop builder, and library management (create, duplicate, archive, delete). All edits currently live in `RouteBuilderSheet`'s local `useState` hooks and are sent directly to the server via `useUpdateTripMutation`. If connectivity drops mid-edit or the user refreshes, all in-progress edits are lost.

This story lays the offline-first infrastructure for Phase 3 Epic 4:

1. A **`tripDraftStore`** (Zustand + persist) that keeps editable drafts across refreshes and brief disconnects.
2. A **`pendingTripMutations`** localStorage queue that capture mutation intents for later flush (flush logic is Epic 4 Story 4.3; this story creates the queue module and makes the mutation hooks enqueue when offline).
3. Wiring `RouteBuilderSheet` to read from and write to `tripDraftStore` so edits survive a browser reload.

### What Already Exists

- `src/lib/offline/pendingCheckins.ts` — the proven localStorage + event-dispatch offline queue pattern to mirror.
- `src/hooks/useOnlineStatus.ts` — `useOnlineStatus()` returning a boolean live-updated from `navigator.onLine`.
- `src/store/rigStore.ts` — Zustand `create + persist` pattern with `partialize` and `onRehydrateStorage`, canonical store pattern for this project.
- `src/store/tripPlansStore.ts` — legacy Zustand + persist store shape, helpful reference.
- `src/features/route-planning/useCreateTripMutation.ts`, `useUpdateTripMutation.ts`, `useTripStatusMutation.ts`, `useDeleteTripMutation.ts` — existing mutation hooks to extend with offline enqueue behavior.
- `src/features/route-planning/RouteBuilderSheet.tsx` — active builder that uses `useState` for `title`, `notes`, `origin`, `destination`, `waypoints`, initialized from the `trip` prop. Needs draft-store wiring.
- `src/features/route-planning/MyRoutesScreen.tsx` — orchestrates `useTripQuery` load and passes the server `Trip` to `RouteBuilderSheet`. Needs draft hydration call.
- `src/types/trip.ts` — `Trip`, `TripWritePayload`, `TripWaypointInput`, `TripPlaceSnapshot`, `TripStatus`, `TripStopSource`.

### What This Story Must NOT Add

- Sync status UX badges (`Local draft`, `Sync pending`, `Synced`, `Sync error`) — Epic 4 Story 4.2.
- The reconnect flush logic and conflict resolution — Epic 4 Story 4.3.
- Any new Supabase migrations — current schema fully supports this story.
- Changes to the `/api/trips` server endpoints.
- Legacy `useTripPlansStore` removal — not in scope for Epic 4.

---

## Acceptance Criteria

### AC 1 — `tripDraftStore` exists with full persisted shape

**Given** the app loads  
**When** `tripDraftStore` is initialized  
**Then** it exposes `activeTripId`, `draftsById`, `dirtyTripIds`, `pendingSyncCount`, `lastSyncedAt`, and `hydrated` as state  
**And** `draftsById` and `dirtyTripIds` persist in `localStorage` under the key `trip-draft-store` via Zustand `persist`.

### AC 2 — Route builder edits persist across browser refresh

**Given** a premium user has the route builder open with an existing trip  
**When** they edit the title, notes, origin, destination, or stops  
**Then** each change is written to `tripDraftStore` within 600 ms via a debounced effect  
**And** after a full browser page reload, the builder re-opens with the locally saved draft values instead of the stale server snapshot.

### AC 3 — Draft-first initialization in RouteBuilderSheet

**Given** a trip has an unsaved local draft in `tripDraftStore`  
**When** `RouteBuilderSheet` mounts with that trip  
**Then** it initializes its `useState` hooks from the dirty draft rather than from the server `Trip` prop  
**And** the user sees their unsaved edits immediately without a jarring reset to server state.

### AC 4 — `pendingTripMutations` queue module mirrors `pendingCheckins` architecture

**Given** the app is offline (`useOnlineStatus()` returns `false`)  
**When** a mutation hook is called (create, update, updateStatus, delete)  
**Then** the mutation is appended to the `pendingTripMutations` localStorage queue instead of making a network call  
**And** a `pending-trip-mutations-updated` custom event is dispatched on `window`  
**And** the queue item is retained until explicitly removed.

### AC 5 — `pendingTripMutations` queue is well-typed and validated on read

**Given** the localStorage contains `pendingTripMutations` data  
**When** `readPendingTripMutations()` is called  
**Then** it returns only items that pass the `isPendingTripMutationArray` type guard  
**And** it returns an empty array on corrupt/invalid JSON rather than throwing.

### AC 6 — Setting the active trip id updates `tripDraftStore`

**Given** the builder opens a trip  
**When** the trip's server data loads  
**Then** `tripDraftStore.setActiveTripId(trip.id)` is called  
**And** if no dirty local draft exists for that trip, `hydrateDraftFromServer(trip)` is called to pre-populate the draft from server state  
**And** on builder close, `setActiveTripId(null)` is called.

---

## Tasks / Subtasks

### Task 1 — Create `src/lib/offline/pendingTripMutations.ts` (AC: 4, 5)

**Primary files:**
- `src/lib/offline/pendingTripMutations.ts` (NEW)

This module must be a near-identical structural mirror of `src/lib/offline/pendingCheckins.ts`.

- [x] 1.1 Define the mutation kind union and interface:
  ```typescript
  import type { TripWritePayload, TripStatus } from '@/types/trip'

  export type PendingTripMutationKind = 'create' | 'update' | 'updateStatus' | 'delete'

  export interface PendingTripMutation {
    id: string                                               // crypto.randomUUID() at enqueue time
    kind: PendingTripMutationKind
    tripId: string                                           // server id for update/updateStatus/delete; local draft id for create
    payload?: TripWritePayload | { status: TripStatus }      // undefined for 'delete'
    queuedAt: string                                         // ISO timestamp
  }
  ```

- [x] 1.2 Define constants and type guard (mirror `pendingCheckins.ts`):
  ```typescript
  const PENDING_TRIP_MUTATIONS_KEY = 'pendingTripMutations'
  export const PENDING_TRIP_MUTATIONS_UPDATED_EVENT = 'pending-trip-mutations-updated'

  function canUseStorage() {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
  }

  function isPendingTripMutationArray(value: unknown): value is PendingTripMutation[] {
    if (!Array.isArray(value)) return false
    return value.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.kind === 'string' &&
        typeof item.tripId === 'string' &&
        typeof item.queuedAt === 'string',
    )
  }
  ```

- [x] 1.3 Implement `readPendingTripMutations()`, `appendPendingTripMutation()`, `removePendingTripMutation(id)`, and `clearPendingTripMutations()`
  - `readPendingTripMutations()`: reads, parses, validates, returns `PendingTripMutation[]`
  - `appendPendingTripMutation(mutation: PendingTripMutation)`: appends, saves, dispatches event
  - `removePendingTripMutation(id: string)`: filters by `id` field (not `queuedAt`), saves, dispatches event
  - `clearPendingTripMutations()`: removes key, dispatches event

### Task 2 — Create `src/store/tripDraftStore.ts` (AC: 1, 6)

**Primary files:**
- `src/store/tripDraftStore.ts` (NEW)

Follow the `rigStore.ts` pattern: `create<TripDraftStore>()(persist(..., { name: 'trip-draft-store', partialize, onRehydrateStorage }))`.

- [x] 2.1 Define the `TripDraft` interface (stored per trip id):
  ```typescript
  import type { TripPlaceSnapshot, TripWaypointInput } from '@/types/trip'

  export interface TripDraft {
    tripId: string
    title: string
    notes: string
    origin: TripPlaceSnapshot | null
    destination: TripPlaceSnapshot | null   // null only while a brand-new trip has no destination yet
    stops: TripWaypointInput[]
    lastSyncedRevision: number | null       // set when hydrating from server; used for conflict detection (Story 4.3)
    lastSyncedAt: string | null
  }
  ```

- [x] 2.2 Define `TripDraftStore` interface:
  ```typescript
  import type { Trip } from '@/types/trip'

  interface TripDraftStore {
    activeTripId: string | null
    draftsById: Record<string, TripDraft>
    dirtyTripIds: string[]           // persisted; can't use Set with Zustand persist
    pendingSyncCount: number         // number of items currently in the pending queue (for badge in Story 4.2)
    lastSyncedAt: string | null
    hydrated: boolean

    setActiveTripId: (tripId: string | null) => void
    upsertDraft: (tripId: string, partial: Partial<Omit<TripDraft, 'tripId'>>) => void
    hydrateDraftFromServer: (trip: Trip) => void  // only writes if trip is NOT already in dirtyTripIds
    markDirty: (tripId: string) => void
    markClean: (tripId: string) => void
    removeDraft: (tripId: string) => void
    setPendingSyncCount: (count: number) => void
    setLastSyncedAt: (at: string) => void
    markHydrated: () => void
  }
  ```

- [x] 2.3 Implement the store:
  ```typescript
  import { create } from 'zustand'
  import { persist } from 'zustand/middleware'
  import type { Trip, TripPlaceSnapshot, TripWaypointInput } from '@/types/trip'

  export const useTripDraftStore = create<TripDraftStore>()(
    persist(
      (set, get) => ({
        activeTripId: null,
        draftsById: {},
        dirtyTripIds: [],
        pendingSyncCount: 0,
        lastSyncedAt: null,
        hydrated: false,

        setActiveTripId: (tripId) => set({ activeTripId: tripId }),

        upsertDraft: (tripId, partial) =>
          set((state) => ({
            draftsById: {
              ...state.draftsById,
              [tripId]: {
                tripId,
                title: '',
                notes: '',
                origin: null,
                destination: null,
                stops: [],
                lastSyncedRevision: null,
                lastSyncedAt: null,
                ...state.draftsById[tripId],
                ...partial,
              },
            },
          })),

        hydrateDraftFromServer: (trip) => {
          if (get().dirtyTripIds.includes(trip.id)) return   // preserve local edits
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
  ```
  
  Note: `activeTripId` is intentionally NOT persisted — it should reset to `null` on every page load to avoid pointing at a non-existent builder state.

### Task 3 — Wire `RouteBuilderSheet.tsx` to read and write `tripDraftStore` (AC: 2, 3)

**Primary files:**
- `src/features/route-planning/RouteBuilderSheet.tsx`

The sheet currently initializes all editing state from the `trip` prop using `useState` lazy initializers. This task makes the builder prefer a dirty local draft on open and write back to the store on every change.

- [x] 3.1 Import the store and read the relevant draft state before the `useState` hooks:
  ```typescript
  import { useTripDraftStore } from '@/store/tripDraftStore'
  import { compactTripWaypointOrders } from './routePlanning'  // already imported

  // Inside the component, before existing useState:
  const { draftsById, dirtyTripIds, upsertDraft, markDirty, setActiveTripId } = useTripDraftStore()
  const existingDraft = trip ? draftsById[trip.id] : null
  const isDirty = trip ? dirtyTripIds.includes(trip.id) : false
  const draftSource = isDirty && existingDraft ? existingDraft : null
  ```

- [x] 3.2 Update each `useState` lazy initializer to prefer `draftSource` when available:
  ```typescript
  const [title, setTitle] = useState(() => draftSource?.title ?? trip?.title ?? '')
  const [notes, setNotes] = useState(() => draftSource?.notes ?? trip?.notes ?? '')
  const [originQuery, setOriginQuery] = useState(() =>
    (draftSource?.origin?.name ?? trip?.origin?.name) ?? '',
  )
  const [destinationQuery, setDestinationQuery] = useState(() =>
    (draftSource?.destination?.name ?? trip?.destination?.name) ?? '',
  )
  const [origin, setOrigin] = useState<TripPlaceSnapshot | null>(
    () => draftSource?.origin ?? trip?.origin ?? null,
  )
  const [destination, setDestination] = useState<TripPlaceSnapshot | null>(
    () => draftSource?.destination ?? trip?.destination ?? null,
  )
  ```
  
  For waypoints, the existing `restoredWaypoints` memo reads from `trip?.stops`. Update the initial waypoints state to use draft stops when dirty:
  ```typescript
  const [waypoints, setWaypoints] = useState(() =>
    draftSource?.stops ?? restoredWaypoints,
  )
  ```
  
  **Important:** The lazy initializer runs only once on mount. The draft check at initializer time is sufficient — do NOT add a `useEffect` that resets state when `trip` changes, as that would clobber in-progress edits.

- [x] 3.3 Add a `useEffect` to set/clear `activeTripId` on mount/unmount:
  ```typescript
  useEffect(() => {
    if (trip) {
      setActiveTripId(trip.id)
    }
    return () => {
      setActiveTripId(null)
    }
  }, [trip?.id, setActiveTripId])
  ```

- [x] 3.4 Add a debounced effect to persist edits to the draft store.
  ```typescript
  const persistDraftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!trip?.id || !isResumeMode) return

    const tripId = trip.id

    if (persistDraftTimer.current) {
      clearTimeout(persistDraftTimer.current)
    }

    persistDraftTimer.current = setTimeout(() => {
      upsertDraft(tripId, {
        title,
        notes,
        origin,
        destination,
        stops: compactTripWaypointOrders(waypoints),
      })
      markDirty(tripId)
    }, 600)

    return () => {
      if (persistDraftTimer.current) {
        clearTimeout(persistDraftTimer.current)
      }
    }
  }, [title, notes, origin, destination, waypoints, trip?.id, isResumeMode, upsertDraft, markDirty])
  ```
  
  600 ms debounce is fast enough to feel responsive while not flooding localStorage on every keystroke.

- [x] 3.5 After a successful `onSave` call, call `markClean(trip.id)` to clear the dirty flag.
  ```typescript
  // In the handleSave (or similar) function, after onSave resolves:
  if (trip?.id) {
    markClean(trip.id)
  }
  ```
  
  Find the existing `onSave` invocation in the sheet and add this call after the `await` (check where `isSaving` is set to see the flow).

### Task 4 — Hydrate draft store in `MyRoutesScreen.tsx` when a trip loads (AC: 6)

**Primary files:**
- `src/features/route-planning/MyRoutesScreen.tsx`

`MyRoutesContent` already uses `useTripQuery` to load the active trip and passes it to `RouteBuilderSheet`. When the server data arrives, we should hydrate the draft store if the trip has no dirty local draft yet.

- [x] 4.1 Import `useTripDraftStore` in `MyRoutesScreen.tsx`:
  ```typescript
  import { useTripDraftStore } from '@/store/tripDraftStore'
  ```

- [x] 4.2 Inside `MyRoutesContent`, add a `useEffect` that hydrates the draft store when server data arrives.
  ```typescript
  const { hydrateDraftFromServer } = useTripDraftStore()

  const { data: activeTrip } = useTripQuery(userId, activeTripId)  // already exists

  useEffect(() => {
    if (activeTrip) {
      hydrateDraftFromServer(activeTrip)
    }
  }, [activeTrip, hydrateDraftFromServer])
  ```
  
  `hydrateDraftFromServer` is a no-op when the trip already has a dirty local draft, so this is safe to call on every query refresh.

- [x] 4.3 When an archive, unarchive, or delete mutation succeeds, call `removeDraft(tripId)` to clean up the draft store.
  ```typescript
  const { removeDraft } = useTripDraftStore()
  
  // In the archive mutation onSuccess (inside MyRoutesContent):
  removeDraft(archivedTripId)
  
  // In the delete mutation onSuccess:
  removeDraft(deletedTripId)
  ```
  
  Look at the existing `useTripStatusMutation` and `useDeleteTripMutation` call sites — they are inline mutation callbacks in `MyRoutesContent`. Add `removeDraft` calls there alongside the existing `closeBuilder()` call.

### Task 5 — Offline enqueue in existing mutation hooks (AC: 4)

**Primary files:**
- `src/features/route-planning/useCreateTripMutation.ts`
- `src/features/route-planning/useUpdateTripMutation.ts`
- `src/features/route-planning/useTripStatusMutation.ts`
- `src/features/route-planning/useDeleteTripMutation.ts`

Each mutation hook calls an API function. When offline, enqueue to `pendingTripMutations` instead. **Story 4.3** handles flushing the queue; this task only ensures writes are captured when offline.

- [x] 5.1 Import and use `useOnlineStatus` and `appendPendingTripMutation` in each hook.
  ```typescript
  import { useOnlineStatus } from '@/hooks/useOnlineStatus'
  import {
    appendPendingTripMutation,
    type PendingTripMutation,
  } from '@/lib/offline/pendingTripMutations'
  ```

- [x] 5.2 In `useUpdateTripMutation.mutationFn`, before the API call, check online status.
  ```typescript
  mutationFn: async ({ tripId, payload }: UpdateTripMutationInput) => {
    if (!isAuthenticated || !accessToken) {
      throw new Error('Sign in again to update your route.')
    }
    if (!isOnline) {
      appendPendingTripMutation({
        id: crypto.randomUUID(),
        kind: 'update',
        tripId,
        payload,
        queuedAt: new Date().toISOString(),
      })
      // Return a sentinel value indicating offline queuing — the UI should treat this as a deferred success.
      // Return the current cached trip data from queryClient if available, or throw a specific offline error.
      const cached = queryClient.getQueryData<Trip>(tripQueryKey(userId, tripId))
      if (cached) return cached
      throw new Error('OFFLINE_QUEUED')
    }
    return updateTrip(accessToken, tripId, payload)
  },
  ```
  
  **Note:** returning the cached trip on offline preserves the `onSuccess` cache update logic. If no cache exists, the error `'OFFLINE_QUEUED'` is a known sentinel that the builder can ignore (the draft store already has the data).

- [x] 5.3 Apply the same offline-first pattern to `useCreateTripMutation`, `useTripStatusMutation`, and `useDeleteTripMutation`.
  - `useCreateTripMutation`: enqueue with `kind: 'create'`, payload is the `TripWritePayload`. No cached trip to return — throw `'OFFLINE_QUEUED'`.
  - `useTripStatusMutation`: enqueue with `kind: 'updateStatus'`, payload is `{ status }`. Return cached trip if available.
  - `useDeleteTripMutation`: enqueue with `kind: 'delete'`, no payload. Return `undefined` (delete has no return).

- [x] 5.4 The `isOnline` value must come from calling `useOnlineStatus()` at the hook's top level.
  ```typescript
  export function useUpdateTripMutation() {
    const isOnline = useOnlineStatus()
    // ...rest of hook
    return useMutation({
      mutationFn: async (...) => {
        // isOnline captured from outer scope
      }
    })
  }
  ```

### Task 6 — Tests for `pendingTripMutations.ts` (AC: 4, 5)

**Primary files:**
- `src/lib/offline/pendingTripMutations.test.ts` (NEW)

Mirror the test file structure of `src/lib/offline/pendingCheckins.test.ts`.

- [x] 6.1 Mock `localStorage` with a simple in-memory store (or use jsdom's built-in localStorage).
- [x] 6.2 Test `readPendingTripMutations()`:
  - returns empty array when localStorage is empty
  - returns parsed queue when valid JSON exists
  - returns empty array on corrupt JSON (covers AC 5)
  - returns empty array when items fail the type guard
- [x] 6.3 Test `appendPendingTripMutation()`:
  - appends to empty queue
  - appends to existing queue (preserves prior items)
  - dispatches `pending-trip-mutations-updated` event on window
- [x] 6.4 Test `removePendingTripMutation(id)`:
  - removes the matching item by `id`
  - leaves other items intact
  - dispatches event
  - is a no-op when id not found (no throw)
- [x] 6.5 Test `clearPendingTripMutations()`:
  - clears all items
  - dispatches event

### Task 7 — Tests for `tripDraftStore.ts` (AC: 1, 2, 3, 6)

**Primary files:**
- `src/store/tripDraftStore.test.ts` (NEW)

- [x] 7.1 Test `upsertDraft`:
  - creates a new draft when none exists
  - merges partial updates onto existing draft (preserves existing fields not in partial)
- [x] 7.2 Test `hydrateDraftFromServer`:
  - creates draft from Trip data when trip is not dirty
  - maps waypoint stops (filters `stopKind === 'waypoint'`, sorts by `stopOrder`)
  - does NOT overwrite an existing dirty draft (trip id is in `dirtyTripIds`)
  - sets `lastSyncedRevision` and `lastSyncedAt` from server trip
- [x] 7.3 Test `markDirty` / `markClean`:
  - `markDirty` adds tripId to `dirtyTripIds` once (idempotent — calling twice doesn't duplicate)
  - `markClean` removes tripId from `dirtyTripIds`
  - `markClean` is a no-op when tripId is not dirty
- [x] 7.4 Test `removeDraft`:
  - removes from `draftsById`
  - removes from `dirtyTripIds`
  - clears `activeTripId` if it matches
  - leaves other drafts intact
- [x] 7.5 Test `setActiveTripId`:
  - sets to a string
  - sets to null
- [x] 7.6 Test store reset between each test (`beforeEach(() => { useTripDraftStore.setState({ ... initialState ... }) })`).

---

## Dev Notes

### Architecture patterns

- **Zustand persist pattern:** Follow `rigStore.ts` exactly — `create<StoreType>()(persist(fn, { name, partialize, onRehydrateStorage }))`. Use `partialize` to exclude `activeTripId` and `hydrated` from persistence. Use `onRehydrateStorage` to call `markHydrated()`.
- **Offline queue pattern:** Follow `pendingCheckins.ts` exactly — pure module (no React), `canUseStorage()` guard, type guard on read, `localStorage.setItem + window.dispatchEvent` on every write.
- **Draft-first initialization:** `useState` lazy initializers run once. Reading from the draft store inside the lazy initializer (before the hook) is the correct pattern — no `useEffect` needed for initialization.
- **Debounce without a library:** Use a `useRef<ReturnType<typeof setTimeout>>` timer inside a `useEffect`. The cleanup function clears the timer. 600 ms aligns with the architecture guidance.
- **`isOnline` in mutation hooks:** Must be called at the hook's top level (hooks rules). It's captured in the `mutationFn` closure automatically.
- **`crypto.randomUUID()`** is available in all modern browsers and Node.js 16+. Use it for queue item ids.

### File locations

```
src/
  lib/
    offline/
      pendingTripMutations.ts          ← NEW (Task 1)
      pendingTripMutations.test.ts     ← NEW (Task 6)
      pendingCheckins.ts               ← reference, do not modify
  store/
    tripDraftStore.ts                  ← NEW (Task 2)
    tripDraftStore.test.ts             ← NEW (Task 7)
  features/
    route-planning/
      RouteBuilderSheet.tsx            ← MODIFY (Task 3)
      MyRoutesScreen.tsx               ← MODIFY (Task 4)
      useCreateTripMutation.ts         ← MODIFY (Task 5)
      useUpdateTripMutation.ts         ← MODIFY (Task 5)
      useTripStatusMutation.ts         ← MODIFY (Task 5)
      useDeleteTripMutation.ts         ← MODIFY (Task 5)
  hooks/
    useOnlineStatus.ts                 ← reference, do not modify
  types/
    trip.ts                            ← reference, do not modify
```

### Key cross-file contract

The `tripDraftStore.dirtyTripIds` array is the authoritative list of "locally modified, not yet confirmed by server" trips. Story 4.2 reads it to render sync badges. Story 4.3 reads it alongside the pending queue for conflict resolution. **Do not remove an item from `dirtyTripIds` unless either (a) `markClean()` is called after a successful server response, or (b) `removeDraft()` is called on archive/delete.**

### Testing standards

- Tests run in jsdom environment — `localStorage` is available as a global.
- For store tests: call `useTripDraftStore.setState({ ...initialState })` in `beforeEach` to avoid cross-test contamination. Export a `INITIAL_TRIP_DRAFT_STATE` constant from `tripDraftStore.ts` for convenience.
- For queue tests: call `localStorage.clear()` in `beforeEach`.
- Spy on `window.dispatchEvent` with `vi.spyOn` to assert custom events are dispatched.
- Import types from `@/types/trip` — do not redefine them in tests.

### Project Structure Notes

- Store file lives in `src/store/` (alongside `rigStore.ts`, `tripPlansStore.ts`).
- Queue file lives in `src/lib/offline/` (alongside `pendingCheckins.ts`).
- Import alias `@/` maps to `src/` — use it everywhere.
- DB types stay in `src/lib/supabase/types.ts`; client types stay in `src/types/trip.ts`. This story uses only client types.

### References

- Offline queue pattern: [Source: src/lib/offline/pendingCheckins.ts]
- Zustand + persist store pattern: [Source: src/store/rigStore.ts]
- Online status hook: [Source: src/hooks/useOnlineStatus.ts]
- Trip types: [Source: src/types/trip.ts]
- RouteBuilderSheet editing state: [Source: src/features/route-planning/RouteBuilderSheet.tsx#L159-L174]
- Architecture offline behavior section: [Source: _bmad-output/planning-artifacts/architecture-phase3.md#Offline-Behavior-and-Sync-Rules]
- Epic 4 story definitions: [Source: _bmad-output/planning-artifacts/epics-phase3.md#Epic-4-Offline-Drafting--Sync-Resilience]

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

None — implementation proceeded cleanly without debugging detours.

### Completion Notes List

- ✅ Task 1: Created `src/lib/offline/pendingTripMutations.ts` — exact structural mirror of `pendingCheckins.ts`. Exports `PendingTripMutation`, `PENDING_TRIP_MUTATIONS_UPDATED_EVENT`, `readPendingTripMutations`, `appendPendingTripMutation`, `removePendingTripMutation`, `clearPendingTripMutations`. Uses `id` field (UUID) for removal, vs `queuedAt` in the checkins queue.
- ✅ Task 2: Created `src/store/tripDraftStore.ts` — Zustand + persist store following `rigStore.ts` pattern. `activeTripId` and `hydrated` intentionally NOT persisted. Exports `INITIAL_TRIP_DRAFT_STATE` for test isolation. `hydrateDraftFromServer` guards against overwriting dirty drafts.
- ✅ Task 3: Modified `RouteBuilderSheet.tsx` — draft-first `useState` lazy initializers, mount/unmount `setActiveTripId` effect, 600ms debounced persist effect, `markClean` after successful save.
- ✅ Task 4: Modified `MyRoutesScreen.tsx` — `hydrateDraftFromServer` effect on `activeTrip` query result, `removeDraft` called in archive and delete success handlers.
- ✅ Task 5: Modified all 4 mutation hooks — `useOnlineStatus()` called at hook top level, captured in `mutationFn` closure. Offline path: enqueue to `pendingTripMutations`, return cached trip or throw `'OFFLINE_QUEUED'` sentinel.
- ✅ Task 6: Created `src/lib/offline/pendingTripMutations.test.ts` — 15 tests covering CRUD, event dispatch, type guard, and corrupt JSON safety. All pass.
- ✅ Task 7: Created `src/store/tripDraftStore.test.ts` — 23 tests covering all store actions, idempotency, guard conditions. All pass.
- ✅ Full regression suite: 1436/1436 tests pass (117 test files).

### File List

- `src/lib/offline/pendingTripMutations.ts` (NEW)
- `src/lib/offline/pendingTripMutations.test.ts` (NEW)
- `src/store/tripDraftStore.ts` (NEW)
- `src/store/tripDraftStore.test.ts` (NEW)
- `src/features/route-planning/RouteBuilderSheet.tsx` (MODIFIED)
- `src/features/route-planning/RouteBuilderSheet.test.tsx` (MODIFIED)
- `src/features/route-planning/MyRoutesScreen.tsx` (MODIFIED)
- `src/features/route-planning/useUpdateTripMutation.ts` (MODIFIED)
- `src/features/route-planning/useCreateTripMutation.ts` (MODIFIED)
- `src/features/route-planning/useTripStatusMutation.ts` (MODIFIED)
- `src/features/route-planning/useDeleteTripMutation.ts` (MODIFIED)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFIED)
- `_bmad-output/implementation-artifacts/p3-4-1-local-draft-store-and-pending-mutation-queue.md` (MODIFIED)

## Change Log

- 2026-03-31: Implemented all 7 tasks for Story p3-4-1 — offline draft store (`tripDraftStore`), pending mutation queue (`pendingTripMutations`), `RouteBuilderSheet` draft wiring, `MyRoutesScreen` hydration/cleanup, 4 mutation hook offline-enqueue, 38 new tests (15 queue + 23 store). All ACs satisfied. Full regression suite: 1436/1436 passing.
- 2026-03-31: Code review (AI) — 3 MEDIUM and 3 LOW issues found and addressed. MEDIUM-1: `useDeleteTripMutation` offline path now throws `OFFLINE_QUEUED_ERROR` (was returning `undefined`, causing ghost-trip flicker on reconnect); `handleConfirmDelete` updated to handle sentinel. MEDIUM-2: `RouteBuilderSheet.test.tsx` added to File List. MEDIUM-3: Added 2 tests covering `handleSubmit` OFFLINE_QUEUED_ERROR behaviour (markClean not called; no alert rendered). LOW-4/5/6 noted. Final suite: 1439/1439 passing (117 files).

---

## Senior Developer Review (AI)

**Reviewer:** claude-sonnet-4.6 (adversarial code review)
**Review Date:** 2026-03-31
**Story Status After Review:** done

### Summary

Story p3-4-1 delivers a solid offline-first foundation. All 6 ACs are fully implemented, all tasks are genuinely complete, and the code faithfully mirrors the established `pendingCheckins` / `rigStore` patterns. The implementation is clean, well-tested (40 tests), and integrates correctly with the existing mutation layer.

### Issues Found and Resolution

| ID | Severity | Description | Resolution |
|---|---|---|---|
| MEDIUM-1 | Medium | `useDeleteTripMutation` offline path returned `undefined` — `onSuccess` fired and removed trip from cache before server confirmed, causing ghost-trip flicker on reconnect | Fixed: offline path now throws `OFFLINE_QUEUED_ERROR`; `handleConfirmDelete` handles sentinel explicitly with `removeDraft` + `closeBuilder` |
| MEDIUM-2 | Medium | `RouteBuilderSheet.test.tsx` modified (test isolation fix) but absent from story File List | Fixed: file added to File List |
| MEDIUM-3 | Medium | No tests for `handleSubmit` OFFLINE_QUEUED_ERROR guard — HIGH bug fixes from code review were unverified | Fixed: 2 new tests added (`markClean` not called on offline save; no alert rendered for sentinel) |
| LOW-4 | Low | `handleDuplicateTrip` offline path gives zero user feedback | Noted; deferred to Story 4.2 sync badges |
| LOW-5 | Low | `useCreateTripMutation` local placeholder `tripId` undocumented | Fixed: inline comment added explaining Story 4.3 reconciliation requirement |
| LOW-6 | Low | `useTripDraftStore()` no-selector usage subscribes component to all store changes | Noted; acceptable at current scale |

### Architecture Compliance

✅ `pendingTripMutations.ts` — exact structural mirror of `pendingCheckins.ts`
✅ `tripDraftStore.ts` — follows `rigStore.ts` Zustand + persist + partialize pattern
✅ `OFFLINE_QUEUED_ERROR` sentinel design — all mutation hooks throw consistently; never surfaces in UI
✅ `hydrateDraftFromServer` guard — server refetch cannot overwrite dirty local edits
✅ `markClean` only called on confirmed server writes
