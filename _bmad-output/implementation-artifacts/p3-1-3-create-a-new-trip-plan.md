# Story p3-1.3: Create a New Trip Plan

## Story

As a **premium user**,
I want to create a route plan with title, notes, destination, and optional origin,
So that I can start planning a corridor trip in Overnighter instead of external notes.

## Status

**Done**

## Context

Story p3-1-1 already created the normalized trip foundation:

- `supabase\migrations\028_create_normalized_trip_model.sql`
- `api\trips.ts`
- `api\_trips.ts`
- `src\lib\supabase\trips.ts`
- `src\types\trip.ts`

Story p3-1-2 already created the gated `/trips` workspace shell and left explicit placeholders for trip creation:

- `src\App.tsx` now lazy-loads `/trips`
- `src\features\route-planning\MyRoutesScreen.tsx` renders the premium-gated planner shell
- `src\features\route-planning\MyRoutesScreen.tsx` currently shows **Create route** buttons that only reveal placeholder copy
- `src\features\route-planning\useTripsQuery.ts` and `src\features\route-planning\api.ts` already load normalized trips from `GET /api/trips`
- `src\features\map\MapView.tsx` and `src\features\pin-detail\PinDetailSheet.tsx` already route users into `/trips`

The next step is to replace the placeholder create state with a real create flow inside the new `/trips` workspace. This story should stay narrowly scoped to **creating a brand-new trip**:

- open a route builder sheet from **Create route**
- collect title, notes, optional origin, and required destination
- save through the normalized `POST /api/trips` endpoint
- refresh the `/trips` workspace without a full-page reload

This story must **not** implement later planner capabilities:

- opening an existing trip for resume/edit (`p3-1-4`)
- adding/removing/reordering intermediate stops (`p3-2-*`)
- offline draft queueing / sync conflict logic (`p3-4-*`)
- `/plan-route` redirect cutover or legacy migration (`p3-5-*`)

---

## Acceptance Criteria

### AC 1 — Create route opens a builder sheet from My Routes

**Given** a premium user opens **My Routes** with no active trip selected  
**When** they tap **Create route**  
**Then** a new trip draft opens in the route builder sheet  
**And** the form includes editable fields for title, notes, optional origin snapshot, and required destination snapshot.

### AC 2 — Destination selection uses existing route-planning baseline data

**Given** the builder is open  
**When** the user selects a destination from existing place / pin search results already supported by the route planning baseline  
**Then** the destination is saved as a snapshot in the draft  
**And** the trip cannot be saved until a destination exists.

### AC 3 — Saving creates a normalized trip and updates My Routes in place

**Given** the user enters valid trip metadata  
**When** they save the new trip  
**Then** the planner creates a `trips` row plus a destination entry in `trip_stops` (or equivalent normalized destination representation)  
**And** the saved trip appears in **My Routes** without a full-page reload.

### AC 4 — Blank titles fall back to a sensible default

**Given** the user leaves title blank  
**When** the trip is first saved  
**Then** the system assigns a sensible default title such as destination name or `"New Route"`  
**And** the trip remains editable afterward.

---

## Tasks / Subtasks

### Task 1 — Replace the create placeholder in `/trips` with real create-flow state

**Primary files:**
- `src\features\route-planning\MyRoutesScreen.tsx`
- `src\features\route-planning\MyRoutesScreen.test.tsx`

- [ ] 1.1 Remove the placeholder-only `showCreatePlaceholder` behavior in `src\features\route-planning\MyRoutesScreen.tsx`
- [ ] 1.2 Add explicit local UI state for opening and closing a create-trip builder from the existing **Create route** CTA
- [ ] 1.3 Keep this flow inside the `/trips` experience so the planner still feels map-native rather than redirecting users into the legacy `/plan-route` screen
- [ ] 1.4 Preserve the existing empty, loading, error, and list states from Story 1.2 while layering in create behavior
- [ ] 1.5 Update `src\features\route-planning\MyRoutesScreen.test.tsx` so clicking **Create route** opens the real builder UI instead of placeholder copy

**Acceptance Criteria:** AC 1, AC 3

---

### Task 2 — Build the new route builder sheet for trip creation

**Primary files:**
- `src\features\route-planning\RouteBuilderSheet.tsx` **(new)**
- `src\features\route-planning\RouteBuilderSheet.test.tsx` **(new)**

- [ ] 2.1 Create `RouteBuilderSheet.tsx` as a sheet/dialog component that matches existing mobile-first overlay patterns already used elsewhere in the app
- [ ] 2.2 Include editable fields for:
  - `title`
  - `notes`
  - optional `origin`
  - required `destination`
