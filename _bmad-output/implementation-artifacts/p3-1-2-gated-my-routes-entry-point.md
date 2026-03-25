# Story p3-1.2: Gated My Routes Entry Point

## Story

As a **traveler**,
I want a clear **My Routes** entry point that follows existing auth and premium access patterns,
So that route planning feels like a natural extension of the current map product.

## Status

**Ready for Dev**

## Context

Story p3-1-1 established the normalized Phase 3 trip foundation:

- `supabase\migrations\028_create_normalized_trip_model.sql`
- `api\trips.ts`
- `api\trips\[id].ts`
- `api\_trips.ts`
- `src\lib\supabase\trips.ts`
- `src\types\trip.ts`

The UI entry point has not been cut over yet. Current route-planning entry paths are still legacy:

- `src\App.tsx` exposes `/plan-route` and lazy-loads `src\features\route-planning\RoutePlanningScreen.tsx`
- `src\features\map\MapView.tsx` still shows a **Plan route** FAB that navigates to `/plan-route`
- `src\features\pin-detail\PinDetailSheet.tsx` does not yet offer a route-planning CTA
- `src\components\AuthRequired.tsx` redirects to `/account`, but currently preserves only `location.pathname`
- `src\features\account\AccountScreen.tsx` does not yet complete a reliable “return to intended planner route” flow after auth

This story adds the new `/trips` entry point and planner shell, but it must stay narrowly scoped:

- build on normalized `trips` reads from Story 1.1
- reuse existing `AuthRequired` and `PremiumGate` patterns
- keep the route lazy-loaded
- do **not** implement trip creation, resume logic, or route cutover from `/plan-route` yet

---

## Acceptance Criteria

### AC 1 — My Routes entry points land in the new planner shell

**Given** a user is browsing the existing map experience  
**When** they tap the new **My Routes** control or a route-planning CTA from a pin detail sheet  
**Then** the app navigates to `/trips` (or `/trips?tripId=...` when relevant)  
**And** the planner shell opens using the existing map-native sheet / panel pattern.

### AC 2 — Signed-out users follow the current auth flow and return correctly

**Given** the user is signed out  
**When** they attempt to access `/trips`  
**Then** the route is wrapped with `AuthRequired` and redirects them through the existing account flow  
**And** after successful sign-in they are returned to the intended planner route.

### AC 3 — Free users see inline premium gating instead of planner CRUD

**Given** the user is signed in but does not have premium access  
**When** `/trips` renders  
**Then** a `PremiumGate` upsell card is shown inline instead of trip CRUD content  
**And** the upsell uses the same pricing / checkout pattern already established in Phase 2.

### AC 4 — Premium users get an empty-state planner entry screen

**Given** the user is premium  
**When** `/trips` loads for the first time with no saved trips  
**Then** an empty-state planner view is shown with CTAs to create a route or start from the map  
**And** the route remains lazy-loaded without regressing the existing map startup experience.

---

## Tasks / Subtasks

### Task 1 — Add the new `/trips` route without cutting over legacy flows yet

**Primary files:**
- `src\App.tsx`
- `src\App.test.tsx`

- [ ] 1.1 Add a new lazy-loaded `/trips` route in `src\App.tsx`
- [ ] 1.2 Create a dedicated screen import for `src\features\route-planning\MyRoutesScreen.tsx` instead of reusing the legacy `RoutePlanningScreen.tsx` component directly
- [ ] 1.3 Wrap `/trips` with `AuthRequired`
- [ ] 1.4 Keep `/plan-route` and `/shared-trip/:shareToken` intact in this story; do **not** redirect `/plan-route` to `/trips` here
- [ ] 1.5 Extend `src\App.test.tsx` with route coverage for:
  - anonymous access to `/trips` redirecting into account flow
  - authenticated access rendering the new lazy screen shell
  - no regression to existing `/`, `/account`, and `/suggest-spot` behavior

**Acceptance Criteria:** AC 1, AC 2, AC 4

---

### Task 2 — Create a premium-gated My Routes screen shell on top of normalized trip reads

**Primary files:**
- `src\features\route-planning\MyRoutesScreen.tsx` **(new)**
- `src\features\route-planning\MyRoutesScreen.test.tsx` **(new)**
- `src\features\route-planning\api.ts` **(new, if needed)**
- `src\features\route-planning\useTripsQuery.ts` **(new, if needed)**

