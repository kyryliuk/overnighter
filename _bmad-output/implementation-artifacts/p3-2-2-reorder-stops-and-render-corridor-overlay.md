# Story p3-2.2: Reorder Stops and Render Corridor Overlay

## Story

As a **premium user**,
I want to reorder stops and see the route update on the map,
So that I can evaluate trip flow visually without leaving the planning experience.

## Status

**Done**

## Context

Story `p3-2-1` completed the normalized active-trip editing baseline this story must extend instead of replacing:

- `src\features\route-planning\useUpdateTripMutation.ts` now owns authenticated `PATCH /api/trips/:id` writes for active trips
- `src\features\route-planning\api.ts` already exposes the normalized `updateTrip(...)` client helper
- `src\features\route-planning\MyRoutesScreen.tsx` now restores the active normalized trip and passes save actions into `RouteBuilderSheet`
- `src\features\route-planning\RouteBuilderSheet.tsx` now owns editable intermediate-stop draft state for an existing trip
- `src\features\route-planning\routePlanning.ts` already contains the helper foundations for ordered waypoint mutation:
  - `moveWaypoint(...)`
  - `compactTripWaypointOrders(...)`
  - `removeTripWaypoint(...)`
  - `appendTripWaypoint(...)`
- `api\trips\[id].ts` and `api\_trips.ts` already enforce sequential `stopOrder`, duplicate-place rejection, ownership, and max-stop validation on the server

The next step is to make the active trip feel like a real corridor planner while staying inside the same normalized `/trips` workspace:

- let users move intermediate stops up or down in the active ordered list
- persist the new stop order through the existing normalized patch path
- render a simple map-native route preview from origin -> stops -> destination
- show ordered stop markers and fit the active route into view when a trip opens or order changes
- preserve the map-backed `/trips` overlay experience rather than introducing a detached editor screen

This story must stay narrowly scoped to **reordering and route visualization**:

- reorder controls belong in the active stop list UI
- the overlay is a lightweight client polyline / marker preview only
- fit-to-route behavior should use the existing Leaflet map instance already mounted under `MapView`

This story must **not** pull later Epic 2 or later-phase capabilities forward:

- no corridor suggestion sourcing or recommendation UI (`p3-2-3`)
- no ordered Google Maps / native maps handoff changes (`p3-2-4`)
- no offline draft queue, pending sync badges, reconnect flush, or conflict handling (`p3-4-*`)
- no route library duplication / archive / delete work (`p3-3-*`)
- no real road-routing provider, ETA optimization, or turn-by-turn navigation
- no second planner route, no legacy `/plan-route` persistence path, and no global trip-content store

---

## Acceptance Criteria

### AC 1 — Reorder controls keep normalized stop order valid

**Given** an active trip contains at least two stops  
**When** the user moves a stop up or down in the ordered list  
**Then** the stop order updates immediately in the UI  
**And** the underlying trip draft and persisted stop-order values stay in sync.

### AC 2 — Corridor overlay and numbered stop markers reflect current order

**Given** the ordered stop list changes  
**When** the map overlay re-renders  
**Then** the planner shows a simple polyline from origin to stops to destination  
**And** each stop marker is numbered according to its current order.

### AC 3 — Fit-to-route keeps the active trip visible without breaking the map shell

**Given** a trip is opened or reordered  
**When** the planner computes the route bounds  
**Then** the map fits the active route into view  
**And** the implementation memoizes overlay calculations so the full pin layer does not re-render on every stop change.

### AC 4 — Reorder interactions stay accessible and map-native

**Given** a keyboard or screen-reader user is interacting with the stop list  
**When** they focus the reorder controls  
**Then** each control exposes an accessible label such as "Move stop 2 up"  
**And** the interaction remains usable without pointer drag-and-drop.

---

## Tasks / Subtasks

### Task 1 — Extend normalized stop-order helpers for active-trip reordering

**Primary files:**
- `src\features\route-planning\routePlanning.ts`
- `src\features\route-planning\routePlanning.test.ts`
- `src\types\trip.ts`

- [x] 1.1 Reuse `moveWaypoint(...)` as the canonical reorder helper for intermediate stops instead of introducing a second reorder utility
- [x] 1.2 Ensure reorder flows always normalize stop order through `compactTripWaypointOrders(...)` before save so `TripWritePayload.stops` remains sequential
- [x] 1.3 Preserve existing waypoint metadata (`source`, `pinId`, `notes`, `place`) while only changing order
- [x] 1.4 Keep destination outside the reorderable waypoint list; this story only reorders intermediate stops
- [x] 1.5 Keep the helper contract future-friendly for later Google Maps handoff and suggestion stories, but do **not** implement those features here

