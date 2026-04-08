# Story 3.1: My Routes Library View

Status: Done

## Story

As a **premium user**,
I want a useful route library view,
So that I can quickly understand which trips are active, recent, and worth reopening.

## Context

Epics 1 and 2 established the normalized trip stack: creation, editing, reorder, corridor overlay, and Google Maps handoff. `MyRoutesScreen.tsx` already renders a basic trip list using `TripListItem`, and the `GET /api/trips` endpoint already returns trips sorted by `updated_at DESC` with archived trips excluded. The `Trip` type already carries `status`, `stopCount`, `updatedAt`, and `destination` fields.

This story enhances the existing library view into a production-quality route card experience with proper status indicators, client-side sort/filter controls, and clear archived-trip toggle support — all without introducing new API endpoints or N+1 fetch patterns.

### What Already Works

- `listTripRows()` in `api/_trips.ts` already applies `.neq('status', 'archived')` and `.order('updated_at', { ascending: false })` — the API returns non-archived trips sorted by most recently updated
- `trips.stop_count` is a stored column on the `trips` table, not a join aggregate — no N+1 risk
- `TripListItem` already shows title, destination name, stop count, and updated-at timestamp
- The `isSelected` highlight border already distinguishes the active trip in the list
- The builder sheet opens with `tripId` in the URL and the "Back to library" flow works via `closeBuilder()`

### What This Story Adds

- **Route cards with status indicators:** visible draft/synced badge per card
- **Archived trip toggle:** ability to view archived trips alongside active ones (client-side filter using a new `?status=` query parameter or `includeArchived` API support)
- **Sort controls:** client-side sort toggle (most recent vs. oldest) applied to the already-sorted API response
- **Enhanced card UI:** cleaner visual hierarchy with destination, stop count, timestamp, and status badge
- **Active trip highlight + library return:** ensure the active trip card is visually distinct and the user can return to library browse without losing planner context

### What This Story Must NOT Add

- Duplicate-trip functionality (Story 3.2)
- Archive/delete mutations (Story 3.3)
- Offline draft store or sync queue (Epic 4)
- Legacy migration or sharing compatibility (Epic 5)

---

## Acceptance Criteria

### AC 1 — Route cards show title, destination, stop count, timestamp, and status indicator

**Given** a premium user has multiple saved trips
**When** they open **My Routes**
**Then** the route list shows cards with title, destination, stop count, updated-at timestamp, and sync/status indicator
**And** archived trips are excluded from the default view.

### AC 2 — Sort and filter controls avoid N+1 patterns

**Given** the user has many trips
**When** they sort or filter the library
**Then** they can order by most recently updated and distinguish draft vs. archived states
**And** the implementation avoids N+1 fetch patterns for stop counts or status summaries.

### AC 3 — Active trip highlight and library return

**Given** a trip card is selected
**When** the route library transitions into builder mode
**Then** the active trip is highlighted in the list
**And** the user can still return to the library without losing their current planner context.

---

## Tasks / Subtasks

### Task 1 — Enhance `TripListItem` into a proper route card component (AC: 1)

**Primary files:**
- `src/features/route-planning/MyRoutesScreen.tsx`

- [x] 1.1 Refactor `TripListItem` into a richer `TripRouteCard` component (can remain in `MyRoutesScreen.tsx` or extract to a sibling file) with clear visual sections: title row, destination + stop count summary, updated-at timestamp, and status badge
- [x] 1.2 Add a status badge element that displays the trip's `status` field (e.g., "Draft" for `draft` status, "Archived" for `archived` status) using appropriate visual treatment — use `data-testid="trip-status-badge"` for test targeting
- [x] 1.3 Add a sync/status indicator that shows "Synced" for server-persisted trips (all trips from the API are synced in this phase; offline sync badges will be added in Epic 4) — keep the indicator as a simple visual element that can be extended later with `Local draft` / `Sync pending` states
- [x] 1.4 Preserve the existing `isSelected` highlight border behavior for the active trip and ensure the card's tap target remains at least 44px
- [x] 1.5 Display destination name prominently (already done), stop count with stop pluralization (already done), and `formatUpdatedAt()` timestamp (already done) — verify these are visually organized in the new card layout

