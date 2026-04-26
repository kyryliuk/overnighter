# Story 4.2: Offline Editing and Sync Status UX

Status: done

## Story

As a **premium user**,
I want clear sync state feedback while editing routes offline or online,
so that I understand whether my trip is only local, waiting to sync, or safely in the cloud.

## Context

Story 4.1 delivered the offline-first infrastructure: `tripDraftStore` persists drafts across reloads, all four mutation hooks enqueue offline and throw `OFFLINE_QUEUED_ERROR`, and `RouteBuilderSheet` initializes from the local draft instead of the server `Trip` prop. The queue infrastructure is fully wired but completely invisible to the user.

This story adds the **sync status UX layer**:

1. A `useTripSyncStatus(tripId)` hook that derives per-trip sync state from `dirtyTripIds` in `tripDraftStore` and the `pendingTripMutations` localStorage queue.
2. A `TripSyncBadge` component that renders `Synced`, `Local draft`, or `Sync pending` with `aria-live="polite"` and non-color-only indicators.
3. Wiring the badge into trip cards in **My Routes** (replacing the hardcoded `SyncIndicator` placeholder) and into the **RouteBuilderSheet** header for the active trip.

### What Already Exists

- `src/store/tripDraftStore.ts` — Zustand + persist store; `dirtyTripIds` is the authoritative dirty flag; `setPendingSyncCount` exists but is not yet updated.
- `src/lib/offline/pendingTripMutations.ts` — queue module; exports `readPendingTripMutations()`, `PENDING_TRIP_MUTATIONS_UPDATED_EVENT`, `OFFLINE_QUEUED_ERROR`.
- `src/hooks/useOnlineStatus.ts` — `useOnlineStatus()` returns `boolean`, live-updated from `navigator.onLine`.
- `src/features/route-planning/MyRoutesScreen.tsx` — contains a hardcoded `SyncIndicator()` function that always renders "Synced"; `TripListItem` renders `<SyncIndicator />` with no props.
- `src/lib/offline/pendingCheckins.ts` and `src/hooks/useOfflineCheckinQueue.ts` — reference patterns for the localStorage + `window` event-dispatch loop.
- `src/features/route-planning/RouteBuilderSheet.tsx` — header area at lines 452–478; `isResumeMode` and `trip?.id` are available in scope.
- `INITIAL_TRIP_DRAFT_STATE` exported from `tripDraftStore.ts` — used in `beforeEach` for test isolation.

### What This Story Must NOT Add

- Reconnect flush logic (queued mutations sent to server on reconnect) — Epic 4 Story 4.3.
- Conflict resolution or server revision comparison — Epic 4 Story 4.3.
- `Sync error` badge state — Story 4.3 (requires server response metadata).
- Updates to `pendingSyncCount` in the store — the badge reads the queue directly; `pendingSyncCount` is a Story 4.3 concern.
- Any new Supabase migrations or `/api/trips` endpoint changes.

---

## Acceptance Criteria

### AC 1 — Trip cards show correct per-trip sync badge

**Given** a user views **My Routes** with one or more trips  
**When** a trip is not in `dirtyTripIds` and has no pending queue item  
**Then** the trip card shows a `Synced` badge  

**When** a trip is in `dirtyTripIds` but has no pending queue item for that `tripId`  
**Then** the trip card shows a `Local draft` badge  

**When** a trip is in `dirtyTripIds` AND `readPendingTripMutations()` contains an item with matching `tripId`  
**Then** the trip card shows a `Sync pending` badge.

### AC 2 — Builder header shows sync badge for the active trip

**Given** the user opens an existing trip in the builder (`isResumeMode === true`)  
**When** the builder header renders  
**Then** a `TripSyncBadge` appears adjacent to the "Route builder" eyebrow label  
**And** it reflects the same per-trip sync state as the trip card in the list.

### AC 3 — Badge updates reactively on queue changes