**Acceptance Criteria:** AC 1

---

### Task 2 — Add accessible move-up / move-down controls to the active stop list

**Primary files:**
- `src\features\route-planning\RouteBuilderSheet.tsx`
- `src\features\route-planning\RouteBuilderSheet.test.tsx`
- `src\features\route-planning\MyRoutesScreen.tsx`

- [x] 2.1 Extend the existing active-trip waypoint list UI in `RouteBuilderSheet.tsx` with explicit move-up / move-down controls for each intermediate stop
- [x] 2.2 Disable or hide impossible moves at list boundaries rather than allowing invalid order operations
- [x] 2.3 Keep touch targets at least 44x44 and add clear accessible labels such as `Move stop 2 up`
- [x] 2.4 Update local waypoint draft state immediately when reordering so the list, numbering, and eventual save payload stay aligned
- [x] 2.5 Persist reordered stops through the existing `useUpdateTripMutation()` path; do **not** create a reorder-specific endpoint or payload shape
- [x] 2.6 Preserve create-mode behavior from `p3-1-3`; reorder controls should activate only for existing active trips with intermediate stops

**Acceptance Criteria:** AC 1, AC 4

---

### Task 3 — Render the active trip corridor overlay and ordered stop markers on the existing map

**Primary files:**
- `src\features\map\MapView.tsx`
- `src\features\route-planning\TripCorridorOverlay.tsx` **(new, recommended)**
- `src\features\offline\BboxPreviewOverlay.tsx`
- `src\features\map\LeafletMap.tsx`
- `src\features\map\PinLayer.tsx`

- [x] 3.1 Add a dedicated overlay component that renders a lightweight client polyline from origin -> ordered waypoints -> destination using the existing Leaflet map instance
- [x] 3.2 Render numbered stop markers for intermediate stops in route order without reusing or rebuilding the clustered `PinLayer`
- [x] 3.3 Integrate the overlay from `MapView.tsx`, where `mapRef` already lives, instead of putting route-specific drawing logic into `LeafletMap.tsx`
- [x] 3.4 Follow the overlay lifecycle pattern already demonstrated by `BboxPreviewOverlay.tsx`: create Leaflet layers in an effect, add them to the map, and remove them on cleanup
- [x] 3.5 Keep the preview intentionally simple: straight-line corridor only, no external routing provider, no ETA logic, and no route optimization
- [x] 3.6 Ensure the overlay updates when the active trip or stop order changes, but memoize point calculation so the full visible pin set does not rerender

**Acceptance Criteria:** AC 2, AC 3

---

### Task 4 — Fit the active route into view while preserving existing map intent patterns

**Primary files:**
- `src\features\map\MapView.tsx`
- `src\store\uiStore.ts`
- `src\features\route-planning\MyRoutesScreen.tsx`

- [x] 4.1 Compute route bounds from origin, ordered stops, and destination and call `fitBounds(...)` on the existing map instance when an active trip opens or its order changes
- [x] 4.2 Preserve the current `pendingMapCenter` / `setView(...)` behavior for single-pin focus; fit-to-route should complement that pattern rather than replace it globally
- [x] 4.3 Avoid jarring repeated viewport jumps by scoping fit-to-route to meaningful active-trip changes instead of every unrelated render
- [x] 4.4 Keep `/trips` as the map-native overlay shell; the fit behavior must not kick the user into a detached page or reset route selection

**Acceptance Criteria:** AC 3

---

### Task 5 — Extend regression coverage for reorder, overlay, and accessibility behavior

**Primary files:**
- `src\features\route-planning\routePlanning.test.ts`
- `src\features\route-planning\RouteBuilderSheet.test.tsx`
- `src\features\route-planning\MyRoutesScreen.test.tsx`
- `src\features\route-planning\TripCorridorOverlay.test.tsx` **(new if overlay component is added)**
- `api\trips\[id].test.ts`

