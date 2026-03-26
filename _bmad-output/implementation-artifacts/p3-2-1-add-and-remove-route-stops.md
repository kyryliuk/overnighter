# Story p3-2.1: Add and Remove Route Stops

## Story

As a **premium user**,
I want to add and remove stops from saved spots and map pins,
So that I can shape a trip around the overnight, dump, water, and fuel points that matter to me.

## Status

**Review**

## Context

Story `p3-1-1` already established the normalized trip persistence and validation stack this story must extend:

- `supabase\migrations\028_create_normalized_trip_model.sql`
- `api\trips.ts`
- `api\trips\[id].ts`
- `api\_trips.ts`
- `src\lib\supabase\trips.ts`
- `src\types\trip.ts`

Story `p3-1-2` already established the map-native `/trips` workspace shell and route entry points:

- `src\App.tsx` nests `/trips` under the map route so `MapView` stays mounted
- `src\features\route-planning\MyRoutesScreen.tsx` renders the premium-gated planner overlay
- `src\features\map\MapView.tsx` already exposes the floating **My Routes** entry point
- `src\features\pin-detail\PinDetailSheet.tsx` already routes users toward `/trips`

Stories `p3-1-3` and `p3-1-4` already established the normalized builder and resume flow this story must reuse rather than replace:

- `src\features\route-planning\RouteBuilderSheet.tsx` owns the create/resume planner sheet UI
- `src\features\route-planning\useCreateTripMutation.ts` already persists normalized trip creates
- `src\features\route-planning\useTripsQuery.ts` and `src\features\route-planning\useTripQuery.ts` already own list + single-trip reads
- `src\features\route-planning\api.ts` already contains authenticated fetch/create helpers
- `/trips?tripId=<id>` is already the selected-trip deep-link contract
- restored normalized stops currently render as read-only resume state inside the builder

The next step is to let an already-open normalized trip become a true stop builder while staying inside the same `/trips` planner stack. This story should stay narrowly scoped to **adding and removing intermediate stops**:

- append an intermediate stop from planner search results, saved-spot affordances, and active-trip pin-detail context
- remove an existing intermediate stop from the builder list
- persist updated ordered waypoints through normalized `PATCH /api/trips/:id`
- keep the active trip on the existing `/trips` map-native planner shell
- enforce duplicate-stop and max-stop limits in the UI without weakening server validation

This story must **not** pull later planner capabilities forward:

- no reorder / move-up / move-down controls (`p3-2-2`)
- no corridor overlay / polyline / fit-to-route implementation (`p3-2-2`)
- no corridor suggestion work from the legacy scoring flow (`p3-2-3`)
- no ordered Google Maps handoff changes (`p3-2-4`)
- no offline draft store, pending mutation queue, or reconnect conflict handling (`p3-4-*`)
- no duplication, archive/delete, or legacy `/plan-route` cutover work (`p3-3-*`, `p3-5-*`)

---

## Acceptance Criteria

### AC 1 — Adding a stop appends it to the active normalized trip

**Given** a premium user has an active trip open in the planner  
**When** they tap **Add to route** from a saved spot card, pin detail sheet, or route planner search result  
**Then** the selected place is appended to the trip as an intermediate stop  
**And** its snapshot is stored in the active draft and persisted through the normalized trip write.

### AC 2 — Duplicate stops are blocked consistently in UI and server validation

**Given** the same stop is already present in the trip  
**When** the user attempts to add it again  
**Then** the planner blocks the duplicate or clearly prompts the user according to the chosen product rule  
**And** the server also rejects duplicate stop ordering / identifiers on save.

### AC 3 — Removing a stop keeps the ordered list valid

**Given** a trip already contains intermediate stops  
**When** the user removes one from the stop list  
**Then** the stop disappears from the builder  
**And** the remaining stops keep a valid sequential order.

### AC 4 — Max-stop guardrails prevent invalid writes

**Given** the trip has reached the 12-stop maximum  
**When** the user attempts to add another stop  
**Then** the planner blocks the action with an inline explanation  
**And** no invalid mutation is queued or sent.

---

## Tasks / Subtasks

### Task 1 — Add the normalized update-mutation path for active-trip stop edits

**Primary files:**
- `src\features\route-planning\api.ts`
- `src\features\route-planning\useUpdateTripMutation.ts` **(new)**
- `src\features\route-planning\useTripQuery.ts`
- `src\features\route-planning\useTripsQuery.ts`

