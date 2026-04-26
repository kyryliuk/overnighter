# Story p3-5: 2 — Dual-Read Cutover and /plan-route Redirect

Status: done

## Story

As a **returning user**,
I want the old route entry points to keep working while the planner moves to the new model,
so that I am not stranded by bookmarks, saved links, or partially migrated data.

## Context

Story 5.1 backfilled legacy `trip_plans` rows into normalized `trips` + `trip_stops`. Now the frontend must:
1. Redirect `/plan-route` to the new `/trips` planner
2. Fix all remaining `navigate('/plan-route')` call sites (SharedTripPlanScreen, AccountScreen)
3. Ensure `MyRoutesScreen`'s empty state surfaces a migration notice for users who still have legacy plans locally but no normalized trips yet

### What Already Exists

- `src/App.tsx` — `<Route path="/plan-route" element={<RoutePlanningScreen />} />` at line 83; `<Navigate>` not yet imported
- `src/features/route-planning/SharedTripPlanScreen.tsx` — `navigate('/plan-route?openPlan=...')` (import) + `navigate('/plan-route')` ("Open planner" button)
- `src/features/account/AccountScreen.tsx` — `navigate('/plan-route')` button labeled "Trip drafts"
- `src/features/route-planning/MyRoutesScreen.tsx` — empty state shows "No saved routes yet" with no mention of legacy plans
- `src/store/tripPlansStore.ts` — `useTripPlansStore` with `tripPlans: TripPlan[]` + `hasHydrated: boolean`

### What This Story Must NOT Add

- New API endpoints or backend changes
- Shared-trip import to the normalized planner (Story 5.3 scope)
- Removal of `RoutePlanningScreen` component (keep for now, just remove route)
- Any UI for actual legacy plan migration (the backfill script in p3-5-1 handles that)

---

## Acceptance Criteria

### AC 1 — `/plan-route` redirects to `/trips`

**Given** the new `/trips` planner is live  
**When** a user navigates to `/plan-route`  
**Then** the app redirects them to `/trips`  
**And** the `RoutePlanningScreen` is no longer rendered at that path.

### AC 2 — Normalized trips are the primary read/write model

**Given** a user has normalized trips available  
**When** **My Routes** loads  
**Then** the planner reads normalized `trips` first  
**And** all new route writes go only to the normalized model.  
*(Already satisfied by existing MyRoutesScreen — no code change needed, covered by existing tests)*

### AC 3 — Legacy-only users see a migration notice

**Given** a user has no normalized trips but still has local legacy plans in `useTripPlansStore`  
**When** they open **My Routes** and the trip list loads successfully empty  
**Then** the empty state shows a "legacy plans" notice explaining their older trip plans need migration  
**And** the notice includes the count of legacy plans.

### AC 4 — All `/plan-route` navigation call sites updated

**Given** the redirect is in place  
**When** any in-app navigation points to `/plan-route`  
**Then** it is updated to navigate to `/trips` instead.

---

## Tasks / Subtasks

- [ ] **Task 1 — Redirect `/plan-route` → `/trips` in App.tsx** (AC: 1)
  - [ ] 1.1 Import `Navigate` from `react-router-dom` in `App.tsx`
  - [ ] 1.2 Replace `<Route path="/plan-route" element={<RoutePlanningScreen />} />` with `<Route path="/plan-route" element={<Navigate to="/trips" replace />} />`
  - [ ] 1.3 Test: visiting `/plan-route` (authenticated) renders my-routes-screen via redirect

- [ ] **Task 2 — Fix `SharedTripPlanScreen.tsx` navigation** (AC: 4)
  - [ ] 2.1 Change `navigate('/plan-route?openPlan=...')` in `handleImportTrip` → `navigate('/trips')`
  - [ ] 2.2 Change `navigate('/plan-route')` in "Open planner" button → `navigate('/trips')`
  - [ ] 2.3 Add tests: "Open planner" navigates to `/trips`; "Copy to planner" navigates to `/trips`

- [ ] **Task 3 — Fix `AccountScreen.tsx` navigation** (AC: 4)
  - [ ] 3.1 Change `navigate('/plan-route')` → `navigate('/trips')` in AccountScreen
  - [ ] 3.2 Update button label from "Trip drafts" → "My Routes"
  - [ ] 3.3 Add/update test: "My Routes" button navigates to `/trips`

- [ ] **Task 4 — Legacy plans notice in `MyRoutesScreen` empty state** (AC: 3)
  - [ ] 4.1 Import and call `useTripPlansStore` in `MyRoutesContent`
  - [ ] 4.2 When `trips.length === 0 && tripsQuery.isSuccess && !tripsQuery.isLoading && legacyPlans.length > 0`: render a notice below the empty state card with `data-testid="legacy-plans-notice"`
  - [ ] 4.3 Notice text: "You have {N} trip plan(s) from your earlier session. They'll appear here once your data is migrated."
  - [ ] 4.4 Test: legacy notice shown when normalized trips = 0 + legacy plans > 0
  - [ ] 4.5 Test: legacy notice NOT shown when normalized trips exist
  - [ ] 4.6 Test: legacy notice NOT shown when legacy plans is empty

---

## Dev Notes

### Architecture Context

- `Navigate` is from `react-router-dom` — already available, just not imported in App.tsx
- `RoutePlanningScreen` stays in App.tsx as a lazy import (other code may reference it) but its route is replaced with a `<Navigate>` redirect
- `useTripPlansStore` is already used throughout the app; import it as usual in MyRoutesContent
- The legacy notice uses `useTripPlansStore(state => state.tripPlans)` and `useTripPlansStore(state => state.hasHydrated)` — only show notice after hydration completes to avoid flash

### SharedTripPlanScreen Import

The existing `handleImportTrip` saves to the legacy store then redirects. For this story, redirect to `/trips` and drop the `?openPlan=` param — the normalized planner doesn't support opening by legacy plan ID. Story 5.3 will handle proper shared-trip import into the normalized model.

### Testing Pattern

- `App.test.tsx` already mocks `@/features/route-planning/RoutePlanningScreen` → `null`. The redirect test should verify that visiting `/plan-route` as an authenticated user ends up on the my-routes-screen.
- `SharedTripPlanScreen.test.tsx` uses `mockNavigate` — add test for both navigation call sites
- `AccountScreen.test.tsx` uses `mockNavigate` — update the existing test (or add new one) for the `/trips` target
- `MyRoutesScreen.test.tsx` mock: mock `useTripPlansStore` to return different legacy plan states

### References

- App routing: [Source: src/App.tsx#L83]
- SharedTripPlanScreen navigation: [Source: src/features/route-planning/SharedTripPlanScreen.tsx#L111,131]
- AccountScreen navigation: [Source: src/features/account/AccountScreen.tsx#L327]
- Legacy store: [Source: src/store/tripPlansStore.ts]
- MyRoutesScreen empty state: [Source: src/features/route-planning/MyRoutesScreen.tsx#L553]

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List

- `src/App.tsx` (modified)
- `src/App.test.tsx` (modified)
- `src/features/route-planning/SharedTripPlanScreen.tsx` (modified)
- `src/features/route-planning/SharedTripPlanScreen.test.tsx` (modified)
- `src/features/account/AccountScreen.tsx` (modified)
- `src/features/account/AccountScreen.test.tsx` (modified)
- `src/features/route-planning/MyRoutesScreen.tsx` (modified)
- `src/features/route-planning/MyRoutesScreen.test.tsx` (modified)