**Given** a trip card or open builder is showing a sync badge  
**When** `PENDING_TRIP_MUTATIONS_UPDATED_EVENT` fires on `window` (e.g. after an offline save)  
**Then** the badge re-evaluates and updates to reflect the new queue state without a page reload.

### AC 4 — Accessibility: aria-live and non-color indicators

**Given** any sync badge is rendered  
**Then** its outermost wrapper carries `aria-live="polite"` and `aria-atomic="true"`  
**And** every badge state includes a visible text label (`Synced`, `Local draft`, `Sync pending`)  
**And** no state relies solely on color to convey status (each state uses a distinct text label and/or icon shape).

### AC 5 — Builder stays fully editable when offline

**Given** a premium user has the builder open for an existing trip  
**When** connectivity is lost  
**Then** all form fields remain interactive  
**And** clicking "Update route" queues the mutation and shows the `Sync pending` badge (no error alert, no loss of input).  
_Note: the offline mutation-queueing itself was delivered in Story 4.1; this AC confirms the badge correctly reflects that state._

---

## Implementation Notes

### Sync Status State Machine

```
not in dirtyTripIds                       → 'synced'
in dirtyTripIds, no queue item            → 'local-draft'
in dirtyTripIds, queue item with tripId   → 'sync-pending'
```

### `useTripSyncStatus` Hook Design

```typescript
// src/features/route-planning/useTripSyncStatus.ts
export type TripSyncStatus = 'synced' | 'local-draft' | 'sync-pending'

export function useTripSyncStatus(tripId: string | null | undefined): TripSyncStatus
```

- Reads `dirtyTripIds` via `useTripDraftStore((state) => state.dirtyTripIds)` with a selector to avoid over-rendering.
- Maintains a `hasPendingMutation` boolean in local `useState`, initialized eagerly from `readPendingTripMutations().some((m) => m.tripId === tripId)` so the correct state is present on first render (handles page reload after offline edits).
- `useEffect` with `tripId` in the dependency array: adds and removes a `window` listener for `PENDING_TRIP_MUTATIONS_UPDATED_EVENT`; on event, re-reads the queue and updates `hasPendingMutation`.
- For `null`/`undefined` `tripId`, returns `'synced'` as a safe default.
- Does NOT call `setPendingSyncCount` — deferred to Story 4.3.

### `TripSyncBadge` Component Design

```tsx
// src/features/route-planning/TripSyncBadge.tsx
export function TripSyncBadge({ tripId }: { tripId: string }): JSX.Element
```

- Calls `useTripSyncStatus(tripId)` internally.
- Outer wrapper: `<span aria-live="polite" aria-atomic="true" data-testid="trip-sync-indicator">` (keeping `data-testid="trip-sync-indicator"` for backward compat with existing `MyRoutesScreen` tests).
- Three states, each with a small dot and a text label:
  - `synced`: green dot (`bg-emerald-400`) + "Synced"
  - `local-draft`: amber dot (`bg-amber-400`) + "Local draft"
  - `sync-pending`: pulsing sky-blue dot (`bg-sky-400 animate-pulse`) + "Sync pending"
- All dot `<span>`s carry `aria-hidden="true"` (purely decorative).
- Minimum 44 px tap area is N/A — this is a read-only indicator, not interactive.

### MyRoutesScreen Changes

- **Remove** the hardcoded `SyncIndicator()` function (lines 146–156 approximately).
- **Add** `import { TripSyncBadge } from './TripSyncBadge'` at the top of the file.
- **Update** `TripListItem`: replace `<SyncIndicator />` with `<TripSyncBadge tripId={trip.id} />`.
- No other changes to `TripListItem` signature or rendering logic.

### RouteBuilderSheet Changes

- **Add** `import { TripSyncBadge } from './TripSyncBadge'` at the top of the file.
- In the header `<div className="space-y-1">` block (lines 462–470 approximately), add `<TripSyncBadge>` **after** the "Route builder" eyebrow `<p>` — only render when `isResumeMode && trip?.id`:
  ```tsx
  {isResumeMode && trip?.id ? <TripSyncBadge tripId={trip.id} /> : null}
  ```
