# Story p3-2.3: Corridor Suggestions From Existing Route Logic

## Story

As a **premium user**,
I want route suggestions based on the current route-planning baseline,
So that the first Phase 3 release improves corridor planning without introducing an entirely new routing engine.

## Status

**Ready for Dev**

## Context

Stories `p3-2-1` and `p3-2-2` established the normalized active-trip planner this story must extend:

- `src\features\route-planning\MyRoutesScreen.tsx` now owns the active normalized `/trips?tripId=` workspace, preview wiring, and `PATCH /api/trips/:id` save flow
- `src\features\route-planning\RouteBuilderSheet.tsx` now owns editable waypoint state for existing active trips, including add/remove/reorder controls
- `src\features\route-planning\routePlanning.ts` already contains the reusable scoring and suggestion logic:
  - `buildRouteSuggestions(...)`
  - `distanceMiles(...)`
  - `RouteSuggestion`
- `src\features\route-planning\RoutePlanningScreen.tsx` already computes `suggestedStops` from the legacy planner baseline using `buildRouteSuggestions(...)`
- `src\features\route-planning\TripCorridorOverlay.tsx` and `src\features\map\MapView.tsx` now provide a lightweight live corridor preview for the active normalized trip

The next step is to bring **suggested corridor stops** into the normalized `/trips` builder by adapting the proven legacy logic rather than replacing it:

- reuse the existing scoring approach from `buildRouteSuggestions(...)`
- surface suggestions inside the active normalized builder as optional additions
- allow a user to add any suggestion into the active trip with one action through the same normalized stop-mutation helpers used elsewhere
- degrade gracefully when corridor suggestions cannot be computed because origin or destination context is missing, or cached pin data is insufficient

This story must stay narrowly scoped to **surfacing and adding suggested stops**:

- suggestions are advisory only until the user explicitly adds one
- suggestion cards should reuse already-available signals (name, recency / badge state, detour distance, rig-fit filtering)
- canonical trip content still changes only through the existing builder state and normalized save path

This story must **not** pull later capabilities forward:

- no Google Maps / native maps handoff changes (`p3-2-4`)
- no new scoring engine, third-party routing provider, or road-geometry API
- no offline mutation queue, conflict handling, or sync-status UI (`p3-4-*`)
- no trip-library duplication / archive / delete behavior (`p3-3-*`)
- no auto-commit of suggestions into a trip without an explicit user action

---

## Acceptance Criteria

### AC 1 — Suggestions reuse existing route-planning logic instead of a new engine

**Given** a trip has an origin or current location plus destination  
**When** the planner requests suggestions  
**Then** it reuses the current route-suggestion scoring logic already present in the route planning feature  
**And** suggested candidate stops are surfaced in the builder as suggested additions rather than committed stops.

### AC 2 — Suggestion cards expose enough context to be useful in the builder

**Given** suggested corridor stops are available  
**When** the user reviews them  
**Then** each suggestion shows enough place context such as name, stop type, distance / detour signal, and rig-fit context already available in the baseline  
**And** the user can add any suggestion to the trip with a single action.

### AC 3 — Planner degrades gracefully when suggestions cannot be computed

**Given** the planner is offline or cached pin data is insufficient  
**When** corridor suggestions cannot be computed reliably  
**Then** the UI degrades gracefully with a non-blocking message  
**And** manual stop editing remains fully available.

---

## Tasks / Subtasks

### Task 1 — Reuse the legacy suggestion logic in the normalized planner layer

**Primary files:**
- `src\features\route-planning\routePlanning.ts`
- `src\features\route-planning\routePlanning.test.ts`
- `src\features\route-planning\RoutePlanningScreen.tsx`

- [ ] 1.1 Reuse `buildRouteSuggestions(...)` and `RouteSuggestion` from `routePlanning.ts` as the canonical suggestion engine for Phase 3
- [ ] 1.2 Extract or adapt any legacy-only assumptions so suggestion computation can work from normalized trip origin / destination / waypoint context without reviving the legacy planner as the persistence owner
- [ ] 1.3 Preserve the existing filtering rules already encoded in `buildRouteSuggestions(...)` (overnight-only, rig-fit, detour thresholds, verification / recency penalties) unless a concrete bug requires tightening them
- [ ] 1.4 Keep the scoring logic local and deterministic; do **not** add a network dependency or routing-provider call for this story

**Acceptance Criteria:** AC 1

---

### Task 2 — Surface suggested stops inside the normalized `/trips` builder

**Primary files:**
- `src\features\route-planning\RouteBuilderSheet.tsx`
- `src\features\route-planning\RouteBuilderSheet.test.tsx`
- `src\features\route-planning\MyRoutesScreen.tsx`

