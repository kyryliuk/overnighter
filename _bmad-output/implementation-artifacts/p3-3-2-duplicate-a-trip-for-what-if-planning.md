# Story 3.2: Duplicate a Trip for What-If Planning

Status: done

## Story

As a **premium user**,
I want to duplicate an existing trip,
So that I can explore alternate route ideas without overwriting my original plan.

## Context

Epic 3 Story 3.1 enhanced `MyRoutesScreen` with `TripRouteCard` (now `TripListItem` with `StatusBadge` + `SyncIndicator`), sort/filter controls, and archived-trip toggle. The trip list is rendered in `MyRoutesContent` using `TripListItem` cards, each with a "Resume route" / "Reopen route" button.

This story adds a **Duplicate** action to each trip card. Duplication is a **client-side composition** — the frontend reads the existing trip's data, constructs a `TripWritePayload` with copied metadata and stops, and POSTs it via the existing `useCreateTripMutation()` → `POST /api/trips` flow. The only backend change is a small extension to the POST handler to accept and persist an optional `sourceTripId` field for lineage tracking.

### What Already Works

- `useCreateTripMutation()` + `POST /api/trips` creates new trips atomically via `upsert_trip_with_stops` RPC
- The `trips` table already has `source_trip_id UUID NULL` for lineage tracking
- The RPC always sets `is_public = false` (via DB default) and `share_token = null` (via DB default) on new trips — duplication inherits these safe defaults automatically
- The `Trip` type exposes `stops: TripStop[]` with full snapshot data — all data needed to construct a duplicate is available client-side
- `TripWritePayload` accepts `title`, `notes`, `origin`, `destination`, `routeMode`, and `stops` — all the fields needed to create a copy
- `TripListItem` already renders a footer action area where a Duplicate button fits naturally

### What This Story Adds

- **Duplicate button on trip cards:** a "Duplicate" action button on each `TripListItem` card in the library
- **Client-side duplication logic:** reads trip data, constructs `TripWritePayload` with `"{title} (copy)"` and `sourceTripId`, POSTs via existing mutation
- **`sourceTripId` support in write flow:** extends `TripWritePayload`, `TripWriteBodySchema`, and POST handler to persist `source_trip_id` on newly created trips
- **Post-duplicate navigation:** the new trip opens in the builder sheet immediately after creation
- **Isolation guarantee:** the duplicate is a fully independent trip — edits to the copy never affect the original

### What This Story Must NOT Add

- Archive or delete mutations (Story 3.3)
- Offline draft store or sync queue (Epic 4)
- Shared trip import flow (Epic 5)
- New API endpoints — reuse `POST /api/trips`
- New database migrations — `source_trip_id` column already exists

---

## Acceptance Criteria

### AC 1 — Duplicate creates a new trip with copied metadata and stop snapshots

**Given** a premium user is viewing a trip card in **My Routes**
**When** they choose **Duplicate trip**
**Then** the system creates a new trip with copied metadata (title + " (copy)", notes, origin, destination, routeMode) and all stop snapshots
**And** the duplicated trip opens as a separate editable route in the builder.

### AC 2 — Duplicate preserves lineage and does not inherit public visibility

**Given** the source trip originated from a shared trip import or already contains `sourceTripId` lineage
**When** the duplicate is created
**Then** the copied trip sets `source_trip_id` to the original trip's ID for lineage tracking
**And** `is_public` is `false` and `share_token` is `null` on the duplicate (enforced by database defaults).

### AC 3 — Duplicate appears in My Routes with distinct title and independent data

**Given** duplication succeeds
**When** the new trip appears in **My Routes**
**Then** it has a distinct title of `"{original title} (copy)"` until the user renames it
**And** changes to the duplicate do not mutate the original trip.

---

## Tasks / Subtasks

### Task 1 — Extend API write schema to support `sourceTripId` (AC: 2)

**Primary files:**
- `api/_trips.ts`
- `api/trips.ts`

- [x] 1.1 Add `sourceTripId` as an optional UUID field to `TripWriteBodySchema` in `api/_trips.ts`:
  ```typescript
  sourceTripId: z.string().uuid().optional(),
  ```
- [x] 1.2 Add `sourceTripId: string | null` to the `TripWriteInput` interface in `api/_trips.ts`
- [x] 1.3 Update `parseTripWriteBody()` to include `sourceTripId` in the returned `data` object:
  ```typescript
  sourceTripId: parsed.data.sourceTripId ?? null,
  ```