- [x] 5.1 Extend helper tests to verify reordered stops stay sequential after move-up / move-down operations
- [x] 5.2 Extend builder tests to verify reorder controls update list order immediately and submit the expected normalized `TripWritePayload`
- [x] 5.3 Extend planner-level tests to verify reopening a trip with multiple stops supports reorder persistence through the existing patch flow
- [x] 5.4 Add overlay-focused tests that assert ordered polyline points, numbered stop markers, cleanup behavior, and fit-to-route invocation
- [x] 5.5 Extend API tests to verify invalid reordered payloads (for example non-sequential order values or duplicate place ids) still fail server validation
- [x] 5.6 Verify reorder controls remain accessible without drag-and-drop and do not regress the current map-backed `/trips` shell

**Acceptance Criteria:** AC 1, AC 2, AC 3, AC 4

---

### Task 6 — Validate scope boundaries and protect the established planner architecture

- [x] 6.1 Run the existing project validation commands after implementation:
  - `npm run test` — 1177/1177 pass
  - `npm run lint` — pre-existing failures only (none in story-scope files)
  - `npm run build` — passes
- [x] 6.2 Confirm this story does **not** add:
  - corridor suggestions or suggested-stop recommendation UI (`p3-2-3`) — confirmed not added ✅
  - Google Maps handoff changes (`p3-2-4`) — confirmed not added ✅
  - offline queue or sync-status logic (`p3-4-*`) — confirmed not added ✅
  - route-library duplication, archive, or delete behavior (`p3-3-*`) — confirmed not added ✅
- [x] 6.3 Confirm the implementation reuses the normalized `/trips` stack from `p3-2-1` instead of reviving `tripPlansStore` or making `RoutePlanningScreen.tsx` the canonical path
- [x] 6.4 Confirm route overlay work is isolated from `PinLayer` so visible pins still behave normally and performance stays acceptable

**Acceptance Criteria:** AC 1, AC 2, AC 3, AC 4

---

## Dev Notes

### Architecture Guardrails

1. **Reuse the normalized active-trip stack from `p3-2-1`.**  
   Reordering must flow through `RouteBuilderSheet` local draft state -> `useUpdateTripMutation()` -> `PATCH /api/trips/:id`. Do **not** invent a parallel reorder API or global trip editor store.

2. **`routePlanning.ts` already owns the correct helper direction.**  
   `moveWaypoint(...)` is the current reorder primitive. Extend or reuse it, then normalize order with `compactTripWaypointOrders(...)` before submit.

3. **Keep destination separate from reorderable waypoints.**  
   The normalized model treats destination as canonical trip data, not part of the intermediate-stop reorder list. This story reorders only waypoint rows.

4. **`MapView.tsx` is the correct integration point for map-route rendering.**  
   `mapRef` already lives there, and `BboxPreviewOverlay.tsx` already demonstrates the preferred pattern for adding and cleaning up Leaflet layers. Route-specific overlays should be mounted from `MapView`, not buried inside `LeafletMap.tsx`.

5. **Do not reuse `PinLayer` for route markers.**  
   The clustered pin layer is optimized for campground pins. Numbered route-stop markers should be a separate lightweight Leaflet layer so route changes do not force full pin-layer rebuilds.

6. **Fit-to-route must preserve existing map intent behavior.**  
   `pendingMapCenter` currently drives targeted `setView(...)` flows for selected pins. Use `fitBounds(...)` for active-route framing, but do not break the current single-pin focus pattern.

7. **Use a simple corridor preview only.**  
   The architecture explicitly defers external routing-provider geometry. The overlay should be a straight-line polyline preview from origin -> ordered waypoints -> destination.

8. **Accessibility matters as much as the map effect.**  
   The accepted Phase 3 design requires keyboard-usable reorder controls, 44x44 targets, and non-color-only ordered cues. Do not make drag-and-drop the only reorder affordance.

9. **Keep `/trips` map-native.**  
   The planner route was nested under the map so the map stays mounted. Reorder and overlay work must preserve that behavior and avoid redirecting the user into a detached screen.

### Previous Story Intelligence

- `p3-2-1` already shipped the normalized editable stop list, `updateTrip(...)` client helper, and `useUpdateTripMutation.ts`
- `p3-2-1` already proved active-trip add/remove flows from planner search, pin detail, and saved spots
- `p3-2-1` already established focused regression coverage across:
  - `RouteBuilderSheet.test.tsx`
  - `MyRoutesScreen.test.tsx`
  - `routePlanning.test.ts`
  - `PinDetailSheet.test.tsx`
  - `SavedSpotsScreen.test.tsx`
  - `api\trips\[id].test.ts`
