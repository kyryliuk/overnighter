# Story p3-1.1: Normalized Trip Model Foundation

## Story

As a **developer**,
I want the normalized Phase 3 trip schema, API helpers, and premium-protected endpoints in place,
So that the planner can save route plans in a durable model without extending legacy snapshot storage forever.

## Status

**Ready for Dev**

## Context

The current route-planning experience is still centered on the legacy snapshot model:

- `supabase/migrations/017_create_trip_plans.sql` stores each plan as a single `trip_plans.plan_snapshot` JSONB row.
- `src/store/tripPlansStore.ts` persists local route drafts in the `trip-plans` Zustand store.
- `src/lib/supabase/tripPlans.ts` provides legacy bulk sync and sharing helpers for `trip_plans`.
- `src/features/route-planning/RoutePlanningScreen.tsx` and `src/features/route-planning/SharedTripPlanScreen.tsx` still operate on `TripPlan` snapshots from `src/types/tripPlan.ts`.
- `src/App.tsx` still exposes `/plan-route` and `/shared-trip/:shareToken`.

Phase 3 Story 1.1 creates the technical foundation for the new premium trip planner by introducing normalized `trips` + `trip_stops`, typed Supabase helpers, and premium-protected REST endpoints. This story is intentionally foundational: it should not perform the legacy backfill or `/plan-route` cutover yet, but it must make future planner stories build on normalized data instead of extending snapshot storage.

---

## Acceptance Criteria

### AC 1 — Normalized Trip Schema, RLS, and Types Exist

**Given** the current project already stores route plans in legacy `trip_plans.plan_snapshot` rows  
**When** Phase 3 Story 1.1 is implemented  
**Then** new `trips` and `trip_stops` tables exist with owner-scoped RLS and indexes on `user_id`, `updated_at`, and `(trip_id, stop_order)`  
**And** `src/lib/supabase/types.ts` includes `DbTrip` and `DbTripStop` types used by new helpers

### AC 2 — Premium-Protected Trip Endpoints Exist

**Given** the new normalized model exists  
**When** the server trip layer is implemented  
**Then** `GET /api/trips`, `POST /api/trips`, `GET /api/trips/:id`, `PATCH /api/trips/:id`, and `DELETE /api/trips/:id` exist  
**And** every endpoint uses `requirePremiumAuth()` and owner validation before reading or mutating data

### AC 3 — Invalid Writes Are Rejected Atomically

**Given** a trip create or update request reaches the server  
**When** the payload is missing a destination, contains duplicate stop order values, exceeds 12 total stops, or belongs to another user  
**Then** the request is rejected with a validation or authorization error  
**And** no partial trip write is committed

### AC 4 — Successful Writes Return Canonical Server State

**Given** a valid trip write succeeds  
**When** the transaction completes  
**Then** the response returns canonical `revision`, `updated_at`, and normalized stop data  
**And** the client can use that response without guessing final server state

---

## Tasks / Subtasks

### Task 1 — Add the normalized database foundation

**Primary file:** `supabase/migrations/028_create_normalized_trip_model.sql`

- [ ] 1.1 Audit existing trip-related migrations before adding Phase 3 schema:
  - `supabase/migrations/017_create_trip_plans.sql`
  - `supabase/migrations/018_enable_trip_plan_sharing.sql`
  - `supabase/migrations/019_create_trip_plan_reactions.sql`
  - `supabase/migrations/020_create_trip_plan_comments.sql`
  - `supabase/migrations/021_add_trip_comment_moderation.sql`
- [ ] 1.2 Create `trips` with the Phase 3 canonical fields from architecture:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `title TEXT NOT NULL`
  - `notes TEXT NOT NULL DEFAULT ''`
  - `status TEXT NOT NULL DEFAULT 'draft'`
  - `origin_snapshot JSONB NULL`
  - `destination_snapshot JSONB NOT NULL`
  - `route_mode TEXT NOT NULL DEFAULT 'corridor'`
  - `stop_count INTEGER NOT NULL DEFAULT 0`
  - `revision INTEGER NOT NULL DEFAULT 1`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - future-hook columns kept nullable/defaulted: `is_public`, `share_token`, `source_trip_id`, `source_share_token`
