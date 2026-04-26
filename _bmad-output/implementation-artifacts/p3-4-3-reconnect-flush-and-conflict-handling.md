# Story 4.3: Reconnect Flush and Conflict Handling

Status: done

## Story

As a **premium user**,
I want queued edits to flush safely on reconnect and conflicts to be surfaced clearly,
so that offline-first behavior stays trustworthy even across multiple devices.

## Context

Stories 4.1–4.2 delivered the complete offline-first infrastructure and sync status UX:
- `tripDraftStore` — persists drafts; `dirtyTripIds` tracks unsaved trips; `TripDraft.lastSyncedRevision` / `lastSyncedAt` track last confirmed server state
- `pendingTripMutations` queue — append-only, localStorage-backed, FIFO; four mutation kinds: `create | update | updateStatus | delete`
- All four mutation hooks enqueue offline and throw `OFFLINE_QUEUED_ERROR`
- `useTripSyncStatus` — derives `synced | local-draft | sync-pending` per trip
- `TripSyncBadge` — accessible badge in trip cards and builder header

This story adds the **reconnect flush and conflict handling layer**:
1. `useOfflineTripQueue` hook — flushes queue FIFO on reconnect, visibility regain (30s min interval), or explicit trigger
2. Conflict detection client-side: if server's cached revision > `draft.lastSyncedRevision` for a dirty trip → mark `conflicted`
3. `conflictedTripIds` in draft store + `markConflicted` / `resolveConflict` actions
4. `conflicted` status in `useTripSyncStatus` + `Sync error` badge in `TripSyncBadge`
5. `useOfflineTripQueue` wired into `MyRoutesScreen`

### What Already Exists

- `src/store/tripDraftStore.ts` — `dirtyTripIds`, `markDirty`, `markClean`, `hydrateDraftFromServer`, `removeDraft`; `TripDraft.lastSyncedRevision` and `lastSyncedAt` already present; `INITIAL_TRIP_DRAFT_STATE` exported for test isolation
- `src/lib/offline/pendingTripMutations.ts` — `readPendingTripMutations()`, `removePendingTripMutation()`, `clearPendingTripMutations()`, `PENDING_TRIP_MUTATIONS_UPDATED_EVENT`, `PendingTripMutation` type
- `src/hooks/useOfflineCheckinQueue.ts` — reference pattern: flushingRef guard, cross-tab localStorage lock, reconnect trigger via `useOnlineStatus()`
- `src/features/route-planning/api.ts` — `createTrip`, `updateTrip`, `updateTripStatus`, `deleteTrip`
- `src/features/route-planning/useTripsQuery.ts` — `tripsQueryKey(userId)`
- `src/features/route-planning/useTripQuery.ts` — `tripQueryKey(userId, tripId)`
- `src/types/trip.ts` — `Trip.revision: number`

### What This Story Must NOT Add

- Server-side 409 conflict response or revision field on write payloads
- UI for conflict resolution / merge (user sees the badge and can resolve in a future story)
- Retry button for conflicted trips (out of scope)
- Any new Supabase migrations or API endpoint changes

---

## Acceptance Criteria

### AC 1 — Queue flushes on reconnect and visibility regain

**Given** one or more trip mutations are queued locally  
**When** the app detects reconnect (online status changes to `true`)  
**Then** queued mutations flush in FIFO order using the normalized trip APIs  
**And** successfully synced items are removed from the queue  
**And** `markClean(tripId)` is called so the badge transitions to `Synced`

**When** the app regains tab visibility after being hidden for ≥ 30 seconds while online  
**Then** the same flush runs (idempotent if queue is already empty)

### AC 2 — Draft store updates with canonical server metadata

**Given** the server accepts a queued `update` mutation  
**When** the response returns the canonical `Trip` with updated `revision` and `updatedAt`  
**Then** `hydrateDraftFromServer(serverTrip)` is called to update `lastSyncedRevision` and `lastSyncedAt`  
**And** `markClean(tripId)` transitions the badge from `Sync pending` to `Synced`