- [x] 1.4 In `api/trips.ts` POST handler, after the `upsert_trip_with_stops` RPC call succeeds and `tripId` is extracted, add a conditional update to set `source_trip_id` on the newly created trip if `parsedBody.data.sourceTripId` is provided:
  ```typescript
  if (parsedBody.data.sourceTripId) {
    await supabase
      .from('trips')
      .update({ source_trip_id: parsedBody.data.sourceTripId })
      .eq('id', tripId)
      .eq('user_id', user.id)
  }
  ```
  This approach avoids modifying the existing `upsert_trip_with_stops` RPC function. The update happens between the RPC call and the final `getTripRow()` re-fetch, so the returned trip includes the correct `sourceTripId`.

### Task 2 — Extend frontend `TripWritePayload` type (AC: 2)

**Primary files:**
- `src/types/trip.ts`

- [x] 2.1 Add `sourceTripId?: string` to the `TripWritePayload` interface:
  ```typescript
  export interface TripWritePayload {
    title?: string
    notes?: string
    origin?: TripPlaceSnapshot | null
    destination: TripPlaceSnapshot
    routeMode?: TripRouteMode
    stops?: TripWaypointInput[]
    sourceTripId?: string        // lineage tracking for duplicates
  }
  ```

### Task 3 — Build trip-to-payload duplication helper (AC: 1, 3)

**Primary files:**
- `src/features/route-planning/routePlanning.ts`

- [x] 3.1 Add a `buildDuplicateTripPayload(trip: Trip): TripWritePayload` function in `routePlanning.ts` that:
  - Sets `title` to `trip.title + ' (copy)'` (trimmed to max 160 chars to respect server validation)
  - Copies `notes`, `origin`, `destination`, `routeMode`
  - Maps `trip.stops` (excluding the destination stop, `stopKind === 'destination'`) to `TripWaypointInput[]` — each with `stopOrder`, `source`, `pinId`, `place`, `notes` (omitting server-assigned `id` so the RPC generates fresh UUIDs)
  - Sets `sourceTripId` to `trip.id`
  - Does NOT copy `isPublic`, `shareToken`, `status`, or `id` — these are server-controlled on creation

### Task 4 — Add Duplicate button and handler to `TripListItem` (AC: 1, 3)

**Primary files:**
- `src/features/route-planning/MyRoutesScreen.tsx`

- [x] 4.1 Add `onDuplicate` prop to `TripListItem`: `onDuplicate: (tripId: string) => void`
- [x] 4.2 Add a "Duplicate" button in the `TripListItem` footer action area, next to the existing "Resume route" button:
  ```tsx
  <button
    type="button"
    data-testid="duplicate-trip-button"
    onClick={() => onDuplicate(trip.id)}
    className="min-h-[44px] rounded-full border border-border px-4 text-sm font-medium transition hover:border-sky-400"
  >
    Duplicate
  </button>
  ```
  Use `data-testid="duplicate-trip-button"` for test targeting.
- [x] 4.3 Do NOT show the Duplicate button on archived trips (`trip.status === 'archived'`) — archived trips should be un-archived before duplication to keep intent clear
- [x] 4.4 In `MyRoutesContent`, create a `handleDuplicateTrip` async function that:
  1. Finds the trip from the `trips` array by ID
  2. Calls `buildDuplicateTripPayload(trip)` to construct the write payload
  3. Calls `createTripMutation.mutateAsync(payload)` to POST the new trip
  4. On success, opens the new trip in the builder by calling `openTrip(createdTrip.id)`
- [x] 4.5 Add loading state management: track `duplicatingTripId: string | null` in component state to disable the Duplicate button and show feedback while the mutation is in-flight
- [x] 4.6 Pass `isDuplicating` boolean down to `TripListItem` to show "Duplicating…" text on the button while the mutation runs and disable the button
- [x] 4.7 Handle error state: if the duplicate mutation fails, show an inline error alert near the duplicated card (use the same error pattern as `activeTripError`) or let the existing `createTripMutation.error` display in the builder context

### Task 5 — Add and extend test coverage (AC: 1, 2, 3)

**Primary files:**
- `src/features/route-planning/MyRoutesScreen.test.tsx`
- `src/features/route-planning/routePlanning.test.ts`

- [x] 5.1 Add unit test for `buildDuplicateTripPayload()` in `routePlanning.test.ts`:
  - Verify title has " (copy)" suffix
  - Verify notes, origin, destination, routeMode are copied
  - Verify stops are mapped correctly (waypoints only, no destination stop, no server-assigned `id`)
  - Verify `sourceTripId` is set to the original trip's ID
  - Verify title is truncated to 160 chars max
