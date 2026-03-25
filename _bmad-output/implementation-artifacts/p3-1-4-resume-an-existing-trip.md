# Story p3-1.4: Resume an Existing Trip

## Story

As a **premium user**,
I want to reopen an existing trip and restore its planner state,
So that I can continue working on a route over multiple sessions.

## Status

**Ready for Dev**

## Context

Story `p3-1-1` already established the normalized trip persistence stack and single-trip API surface:

- `supabase\migrations\028_create_normalized_trip_model.sql`
- `api\trips.ts`
- `api\trips\[id].ts`
- `api\_trips.ts`
- `src\lib\supabase\trips.ts`
- `src\types\trip.ts`

Story `p3-1-2` already established the planner shell entry point and deep-link contract for `/trips`:

- `src\App.tsx` nests `/trips` under the map route so `MapView` stays mounted
- `src\features\route-planning\MyRoutesScreen.tsx` renders the premium-gated planner overlay
- `src\features\route-planning\useTripsQuery.ts` scopes trip cache by user and powers list reads
- `/trips?tripId=<id>` is already the selected-trip URL convention
- `src\features\map\MapView.tsx` and `src\features\pin-detail\PinDetailSheet.tsx` already send users into `/trips`

Story `p3-1-3` replaced the placeholder state with a real create flow:

- `src\features\route-planning\RouteBuilderSheet.tsx` now owns the planner sheet UI
- `src\features\route-planning\useCreateTripMutation.ts` writes through normalized `POST /api/trips`
- `src\features\route-planning\MyRoutesScreen.tsx` already sets `?tripId=<created-id>` after save
- `api\trips.test.ts`, `src\features\route-planning\RouteBuilderSheet.test.tsx`, and `src\features\route-planning\MyRoutesScreen.test.tsx` already cover create-path expectations

The next step is to let `/trips` reopen an existing normalized trip and rebuild the planner state from server data. This story should stay narrowly scoped to **resume / restore**:

- selecting an existing trip from the My Routes list
- restoring title, notes, origin, destination, and ordered stops into the planner
- supporting direct refresh / deep-link load through `/trips?tripId=:id`
- keeping the planner inside the existing map-native `/trips` overlay

This story must **not** pull later capabilities forward:

- no add/remove/reorder stop builder controls (`p3-2-*`)
- no offline queue / conflict resolution (`p3-4-*`)
- no legacy `/plan-route` redirect cutover or migration work (`p3-5-*`)
- no trip duplication, archive, or delete management (`p3-3-*`)

---

## Acceptance Criteria

### AC 1 — Selecting a saved trip restores it inside the existing planner shell

**Given** a premium user already has one or more saved trips  
**When** they open **My Routes**  
**Then** the app lists their non-archived trips from normalized storage  
**And** selecting a trip loads it into the planner without losing current map context.

### AC 2 — Planner state is reconstructed from the normalized trip record

**Given** a trip is selected from the list  
**When** the planner restores the route  
**Then** title, notes, origin, destination, and ordered stop data populate the route builder sheet  
**And** the active trip id is reflected in the URL query string.

### AC 3 — Deep-link refresh restores the same trip from URL + server data

**Given** a user refreshes `/trips?tripId=:id`  
**When** the page reloads  
**Then** the same trip is reloaded from query + server data  
**And** the planner state is reconstructed without requiring the user to navigate from the list again.

---

## Tasks / Subtasks

### Task 1 — Promote trip selection from passive list state to active planner state

**Primary files:**
- `src\features\route-planning\MyRoutesScreen.tsx`
- `src\features\route-planning\MyRoutesScreen.test.tsx`

- [ ] 1.1 Replace the current read-only "Selected route" notice with a real trip selection action
- [ ] 1.2 Clicking a saved trip should open the planner sheet for that trip rather than only rendering informational copy
- [ ] 1.3 Preserve the existing fixed `/trips` overlay behavior from Story 1.2 so `MapView` stays mounted
- [ ] 1.4 Update search params to `?tripId=<selected-id>` whenever a trip is opened from the list
- [ ] 1.5 Keep loading, error, empty, and list states intact while adding resume behavior

**Acceptance Criteria:** AC 1, AC 2

---

### Task 2 — Add a single-trip query path for direct deep-link and refresh restore

**Primary files:**
- `src\features\route-planning\api.ts`
- `src\features\route-planning\useTripQuery.ts` **(new)**
- `src\features\route-planning\useTripsQuery.ts`