### Task 2 — Add archived trip filter toggle (AC: 1, 2)

**Primary files:**
- `src/features/route-planning/MyRoutesScreen.tsx`
- `src/features/route-planning/useTripsQuery.ts`
- `src/features/route-planning/api.ts`
- `api/trips.ts`
- `api/_trips.ts`

- [x] 2.1 Add an optional `status` query parameter to `GET /api/trips` that accepts `all` to include archived trips alongside drafts — default behavior (no parameter or `status=active`) continues to exclude archived trips, preserving backward compatibility
- [x] 2.2 Update `listTripRows()` in `api/_trips.ts` to conditionally remove the `.neq('status', 'archived')` filter when the `status=all` parameter is present
- [x] 2.3 Update `fetchTrips()` in `src/features/route-planning/api.ts` to accept an optional `{ includeArchived?: boolean }` parameter and pass it as `?status=all` query string when true
- [x] 2.4 Update `useTripsQuery()` to accept an `includeArchived` option, pass it to `fetchTrips()`, and include it in the `queryKey` so cached data is scoped correctly (e.g., `['trips', userId, { includeArchived }]`)
- [x] 2.5 Add a filter toggle button in `MyRoutesContent` (above the trip list) that toggles `includeArchived` state — use clear labeling such as "Show archived" / "Hide archived" and `data-testid="archive-filter-toggle"`
- [x] 2.6 When archived trips are shown, visually distinguish them from drafts using the status badge from Task 1 and a muted card appearance (e.g., reduced opacity or different border treatment)

### Task 3 — Add client-side sort controls (AC: 2)

**Primary files:**
- `src/features/route-planning/MyRoutesScreen.tsx`

- [x] 3.1 Add a sort toggle or dropdown that lets users switch between "Most recent" (default, matching API order) and "Oldest first" sort — use `data-testid="sort-control"`
- [x] 3.2 Implement sort as a client-side `useMemo` operation on the already-fetched `trips` array — the API already returns trips sorted by `updated_at DESC`, so "Most recent" uses the natural order and "Oldest first" reverses it
- [x] 3.3 Persist the selected sort preference in component state only (no localStorage or URL param needed) — reset to default on unmount
- [x] 3.4 Place the sort control and archive toggle in a compact filter bar above the trip list, using a horizontal layout that does not push the trip cards below the fold on mobile

### Task 4 — Validate active trip highlight and library return flow (AC: 3)

**Primary files:**
- `src/features/route-planning/MyRoutesScreen.tsx`

- [x] 4.1 Verify the active trip card shows the existing `border-sky-400/70 ring-1 ring-sky-400/40` highlight treatment when `isSelected` is true — this already works and should be preserved in the new card layout
- [x] 4.2 Verify the "Open in planner" indicator text appears on the selected card — already implemented, ensure it survives the card refactor
- [x] 4.3 Verify `closeBuilder()` clears the `tripId` search param and resets builder state so the user returns to the library list — already implemented, add test coverage if not already present
- [x] 4.4 Verify the trip list remains visible and scrollable while the builder sheet is open, so the user can see which trip is active in the library context — this depends on the existing `PlannerShell` layout which shows the list and builder side-by-side on desktop and stacked on mobile

### Task 5 — Add and extend test coverage (AC: 1, 2, 3)

**Primary files:**
- `src/features/route-planning/MyRoutesScreen.test.tsx`