- [x] 5.2 Add test in `MyRoutesScreen.test.tsx`: Duplicate button appears on draft trip cards
- [x] 5.3 Add test in `MyRoutesScreen.test.tsx`: Duplicate button does NOT appear on archived trip cards (when `includeArchived` is toggled)
- [x] 5.4 Add test in `MyRoutesScreen.test.tsx`: Clicking Duplicate calls createTripMutation with the expected payload shape (title with " (copy)" suffix, copied destination, sourceTripId)
- [x] 5.5 Add test in `MyRoutesScreen.test.tsx`: After successful duplication, the new trip opens in the builder (tripId search param updates)
- [x] 5.6 Add test in `MyRoutesScreen.test.tsx`: Duplicate button shows disabled/loading state while mutation is pending

### Task 6 — Validate scope boundaries and project health (AC: 1, 2, 3)

- [x] 6.1 Run `npm run test`, `npm run lint`, `npm run build` after implementation
- [x] 6.2 Confirm this story does **not** add:
  - archive or delete mutation endpoints or UI
  - offline draft store or sync queue
  - new database migrations
  - new API endpoints (only extends existing POST /api/trips)
- [x] 6.3 Confirm `is_public` and `share_token` are NOT set in the duplicate payload — they use safe database defaults (`false` and `null`)
- [x] 6.4 Confirm the original trip is unmodified after duplication (verify by checking the trip query cache or re-fetching)

---

## Dev Notes

### Architecture Guardrails

1. **Reuse `POST /api/trips` — do NOT create a new endpoint.**
   Duplication is a client-side composition: read existing trip data, construct a new `TripWritePayload`, and POST it. The only server-side change is accepting and persisting `sourceTripId` in the write flow.

2. **Do NOT modify the `upsert_trip_with_stops` RPC function.**
   The RPC signature is stable and shared by create and update flows. Instead, set `source_trip_id` with a lightweight `.update()` call after the RPC succeeds in the POST handler. This avoids migration complexity and RPC signature changes.

3. **`is_public` and `share_token` safety is guaranteed by database defaults.**
   The `upsert_trip_with_stops` RPC INSERT does not set `is_public` or `share_token` — they use column defaults (`false` and `null`). The client must NOT include these fields in the write payload. This ensures duplicates never inherit public visibility.

4. **Title format: `"{original title} (copy)"`, max 160 chars.**
   The server-side `TripWriteBodySchema` enforces `z.string().max(160)` on the title. The client must truncate the title before appending " (copy)" if the original is longer than 153 chars (160 - 7 for " (copy)").

5. **Map `TripStop[]` → `TripWaypointInput[]` excluding destination.**
   A trip's `stops` array includes the destination stop (`stopKind: 'destination'`). The write payload's `destination` field already carries the destination snapshot. Only waypoint stops (`stopKind: 'waypoint'`) should be mapped to the `stops` array in the payload. Omit the server-assigned `id` field so fresh UUIDs are generated.

6. **Re-index `stopOrder` from 0.**
   When mapping stops, reset `stopOrder` to sequential indices starting at 0. The original stop order values may not be sequential after filtering out the destination stop.

7. **`sourceTripId` points to the immediate parent, not the root.**
   When duplicating a trip that was itself a duplicate (or an import), set `sourceTripId` to the immediate parent trip's ID, not the root-of-chain trip. This creates a chain: `shared → import → duplicate` where each link points to its direct parent.

8. **Keep `useCreateTripMutation` as the single create hook.**
   Do NOT create a separate `useDuplicateTripMutation`. Duplication uses the same mutation with a pre-constructed payload. The `onSuccess` cache update in `useCreateTripMutation` already handles inserting the new trip into the list.

### Existing Code Signals

- `MyRoutesScreen.tsx` line 153-201: `TripListItem` component — add `onDuplicate` prop and Duplicate button in the footer area (line 186-199)
- `MyRoutesScreen.tsx` line 428-435: Trip list map — pass `onDuplicate` handler to each `TripListItem`
- `MyRoutesScreen.tsx` line 464-469: `createTripMutation` is already available in `MyRoutesContent` and its `mutateAsync` is used for creation flow
- `useCreateTripMutation.ts` line 21-27: `onSuccess` optimistically adds the new trip to the cache — this covers duplicate trips automatically
- `api/trips.ts` line 45-83: POST handler — insert `source_trip_id` update between the RPC call (line 51) and the final `getTripRow()` re-fetch (line 73)
- `api/_trips.ts` line 34-45: `TripWriteBodySchema` — add `sourceTripId` here; the `.strict()` validator will reject it if not added
- `api/_trips.ts` line 64-71: `TripWriteInput` — add `sourceTripId: string | null`
- `api/_trips.ts` line 239-258: `parseTripWriteBody()` — include `sourceTripId` in returned data
- `src/types/trip.ts` line 50-57: `TripWritePayload` — add `sourceTripId?: string`
- `routePlanning.ts` line 53-60: `pinToTripPlaceSnapshot` shows the snapshot mapping pattern; `tripStopToWaypointInput` (line ~70-80) maps stops to input format — reuse this pattern for duplicate payload construction