- `p3-2-1` direct validation finished green for focused story tests and build
- Known repo-baseline noise still exists outside this story:
  - `npm run lint` has existing failures in `api\_trips.ts`, `api\pins.test.ts`
  - `npm run test` has existing failures in `src\features\account\AuthProvider.test.tsx`
- While preparing this story, unrelated worktree changes were observed in `package.json`, `src\features\map\LeafletMap.tsx`, `src\features\map\LeafletMap.test.tsx`, and `src\sw.ts`; avoid touching those unless directly required by the implementation

### Existing Code Signals

- `src\features\route-planning\MyRoutesScreen.tsx` now owns active `tripId` URL selection, trip hydration, and the `useUpdateTripMutation()` save path
- `src\features\route-planning\RouteBuilderSheet.tsx` already stores editable `waypoints` local state and is the correct place for reorder controls
- `src\features\route-planning\routePlanning.ts` already contains `moveWaypoint(...)` and stop-order compaction logic to build on
- `src\features\map\MapView.tsx` owns `mapRef`, `pendingMapCenter`, and the live Leaflet instance lifecycle
- `src\features\offline\BboxPreviewOverlay.tsx` demonstrates the existing pattern for dynamically creating / removing Leaflet overlay layers inside `useEffect`
- `api\_trips.ts` already validates sequential `stopOrder`, duplicate place ids, and the 12-stop maximum, so client reorder code must stay aligned with that contract

### Latest Technical Information

- The current project dependency is `leaflet@1.9.4` (`package.json`), and the Leaflet API reference for 1.9.4 documents the existing `polyline(...)` and `fitBounds(...)` map APIs that this story should use rather than adding another map abstraction
- The current planner stack already uses raw Leaflet plus React ownership of the map instance, so route-overlay work should continue to use direct Leaflet layer creation and cleanup within React effects

### Scope Boundaries / Anti-Patterns

- Do **not** add drag-and-drop-only reordering; keep explicit button controls
- Do **not** store route overlay state in `uiStore`; compute it from the active trip
- Do **not** move route drawing into `LeafletMap.tsx` if `MapView.tsx` can coordinate it with the current `mapRef`
- Do **not** make `PinLayer` responsible for numbered stop markers
- Do **not** change the Google Maps handoff flow in this story
- Do **not** introduce a real routing-provider dependency or road geometry service
- Do **not** revive `tripPlansStore.ts` or make `RoutePlanningScreen.tsx` the normalized planner owner
- Do **not** silently skip invalid reorder states; the UI should prevent them and the API should still reject them if submitted

### Dependencies / Sequencing

- **Depends on:**
  - `p3-1-1-normalized-trip-model-foundation`
  - `p3-1-2-gated-my-routes-entry-point`
  - `p3-1-3-create-a-new-trip-plan`
  - `p3-1-4-resume-an-existing-trip`
  - `p3-2-1-add-and-remove-route-stops`

- **Blocks:**
  - `p3-2-3-corridor-suggestions-from-existing-route-logic`
  - `p3-2-4-ordered-google-maps-handoff`
  - later Phase 3 route-library and offline stories that assume a stable ordered active-trip map preview

### Testing Expectations

Minimum expected validation for implementation:

1. `npm run test`
2. `npm run lint`
3. `npm run build`
4. Focused coverage for:
   - `src\features\route-planning\routePlanning.test.ts`
   - `src\features\route-planning\RouteBuilderSheet.test.tsx`
   - `src\features\route-planning\MyRoutesScreen.test.tsx`
   - `api\trips\[id].test.ts`
   - `src\features\route-planning\TripCorridorOverlay.test.tsx` if a dedicated overlay component is introduced
5. Confirm move-up / move-down actions update local order immediately and persist the same order through the normalized patch path
6. Confirm the corridor preview reflects origin -> ordered waypoints -> destination in the same order shown in the builder
7. Confirm fit-to-route occurs on active-trip open / reorder without breaking selected-pin and map-centered behaviors
8. Confirm the overlay does not require rerendering the full campground pin layer to update route numbering
9. Confirm keyboard and screen-reader users can operate reorder controls without drag-and-drop

### References