- [ ] 2.1 Compute suggestion candidates from the active normalized trip context already available to the builder preview
- [ ] 2.2 Render a dedicated suggestions section in the builder that is clearly distinct from already-committed route stops
- [ ] 2.3 Keep suggestion cards lightweight and mobile-friendly; the planner is still a map-native sheet, not a separate recommendation page
- [ ] 2.4 Exclude pins already present in the trip or currently used as destination so the suggestion list stays aligned with existing duplicate-stop guardrails
- [ ] 2.5 Preserve create-mode behavior for new trips that do not yet have enough route context to compute meaningful suggestions

**Acceptance Criteria:** AC 1, AC 2, AC 3

---

### Task 3 — Add suggested stops through the existing normalized stop-edit flow

**Primary files:**
- `src\features\route-planning\RouteBuilderSheet.tsx`
- `src\features\route-planning\routePlanning.ts`
- `src\features\route-planning\useUpdateTripMutation.ts`
- `api\trips\[id].ts`

- [ ] 3.1 When a user taps a suggestion, convert it through the same normalized stop helper path already used for manual / saved additions
- [ ] 3.2 Mark suggested additions with `source: 'suggested'` so the normalized model preserves where the stop came from
- [ ] 3.3 Preserve existing duplicate-stop and max-stop guardrails for suggested additions; a suggestion must not bypass validation just because it came from the scoring layer
- [ ] 3.4 Keep canonical trip content changes inside the builder draft + normalized save flow; do **not** mutate the active trip from a detached suggestion store

**Acceptance Criteria:** AC 1, AC 2

---

### Task 4 — Handle unavailable-suggestion states gracefully without blocking editing

**Primary files:**
- `src\features\route-planning\RouteBuilderSheet.tsx`
- `src\features\route-planning\MyRoutesScreen.tsx`
- `src\hooks\usePinsQuery.ts`

- [ ] 4.1 When origin or destination context is missing, show a quiet empty / unavailable state instead of a broken suggestion area
- [ ] 4.2 When pins are still loading or insufficient cached data exists, show a non-blocking status message rather than treating suggestions as required
- [ ] 4.3 Keep add/remove/reorder/manual stop editing fully usable even when no suggestions can be computed
- [ ] 4.4 Avoid error-shaped UX for expected no-suggestion cases such as short trips or sparse pin coverage

**Acceptance Criteria:** AC 3

---

### Task 5 — Extend regression coverage for suggestion computation and add-from-suggestion behavior

**Primary files:**
- `src\features\route-planning\routePlanning.test.ts`
- `src\features\route-planning\RouteBuilderSheet.test.tsx`
- `src\features\route-planning\MyRoutesScreen.test.tsx`
- `src\features\route-planning\RoutePlanningScreen.tsx` **(legacy reuse reference only, not canonical owner)**

- [ ] 5.1 Extend helper tests around `buildRouteSuggestions(...)` to cover the normalized planner inputs this story now depends on
- [ ] 5.2 Verify suggestions exclude already-selected trip stops and destination duplicates
- [ ] 5.3 Verify tapping a suggestion adds it to the active route through the same normalized payload path used by other stop-add flows
- [ ] 5.4 Verify the added suggestion is tagged with `source: 'suggested'`
- [ ] 5.5 Verify no-suggestion and insufficient-context states remain non-blocking and do not regress manual stop editing

**Acceptance Criteria:** AC 1, AC 2, AC 3

---

### Task 6 — Validate scope boundaries and protect the normalized planner architecture

- [ ] 6.1 Run the existing project validation commands after implementation:
  - `npm run test`
  - `npm run lint`
  - `npm run build`
- [ ] 6.2 Confirm this story does **not** add:
  - Google Maps handoff changes (`p3-2-4`)
  - third-party routing-provider geometry
  - offline queue / sync-status logic (`p3-4-*`)
  - trip-library management work (`p3-3-*`)
- [ ] 6.3 Confirm suggestion UI extends the normalized `/trips` builder rather than reviving `RoutePlanningScreen.tsx` as the canonical trip-edit surface
- [ ] 6.4 Confirm suggestions remain optional recommendations until the user explicitly adds them

**Acceptance Criteria:** AC 1, AC 2, AC 3

---

## Dev Notes

### Architecture Guardrails

1. **Reuse the scoring logic that already exists.**  
   `buildRouteSuggestions(...)` in `routePlanning.ts` is the accepted reuse point. This story is about adapting it into the normalized planner, not building a second corridor engine.

2. **Keep the normalized `/trips` stack as the canonical owner.**  
   `RoutePlanningScreen.tsx` is useful as a reuse reference, but `MyRoutesScreen.tsx` + `RouteBuilderSheet.tsx` remain the true Phase 3 owner for active-trip editing.

3. **Suggestions are advisory, not committed state.**  
   Suggested stops should remain outside the canonical trip until the user explicitly adds one through the existing stop helper path.

4. **Use the same duplicate and max-stop guardrails already established.**  
   Suggested stops must flow through the same normalized append logic used by manual and saved additions, and the API must remain authoritative.

5. **Preserve source metadata.**  
   Suggested additions should carry `source: 'suggested'` through the normalized payload so later analytics / UX can distinguish them.