- [x] 1.1 Extend `src\features\route-planning\api.ts` with an `updateTrip(accessToken, tripId, payload)` helper that issues `PATCH /api/trips/:id`
- [x] 1.2 Create `useUpdateTripMutation.ts` with TanStack Query `useMutation`, following the same auth-token ownership pattern already used by `useCreateTripMutation.ts`
- [x] 1.3 On successful stop edits, refresh both the active trip query and the trips list query so `/trips` reflects canonical server state without a page reload
- [x] 1.4 Keep the client payload aligned with `TripWritePayload` in `src\types\trip.ts`; do **not** invent a parallel add-stop contract
- [x] 1.5 Route all persisted add/remove behavior through the normalized stack rather than the legacy `tripPlansStore` / snapshot planner path

**Acceptance Criteria:** AC 1, AC 2, AC 3, AC 4

---

### Task 2 — Introduce normalized stop-draft helpers without reviving the legacy planner store

**Primary files:**
- `src\features\route-planning\routePlanning.ts`
- `src\features\route-planning\routePlanning.test.ts`
- `src\types\trip.ts`

- [x] 2.1 Reuse the proven add/remove ordering ideas from `appendUniqueWaypoint(...)` in `routePlanning.ts`, but adapt them for normalized trip-stop inputs rather than `TripPlanPlace` legacy state
- [x] 2.2 Add or extract helper logic that can:
  - append a new intermediate stop at the next valid `stopOrder`
  - remove an intermediate stop and compact the remaining order values
  - detect duplicate place ids before a mutation is sent
- [x] 2.3 Preserve stop metadata needed by the normalized model (`source`, `pinId`, `notes`, `stopKind`) when converting between builder UI state and `TripWritePayload`
- [x] 2.4 Treat destination as a separate canonical field; this story only mutates intermediate waypoint stops
- [x] 2.5 Keep reorder behavior out of scope even if helper extraction makes that future work easier

**Acceptance Criteria:** AC 1, AC 2, AC 3, AC 4

---

### Task 3 — Extend `RouteBuilderSheet` into an interactive add/remove stop builder for active trips

**Primary files:**
- `src\features\route-planning\RouteBuilderSheet.tsx`
- `src\features\route-planning\RouteBuilderSheet.test.tsx`
- `src\features\route-planning\MyRoutesScreen.tsx`

- [x] 3.1 Hydrate editable intermediate-stop draft state from the restored normalized trip instead of rendering stops as read-only resume-only content
- [x] 3.2 Reuse the existing `usePinsQuery()` planner search source already wired into `RouteBuilderSheet.tsx`; do **not** create a second pin-search stack for `/trips`
- [x] 3.3 Add an explicit stop list UI with per-stop remove actions, clear labeling, and immediate local order compaction after removal
- [x] 3.4 Add planner-side stop-add affordances that append a selected place into the active stop list while leaving destination/origin editing intact
- [x] 3.5 Surface inline duplicate-stop and max-stop validation before mutation submission, while preserving server-side enforcement in `api\_trips.ts`
- [x] 3.6 Keep create-mode behavior from `p3-1-3` intact; stop editing should activate only for an existing active trip rather than forcing the new-trip create flow to become a full editor immediately
- [x] 3.7 Keep the builder mobile-first and map-native; do not turn `/trips` into a detached CRUD admin form

**Acceptance Criteria:** AC 1, AC 2, AC 3, AC 4

---

### Task 4 — Wire add-stop entry points from existing planner-adjacent surfaces into the active `/trips` builder

**Primary files:**
- `src\features\pin-detail\PinDetailSheet.tsx`
- `src\features\pin-detail\PinDetailSheet.test.tsx`
- `src\features\saved-spots\SavedSpotsScreen.tsx`
- `src\features\route-planning\MyRoutesScreen.tsx`
- `src\store\spotsStore.ts`

- [x] 4.1 Preserve the existing `Plan route here` entry behavior for users without an active trip, but add an active-trip path that can send the selected pin into the normalized `/trips?tripId=<id>` builder as a pending stop-add intent
- [x] 4.2 Reuse existing saved-spot data from `useSpotsStore` / saved-spots UI rather than creating a duplicate saved-place cache for this story
- [x] 4.3 Normalize all entry points (pin detail, saved spots, planner search) through the same stop-conversion helper so place snapshots, `source`, and duplicate detection rules stay consistent
- [x] 4.4 Keep canonical trip content changes inside the `/trips` planner flow; external surfaces may launch or pass intent, but they must not bypass the normalized builder and patch stack
- [x] 4.5 Do **not** require a legacy `/plan-route` redirect, a second planner route, or a global trip-content store to make these entry points work