- The badge sits between the eyebrow label and the title heading to make it spatially clear it belongs to the active trip.

### Key Contracts from Story 4.1

- **`dirtyTripIds`**: Set by `markDirty(tripId)` (debounced write in `RouteBuilderSheet`); cleared by `markClean(tripId)` (post-server-confirm in `handleSubmit`). Never cleared on offline save — that is why `local-draft` and `sync-pending` persist until Story 4.3 flushing.
- **`PENDING_TRIP_MUTATIONS_UPDATED_EVENT`**: Fired by `appendPendingTripMutation()` and `removePendingTripMutation()` in `pendingTripMutations.ts`. Story 4.2 only reads; Story 4.3 calls `removePendingTripMutation`.
- **`OFFLINE_QUEUED_ERROR`**: Thrown (not returned) by all four mutation hooks when offline. `handleSubmit` in `RouteBuilderSheet` catches it and does NOT call `markClean` — intentional; the trip stays dirty so the badge shows `sync-pending`.

---

## Tasks

- [x] Task 1: Create `useTripSyncStatus` hook (`src/features/route-planning/useTripSyncStatus.ts`)
  - Export `TripSyncStatus` type: `'synced' | 'local-draft' | 'sync-pending'`
  - Implement hook with `dirtyTripIds` selector + eager `useState` init + `PENDING_TRIP_MUTATIONS_UPDATED_EVENT` listener

- [x] Task 2: Create `TripSyncBadge` component (`src/features/route-planning/TripSyncBadge.tsx`)
  - Three states with dot icon + text label
  - `aria-live="polite"`, `aria-atomic="true"`, `data-testid="trip-sync-indicator"`
  - Each dot `aria-hidden="true"`

- [x] Task 3: Update `MyRoutesScreen.tsx`
  - Remove hardcoded `SyncIndicator()` function
  - Import and use `<TripSyncBadge tripId={trip.id} />` in `TripListItem`

- [x] Task 4: Update `RouteBuilderSheet.tsx`
  - Import `TripSyncBadge`
  - Render `<TripSyncBadge tripId={trip.id} />` in header when `isResumeMode && trip?.id`

- [x] Task 5: Write unit tests for `useTripSyncStatus` (`src/features/route-planning/useTripSyncStatus.test.ts`)
  - `null`/`undefined` tripId → `'synced'`
  - Trip not in `dirtyTripIds`, no queue item → `'synced'`
  - Trip in `dirtyTripIds`, no queue item → `'local-draft'`
  - Trip in `dirtyTripIds`, queue item for that trip → `'sync-pending'`
  - Dispatching `PENDING_TRIP_MUTATIONS_UPDATED_EVENT` re-evaluates state

- [x] Task 6: Write tests for `TripSyncBadge` (`src/features/route-planning/TripSyncBadge.test.tsx`)
  - Renders "Synced" by default (no dirty trips, no queue)
  - Renders "Local draft" when trip is in `dirtyTripIds`
  - Renders "Sync pending" when trip is in `dirtyTripIds` AND queue has matching item
  - `aria-live="polite"` is present on the wrapper

- [x] Task 7: Update `MyRoutesScreen.test.tsx`
  - Existing test "renders … sync indicator … Synced" passes unchanged (default store state → no dirty trips → "Synced")
  - Add test: badge shows "Local draft" when store has `dirtyTripIds` containing the trip id
  - Add test: badge shows "Sync pending" when store has `dirtyTripIds` + localStorage queue has item for that trip

- [x] Task 8: Update `RouteBuilderSheet.test.tsx`
  - Add test: `TripSyncBadge` appears in builder header in resume mode
  - Confirm badge is absent in create mode (no `tripId` → badge not rendered)

