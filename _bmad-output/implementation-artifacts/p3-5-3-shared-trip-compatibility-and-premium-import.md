# Story p3-5: 3 — Shared Trip Compatibility and Premium Import

Status: in-progress

## Story

As a **traveler using shared links**,
I want existing public shared-trip pages to remain useful and import cleanly into the new planner,
So that current sharing behavior survives Phase 3.0 without expanding the scope into a social rebuild.

## Context

Stories 5.1 and 5.2 completed the backend backfill and frontend route cutover.
`SharedTripPlanScreen` now correctly redirects legacy navigation, but `handleImportTrip` still just
calls `navigate('/trips')` without gating or actually creating a normalized Trip copy.

This story gates the import CTA with auth + premium checks (via the existing `PremiumGate`
component) and wires up real trip creation via `useCreateTripMutation` for premium users.

### What Already Exists

- `src/features/route-planning/SharedTripPlanScreen.tsx` — renders shared trip read-only content; `handleImportTrip` navigates to `/trips` only
- `src/features/route-planning/useCreateTripMutation.ts` — normalized trip creation with offline queue
- `src/components/PremiumGate.tsx` — renders upsell UI for non-premium; redirects to `/account?returnTo=...` for signed-out users
- `src/hooks/useSubscription.ts` — `useSubscription()` returning `{ isPremium, isLoading, ... }`
- `src/features/route-planning/api.ts` — `createTrip()` POST endpoint client
- `src/types/trip.ts` — `TripWritePayload`, `TripWaypointInput`, `TripPlaceSnapshot`
- `src/types/tripPlan.ts` — `TripPlan`, `TripPlanPlace`

### What This Story Must NOT Add

- Social features or public trip sharing rebuild
- Backend API changes
- Changes to comments or reactions functionality
- New routes or URL changes

## Acceptance Criteria

**Given** any user opens a `/shared-trip/:shareToken` URL
**When** the page loads
**Then** the shared trip renders read-only content (title, destination, waypoints, notes)
**And** existing comments and reactions continue to work (no regression from Stories 5.1/5.2).

**Given** a signed-out user taps "Save a copy to my planner"
**When** they tap the import CTA
**Then** they are redirected to `/account?returnTo=/shared-trip/:shareToken`
**And** after auth they return to the shared trip page.

**Given** an authenticated but free-tier user taps "Save a copy to my planner"
**When** they tap the import CTA
**Then** they see the premium upsell UI (PremiumGate) with an upgrade path to Stripe checkout.

**Given** an authenticated premium user taps "Save a copy to my planner"
**When** the import succeeds
**Then** a private route copy is created in normalized storage with `sourceTripId` attribution preserved
**And** the imported trip is private (not public)
**And** the user is navigated to `/trips`.

## Tasks / Subtasks

- [x] Task 1: Gate "Save a copy to my planner" CTA with PremiumGate
  - [x] Wrap the import button section with `<PremiumGate feature="..." variant="compact">`
  - [x] Auth redirect (not authenticated) handled automatically by PremiumGate
  - [x] Premium upsell (authenticated, not premium) handled automatically by PremiumGate

- [x] Task 2: Implement trip import for premium users
  - [x] Add `useCreateTripMutation()` to SharedTripPlanScreen
  - [x] Build `TripWritePayload` from `tripQuery.data` (title, notes, destination, stops, sourceTripId)
  - [x] Map legacy stops to `TripWaypointInput[]` with `source: 'imported'`
  - [x] Navigate to `/trips` on successful import

- [x] Task 3: Import feedback UX
  - [x] Show "Saving to planner…" when mutation is pending (button disabled)
  - [x] Show inline error message if import fails

- [x] Task 4: Tests
  - [x] Premium user: import creates trip with correct payload shape and navigates to `/trips`
  - [x] Non-premium authenticated user: sees PremiumGate upsell, not the import button
  - [x] Non-authenticated user: PremiumGate redirects to `/account?returnTo=...`
  - [x] Import error: error alert shown when mutation throws
  - [x] Pending state: button shows loading text while mutation pending

## Dev Agent Record

### Agent

Story implemented by Copilot (Claude Sonnet 4.6) on 2026-04-26.

### File List

- `src/features/route-planning/SharedTripPlanScreen.tsx`
- `src/features/route-planning/SharedTripPlanScreen.test.tsx`
- `_bmad-output/implementation-artifacts/p3-5-3-shared-trip-compatibility-and-premium-import.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- Added `PremiumGate` (compact variant) wrapping "Save a copy to my planner" CTA
- Added `useCreateTripMutation` call; `handleImportTrip` now builds `TripWritePayload` and calls mutation
- Added import pending/error feedback
- Added 5 new tests covering the full auth/premium/import flow