**Acceptance Criteria:** AC 1, AC 2

---

### Task 5 — Extend API and UI regression coverage for add/remove-stop behavior

**Primary files:**
- `api\trips\[id].test.ts`
- `api\trips.test.ts`
- `src\features\route-planning\RouteBuilderSheet.test.tsx`
- `src\features\route-planning\MyRoutesScreen.test.tsx`
- `src\features\route-planning\routePlanning.test.ts`
- `src\features\pin-detail\PinDetailSheet.test.tsx`
- `src\features\saved-spots\SavedSpotsScreen.test.tsx`

- [x] 5.1 Extend `api\trips\[id].test.ts` to cover add-stop and remove-stop `PATCH /api/trips/:id` scenarios using the normalized payload shape
- [x] 5.2 Verify the server still rejects duplicate place ids, invalid stop-order sequences, and trip payloads that exceed the 12-stop limit
- [x] 5.3 Verify builder-side add/remove interactions update local stop rendering immediately and submit the expected `TripWritePayload` on save
- [x] 5.4 Verify active-trip add actions from planner search, pin detail, and saved-spot entry points land in the same normalized builder flow
- [x] 5.5 Verify removing a stop keeps order sequential and does not silently mutate origin or destination data
- [x] 5.6 Verify duplicate-stop and max-stop guardrails present clear user-facing feedback without crashing the `/trips` shell

**Acceptance Criteria:** AC 1, AC 2, AC 3, AC 4

---

### Task 6 — Validate add/remove behavior without leaking later Epic 2 work into this story

- [x] 6.1 Run the existing project validation commands after implementation:
  - `npm run test`
  - `npm run lint`
  - `npm run build`
- [x] 6.2 Confirm this story does **not** add:
  - reorder controls or keyboard move-up / move-down behavior (`p3-2-2`)
  - `TripCorridorOverlay` polyline, numbered markers, or fit-to-route work (`p3-2-2`)
  - corridor suggestion scoring / recommendation UI (`p3-2-3`)
  - ordered Google Maps handoff changes (`p3-2-4`)
  - offline queue, sync badge, reconnect flush, or conflict-resolution logic (`p3-4-*`)
- [x] 6.3 Confirm `/trips` remains the normalized planner surface while legacy `RoutePlanningScreen.tsx` / `tripPlansStore.ts` stay untouched as compatibility paths for now
- [x] 6.4 Confirm map-native planner behavior is preserved: `MapView` stays mounted, `/trips` remains the active overlay shell, and add/remove changes do not kick the user into a detached screen

**Acceptance Criteria:** AC 1, AC 2, AC 3, AC 4

---

## Dev Notes

### Architecture Guardrails

1. **Stay on the normalized `/trips` planner stack.**  
   Story `p3-1-4` already restored active trips inside `MyRoutesScreen` + `RouteBuilderSheet`. Add/remove stop behavior must extend that stack, not fork into legacy planner state.

2. **Persist through `PATCH /api/trips/:id`, not a new mutation path.**  
   `api\trips\[id].ts` and `api\_trips.ts` already define the normalized update contract, including duplicate-place and sequential-order validation.

3. **URL still owns the active trip.**  
   `/trips?tripId=<id>` remains the canonical selected-trip contract. Any transient “add this pin/spot into the active trip” intent may be passed through route state or lightweight UI state, but canonical trip content must still hydrate in the builder and persist through TanStack Query + `PATCH`.

4. **Reuse existing search and place data sources.**  
   `RouteBuilderSheet.tsx` already uses `usePinsQuery()`, `PinDetailSheet.tsx` already exposes a route-planning CTA, and saved spots already live in `useSpotsStore`. Build on those sources instead of creating a second planner-search or saved-places subsystem.

5. **Destination is separate from intermediate stops.**  
   The normalized trip model keeps destination as its own snapshot. This story mutates only intermediate waypoints; do not collapse destination into the editable stop list model.

6. **Honor the server guardrails in the client, but keep the server authoritative.**  
   `api\_trips.ts` already enforces max 12 total stops including destination, unique place ids, and sequential `stopOrder`. The UI should pre-block bad edits for usability, while the API remains the final authority.

7. **Do not sneak reorder or overlay work into this story.**  
   Removing a stop should compact order values immediately, but move-up / move-down controls, numbered markers, corridor polylines, and fit-to-route behavior belong to `p3-2-2`.