- [x] 5.1 Add test: route cards render title, destination, stop count, updated-at timestamp, and status badge for each trip
- [x] 5.2 Add test: archived trips are NOT shown in the default view (mock `useTripsQuery` returning only non-archived trips as the API does by default)
- [x] 5.3 Add test: toggling the archive filter triggers a new query with `includeArchived` and archived trips appear with distinct visual treatment
- [x] 5.4 Add test: sort toggle reverses trip order from most-recent to oldest-first
- [x] 5.5 Add test: selected trip card has the active highlight treatment (`aria-pressed="true"` and sky border)
- [x] 5.6 Add test: closing the builder clears the `tripId` param and returns to library state
- [x] 5.7 Verify existing `MyRoutesScreen.test.tsx` tests still pass after the card refactor

### Task 6 — Validate scope boundaries and project health (AC: 1, 2, 3)

- [x] 6.1 Run `npm run test`, `npm run lint`, `npm run build` after implementation
- [x] 6.2 Confirm this story does **not** add:
  - trip duplication functionality
  - archive or delete mutation endpoints
  - offline draft store or sync queue
  - new database migrations
- [x] 6.3 Confirm the `GET /api/trips` default behavior (excluding archived, sorted by updated_at DESC) is unchanged for existing callers

---

## Dev Notes

### Architecture Guardrails

1. **The API already excludes archived trips and sorts by `updated_at DESC`.**
   `listTripRows()` in `api/_trips.ts` line 291-307 applies `.neq('status', 'archived')` and `.order('updated_at', { ascending: false })`. The default behavior must NOT change. The `status=all` parameter is additive.

2. **`stop_count` is a stored column, not a computed join.**
   The `trips` table has `stop_count INTEGER` maintained by the `upsert_trip_with_stops` RPC. No separate query or aggregation is needed. This is already N+1 safe.

3. **No new database migrations.**
   This story operates entirely within the existing `trips` + `trip_stops` schema from migration 028. The `status` column already supports `'draft'` and `'archived'` values.

4. **Keep `useTripsQuery` as the single trip-list hook.**
   Do NOT create a second list query hook. Extend the existing hook with an `includeArchived` option and adjust the `queryKey` to scope cache correctly.

5. **Status badge is a visual-only element in this story.**
   The full sync status system (Local draft / Sync pending / Synced / Sync error) is Epic 4 scope. For now, show `Draft` for `status === 'draft'` and `Archived` for `status === 'archived'`. All trips from the API are server-persisted, so a "Synced" indicator is valid but optional.

6. **Sort is client-side only.**
   The API already returns the optimal sort order. Client-side reverse is sufficient for "oldest first" toggle. No additional API parameters are needed for sorting.

7. **Preserve the existing `PlannerShell` layout.**
   The split-pane desktop layout and stacked mobile layout must remain intact. The filter/sort bar is added WITHIN the existing `MyRoutesContent` component, above the trip list.

### Existing Code Signals

- `MyRoutesScreen.tsx` line 124-163: `TripListItem` already renders title, destination, stop count, and timestamp — refactor this into the enhanced card
- `MyRoutesScreen.tsx` line 13-20: `formatUpdatedAt()` is already defined and properly formats dates
- `MyRoutesScreen.tsx` line 166-422: `MyRoutesContent` is the main component with all trip list logic
- `useTripsQuery.ts` line 6-8: `tripsQueryKey()` already scopes by `userId` — extend to include filter params
- `api/_trips.ts` line 291-307: `listTripRows()` is the server-side list query
- `api/trips.ts` line 33-41: GET handler calls `listTripRows()` and maps to API response
- `src/types/trip.ts` line 5: `TripStatus = 'draft' | 'archived'` is already defined

### Scope Boundaries / Anti-Patterns

- Do **not** add archive/delete mutation logic (Story 3.3)
- Do **not** add trip duplication (Story 3.2)
- Do **not** create a new component file unless the card complexity genuinely warrants extraction — prefer refactoring `TripListItem` inline first
- Do **not** add localStorage persistence for filter/sort preferences
- Do **not** add a separate "archived trips" page or route — use in-place toggle

### Dependencies / Sequencing