- [ ] 2.3 Use the existing route-planning baseline search behavior for destination lookup by reusing the same pins/query source already used in `src\features\route-planning\RoutePlanningScreen.tsx` rather than inventing a second destination source
- [ ] 2.4 Persist the selected destination as a `TripPlaceSnapshot`-compatible shape (`id`, `name`, `latitude`, `longitude`)
- [ ] 2.5 Make destination required in the UI; save must stay disabled or fail inline until a destination exists
- [ ] 2.6 Make title optional in the UI; do **not** block save on blank title because the server already applies a fallback title in `api\_trips.ts`
- [ ] 2.7 Keep the create sheet scoped to trip metadata only; do **not** add waypoint management, reorder controls, Google Maps handoff, share controls, or resume-existing-trip logic here
- [ ] 2.8 Add component tests covering:
  - sheet opens and closes accessibly
  - destination search renders results from the existing baseline data
  - selecting a destination updates the draft
  - save remains blocked without a destination
  - blank title is allowed through to the mutation layer

**Acceptance Criteria:** AC 1, AC 2, AC 4

---

### Task 3 — Add the client mutation layer for creating normalized trips

**Primary files:**
- `src\features\route-planning\api.ts`
- `src\features\route-planning\useCreateTripMutation.ts` **(new)**
- `src\types\trip.ts` *(only if response/payload typing needs a small extension; otherwise leave unchanged)*

- [ ] 3.1 Extend `src\features\route-planning\api.ts` with a `createTrip(accessToken, payload)` helper that `POST`s to `/api/trips`
- [ ] 3.2 Create `src\features\route-planning\useCreateTripMutation.ts` using TanStack Query `useMutation`
- [ ] 3.3 Read the access token from the same auth context pattern already used for trip reads and other authenticated feature flows
- [ ] 3.4 On success, invalidate or refetch the `['trips']` query so **My Routes** updates without a full-page reload
- [ ] 3.5 Return and expose the canonical created trip payload from the API response so the UI can immediately reflect the new trip id/title/destination/revision
- [ ] 3.6 Surface API validation failures inline using the repo's existing human-readable error messaging pattern
- [ ] 3.7 Keep the client payload aligned with `TripWritePayload` in `src\types\trip.ts`; do not introduce a parallel trip-create contract

**Acceptance Criteria:** AC 3, AC 4

---

### Task 4 — Wire save behavior from the builder into the My Routes workspace

**Primary files:**
- `src\features\route-planning\MyRoutesScreen.tsx`
- `src\features\route-planning\RouteBuilderSheet.tsx`

- [ ] 4.1 Connect the sheet submit action to `useCreateTripMutation`
- [ ] 4.2 On success, close the builder sheet and immediately reflect the newly created trip in the `/trips` screen without a browser reload
- [ ] 4.3 Update the URL search params to `?tripId=<created-id>` once the trip exists so later resume work can build on the selected-trip convention already introduced in Story 1.2
- [ ] 4.4 Keep the post-create state lightweight in this story:
  - it is acceptable to highlight/select the created trip in **My Routes**
  - it is acceptable to show a non-destructive success state
  - it is **not** acceptable to implement full resume/edit restoration from server data yet
- [ ] 4.5 Handle loading and error UI so repeated taps do not fire duplicate creates and failures do not wipe the in-progress draft unexpectedly

**Acceptance Criteria:** AC 1, AC 3, AC 4

---

### Task 5 — Add or adjust server/API regression coverage for create-trip expectations

**Primary files:**
- `api\trips.test.ts`
- `api\_trips.ts` *(reference only unless a test gap exposes a direct defect)*

- [ ] 5.1 Extend `api\trips.test.ts` with explicit POST coverage for the create flow assumptions this story depends on
- [ ] 5.2 Verify the API returns `201` with a canonical `trip` payload after successful creation
- [ ] 5.3 Verify blank or whitespace-only title input still produces a valid saved trip using the fallback logic already implemented in `api\_trips.ts`
- [ ] 5.4 Verify destination is still required and invalid bodies continue to return the standard `INVALID_BODY` envelope
- [ ] 5.5 Only modify server code if the UI story uncovers a real gap; do **not** expand the server into update/resume/offline functionality in this story

**Acceptance Criteria:** AC 2, AC 3, AC 4

---

### Task 6 — Validate create-trip behavior without pulling later stories forward

- [ ] 6.1 Run the existing project validation commands after implementation:
  - `npm run test`
  - `npm run lint`
  - `npm run build`
- [ ] 6.2 Confirm the new create flow does **not** implement:
  - loading an existing trip into editable state (`p3-1-4`)
  - adding/removing/reordering intermediate stops (`p3-2-*`)
  - offline draft queueing or reconnect flush (`p3-4-*`)
  - `/plan-route` redirect or legacy data migration (`p3-5-*`)
- [ ] 6.3 Confirm `/trips` continues to use normalized trip reads/writes while the legacy `src\features\route-planning\RoutePlanningScreen.tsx` and `src\store\tripPlansStore.ts` remain untouched for backward compatibility in this story