- [ ] 1.3 Create `trip_stops` with ordered stop support:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE`
  - `stop_order INTEGER NOT NULL`
  - `stop_kind TEXT NOT NULL`
  - `source TEXT NOT NULL DEFAULT 'manual'`
  - `pin_id TEXT NULL`
  - `place_snapshot JSONB NOT NULL`
  - `notes TEXT NOT NULL DEFAULT ''`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- [ ] 1.4 Add the required constraints and indexes:
  - allowed `trips.status` values for Phase 3.0: `draft`, `archived`
  - allowed `trip_stops.stop_kind` values for Phase 3.0: `waypoint`, `destination`
  - allowed `trip_stops.source` values for Phase 3.0: `manual`, `saved`, `suggested`, `imported`
  - `CHECK (stop_order >= 0)`
  - unique ordering constraint on `(trip_id, stop_order)`
  - index on `trips.user_id`
  - index on `trips.updated_at`
  - index/unique support on `(trip_id, stop_order)`
- [ ] 1.5 Enable owner-scoped RLS on both `trips` and `trip_stops`:
  - `trips` policies should use `auth.uid() = user_id`
  - `trip_stops` policies should derive ownership through the parent `trips` row (do not leave `trip_stops` unprotected)
- [ ] 1.6 Keep `trip_plans` intact for backward compatibility; this story must not delete, rewrite, or backfill legacy rows yet

**Acceptance Criteria:** AC 1

---

### Task 2 — Add normalized types and Supabase helper layer

**Primary files:**
- `src/lib/supabase/types.ts`
- `src/lib/supabase/trips.ts`

- [ ] 2.1 Add `DbTrip` and `DbTripStop` to `src/lib/supabase/types.ts` using snake_case database fields only
- [ ] 2.2 Create `src/lib/supabase/trips.ts` for normalized trip reads and mapping helpers
- [ ] 2.3 Keep database naming confined to the Supabase layer:
  - add DB-to-app mapping helpers inside `src/lib/supabase/trips.ts`
  - if a shared app-level type is needed for endpoint responses, add it in a non-DB file such as `src\types\trip.ts` rather than exposing `DbTrip*` directly to components
- [ ] 2.4 Preserve compatibility with existing snapshot shapes by reusing the same place snapshot shape currently represented by `TripPlanPlace` in `src/types/tripPlan.ts`
- [ ] 2.5 Do not extend `src/lib/supabase/tripPlans.ts` for normalized work; keep that file as legacy compatibility until Phase 3 migration stories

**Acceptance Criteria:** AC 1, AC 4

---

### Task 3 — Implement premium-protected trips endpoints

**Primary files:**
- `api/trips.ts`
- `api/trips/[id].ts`

- [ ] 3.1 Add `api/trips.ts` for:
  - `GET /api/trips` — list current user trips (exclude archived by default unless explicitly needed)
  - `POST /api/trips` — create a normalized trip with ordered stops
- [ ] 3.2 Add `api/trips/[id].ts` for:
  - `GET /api/trips/:id` — fetch one owned trip
  - `PATCH /api/trips/:id` — update metadata, destination, and ordered stops
  - `DELETE /api/trips/:id` — soft delete by setting `status = 'archived'`
- [ ] 3.3 Reuse existing server patterns:
  - `requirePremiumAuth()` from `api/_auth.ts`
  - `createServiceClient()` from `api/_supabase.ts`
  - standard error envelope shape used by current API handlers (`METHOD_NOT_ALLOWED`, `INVALID_PARAMS` / `INVALID_BODY`, `INTERNAL_ERROR`)
- [ ] 3.4 Validate request bodies and params with Zod:
  - destination is required
  - total stop count max is 12 including destination
  - stop orders must be unique and non-negative
  - stop IDs / trip IDs in the request cannot be used to mutate another user's trip
- [ ] 3.5 Ensure create/update writes are atomic:
  - use a database transaction pattern, preferably via SQL function/RPC in the migration layer, for parent + child stop writes
  - do **not** perform separate non-transactional JS writes that could leave `trips` and `trip_stops` out of sync
- [ ] 3.6 Return canonical server state after successful create/update:
  - `revision`
  - `updated_at`
  - normalized ordered stops
  - destination/origin snapshots as persisted

**Acceptance Criteria:** AC 2, AC 3, AC 4

---

### Task 4 — Add endpoint and helper test coverage

**Primary files:**
- `api/trips.test.ts`
- `api/trips/[id].test.ts`
- `src/lib/supabase/trips.test.ts` *(if helper extraction warrants direct unit tests)*

- [ ] 4.1 Follow the existing `api/pins.test.ts` / `api/pins/[id].test.ts` Vitest pattern:
  - hoisted mocks
  - mocked `createServiceClient()`
  - mocked `requirePremiumAuth()`
  - lightweight request/response helpers
- [ ] 4.2 Add endpoint tests for:
  - 405 handling
  - 401/403 auth and premium failures
  - missing destination
  - duplicate `stop_order`
  - stop count greater than 12
  - owner mismatch / not-found access rejection
  - success payload shape including `revision`, `updated_at`, and ordered stops
  - delete/archive behavior
- [ ] 4.3 Add focused helper tests if `src/lib/supabase/trips.ts` contains non-trivial mapping logic

**Acceptance Criteria:** AC 2, AC 3, AC 4

---

### Task 5 — Validate the foundation without regressing legacy flows

- [ ] 5.1 Run API/type test coverage:
  - `npm run test`
  - `npm run typecheck:api`
- [ ] 5.2 Validate the new migration in the same way current database work is validated for this repo (prefer local Supabase reset/apply if environment is available)
- [ ] 5.3 Confirm existing legacy files and routes still build untouched:
  - `src/store/tripPlansStore.ts`
  - `src/lib/supabase/tripPlans.ts`
  - `src/features/route-planning/RoutePlanningScreen.tsx`
  - `src/features/route-planning/SharedTripPlanScreen.tsx`
  - `/plan-route`
  - `/shared-trip/:shareToken`

**Acceptance Criteria:** AC 1, AC 2, AC 3, AC 4

---

## Dev Notes

### Architecture Guardrails

1. **Keep this story foundational.** Do not perform the legacy backfill or route cutover here. Those belong to:
   - `p3-5-1-backfill-legacy-trip-plans`
   - `p3-5-2-dual-read-cutover-and-plan-route-redirect`

2. **Reuse existing auth and premium patterns exactly.**
   - Route-level auth in later UI stories should use `AuthRequired` from `src/components/AuthRequired.tsx`
   - Feature-level upsell in later UI stories should use `PremiumGate` from `src/components/PremiumGate.tsx`
   - All `/api/trips*` handlers in this story must use `requirePremiumAuth()` from `api/_auth.ts`

3. **Do not leak DB snake_case into UI state.**
   `src/lib/supabase/types.ts` is explicitly the snake_case boundary. Any type consumed by components, hooks, or stores should be camelCase/domain-level.

4. **Delete means archive in Phase 3.0.**
   `DELETE /api/trips/:id` should soft-delete by updating `trips.status = 'archived'`, not physically remove rows.

5. **Destination is both summary data and part of ordered stops.**
   Keep `trips.destination_snapshot` for fast reads, but preserve an ordered destination stop representation so future planner stories can render a single ordered route model.

6. **Treat 12 as the total-stop cap.**
   The architecture explicitly says the max stop count is 12 total stops including destination. Validation should enforce that server-side.

7. **Atomic write safety matters more than convenience.**
   AC 3 requires no partial writes. If the implementation cannot guarantee atomicity with plain chained Supabase calls, move the write logic into SQL/RPC within the migration layer and keep the API handler thin.

8. **Preserve future sharing hooks without activating them.**
   `is_public`, `share_token`, `source_trip_id`, and `source_share_token` can exist in schema now, but this story should not enable public sharing logic on normalized trips yet.

### Existing Code and Structure Signals

- Current route-planning UI lives under `src/features/route-planning/`
- Current route state is local-first in `src/store/tripPlansStore.ts`
- Current legacy cloud sync helper is `src/lib/supabase/tripPlans.ts`
- Current route definitions are in `src/App.tsx`
- Existing API resource patterns use:
  - top-level file for collection routes (example: `api/pins.ts`)
  - `[id].ts` for single-resource dynamic routes (example: `api/pins/[id].ts`)
- Existing API tests live beside handlers and use Vitest mocks instead of integration servers

### Testing Expectations

Minimum required validation for implementation:

1. `npm run test`
2. `npm run typecheck:api`
3. Focused Vitest coverage for `api/trips.ts`
4. Focused Vitest coverage for `api/trips/[id].ts`
5. Migration validation for `supabase/migrations/028_create_normalized_trip_model.sql`
6. Regression confirmation that legacy `/plan-route` and `/shared-trip/:shareToken` flows remain untouched in this story

### Dependencies / Sequencing

- **Blocked by:** nothing in Phase 3 backlog; this is the foundation story for Epic 1
- **Blocks:**
  - `p3-1-2-gated-my-routes-entry-point`
  - `p3-1-3-create-a-new-trip-plan`
  - `p3-1-4-resume-an-existing-trip`
  - all later route library / offline sync stories that depend on normalized trip CRUD

### References

- Source: `_bmad-output/planning-artifacts/epics-phase3.md` (Epic 1, Story 1.1)
- Source: `_bmad-output/planning-artifacts/architecture-phase3.md` (Data Model Proposal, API Surface Proposal, Auth / Premium Gating Rules, Rollout and Migration Strategy, Recommended Implementation Notes)
- Source: `supabase/migrations/017_create_trip_plans.sql`
- Source: `src/store/tripPlansStore.ts`
- Source: `src/lib/supabase/tripPlans.ts`
- Source: `src/lib/supabase/types.ts`
- Source: `api/_auth.ts`
- Source: `api/pins.ts`
- Source: `api/pins/[id].ts`
- Source: `api/pins.test.ts`
- Source: `src/App.tsx`