### Scope Boundaries / Anti-Patterns

- Do **not** add archive/delete mutation logic (Story 3.3)
- Do **not** add a "Duplicate" action inside the `RouteBuilderSheet` — keep it on the library card only for this story
- Do **not** copy `is_public`, `share_token`, `status`, or `revision` from the source trip
- Do **not** modify the `upsert_trip_with_stops` RPC function or create a new migration
- Do **not** add a confirmation dialog for duplication — it's non-destructive and instantly revertible (user can delete the duplicate)
- Do **not** handle recursive title suffixing (e.g., "Trip (copy) (copy)") — appending " (copy)" once is sufficient for MVP

### Dependencies / Sequencing

- **Depends on (all done):**
  - `p3-1-1-normalized-trip-model-foundation` — trips + trip_stops schema, RPC
  - `p3-1-3-create-a-new-trip-plan` — `useCreateTripMutation`, `POST /api/trips`
  - `p3-3-1-my-routes-library-view` — enhanced `TripListItem` card, filter/sort controls

- **Blocks:**
  - `p3-3-3-archive-and-delete-route-plans` — may reuse the card action pattern introduced here

### Previous Story Intelligence

- `p3-3-1` confirmed that `TripListItem` is the card component with `StatusBadge` and `SyncIndicator`. The footer area has a "Resume route" button — the Duplicate button fits next to it.
- `p3-3-1` added the `includeArchived` filter toggle — archived trips can appear in the list. The Duplicate button should be hidden on archived cards to keep intent clear.
- `p3-3-1` confirmed that `useCreateTripMutation` cache update pattern works: `onSuccess` prepends the new trip to the list and invalidates queries.
- Known baseline repo noise remains outside this story:
  - `npm run lint` baseline failures in `api/_trips.ts`, `api/pins.test.ts`
  - `npm run test` baseline noise in `src/features/account/AuthProvider.test.tsx`

### Testing Expectations

1. `npm run test` — all existing tests pass + new tests for duplicate functionality
2. `npm run lint` — no new lint errors on changed files
3. `npm run build` — clean tsc + vite build
4. Focused unit test coverage for:
   - `src/features/route-planning/routePlanning.test.ts` — `buildDuplicateTripPayload()` helper
   - `src/features/route-planning/MyRoutesScreen.test.tsx` — Duplicate button rendering, click behavior, loading state
5. Verify: Duplicate button appears on draft cards, hidden on archived cards
6. Verify: Created trip has " (copy)" title suffix, correct stops, and `sourceTripId`
7. Verify: New trip opens in builder after duplication
8. Verify: `is_public = false` and `share_token = null` on duplicate (guaranteed by DB defaults)

### Project Structure Notes

- All frontend changes stay within `src/features/route-planning/` and `src/types/`
- API changes are in `api/trips.ts` and `api/_trips.ts` — no new files
- No new database migrations — `source_trip_id` column already exists on `trips` table
- The `buildDuplicateTripPayload()` helper lives in `routePlanning.ts` alongside existing trip manipulation utilities (`appendTripWaypoint`, `removeTripWaypoint`, `tripStopToWaypointInput`)
- Path alias `@/` → `src/` used throughout

### References

- Source: `_bmad-output/planning-artifacts/epics-phase3.md#Story 3.2` — Epic acceptance criteria
- Source: `_bmad-output/planning-artifacts/architecture-phase3.md` — Trip data model, duplication scope
- Source: `_bmad-output/implementation-artifacts/p3-3-1-my-routes-library-view.md` — Previous story learnings, card component structure
- Source: `src/features/route-planning/MyRoutesScreen.tsx` — TripListItem card, MyRoutesContent, mutation handlers
- Source: `src/features/route-planning/useCreateTripMutation.ts` — Create trip mutation with cache update
- Source: `src/features/route-planning/routePlanning.ts` — Trip manipulation helpers
- Source: `src/features/route-planning/api.ts` — `createTrip()` fetch wrapper
- Source: `src/types/trip.ts` — Trip, TripStop, TripWritePayload, TripWaypointInput types
- Source: `api/trips.ts` — POST /api/trips handler
- Source: `api/_trips.ts` — TripWriteBodySchema, parseTripWriteBody(), TripWriteInput
- Source: `supabase/migrations/028_create_normalized_trip_model.sql` — upsert_trip_with_stops RPC, trips table schema

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4 (claude-sonnet-4-20250514)