**Given** a queued `create` mutation flushes successfully  
**When** the server returns the canonical `Trip` with a real ID  
**Then** the placeholder draft entry is removed from the store  
**And** the trips list query is invalidated so the real trip appears in **My Routes**

### AC 3 — Conflicts are surfaced, not silently overwritten

**Given** a trip is dirty AND has a pending `update` queue mutation  
**When** the flush hook detects that the server's cached revision > `draft.lastSyncedRevision`  
**Then** the trip is marked `conflicted` in the draft store (mutation is NOT sent to server)  
**And** the `TripSyncBadge` shows a `Sync error` badge  
**And** the mutation stays in the queue until `resolveConflict` is called

---

## Tasks / Subtasks

### Task 1 — Extend `tripDraftStore` with conflict state
- [x] 1.1 Add `conflictedTripIds: string[]` to `TripDraftStore` interface and `INITIAL_TRIP_DRAFT_STATE`
- [x] 1.2 Add `markConflicted(tripId: string)` action — adds to `conflictedTripIds`, does NOT remove from `dirtyTripIds`
- [x] 1.3 Add `resolveConflict(tripId: string)` action — removes from `conflictedTripIds`, keeps in `dirtyTripIds` for retry
- [x] 1.4 Include `conflictedTripIds` in `partialize` for persistence across reloads
- [x] 1.5 Write unit tests for `markConflicted` and `resolveConflict`

### Task 2 — Add `conflicted` status to `useTripSyncStatus`
- [x] 2.1 Select `conflictedTripIds` from `useTripDraftStore` in the hook
- [x] 2.2 Return `'conflicted'` as highest-priority status (checked before `sync-pending`, after `tripId` guard)
- [x] 2.3 Write unit test for `conflicted` status

### Task 3 — Add `Sync error` badge state to `TripSyncBadge`
- [x] 3.1 Add `conflicted` case rendering `Sync error` with amber dot + text label
- [x] 3.2 Write component test for `Sync error` badge state

### Task 4 — Create `useOfflineTripQueue` hook
- [x] 4.1 Create `src/features/route-planning/useOfflineTripQueue.ts`
- [x] 4.2 Implement `flushQueue()` for all four mutation kinds:
  - `update`: check revision conflict via QueryClient cache; if conflict → `markConflicted`, skip; else → `updateTrip`, on success `hydrateDraftFromServer` + `markClean` + `removePendingTripMutation`
  - `updateStatus`: `updateTripStatus`; on success `markClean` + `removePendingTripMutation` + invalidate queries
  - `delete`: `deleteTrip`; on success `removeDraft` + `removePendingTripMutation` + invalidate queries
  - `create`: `createTrip`; on success `removeDraft(tempTripId)` + `removePendingTripMutation` + invalidate trips query
  - 4xx (non-409): `removePendingTripMutation` (bad data, skip)
  - 409: `markConflicted`
  - 5xx / network: leave in queue (retry on next trigger)
- [x] 4.3 `useEffect([isOnline])`: flush when `isOnline` becomes `true`
- [x] 4.4 `useEffect([])` mount: flush on mount if already online
- [x] 4.5 `visibilitychange` handler: flush when visible + online + ≥ 30s since last flush
- [x] 4.6 Expose `{ isFlushing: boolean; triggerFlush: () => void }`
- [x] 4.7 Write unit tests: flush-on-reconnect, FIFO order, update success, create success, conflict detection, delete success, 4xx skip

### Task 5 — Wire `useOfflineTripQueue` into `MyRoutesScreen`
- [x] 5.1 Import and call `useOfflineTripQueue()` in `MyRoutesContent` component body
- [x] 5.2 Write integration test: flush is triggered when `isOnline` becomes `true`

---

## Dev Notes

### Flush Pattern (follow `useOfflineCheckinQueue`)