- [ ] 2.1 Extend `src\features\route-planning\api.ts` with a `fetchTrip(accessToken, tripId)` helper using `GET /api/trips/:id`
- [ ] 2.2 Add `useTripQuery.ts` using TanStack Query for the active trip record
- [ ] 2.3 Reuse the existing auth-context pattern and user-scoped query ownership already established for trip reads
- [ ] 2.4 Prefer list data when present, but ensure `/trips?tripId=:id` can restore from server data after refresh without relying on in-memory state
- [ ] 2.5 Surface missing / inaccessible trip errors in a human-readable way consistent with repo patterns

**Acceptance Criteria:** AC 2, AC 3

---

### Task 3 — Teach the route builder sheet to hydrate and render existing trip state

**Primary files:**
- `src\features\route-planning\RouteBuilderSheet.tsx`
- `src\features\route-planning\RouteBuilderSheet.test.tsx`
- `src\types\trip.ts`

- [ ] 3.1 Extend `RouteBuilderSheet.tsx` so it can accept an existing trip (or equivalent draft model) as initial state
- [ ] 3.2 Hydrate title, notes, origin, destination, and ordered normalized stops into the sheet when resuming a trip
- [ ] 3.3 Keep the existing create flow intact; the component must still support blank-title create behavior from Story 1.3
- [ ] 3.4 Render restored stop data clearly, but **do not** add add/remove/reorder controls in this story
- [ ] 3.5 Ensure the sheet remains mobile-first and map-native rather than turning into a detached admin form
- [ ] 3.6 Add focused tests covering hydration of an existing trip and deep-link restore behavior

**Acceptance Criteria:** AC 2, AC 3

---

### Task 4 — Wire resume behavior through My Routes without prematurely expanding edit scope

**Primary files:**
- `src\features\route-planning\MyRoutesScreen.tsx`
- `src\features\route-planning\RouteBuilderSheet.tsx`
- `src\features\route-planning\useCreateTripMutation.ts`

- [ ] 4.1 Open the sheet automatically when a valid `tripId` is present in the URL
- [ ] 4.2 Close / clear active selection cleanly when the sheet is dismissed
- [ ] 4.3 Keep the selected trip highlighted or otherwise obvious in the My Routes list
- [ ] 4.4 Do **not** introduce stop mutation controls, duplication flows, archive flows, or offline queue behavior in this story
- [ ] 4.5 If metadata save behavior is touched, route it through the existing normalized trip API surface (`PATCH /api/trips/:id`) rather than adding parallel persistence logic

**Acceptance Criteria:** AC 1, AC 2, AC 3

---

### Task 5 — Add API and UI regression coverage for single-trip restore assumptions

**Primary files:**
- `api\trips\[id].test.ts`
- `src\features\route-planning\MyRoutesScreen.test.tsx`
- `src\features\route-planning\RouteBuilderSheet.test.tsx`

- [ ] 5.1 Extend API tests for `GET /api/trips/:id` if coverage gaps remain around normalized restore payload shape
- [ ] 5.2 Verify restored trip payload includes origin, destination, ordered stops, revision, and timestamps in canonical API form
- [ ] 5.3 Verify selecting a trip from the list opens the planner with the expected hydrated state
- [ ] 5.4 Verify `/trips?tripId=<id>` rebuilds planner state after render / refresh simulation
- [ ] 5.5 Verify an invalid or inaccessible `tripId` fails gracefully without crashing the `/trips` shell

**Acceptance Criteria:** AC 1, AC 2, AC 3

---

### Task 6 — Validate resume flow without leaking later story behavior

- [ ] 6.1 Run the existing project validation commands after implementation:
  - `npm run test`
  - `npm run lint`
  - `npm run build`
- [ ] 6.2 Confirm resume behavior does **not** add:
  - stop add/remove/reorder controls (`p3-2-*`)
  - duplication/archive/delete flows (`p3-3-*`)
  - offline mutation queue or reconnect conflict logic (`p3-4-*`)
  - `/plan-route` cutover or legacy migration (`p3-5-*`)
- [ ] 6.3 Confirm `/trips` continues to use normalized reads and deep-link state while leaving the legacy `RoutePlanningScreen.tsx` / `tripPlansStore.ts` path untouched for now

**Acceptance Criteria:** AC 1, AC 2, AC 3

---

## Dev Notes

### Architecture Guardrails

1. **Resume inside `/trips`, not the legacy planner.**  
   The Phase 3 architecture and Story 1.2 shell both require the map-backed `/trips` route to remain the primary route-planning entry.

2. **Deep link is the contract.**  
   `architecture-phase3.md` explicitly defines `/trips?tripId=:id` as the deep-link form. This story should reinforce that convention, not invent a new route shape.

3. **Use the existing normalized single-trip API.**  
   `api\trips\[id].ts` already exists from Story 1.1. Reuse that endpoint for restore-path reads instead of deriving everything only from the list response.