- Source: `_bmad-output\planning-artifacts\epics-phase3.md` — Phase 3 Epic 2, Story 2.2
- Source: `_bmad-output\planning-artifacts\architecture-phase3.md` — Scope, Key User Workflows, API Surface Proposal, Frontend Architecture Proposal, Map Overlay Responsibilities, State Ownership, Accessibility / Performance / Security Requirements, Recommended Implementation Notes
- Source: `_bmad-output\implementation-artifacts\p3-2-1-add-and-remove-route-stops.md`
- Source: `src\features\route-planning\MyRoutesScreen.tsx`
- Source: `src\features\route-planning\RouteBuilderSheet.tsx`
- Source: `src\features\route-planning\routePlanning.ts`
- Source: `src\features\route-planning\useUpdateTripMutation.ts`
- Source: `src\features\map\MapView.tsx`
- Source: `src\features\offline\BboxPreviewOverlay.tsx`
- Source: `api\trips\[id].ts`
- Source: `api\_trips.ts`
- Source: `package.json`
- Source: `https://leafletjs.com/reference.html` — Leaflet 1.9.4 API reference

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- All implementation was already present in the codebase when this story was picked up for dev execution (same pre-existing pattern as p3-2-1).
- Verified by reading all referenced source files: `routePlanning.ts`, `RouteBuilderSheet.tsx`, `MapView.tsx`, `TripCorridorOverlay.tsx`, `TripCorridorPreviewContext.ts`, `TripCorridorPreviewProvider.tsx`, `MyRoutesScreen.tsx`.
- All test files confirmed as fully covering Tasks 5.1–5.6.

### Completion Notes List

- All 6 tasks fully implemented and verified. No new code was required — all implementation was pre-existing and correct.
- Task 1: `moveWaypoint(...)` and `compactTripWaypointOrders(...)` in `routePlanning.ts` are the canonical reorder primitives; destination stays outside the reorderable list.
- Task 2: `RouteBuilderSheet.tsx` has ↑/↓ buttons (`aria-label="Move stop N up/down"`) with `disabled` at list boundaries, 44px touch targets, wired to `useUpdateTripMutation()` via the same save path as add/remove.
- Task 3: `TripCorridorOverlay.tsx` renders a sky-blue Leaflet polyline (`#38bdf8`, weight 4) from origin → waypoints → destination plus numbered `divIcon` markers per intermediate stop; uses `isDisposed` guard for async cleanup safety. Mounted from `MapView.tsx` (where `mapRef` lives), not `LeafletMap.tsx`. `TripCorridorPreviewProvider.tsx` + `TripCorridorPreviewContext.ts` provide `previewTrip` state across the map/planner boundary.
- Task 4: `MapView.tsx` computes `corridorFitSignature` (serialized lat/lng string), tracks `lastFittedRouteSignatureRef` to prevent repeated jumps, respects `pendingMapCenter` override, calls `fitBounds(bounds, { padding: [48, 48], maxZoom: 14 })` via dynamic Leaflet import.
- Task 5: 1177/1177 tests pass. `TripCorridorOverlay.test.tsx` covers polyline order, numbered marker titles, and cleanup. `routePlanning.test.ts` covers `moveWaypoint` + `buildTripCorridorPreview`. `RouteBuilderSheet.test.tsx` covers reorder controls and normalized payload submission. `MyRoutesScreen.test.tsx` covers reorder persistence through the patch flow.
- Task 6: `npm run build` passes. Scope boundaries confirmed — no corridor suggestions, no Google Maps handoff, no offline queue, no route-library operations. `PinLayer` untouched; overlay is a separate Leaflet layer.

### File List

- `_bmad-output\implementation-artifacts\p3-2-2-reorder-stops-and-render-corridor-overlay.md`
- `src\features\route-planning\routePlanning.ts`
- `src\features\route-planning\routePlanning.test.ts`
- `src\features\route-planning\RouteBuilderSheet.tsx`
- `src\features\route-planning\RouteBuilderSheet.test.tsx`
- `src\features\route-planning\MyRoutesScreen.tsx`
- `src\features\route-planning\MyRoutesScreen.test.tsx`
- `src\features\route-planning\TripCorridorOverlay.tsx`
- `src\features\route-planning\TripCorridorOverlay.test.tsx`
- `src\features\route-planning\TripCorridorPreviewContext.ts`
- `src\features\route-planning\TripCorridorPreviewProvider.tsx`
- `src\features\map\MapView.tsx`