6. **Do not introduce a network dependency for scoring.**  
   The architecture explicitly avoids external routing providers here. Keep suggestion computation local to currently available pin + trip context.

7. **Keep the planner map-native and incremental.**  
   Suggestions belong in the existing builder sheet as a helpful extension, not in a second screen or large recommendation experience.

8. **Graceful empty states matter.**  
   No origin, short routes, sparse data, or insufficient cached pins are expected conditions. The UI should explain that suggestions are unavailable without blocking the route builder.

### Previous Story Intelligence

- `p3-2-1` established normalized active-trip add/remove editing and `source` ownership for stop additions
- `p3-2-2` established live corridor preview, route-fit behavior, and review-clean overlay lifecycle fixes
- `p3-2-2` review fixes also restored the `PremiumGate` wrapper around `MyRoutesScreen`, so this story must preserve that gating contract
- Known baseline repo noise still exists outside this story:
  - `npm run lint` baseline failures in `api\_trips.ts`, `api\pins.test.ts`
  - `npm run test` baseline noise in `src\features\account\AuthProvider.test.tsx`

### Existing Code Signals

- `src\features\route-planning\RoutePlanningScreen.tsx` already computes `suggestedStops` from `buildRouteSuggestions(...)` and is the best reuse reference for suggestion criteria and presentation hints
- `src\features\route-planning\routePlanning.ts` already contains `RouteSuggestion`, `distanceMiles(...)`, and the full baseline suggestion scoring logic
- `src\features\route-planning\RouteBuilderSheet.tsx` already contains the active waypoint list, local draft state, and add-stop entry points to extend
- `src\features\route-planning\MyRoutesScreen.tsx` already passes active normalized trip state and preview updates into the builder
- `src\types\trip.ts` already includes `TripStopSource = 'manual' | 'saved' | 'suggested' | 'imported'`, so the normalized model already supports this story’s source labeling

### Scope Boundaries / Anti-Patterns

- Do **not** create a second suggestion engine outside `routePlanning.ts`
- Do **not** commit a suggestion into the trip automatically just because it renders
- Do **not** bypass normalized helper logic when adding a suggested stop
- Do **not** make `RoutePlanningScreen.tsx` the persistence owner again
- Do **not** add Google Maps handoff or route-optimization work in this story
- Do **not** treat “no suggestions available” as a hard error that blocks editing

### Dependencies / Sequencing

- **Depends on:**
  - `p3-1-1-normalized-trip-model-foundation`
  - `p3-1-2-gated-my-routes-entry-point`
  - `p3-1-3-create-a-new-trip-plan`
  - `p3-1-4-resume-an-existing-trip`
  - `p3-2-1-add-and-remove-route-stops`
  - `p3-2-2-reorder-stops-and-render-corridor-overlay`

- **Blocks:**
  - `p3-2-4-ordered-google-maps-handoff`
  - later route-library and offline stories that assume the active planner can suggest and add corridor stops cleanly

### Testing Expectations

Minimum expected validation for implementation:

1. `npm run test`
2. `npm run lint`
3. `npm run build`
4. Focused coverage for:
   - `src\features\route-planning\routePlanning.test.ts`
   - `src\features\route-planning\RouteBuilderSheet.test.tsx`
   - `src\features\route-planning\MyRoutesScreen.test.tsx`
5. Confirm suggestions only appear when route context is sufficient
6. Confirm suggestion cards can add a stop through the normalized planner flow
7. Confirm suggested additions carry `source: 'suggested'`
8. Confirm duplicate and max-stop guardrails still block bad suggestion adds
9. Confirm manual add/remove/reorder remains usable when no suggestions are available

### References

- Source: `_bmad-output\planning-artifacts\epics-phase3.md` — Phase 3 Epic 2, Story 2.3
- Source: `_bmad-output\planning-artifacts\architecture-phase3.md` — Scope, Key User Workflows, Frontend Architecture Proposal, Recommended Implementation Notes
- Source: `_bmad-output\implementation-artifacts\p3-2-2-reorder-stops-and-render-corridor-overlay.md`
- Source: `src\features\route-planning\RoutePlanningScreen.tsx`
- Source: `src\features\route-planning\routePlanning.ts`
- Source: `src\features\route-planning\RouteBuilderSheet.tsx`
- Source: `src\features\route-planning\MyRoutesScreen.tsx`
- Source: `src\types\trip.ts`

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- Recent route-planning work already migrated active editing to the normalized `/trips` stack and review-cleaned the new corridor overlay path

### Completion Notes List

- Story context created from the Phase 3 epic + architecture artifacts, direct code inspection, and the immediately preceding `p3-2-2` story artifact
- Story scope was intentionally constrained to suggestion reuse, suggestion display, and add-from-suggestion behavior inside the normalized builder
- Sprint tracking should mark `p3-2-3-corridor-suggestions-from-existing-route-logic` as `ready-for-dev`

### File List

- `_bmad-output\implementation-artifacts\p3-2-3-corridor-suggestions-from-existing-route-logic.md`