```typescript
const FLUSH_LOCK_KEY = 'pendingTripMutations_flushing'
const FLUSH_LOCK_TTL_MS = 30_000
const MIN_VISIBILITY_FLUSH_INTERVAL_MS = 30_000

export function useOfflineTripQueue() {
  const isOnline = useOnlineStatus()
  const { session, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const { draftsById, markClean, markConflicted, removeDraft, hydrateDraftFromServer } =
    useTripDraftStore()
  const flushingRef = useRef(false)
  const lastFlushTimeRef = useRef(0)
  const [isFlushing, setIsFlushing] = useState(false)

  const flushQueue = useCallback(async () => {
    if (!isAuthenticated || !session?.access_token) return
    if (flushingRef.current) return
    const lockValue = localStorage.getItem(FLUSH_LOCK_KEY)
    if (lockValue && Date.now() - Number(lockValue) < FLUSH_LOCK_TTL_MS) return

    flushingRef.current = true
    localStorage.setItem(FLUSH_LOCK_KEY, String(Date.now()))
    setIsFlushing(true)
    // ... FIFO processing ...
  }, [...])
}
```

### Conflict Detection

For `update` mutations only, using TanStack Query cache:
```typescript
const cachedTrip = queryClient.getQueryData<Trip>(tripQueryKey(userId, tripId))
const draft = draftsById[tripId]
if (
  cachedTrip &&
  draft?.lastSyncedRevision !== null &&
  cachedTrip.revision > (draft.lastSyncedRevision ?? 0)
) {
  markConflicted(tripId) // keep in queue
  continue
}
```

No extra API call needed — reuses the last fetched server state from TanStack Query cache.

### `create` Mutation: Placeholder Cleanup

After `createTrip` succeeds:
```typescript
removeDraft(mutation.tripId) // removes placeholder UUID from draftsById + dirtyTripIds
removePendingTripMutation(mutation.id)
void queryClient.invalidateQueries({ queryKey: tripsQueryKey(userId) })
```

The real trip appears in My Routes after invalidation. No need to map placeholder → real ID in the store.

### Sync Error Badge Color

Amber theme for conflict (distinct from gray = synced, sky = sync-pending, green = synced):
- Dot: `bg-amber-500`
- Text wrapper: `text-amber-600 dark:text-amber-400`

### Test Isolation Notes

- Mock `useOnlineStatus` via `vi.mock('@/hooks/useOnlineStatus')`
- Mock `useAuth` via `vi.mock('@/contexts/AuthContext')`
- Mock API functions via `vi.mock('./api')` (or `vi.mock('@/features/route-planning/api')`)
- Reset `useTripDraftStore` + `clearPendingTripMutations()` in `beforeEach`

---

## File List

### New Files
- `src/features/route-planning/useOfflineTripQueue.ts`
- `src/features/route-planning/useOfflineTripQueue.test.ts`

### Modified Files
- `src/store/tripDraftStore.ts`
- `src/features/route-planning/useTripSyncStatus.ts`
- `src/features/route-planning/useTripSyncStatus.test.ts`
- `src/features/route-planning/TripSyncBadge.tsx`
- `src/features/route-planning/TripSyncBadge.test.tsx`
- `src/features/route-planning/MyRoutesScreen.tsx`
- `src/features/route-planning/MyRoutesScreen.test.tsx`

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4.6

### Debug Log

### Completion Notes

All 5 tasks completed. 1484/1484 tests passing. Key implementation decisions:
- `hydrateDraftFromServer` exits early while trip is still dirty (by design), so `lastSyncedRevision` updates only after `markClean` transitions the trip — conflict detection relies on draft store state, not hydrated data
- Conflict detection is client-side only: compare cached server revision vs `draft.lastSyncedRevision`; no extra API call needed
- The `triggerFlush` / `flushQueue` does not guard on `isOnline` — callers control when to trigger

### Change Log
| Date | Change | Author |
|------|--------|--------|
| 2026-04-02 | Implemented all tasks; 1484 tests passing | Amelia (dev agent) |
