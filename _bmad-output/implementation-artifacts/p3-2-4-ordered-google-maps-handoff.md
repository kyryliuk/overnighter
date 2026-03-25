# Story p3-2.4: Ordered Google Maps Handoff

## Story

As a **premium user**,
I want to send my ordered trip to Google Maps / native maps,
So that Overnighter remains the planning tool while existing navigation apps handle the drive.

## Status

**Ready for Dev**

## Context

Stories `p3-2-1` through `p3-2-3` established the normalized active-trip planner this story must extend:

- `src\features\route-planning\MyRoutesScreen.tsx` now owns the active normalized `/trips?tripId=` workspace
- `src\features\route-planning\RouteBuilderSheet.tsx` now owns editable active-trip stop state, including add/remove/reorder and suggested-stop additions
- `src\features\route-planning\routePlanning.ts` already preserves ordered waypoint data in normalized draft state
- `src\features\map\MapView.tsx` and `TripCorridorOverlay.tsx` now render the active route order visibly on the map

The app already has proven Google Maps handoff logic in legacy and shared-trip flows:

- `src\features\route-planning\RoutePlanningScreen.tsx` builds `routeHref` with `buildDirectionsUrl(...)`
- `src\features\route-planning\SharedTripPlanScreen.tsx` also builds ordered directions links from trip stop data
- `src\lib\maps\googleMaps.ts` is the accepted helper surface for external navigation URL generation

This story should adapt that proven handoff behavior into the normalized `/trips` planner:

- build the Google Maps / native maps URL from the active normalized trip
- preserve the same visible stop order the user sees in the builder and corridor overlay
- reflect the latest saved or in-sheet route state instead of stale cached order
- handle waypoint-count edge cases explicitly rather than silently producing a broken link

This story must stay narrowly scoped to **ordered handoff from the normalized planner**:

- use existing `buildDirectionsUrl(...)` patterns rather than inventing a new navigation helper
- keep Overnighter as the planner and Google Maps / native maps as the navigation target
- surface clear user guidance if the current trip cannot be handed off safely

This story must **not** pull later capabilities forward:

- no real routing-provider geometry or ETA optimization
- no offline queue or sync-status work (`p3-4-*`)
- no route library management work (`p3-3-*`)
- no legacy `/plan-route` cutover or sharing migration work (`p3-5-*`)

---

## Acceptance Criteria

### AC 1 — Ordered handoff mirrors the active trip sequence

**Given** an active trip has a destination and optional intermediate stops  
**When** the user taps **Open in Google Maps** or equivalent handoff CTA  
**Then** the app builds a directions URL using the active origin / current-location rule, ordered waypoints, and destination  
**And** the external maps app opens with the same order shown in Overnighter.

### AC 2 — Waypoint-count edge cases are handled explicitly

**Given** the trip contains more waypoints than the handoff URL can support safely  
**When** the user triggers navigation  
**Then** the planner handles the edge case explicitly such as truncating with a warning or blocking with guidance  
**And** it does not silently generate a broken link.

### AC 3 — Handoff reflects the latest route state

**Given** the active trip is edited and saved  
**When** the user immediately re-triggers the handoff  
**Then** the newly generated directions URL reflects the latest stop order  
**And** no stale cached URL is reused.

---

## Tasks / Subtasks

### Task 1 — Reuse existing Google Maps URL generation in the normalized planner

**Primary files:**
- `src\lib\maps\googleMaps.ts`
- `src\features\route-planning\RoutePlanningScreen.tsx`
- `src\features\route-planning\SharedTripPlanScreen.tsx`
- `src\features\route-planning\routePlanning.test.ts`

- [ ] 1.1 Reuse `buildDirectionsUrl(...)` as the canonical handoff helper for Phase 3
- [ ] 1.2 Adapt the normalized active-trip data shape into the existing helper contract without creating a second URL builder
- [ ] 1.3 Preserve the visible waypoint order from the normalized trip when building the handoff URL
- [ ] 1.4 Keep current-location / origin behavior aligned with the existing helper rules already used by legacy route planning and shared-trip flows

**Acceptance Criteria:** AC 1, AC 3

---

### Task 2 — Add a handoff CTA to the normalized `/trips` experience

**Primary files:**
- `src\features\route-planning\RouteBuilderSheet.tsx`
- `src\features\route-planning\MyRoutesScreen.tsx`
- `src\features\route-planning\RouteBuilderSheet.test.tsx`
- `src\features\route-planning\MyRoutesScreen.test.tsx`

- [ ] 2.1 Add an explicit handoff CTA in the active normalized planner experience
- [ ] 2.2 Keep the CTA disabled or guarded when there is insufficient destination / route context to build a safe link
- [ ] 2.3 Ensure the CTA uses the current in-memory route order rather than a stale cached value
- [ ] 2.4 Preserve create-mode and premium-gate behavior; the CTA belongs only to a valid active trip state

**Acceptance Criteria:** AC 1, AC 3

---

### Task 3 — Handle waypoint-limit edge cases safely

**Primary files:**
- `src\lib\maps\googleMaps.ts`
- `src\features\route-planning\RouteBuilderSheet.tsx`
- `src\features\route-planning\routePlanning.test.ts`

- [ ] 3.1 Determine the supported Google Maps waypoint count based on the current helper behavior and encode the limit explicitly if not already present
- [ ] 3.2 If the normalized trip exceeds the safe handoff size, block or degrade with a clear user-facing message instead of silently dropping waypoints
- [ ] 3.3 Keep the error / guidance behavior non-destructive: the route itself remains intact even if handoff is unavailable

**Acceptance Criteria:** AC 2

---