---

## File List

### New
- `src/features/route-planning/useTripSyncStatus.ts`
- `src/features/route-planning/useTripSyncStatus.test.ts`
- `src/features/route-planning/TripSyncBadge.tsx`
- `src/features/route-planning/TripSyncBadge.test.tsx`

### Modified
- `src/features/route-planning/MyRoutesScreen.tsx`
- `src/features/route-planning/MyRoutesScreen.test.tsx`
- `src/features/route-planning/RouteBuilderSheet.tsx`
- `src/features/route-planning/RouteBuilderSheet.test.tsx`

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4.6

### Debug Log
No significant debug issues. All 84 tests in new/modified files pass on first run.

### Completion Notes
All 8 tasks implemented:
- `useTripSyncStatus` hook: eagerly initializes from `readPendingTripMutations()` on mount (handles page-reload correctness), then re-evaluates on `PENDING_TRIP_MUTATIONS_UPDATED_EVENT`
- `TripSyncBadge` component: uses `aria-live="polite"` + `aria-atomic="true"`; three badge states with dot + text label; no color-only indicators
- `MyRoutesScreen.tsx`: hardcoded `SyncIndicator` removed; `TripSyncBadge` wired with `tripId={trip.id}`
- `RouteBuilderSheet.tsx`: badge added in header (after "Route builder" eyebrow) when `isResumeMode && trip?.id`
- `MyRoutesScreen.test.tsx`: store + queue reset added to `beforeEach`; 4 new tests added
- `RouteBuilderSheet.test.tsx`: 3 new sync badge tests added
- 10 hook unit tests + 7 component unit tests all pass

Test count: 1439 → 1465 passing (+26 tests). The 1 failure in full suite is a pre-existing `PinLayer.test.ts` timeout on dynamic import in `beforeEach`, unrelated to this story.

### Change Log
| Date | Change | Author |
|------|--------|--------|
| 2026-04-26 | Implemented all tasks; 1465 tests passing | Dev Agent (claude-sonnet-4.6) |
| 2026-04-26 | Code review fixes: sync hasPendingMutation immediately on tripId change in useEffect; added sync-pending builder badge test; removed redundant event dispatches from tests. 85 tests in modified files pass | QA Agent (claude-sonnet-4.6) |

---

## Senior Developer Review (AI)

**Reviewer:** claude-sonnet-4.6  
**Verdict:** ✅ Approved — no blocking issues

**AC Compliance:**
- AC1 (trip cards show correct badge): ✅ Implemented via `TripSyncBadge tripId={trip.id}` in `TripListItem`
- AC2 (builder header badge): ✅ Conditional badge in `RouteBuilderSheet` header when `isResumeMode && trip?.id`
- AC3 (reactive updates): ✅ `PENDING_TRIP_MUTATIONS_UPDATED_EVENT` listener on `window`
- AC4 (accessible live region): ✅ `aria-live="polite"` + `aria-atomic="true"` with text labels and `aria-hidden` icons
- AC5 (builder stays editable offline): ✅ Inherited from Story 4.1; badge does not interfere

**Issues Fixed:**
1. **MEDIUM**: `useTripSyncStatus` — added `handleQueueChange()` call inside `useEffect` to re-sync state immediately when `tripId` changes (mitigates stale state if component reuses hook with different tripId without unmount)
2. **MEDIUM**: Added `RouteBuilderSheet` test for `sync-pending` badge state (dirty + queue item) — all three badge states now covered in builder tests
3. **LOW**: Removed redundant `window.dispatchEvent(PENDING_TRIP_MUTATIONS_UPDATED_EVENT)` calls from 3 test files where `appendPendingTripMutation`/`clearPendingTripMutations` already dispatch the event internally; also added `clearPendingTripMutations()` to `RouteBuilderSheet.test.tsx` `beforeEach` for proper queue isolation

**Final test count:** 85 passing in 4 modified test files (1 new test added)