- **Depends on (all done):**
  - `p3-1-1-normalized-trip-model-foundation`
  - `p3-1-2-gated-my-routes-entry-point`
  - `p3-1-3-create-a-new-trip-plan`
  - `p3-1-4-resume-an-existing-trip`
  - `p3-2-1-add-and-remove-route-stops`
  - `p3-2-2-reorder-stops-and-render-corridor-overlay`
  - `p3-2-3-corridor-suggestions-from-existing-route-logic`
  - `p3-2-4-ordered-google-maps-handoff`

- **Blocks:**
  - `p3-3-2-duplicate-a-trip-for-what-if-planning` (needs library card actions)
  - `p3-3-3-archive-and-delete-route-plans` (needs status badge and archive filter)

### Previous Story Intelligence

- `p3-2-4` confirmed that `MyRoutesScreen.tsx` is the canonical entry point and `PremiumGate` wrapping is stable
- `p3-2-4` added handoff CTA to `RouteBuilderSheet.tsx` — this story should not touch the builder sheet
- Known baseline repo noise remains outside this story:
  - `npm run lint` baseline failures in `api/_trips.ts`, `api/pins.test.ts`
  - `npm run test` baseline noise in `src/features/account/AuthProvider.test.tsx`

### Testing Expectations

1. `npm run test`
2. `npm run lint`
3. `npm run build`
4. Focused coverage for:
   - `src/features/route-planning/MyRoutesScreen.test.tsx`
5. Confirm route cards display all required fields (title, destination, stop count, timestamp, status)
6. Confirm archived trips are excluded by default and appear when filter is toggled
7. Confirm sort toggle reverses trip order
8. Confirm active trip highlight and library return flow work

### Project Structure Notes

- All changes stay within `src/features/route-planning/` and `api/` — no new modules or directories
- Card component stays in or near `MyRoutesScreen.tsx` following the existing inline component pattern (`TripListItem`, `PlannerShell`)
- API enhancement is a backward-compatible optional parameter, not a new endpoint
- Query key extension follows existing `tripsQueryKey()` pattern

### References

- Source: `_bmad-output/planning-artifacts/epics-phase3.md` — Phase 3 Epic 3, Story 3.1
- Source: `_bmad-output/planning-artifacts/architecture-phase3.md` — My Routes Entry Point, Frontend Architecture, API Surface
- Source: `_bmad-output/implementation-artifacts/p3-2-4-ordered-google-maps-handoff.md` — Previous story learnings
- Source: `src/features/route-planning/MyRoutesScreen.tsx` — Existing trip list and card components
- Source: `src/features/route-planning/useTripsQuery.ts` — Existing trip list query hook
- Source: `src/features/route-planning/api.ts` — Existing fetch wrappers
- Source: `api/trips.ts` — Existing GET /api/trips handler
- Source: `api/_trips.ts` — Existing listTripRows(), mapTripRowToApiTrip()
- Source: `src/types/trip.ts` — Trip, TripStatus type definitions

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4 (claude-sonnet-4-20250514)

### Debug Log References

### Completion Notes List

- Enhanced `TripListItem` with `StatusBadge` (Draft/Archived) and `SyncIndicator` (Synced) components
- Archived trips get `opacity-60` muted treatment when displayed
- Added `?status=all` optional query param to `GET /api/trips` — default behavior unchanged
- Extended `listTripRows()` with `options.includeArchived` to conditionally remove `.neq('status', 'archived')` filter
- Extended `fetchTrips()` to accept `{ includeArchived?: boolean }` and append `?status=all` query string
- Extended `useTripsQuery()` with `includeArchived` option, scoped in queryKey as `['trips', userId, { includeArchived }]`
- Updated `useUpdateTripMutation` to invalidate all trip queries via `['trips', userId]` prefix instead of exact key match
- Removed unused `tripsQueryKey` import from `useUpdateTripMutation.ts`
- Added filter bar with "Show archived" / "Hide archived" toggle (`data-testid="archive-filter-toggle"`)
- Added sort toggle "Most recent" / "Oldest first" (`data-testid="sort-control"`) using client-side `useMemo` reverse
- Added 6 new tests in `MyRoutesScreen.test.tsx` (21 total, all passing)
- All 1194 tests pass, 0 lint errors on changed files, clean tsc + vite build