4. **Hydrate the existing builder; do not fork the planner UI.**  
   Story 1.3 introduced `RouteBuilderSheet.tsx`. Resume behavior should extend that component with initial-state hydration rather than creating a second "edit trip" surface.

5. **Restored stops are display state in this story, not editable stop-builder state.**  
   Ordered stops should appear so the user can see the reconstructed route, but actual add/remove/reorder controls belong to Epic 2.

6. **Map-native context is non-negotiable.**  
   Story 1.2 review fixes moved `/trips` under the map route specifically to preserve map context. Do not regress this by making trip resume a separate page.

7. **Keep query ownership consistent.**  
   TanStack Query owns server trip reads. Local component state may own the active builder session, but do not introduce a new global store yet.

### Previous Story Intelligence

- Story `p3-1-3` already established `RouteBuilderSheet.tsx` as the create/resume surface, so reusing and extending it is preferred over adding a second planner component.
- Story `p3-1-3` already proved the `/trips` flow can set `?tripId=<created-id>` after a successful create; this story should reuse that URL convention for selection and refresh restore.
- Story `p3-1-3` intentionally stopped short of resume logic, stop editing, and offline state. Keep those boundaries intact.
- Story `p3-1-3` test coverage already exercises the planner shell, builder open state, and normalized create API path; build on those tests rather than replacing them.

### Existing Code Signals

- `src\features\route-planning\MyRoutesScreen.tsx` currently lists trips and already computes `selectedTrip` from `tripId`
- `src\features\route-planning\RouteBuilderSheet.tsx` currently owns the planner-sheet form state for creation
- `src\features\route-planning\api.ts` already contains normalized trip fetch/create wrappers
- `src\features\route-planning\useTripsQuery.ts` already scopes trip cache by authenticated user
- `api\trips\[id].ts` already provides owned-trip reads from normalized storage
- `src\types\trip.ts` already contains the normalized trip / stop shape the resume flow needs

### Scope Boundaries / Anti-Patterns

- Do **not** reintroduce or extend `src\store\tripPlansStore.ts` for the normalized `/trips` resume flow
- Do **not** redirect resumed trips into `src\features\route-planning\RoutePlanningScreen.tsx`
- Do **not** add stop editing controls, waypoint chips, reordering UI, or Google Maps handoff here
- Do **not** create a second builder component just for resume mode
- Do **not** add silent fallbacks that ignore invalid `tripId` values without user-facing state

### Dependencies / Sequencing

- **Depends on:**
  - `p3-1-1-normalized-trip-model-foundation`
  - `p3-1-2-gated-my-routes-entry-point`
  - `p3-1-3-create-a-new-trip-plan`

- **Blocks:**
  - `p3-2-1-add-and-remove-route-stops`
  - later Epic 2 map overlay and ordered-stop editing stories

### Testing Expectations

Minimum expected validation for implementation:

1. `npm run test`
2. `npm run lint`
3. `npm run build`
4. Focused coverage for:
   - `src\features\route-planning\MyRoutesScreen.test.tsx`
   - `src\features\route-planning\RouteBuilderSheet.test.tsx`
   - `api\trips\[id].test.ts`
5. Confirm selecting a saved trip opens the planner with restored title, notes, origin, destination, and ordered stops
6. Confirm `/trips?tripId=<id>` restores the same trip after a refresh-style render
7. Confirm invalid or unauthorized trip ids fail gracefully without tearing down the planner shell

### References

- Source: `_bmad-output\planning-artifacts\epics-phase3.md` — Phase 3 Epic 1, Story 1.4
- Source: `_bmad-output\planning-artifacts\architecture-phase3.md` — Client-Side Draft Model, API Surface Proposal, Query / Helper Layer, Frontend Architecture Proposal, UI Composition
- Source: `_bmad-output\implementation-artifacts\p3-1-3-create-a-new-trip-plan.md`
- Source: `src\features\route-planning\MyRoutesScreen.tsx`
- Source: `src\features\route-planning\RouteBuilderSheet.tsx`
- Source: `src\features\route-planning\useTripsQuery.ts`
- Source: `src\features\route-planning\api.ts`
- Source: `src\types\trip.ts`
- Source: `api\trips\[id].ts`
- Source: `api\_trips.ts`

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- Phase 3 Story 1.3 review reported no significant issues before advancing to this story.

### Completion Notes List

- Story context created in YOLO mode from Phase 3 epic, architecture, and prior-story artifacts.
- Sprint tracking should mark this story as `ready-for-dev`.

### File List

- `_bmad-output\implementation-artifacts\p3-1-4-resume-an-existing-trip.md`