8. **Do not regress the map-native planner shell.**  
   `/trips` was nested under the map route so `MapView` stays mounted. Add/remove stop work must preserve that behavior and avoid redirecting users into a detached page flow.

9. **Keep query/state ownership consistent.**  
   TanStack Query owns server trip data. Local component state may own in-sheet stop editing before save. Do **not** introduce `tripDraftStore`, pending mutation queues, or offline sync state in this story.

### Previous Story Intelligence

- Story `p3-1-3` already proved the normalized create flow, active `tripId` URL update, and query invalidation pattern for `/trips`.
- Story `p3-1-4` already introduced single-trip hydration via `useTripQuery.ts` and restored ordered stops into the builder as read-only content.
- The builder now has enough normalized data to become the stop-editing surface; the correct next move is extending that component, not building a second “edit trip” screen.
- Existing tests in `MyRoutesScreen.test.tsx` and `RouteBuilderSheet.test.tsx` already cover create/resume behavior and should be extended rather than replaced.

### Existing Code Signals

- `src\features\route-planning\RouteBuilderSheet.tsx` already uses `usePinsQuery()` and contains the closest current planner-search UX to extend for active-trip stop adds
- `src\features\route-planning\MyRoutesScreen.tsx` already owns active `tripId` selection, create/resume sheet state, and single-trip query hydration
- `src\features\route-planning\api.ts` already implements authenticated fetch/create wrappers and should host the matching update wrapper
- `src\features\route-planning\routePlanning.ts` already contains proven add/remove/reorder helper ideas in the legacy planner (`appendUniqueWaypoint`, `moveWaypoint`)
- `api\_trips.ts` already validates unique place ids, sequential order, and the 12-stop maximum through the normalized API contract
- `src\features\pin-detail\PinDetailSheet.tsx` already has a **Plan route here** CTA that should be expanded carefully for active-trip add behavior without breaking the existing entry flow
- `src\features\saved-spots\SavedSpotsScreen.tsx` already renders the saved-spot list and can act as an entry surface, but it must not become a second canonical trip editor
- `src\types\trip.ts` already defines `TripStop`, `TripWritePayload`, and the normalized place snapshot shape required for persistence

### Scope Boundaries / Anti-Patterns

- Do **not** route normalized stop edits through `src\store\tripPlansStore.ts`
- Do **not** make `RoutePlanningScreen.tsx` the persistence path for `/trips`
- Do **not** add reorder handles, keyboard move controls, or drag-and-drop in this story
- Do **not** add `TripCorridorOverlay`, numbered markers, or map fit logic here
- Do **not** create a second saved-spots cache, duplicate pin-search layer, or parallel trip mutation API
- Do **not** silently ignore duplicate/max-stop failures; users need clear feedback and the API must still reject invalid writes
- Do **not** pull in offline queueing, duplication, archive/delete, or legacy cutover behavior while implementing add/remove stops

### Dependencies / Sequencing

- **Depends on:**
  - `p3-1-1-normalized-trip-model-foundation`
  - `p3-1-2-gated-my-routes-entry-point`
  - `p3-1-3-create-a-new-trip-plan`
  - `p3-1-4-resume-an-existing-trip`

- **Blocks:**
  - `p3-2-2-reorder-stops-and-render-corridor-overlay`
  - `p3-2-3-corridor-suggestions-from-existing-route-logic`
  - `p3-2-4-ordered-google-maps-handoff`
  - later offline draft/sync stories that assume active-trip stop mutation is working on the normalized stack

### Testing Expectations

Minimum expected validation for implementation:

1. `npm run test`
2. `npm run lint`
3. `npm run build`
4. Focused coverage for:
   - `api\trips\[id].test.ts`
   - `api\trips.test.ts`
   - `src\features\route-planning\RouteBuilderSheet.test.tsx`
   - `src\features\route-planning\MyRoutesScreen.test.tsx`
   - `src\features\route-planning\routePlanning.test.ts`
   - `src\features\pin-detail\PinDetailSheet.test.tsx`
   - `src\features\saved-spots\SavedSpotsScreen.test.tsx`
5. Confirm add-stop actions append a normalized intermediate stop with the expected source/place snapshot metadata
6. Confirm duplicate-stop and max-stop attempts are blocked in the UI and still rejected by API validation if they slip through
7. Confirm removing a stop compacts order immediately and persists a valid sequential stop list on save
8. Confirm add/remove changes do not reset title, notes, origin, destination, or active `tripId` selection
9. Confirm `/trips` continues to behave as a map-backed overlay rather than a standalone page flow