### Task 4 — Extend regression coverage for ordered handoff behavior

**Primary files:**
- `src\features\route-planning\routePlanning.test.ts`
- `src\features\route-planning\RouteBuilderSheet.test.tsx`
- `src\features\route-planning\MyRoutesScreen.test.tsx`
- `src\features\route-planning\SharedTripPlanScreen.tsx`

- [ ] 4.1 Verify the generated handoff URL preserves the same stop order shown in the normalized planner
- [ ] 4.2 Verify reordered and newly suggested stops are reflected in the next generated URL
- [ ] 4.3 Verify waypoint-limit edge cases are surfaced explicitly and do not create a broken link
- [ ] 4.4 Verify the CTA remains unavailable when the trip lacks a destination or otherwise cannot be handed off safely

**Acceptance Criteria:** AC 1, AC 2, AC 3

---

### Task 5 — Validate scope boundaries

- [ ] 5.1 Run the existing project validation commands after implementation:
  - `npm run test`
  - `npm run lint`
  - `npm run build`
- [ ] 5.2 Confirm this story does **not** add:
  - a new routing provider
  - ETA optimization or route optimization
  - offline sync / queue logic
  - trip-library management work
- [ ] 5.3 Confirm handoff continues to reuse shared helper logic rather than duplicating Google Maps URL assembly inside the planner

**Acceptance Criteria:** AC 1, AC 2, AC 3

---

## Dev Notes

### Architecture Guardrails

1. **Reuse `buildDirectionsUrl(...)`.**  
   This story should adapt normalized trip data into the existing maps helper contract, not create a second handoff implementation.

2. **The normalized `/trips` stack stays canonical.**  
   `RoutePlanningScreen.tsx` and `SharedTripPlanScreen.tsx` are reuse references only. Active-trip state still belongs to `MyRoutesScreen.tsx` + `RouteBuilderSheet.tsx`.

3. **Preserve visible order exactly.**  
   The handoff URL must match the same origin / waypoint / destination order shown in the builder and corridor overlay.

4. **Do not silently drop waypoints.**  
   If the URL target cannot safely support the current trip length, the planner must surface guidance instead of producing a misleading link.

5. **Keep Overnighter as planner, not navigator.**  
   The scope is external handoff only, not in-app navigation.

### Previous Story Intelligence

- `p3-2-2` established clean ordered waypoint editing and live corridor preview
- `p3-2-3` established optional suggested-stop additions through the normalized stop flow with `source: 'suggested'`
- Recent review work restored and preserved `PremiumGate` ownership around `MyRoutesScreen`
- Known baseline repo noise remains outside this story:
  - `npm run lint` baseline failures in `api\_trips.ts`, `api\pins.test.ts`
  - `npm run test` baseline noise in `src\features\account\AuthProvider.test.tsx`

### Existing Code Signals

- `RoutePlanningScreen.tsx` already builds a Google Maps URL from `origin`, `destination`, and `selectedStops`
- `SharedTripPlanScreen.tsx` already builds ordered directions URLs from normalized-like trip stop arrays
- `routePlanning.test.ts` already includes `buildDirectionsUrl(...)` coverage and is the best initial test extension point
- `RouteBuilderSheet.tsx` already has the latest in-memory route ordering, so it is the best place to source handoff order from

### Scope Boundaries / Anti-Patterns

- Do **not** create a second Google Maps URL builder
- Do **not** silently truncate waypoints without telling the user
- Do **not** move handoff ownership back to the legacy planner
- Do **not** add third-party routing-provider logic in this story

### Dependencies / Sequencing

- **Depends on:**
  - `p3-1-1-normalized-trip-model-foundation`
  - `p3-1-2-gated-my-routes-entry-point`
  - `p3-1-3-create-a-new-trip-plan`
  - `p3-1-4-resume-an-existing-trip`
  - `p3-2-1-add-and-remove-route-stops`
  - `p3-2-2-reorder-stops-and-render-corridor-overlay`
  - `p3-2-3-corridor-suggestions-from-existing-route-logic`

### Testing Expectations

1. `npm run test`
2. `npm run lint`
3. `npm run build`
4. Focused coverage for:
   - `src\features\route-planning\routePlanning.test.ts`
   - `src\features\route-planning\RouteBuilderSheet.test.tsx`
   - `src\features\route-planning\MyRoutesScreen.test.tsx`
5. Confirm generated URLs use the latest visible route order
6. Confirm handoff edge cases are explicit and non-destructive

### References

- Source: `_bmad-output\planning-artifacts\epics-phase3.md` — Phase 3 Epic 2, Story 2.4
- Source: `_bmad-output\planning-artifacts\architecture-phase3.md` — Scope, Key User Workflows, Recommended Implementation Notes
- Source: `_bmad-output\implementation-artifacts\p3-2-3-corridor-suggestions-from-existing-route-logic.md`
- Source: `src\features\route-planning\RoutePlanningScreen.tsx`
- Source: `src\features\route-planning\SharedTripPlanScreen.tsx`
- Source: `src\lib\maps\googleMaps.ts`
- Source: `src\features\route-planning\RouteBuilderSheet.tsx`
- Source: `src\features\route-planning\MyRoutesScreen.tsx`

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- Existing handoff logic already lives in legacy and shared-trip planner surfaces via `buildDirectionsUrl(...)`

### Completion Notes List

- Story context created from the Phase 3 epic artifact, direct code reuse points, and the immediately preceding `p3-2-3` story artifact
- Story scope was intentionally constrained to ordered handoff from the normalized planner

### File List

- `_bmad-output\implementation-artifacts\p3-2-4-ordered-google-maps-handoff.md`