- [ ] 2.1 Add a dedicated `MyRoutesScreen` under `src\features\route-planning\`
- [ ] 2.2 Keep the screen aligned with the Phase 3 architecture:
  - route path is `/trips`
  - route content feels like a map feature, not a detached admin page
  - mobile uses a sheet-style shell; larger breakpoints can use a panel layout
- [ ] 2.3 Reuse `PremiumGate` from `src\components\PremiumGate.tsx` for feature-level gating inside the screen
- [ ] 2.4 Add read-only trip loading through the normalized trip stack created in Story 1.1:
  - prefer a feature wrapper such as `src\features\route-planning\api.ts`
  - use TanStack Query via `useTripsQuery.ts`
  - consume `GET /api/trips`, not legacy `trip_plans` helpers
- [ ] 2.5 For free users, render only the inline upsell state; do not expose trip CRUD controls behind the gate
- [ ] 2.6 For premium users with zero trips, render an empty-state planner shell with:
  - **Create route** CTA
  - **Start from map** CTA
  - explanatory copy that this is the new trip workspace
- [ ] 2.7 The empty-state shell may transition into a local placeholder state if needed, but it must **not** create or persist trips yet; actual create flow belongs to `p3-1-3-create-a-new-trip-plan`
- [ ] 2.8 Add screen tests for:
  - free user sees `PremiumGate`
  - premium user with no trips sees empty state
  - trips query loading/error states are handled without exposing broken CRUD UI

**Acceptance Criteria:** AC 1, AC 3, AC 4

---

### Task 3 — Replace legacy map entry copy with the new My Routes entry point

**Primary files:**
- `src\features\map\MapView.tsx`
- `src\features\map\MapView.test.tsx` **(create if coverage is missing)**

- [ ] 3.1 Replace the current **Plan route** map control in `src\features\map\MapView.tsx` with **My Routes**
- [ ] 3.2 Navigate that control to `/trips`
- [ ] 3.3 Preserve existing floating-control spacing, 44px tap target behavior, and map startup performance
- [ ] 3.4 Add or extend tests so the map-level CTA continues to render and points to the new `/trips` route

**Acceptance Criteria:** AC 1, AC 4

---

### Task 4 — Add a route-planning CTA to the pin detail sheet

**Primary files:**
- `src\features\pin-detail\PinDetailSheet.tsx`
- `src\features\pin-detail\PinDetailSheet.test.tsx`

- [ ] 4.1 Add a route-planning CTA to the existing pin detail action area in `src\features\pin-detail\PinDetailSheet.tsx`
- [ ] 4.2 Use copy consistent with the epic and architecture, such as **Plan route here** or **Add to route**
- [ ] 4.3 The CTA should navigate into `/trips`; only use `?tripId=...` when there is a real selected trip context to preserve
- [ ] 4.4 Do not break or replace existing **Get Directions**, bookmark, issue-report, or push-toggle actions
- [ ] 4.5 Add tests confirming:
  - the new CTA renders only when pin data is loaded
  - it navigates to the new planner entry point
  - existing PinDetailSheet action tests still pass

**Acceptance Criteria:** AC 1

---

### Task 5 — Preserve the full intended planner destination through auth

**Primary files:**
- `src\components\AuthRequired.tsx`
- `src\components\AuthRequired.test.tsx`
- `src\features\account\AccountScreen.tsx`
- `src\features\account\AccountScreen.test.tsx`

- [ ] 5.1 Update `AuthRequired` so it preserves the full intended route (`pathname`, `search`, and `hash`), not just `pathname`
- [ ] 5.2 Keep the redirect target as the existing account flow; do not introduce a separate auth screen
- [ ] 5.3 Update `AccountScreen.tsx` to honor the intended return destination after successful sign-in
- [ ] 5.4 Support both existing router state (`state.from`) and any query-based `returnTo` handoff already used by `PremiumGate`
- [ ] 5.5 Add tests covering:
  - `/trips?tripId=...` survives the auth handoff
  - successful sign-in returns the user to the intended planner route
  - existing account form behavior and error handling do not regress

**Acceptance Criteria:** AC 2

---

### Task 6 — Validate the new planner entry shell without starting later stories early

- [ ] 6.1 Run front-end validation for the route and shell changes:
  - `npm run test`
  - `npm run lint`
  - `npm run build`
- [ ] 6.2 Confirm this story does **not** implement:
  - trip creation persistence (`p3-1-3`)
  - resume existing trip behavior (`p3-1-4`)
  - offline draft store / pending mutation queue (`p3-4-1`)
  - `/plan-route` redirect cutover (`p3-5-2`)
- [ ] 6.3 Confirm normalized trip reads come from the new Phase 3 stack, while legacy `/plan-route` continues to use the old snapshot flow until the migration/cutover stories land

**Acceptance Criteria:** AC 1, AC 2, AC 3, AC 4

---

## Dev Notes

### Architecture Guardrails

1. **Reuse existing gates exactly.**
   - Route boundary auth stays with `src\components\AuthRequired.tsx`
   - Premium gating stays with `src\components\PremiumGate.tsx`
   - Do not invent a new planner-specific auth or subscription gate

2. **Use the normalized Phase 3 trip stack, not the legacy snapshot planner.**
   Story 1.1 already created `trips`, `trip_stops`, `api\trips*`, and `src\lib\supabase\trips.ts`. This story should read from that new path and stop extending `trip_plans` for the new workspace.

3. **Do not cut over `/plan-route` yet.**
   The Phase 3 architecture eventually redirects `/plan-route` to `/trips`, but epic sequencing already reserves that compatibility cutover for `p3-5-2-dual-read-cutover-and-plan-route-redirect`.

4. **Keep scope to entry, gating, and shell.**
   This story is about access and shell composition, not trip CRUD. Do not implement create/save, resume, duplicate, archive, offline queueing, or shared-trip import here.

5. **Preserve the “map → sheet → action” UX rule.**
   Reuse established visual patterns from the current app rather than inventing a full-page dashboard. The planner should still feel like a map-native feature.

6. **Keep lazy loading intact.**
   `/trips` should remain lazy-loaded so the map route does not pay the route-planner cost on first app load.

### Existing Code Signals

- `src\App.tsx` already lazy-loads route screens and uses `AuthRequired` for protected routes
- `src\components\AuthRequired.tsx` currently redirects anonymous users with `state={{ from: location.pathname }}`
- `src\components\PremiumGate.tsx` already supports checkout initiation and `returnTo`
- `src\features\map\MapView.tsx` has the current **Plan route** floating button
- `src\features\pin-detail\PinDetailSheet.tsx` currently exposes **Get Directions**, bookmark, and issue-report actions, but no planner CTA
- `src\features\route-planning\RoutePlanningScreen.tsx` and `src\store\tripPlansStore.ts` are still legacy snapshot-based and should not become the long-term `/trips` implementation path
- `api\trips.ts`, `api\trips\[id].ts`, and `api\_trips.ts` already provide the normalized premium-protected read/write foundation from Story 1.1

### Dependencies / Sequencing

- **Depends on:** `p3-1-1-normalized-trip-model-foundation`
- **Blocks:**
  - `p3-1-3-create-a-new-trip-plan`
  - `p3-1-4-resume-an-existing-trip`
  - later route-library and offline-sync stories that need a real `/trips` shell

### Testing Expectations

Minimum expected validation for this story:

1. `npm run test`
2. `npm run lint`
3. `npm run build`
4. Focused coverage for:
   - `src\App.test.tsx`
   - `src\components\AuthRequired.test.tsx`
   - `src\features\account\AccountScreen.test.tsx`
   - `src\features\pin-detail\PinDetailSheet.test.tsx`
   - `src\features\route-planning\MyRoutesScreen.test.tsx`
   - map CTA coverage in an existing or new `MapView` test

### References

- Source: `_bmad-output\planning-artifacts\epics-phase3.md` — Epic 1, Story 1.2
- Source: `_bmad-output\planning-artifacts\architecture-phase3.md` — Route Structure, Main Feature Modules, UI Composition, Auth / Premium Gating Rules, Accessibility, Performance, Recommended Implementation Notes
- Source: `_bmad-output\implementation-artifacts\p3-1-1-normalized-trip-model-foundation.md`
- Source: `_bmad-output\implementation-artifacts\p2-2-4-premiumgate-ui-component.md`
- Source: `src\App.tsx`
- Source: `src\components\AuthRequired.tsx`
- Source: `src\components\PremiumGate.tsx`
- Source: `src\features\account\AccountScreen.tsx`
- Source: `src\features\map\MapView.tsx`
- Source: `src\features\pin-detail\PinDetailSheet.tsx`
- Source: `src\features\route-planning\RoutePlanningScreen.tsx`
- Source: `src\store\tripPlansStore.ts`
- Source: `api\trips.ts`
- Source: `api\trips\[id].ts`
- Source: `api\_trips.ts`