### References

- Source: `_bmad-output\planning-artifacts\epics-phase3.md` — Phase 3 Epic 2, Story 2.1
- Source: `_bmad-output\planning-artifacts\architecture-phase3.md` — Scope, Key User Workflows, Data Model Proposal, API Surface Proposal, Frontend Architecture Proposal, UI Composition, State Ownership, Accessibility / Performance / Security Requirements, Recommended Implementation Notes
- Source: `_bmad-output\implementation-artifacts\p3-1-3-create-a-new-trip-plan.md`
- Source: `_bmad-output\implementation-artifacts\p3-1-4-resume-an-existing-trip.md`
- Source: `src\features\route-planning\MyRoutesScreen.tsx`
- Source: `src\features\route-planning\RouteBuilderSheet.tsx`
- Source: `src\features\route-planning\useTripQuery.ts`
- Source: `src\features\route-planning\useTripsQuery.ts`
- Source: `src\features\route-planning\api.ts`
- Source: `src\features\route-planning\routePlanning.ts`
- Source: `src\features\route-planning\RoutePlanningScreen.tsx`
- Source: `src\features\pin-detail\PinDetailSheet.tsx`
- Source: `src\features\saved-spots\SavedSpotsScreen.tsx`
- Source: `src\types\trip.ts`
- Source: `api\trips.ts`
- Source: `api\trips\[id].ts`
- Source: `api\_trips.ts`
- Source: `package.json`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- All implementation was already present in the codebase when this story was picked up for dev execution.
- Verified by reading all referenced source files: `api.ts`, `useUpdateTripMutation.ts`, `routePlanning.ts`, `RouteBuilderSheet.tsx`, `MyRoutesScreen.tsx`, `PinDetailSheet.tsx`, `SavedSpotsScreen.tsx`.
- All test files confirmed as fully covering Tasks 5.1–5.6.

### Completion Notes List

- All 6 tasks fully implemented and verified. No new code was required — all implementation was pre-existing and correct.
- Task 1: `updateTrip` in `api.ts` + `useUpdateTripMutation.ts` with dual query invalidation (`tripQueryKey` + `tripsQueryKey`).
- Task 2: `appendTripWaypoint`, `removeTripWaypoint`, `compactTripWaypointOrders`, `pinToTripWaypointInput`, `tripStopToWaypointInput` all in `routePlanning.ts`.
- Task 3: `RouteBuilderSheet.tsx` — editable stop list, add from search/saved spots/suggestions, remove with order compaction, inline validation, create-mode vs resume-mode separation.
- Task 4: `PinDetailSheet.tsx` — `handleRoutePlanning` passes `addStopPinId`+`addStopSource` via URL params when `activeTripId` present. `SavedSpotsScreen.tsx` — `handleAddToRoute` navigates to `/trips?tripId=...&addStopPinId=...&addStopSource=saved`.
- Task 5: 1177 tests pass across 107 test files. API tests in `api/trips/[id].test.ts` cover PATCH add/remove/reorder/duplicate/max-stop/sequential-order. UI tests in `RouteBuilderSheet.test.tsx`, `MyRoutesScreen.test.tsx`, `PinDetailSheet.test.tsx`, `SavedSpotsScreen.test.tsx`.
- Task 6: `npm run build` passes. Scope boundaries confirmed — no reorder controls, no corridor overlay, no Google Maps handoff, no offline queue, no legacy store regression.

### File List

- `_bmad-output\implementation-artifacts\p3-2-1-add-and-remove-route-stops.md`
- `src\features\route-planning\api.ts`
- `src\features\route-planning\useUpdateTripMutation.ts`
- `src\features\route-planning\routePlanning.ts`
- `src\features\route-planning\RouteBuilderSheet.tsx`
- `src\features\route-planning\MyRoutesScreen.tsx`
- `src\features\pin-detail\PinDetailSheet.tsx`
- `src\features\saved-spots\SavedSpotsScreen.tsx`
- `api\trips\[id].test.ts`
- `src\features\route-planning\routePlanning.test.ts`
- `src\features\route-planning\RouteBuilderSheet.test.tsx`
- `src\features\route-planning\MyRoutesScreen.test.tsx`
- `src\features\pin-detail\PinDetailSheet.test.tsx`
- `src\features\saved-spots\SavedSpotsScreen.test.tsx`