### Debug Log References

### Completion Notes List

- All 6 tasks implemented and verified in order
- 107 test files, 1206 tests — all passing (0 regressions)
- 7 new unit tests for `buildDuplicateTripPayload` in `routePlanning.test.ts`
- 5 new integration tests for Duplicate button behavior in `MyRoutesScreen.test.tsx`
- Build passes cleanly (`tsc -b && vite build`)
- No new API endpoints — reused `POST /api/trips`
- No new database migrations — `source_trip_id` column already existed
- No RPC modification — lightweight `.update()` for `source_trip_id` after RPC
- `is_public` and `share_token` NOT set in duplicate payload — DB defaults apply
- Title truncation: `"{original} (copy)"` capped at 160 chars
- Duplicate button hidden on archived trips
- Duplicating state shows disabled button with "Duplicating…" text
- After duplication, new trip opens in builder via `openTrip(createdTrip.id)`

### File List

- `api/_trips.ts` — Added `sourceTripId` to `TripWriteBodySchema`, `TripWriteInput`, and `parseTripWriteBody()`
- `api/trips.ts` — Added conditional `source_trip_id` update after RPC in POST handler
- `src/types/trip.ts` — Added `sourceTripId?: string` to `TripWritePayload`
- `src/features/route-planning/routePlanning.ts` — Added `buildDuplicateTripPayload()` helper function
- `src/features/route-planning/MyRoutesScreen.tsx` — Added Duplicate button to `TripListItem`, `handleDuplicateTrip` handler, `duplicatingTripId` state, loading/disabled UX
- `src/features/route-planning/routePlanning.test.ts` — Added 7 unit tests for `buildDuplicateTripPayload`
- `src/features/route-planning/MyRoutesScreen.test.tsx` — Added 5 integration tests for Duplicate trip behavior

### Review Follow-ups (AI)

**Reviewed by:** Claude Sonnet 4 (adversarial code review)

**Issues found and fixed (3 HIGH/MEDIUM, 1 test addition):**

1. **HIGH — `source_trip_id` update error silently swallowed** (`api/trips.ts:76-82`): The Supabase `.update()` call for `source_trip_id` returned `{error}` but it was never destructured or checked. If the update failed, the trip was created without lineage tracking and no error was logged. **Fixed:** Added `{ error: sourceError }` destructuring and `console.error` logging on failure.

2. **MEDIUM — No error handling/display for duplicate failures** (`MyRoutesScreen.tsx:313-325`): Task 4.7 required an inline error alert on duplicate failure, but `handleDuplicateTrip` had no `catch` block and no UI rendered errors to the user. `mutateAsync` would throw, the `finally` cleaned up state, but the user saw no error message. **Fixed:** Added `catch` block with `duplicateError` state, added `setDuplicateError(null)` to clear on retry, and added an error alert UI (`data-testid="duplicate-error"`) rendered above the trip list with a Dismiss button.

3. **MEDIUM — `useCreateTripMutation` optimistic cache broken** (`useCreateTripMutation.ts:22`): The `tripsQueryKey` signature was changed in this story to include `{includeArchived}` as a third element. `useCreateTripMutation` still used `tripsQueryKey(userId)` → `['trips', userId, {includeArchived: false}]` for `setQueryData`, meaning it only updated the non-archived cache variant and missed the `includeArchived: true` variant. Also used broader `['trips']` for invalidation instead of `['trips', userId]`. **Fixed:** Replaced `setQueryData(tripsQueryKey(...))` with `setQueriesData({queryKey: ['trips', userId]})` to update ALL cached trip list variants, and narrowed invalidation to `['trips', userId]`.

4. **LOW (test added) — No test for zero-waypoint trip duplication** (`routePlanning.test.ts`): Added a test verifying `buildDuplicateTripPayload` correctly handles a trip with only a destination stop (0 waypoints), producing `stops: []`.

**Issues noted but not fixed (LOW):**
- `sourceTripId` has no FK validation on the API side — any valid UUID is accepted. This is acceptable for lineage tracking (non-security-critical) and the Zod schema validates UUID format.
- Title truncation via `.slice()` operates on UTF-16 code units, which could split multi-byte emoji characters. Acceptable for MVP.

**Verification:** 107 test files, 1207 tests all passing. Build clean (`tsc -b && vite build`).