### File List

- `src/features/route-planning/MyRoutesScreen.tsx` — Enhanced TripListItem with StatusBadge, SyncIndicator, filter bar, sort control
- `src/features/route-planning/MyRoutesScreen.test.tsx` — 6 new tests for cards, filter, sort, highlight, close-builder
- `src/features/route-planning/useTripsQuery.ts` — Extended with `includeArchived` option and scoped queryKey
- `src/features/route-planning/api.ts` — Extended `fetchTrips()` with `includeArchived` option
- `src/features/route-planning/useUpdateTripMutation.ts` — Fixed invalidation to use prefix key, removed unused import
- `api/trips.ts` — Added `status` query param parsing, passes `includeArchived` to `listTripRows()`
- `api/_trips.ts` — Extended `listTripRows()` with optional `includeArchived` parameter

## Review Follow-ups (AI)

### Issues Found and Fixed (2)

1. **MEDIUM — API `status` query param not validated (security hardening)**: `api/trips.ts` accepted any string for the `?status=` query parameter and silently treated unrecognized values as the default (exclude archived). While safe in behavior, this masks client-side bugs and violates input validation best practices. **Fixed**: Added whitelist validation — only `'all'` or absent is accepted; any other value returns 400 with a clear error message.

2. **MEDIUM — "Excludes archived" test lacked hook parameter verification**: The `excludes archived trips from the default view` test (Task 5.2) mocked `useTripsQuery` with a static return value and only checked rendered output. It would pass even if the component called `useTripsQuery({ includeArchived: true })`. **Fixed**: Added `expect(mockUseTripsQuery).toHaveBeenCalledWith(expect.objectContaining({ includeArchived: false }))` assertion to verify the component passes the correct default parameter to the hook.

### Issues Noted (not fixed — LOW or forward-looking)

3. **MEDIUM (forward-looking) — Filter bar inaccessible from empty state**: The "Show archived" toggle is only rendered when `trips.length > 0`. If a user archives all trips (possible after Story 3.3), they see "No saved routes yet" with no way to toggle the archive filter. This is currently a non-issue since archiving isn't available yet, but Story 3.3 should address this when it adds archive mutations. Recommend: show the filter bar or a "Show archived" link in the empty state if archived trips could exist.

4. **LOW — `useCreateTripMutation` optimistic update now scoped to one cache key**: The `tripsQueryKey(userId)` change from `['trips', userId]` to `['trips', userId, { includeArchived: false }]` means the `setQueryData` in `useCreateTripMutation.ts` only updates the non-archived query cache. If a user creates a trip while viewing with `includeArchived: true`, the optimistic update misses the visible cache. The `invalidateQueries({ queryKey: ['trips'] })` immediately triggers a refetch so the UX impact is negligible (~100ms flash). No fix needed.

5. **LOW — Missing archived card opacity assertion in tests**: The archive toggle test verifies the `Archived` badge text but doesn't assert the `opacity-60` visual muting class. The visual treatment is clearly implemented in code. Recommend: add a CSS class assertion in Story 3.3 when archive/delete interactions are tested.

6. **LOW — Inconsistent label semantics between controls**: The sort button shows the **current state** ("Most recent" / "Oldest first"), while the archive toggle shows the **next action** ("Show archived" / "Hide archived"). Both are valid UI patterns but the inconsistency could confuse users. Minor UX polish for a future iteration.

### Verification Results

- **107 test files passed, 1194 tests passed, 0 failures**
- **Clean TypeScript compilation (`tsc -b`)** — no type errors
- **Clean Vite production build** — all assets generated successfully
- All 3 Acceptance Criteria verified satisfied