**Acceptance Criteria:** AC 1, AC 2, AC 3, AC 4

---

## Dev Notes

### Architecture Guardrails

1. **Create inside `/trips`, not `/plan-route`.**  
   Story 1.2 established `/trips` as the new premium workspace. Do not route the user back into the legacy snapshot-based planner for this story.

2. **Reuse normalized POST, do not invent a second persistence path.**  
   `api\trips.ts` already supports `POST /api/trips`, and `api\_trips.ts` already validates payloads, enforces stop limits, requires destination, and assigns a fallback title from destination name or `"New Route"`.

3. **Keep destination search aligned with the baseline route planner.**  
   The current baseline search behavior already exists in `src\features\route-planning\RoutePlanningScreen.tsx` using `usePinsQuery()`. Reuse or extract from that source instead of creating a different destination search stack.

4. **Title is optional; destination is not.**  
   The UI should require a destination before save, but it should allow a blank title and rely on the server's canonical fallback logic.

5. **Do not start stop-builder work early.**  
   This story is only for metadata + initial destination/origin capture. No intermediate stop add/remove/reorder UI belongs here.

6. **Do not implement resume semantics yet.**  
   It is fine to select the created trip in the URL after success, but full “open existing trip and restore planner state” belongs to `p3-1-4`.

7. **Preserve the map-native UX rule.**  
   The architecture still expects **map → sheet → action**. Prefer a bottom sheet / panel style builder over a detached admin-style form page.

8. **Keep query/state ownership consistent.**  
   TanStack Query owns server trip data, while local component state can own the in-progress create form. Do not introduce a new global store for this story.

### Existing Code Signals

- `src\features\route-planning\MyRoutesScreen.tsx` already contains the create placeholder that should be replaced
- `src\features\route-planning\useTripsQuery.ts` already owns normalized trip reads for `/trips`
- `src\features\route-planning\api.ts` already contains the fetch wrapper pattern for authenticated trip requests
- `src\types\trip.ts` already defines `TripWritePayload`
- `api\trips.ts` already performs the create RPC and returns canonical trip state
- `api\_trips.ts` already applies blank-title fallback:
  - destination name first
  - `"New Route"` as final fallback
- `src\features\route-planning\RoutePlanningScreen.tsx` already contains the closest existing destination-search and place-snapshot logic, but it remains legacy snapshot-planner code and should not become the persistence path for `/trips`

### Scope Boundaries / Anti-Patterns

- Do **not** extend `src\store\tripPlansStore.ts` for the new `/trips` create flow
- Do **not** save into legacy `trip_plans` or `useTripPlansStore`
- Do **not** add trip-sharing UI to the new builder sheet
- Do **not** add waypoint chips, stop lists, reorder handles, or corridor overlay behavior
- Do **not** refactor unrelated map, account, or premium flows beyond what the create story needs

### Dependencies / Sequencing

- **Depends on:**
  - `p3-1-1-normalized-trip-model-foundation`
  - `p3-1-2-gated-my-routes-entry-point`

- **Blocks:**
  - `p3-1-4-resume-an-existing-trip`
  - `p3-2-1-add-and-remove-route-stops`
  - later offline draft/sync stories that assume a real normalized create flow exists

### Testing Expectations

Minimum expected validation for implementation:

1. `npm run test`
2. `npm run lint`
3. `npm run build`
4. Focused coverage for:
   - `src\features\route-planning\MyRoutesScreen.test.tsx`
   - `src\features\route-planning\RouteBuilderSheet.test.tsx`
   - `api\trips.test.ts`
5. Confirm create success updates the visible `/trips` UI without a browser reload
6. Confirm blank title create succeeds and shows the fallback title returned by the server
7. Confirm destination-missing create stays blocked or fails inline without producing a saved trip

### References

- Source: `_bmad-output\planning-artifacts\epics-phase3.md` — Phase 3 Epic 1, Story 1.3
- Source: `_bmad-output\planning-artifacts\architecture-phase3.md` — Key User Workflows, API Surface Proposal, Frontend Architecture Proposal, UI Composition, Auth / Premium Gating Rules, Accessibility / Performance / Security Requirements, Recommended Implementation Notes
- Source: `_bmad-output\implementation-artifacts\p3-1-1-normalized-trip-model-foundation.md`
- Source: `_bmad-output\implementation-artifacts\p3-1-2-gated-my-routes-entry-point.md`
- Source: `src\features\route-planning\MyRoutesScreen.tsx`
- Source: `src\features\route-planning\useTripsQuery.ts`
- Source: `src\features\route-planning\api.ts`
- Source: `src\features\route-planning\RoutePlanningScreen.tsx`
- Source: `src\types\trip.ts`
- Source: `api\trips.ts`
- Source: `api\_trips.ts`
- Source: `supabase\migrations\028_create_normalized_trip_model.sql`
