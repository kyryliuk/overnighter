# Story p3-5: 1 — Backfill Legacy Trip Plans

Status: done

## Story

As an **existing route-planning user**,
I want my earlier trip plans preserved in the new planner,
so that Phase 3.0 feels like an upgrade instead of a reset.

## Context

Epic 5 covers the legacy migration and sharing compatibility layer. Epics 1–4 built the full normalized trip model (`trips` + `trip_stops`), API, UI, offline-first drafting, and sync-conflict detection. Now existing data in `trip_plans` must be migrated into that normalized model so users see their prior routes in **My Routes** without manual recreation.

### What Already Exists

- `supabase/migrations/017_create_trip_plans.sql` — `trip_plans (user_id, plan_id, plan_snapshot JSONB, created_at, updated_at)`
- `supabase/migrations/018_enable_trip_plan_sharing.sql` — adds `is_public`, `share_token` to `trip_plans`
- `supabase/migrations/028_create_normalized_trip_model.sql` — `trips`, `trip_stops`, `upsert_trip_with_stops` RPC (service_role only)
- `src/lib/supabase/tripPlans.ts` — `dbTripPlanToTripPlan()` shows the `plan_snapshot` shape: `{ id, title, notes, destination: TripPlanPlace, stops: TripPlanPlace[], isPublic, shareToken, sourceTrip: { shareToken, title } | null, createdAt, updatedAt }`
- `src/types/tripPlan.ts` — `TripPlan`, `TripPlanPlace`, `TripPlanSource` types
- `src/lib/supabase/trips.ts` — `dbTripToTrip()` + helpers showing normalized column shapes
- `src/lib/supabase/types.ts` — `DbTripPlan`, `DbTrip`, `DbTripStop`
- `api/_supabase.ts` — `createServiceClient()` for server-side access
- `scripts/validate-model-precision.ts` — existing script as a structural reference for the `scripts/` folder

### What This Story Must NOT Add

- Any changes to `tripPlans.ts`, the trip API, or the existing `trips` read path
- Deletion of `trip_plans` rows (kept read-only for rollback / dual-read in Story 5.2)
- UI changes to **My Routes** (normalized rows will appear automatically once inserted)
- Sharing or import logic (Story 5.3)
- Any new Supabase policies or RLS changes beyond the idempotency column

---

## Acceptance Criteria

### AC 1 — Legacy plans backfilled with preserved snapshots and share metadata

**Given** the database already contains `trip_plans.plan_snapshot` rows  
**When** the backfill script runs  
**Then** each eligible legacy trip is inserted into `trips` with `destination_snapshot`, `is_public`, `share_token`, and `source_share_token` from the legacy data  
**And** each `stops` entry in the snapshot is inserted as an ordered `trip_stops` waypoint row  
**And** the destination is inserted as a `trip_stops` destination row at the final `stop_order`  
**And** a `legacy_plan_id` column on `trips` links back to `trip_plans.plan_id` for traceability.

### AC 2 — Idempotent; `trip_plans` kept intact; rollback documented

**Given** the migration is running during the transition window  
**When** the backfill script is run more than once  
**Then** rows with an already-populated `legacy_plan_id` are skipped, not duplicated  
**And** `trip_plans` rows are not modified or deleted  
**And** the script prints a rollback statement (`DELETE FROM trips WHERE legacy_plan_id IS NOT NULL`) to stdout so operators can undo the backfill if needed.

### AC 3 — Malformed rows skipped; batch continues

**Given** a legacy row contains malformed or incomplete `plan_snapshot` (missing destination, invalid coordinates, or non-JSON)  
**When** the backfill encounters it  
**Then** the row is skipped with a warning line per record (`[SKIP] plan_id=… reason=…`)  
**And** the script continues processing remaining rows without aborting.

### AC 4 — Stop count integrity

**Given** a valid legacy `plan_snapshot.stops` array with N entries  
**When** the trip is inserted  
**Then** `trips.stop_count = N + 1` (N waypoints + 1 destination)  
**And** waypoints have `stop_order` 0…N-1 and the destination has `stop_order = N`.

---

## Tasks / Subtasks

- [x] **Task 1 — Migration: add `legacy_plan_id` column** (AC: 1, 2)
  - [x] 1.1 Write `supabase/migrations/035_add_legacy_plan_id_to_trips.sql`
    - Add `legacy_plan_id TEXT` column to `trips` (nullable)
    - Add `UNIQUE(user_id, legacy_plan_id)` constraint for idempotency

- [x] **Task 2 — Backfill script** (AC: 1, 2, 3, 4)
  - [x] 2.1 Create `scripts/backfill-legacy-trip-plans.ts`
    - Use `createServiceClient()` from `api/_supabase.ts` (bypasses RLS)
    - Read all `trip_plans` rows (paginated with `BATCH_SIZE = 100`)
    - For each row:
      - Parse and validate `plan_snapshot` → require `destination` with `id/name/lat/lng`
      - Skip with `[SKIP]` log if invalid
      - Check idempotency: skip if `trips` already has `legacy_plan_id = plan_id` for that user
      - Insert `trips` row with `legacy_plan_id`, `is_public`, `share_token` from legacy row
      - Insert `trip_stops` rows (waypoints then destination in order)
      - Wrap per-trip in try/catch; log `[ERROR]` on failure without aborting batch
    - At end: print summary `Processed: X | Inserted: Y | Skipped: Z | Errors: E`
    - Print rollback statement to stdout

- [x] **Task 3 — Unit tests** (AC: 1, 2, 3, 4)
  - [x] 3.1 Create `scripts/backfill-legacy-trip-plans.test.ts`
    - Export and test a pure `transformLegacyPlan(row)` function that converts a `DbTripPlan` to `{ trip, stops }` — separate from I/O for testability
    - Test: valid plan with 2 waypoints → correct `trips` row + 3 `trip_stops` (2 waypoints + 1 destination)
    - Test: plan with 0 stops → 1 `trip_stops` (destination only), `stop_count = 1`
    - Test: `is_public = true`, `share_token` preserved on `trips` row
    - Test: `sourceTrip.shareToken` → `source_share_token` on `trips` row
    - Test: missing destination → returns `null` (caller skips)
    - Test: destination with missing `latitude` → returns `null`
    - Test: `legacy_plan_id` set to `plan_id` on the trips row

---

## Dev Notes

### Architecture Context

This story is purely a data migration path — no UI, no API endpoint changes. The script runs once (or repeatedly, idempotently) against a real Supabase database using the service role key. Once `trips` rows exist with a `legacy_plan_id`, they appear automatically in **My Routes** via the existing `GET /api/trips` → `getTrips()` path.

### Key Mapping: `TripPlan` → `trips` + `trip_stops`

```
trip_plans.user_id        → trips.user_id
plan_snapshot.id          (ignored — we generate a new UUID)
plan_snapshot.title       → trips.title (fallback: 'Imported trip')
plan_snapshot.notes       → trips.notes (fallback: '')
'draft'                   → trips.status
null                      → trips.origin_snapshot (legacy has no origin)
plan_snapshot.destination → trips.destination_snapshot { id, name, latitude, longitude }
'corridor'                → trips.route_mode
stops.length + 1          → trips.stop_count
1                         → trips.revision
trip_plans.is_public      → trips.is_public
trip_plans.share_token    → trips.share_token
null                      → trips.source_trip_id (no UUID linkage available yet)
sourceTrip?.shareToken    → trips.source_share_token
trip_plans.updated_at     → trips.created_at AND trips.updated_at
trip_plans.plan_id        → trips.legacy_plan_id

plan_snapshot.stops[i]    → trip_stops row: stop_order=i, stop_kind='waypoint', source='imported'
plan_snapshot.destination → trip_stops row: stop_order=stops.length, stop_kind='destination', source='imported'
```

### Service Role Access Pattern

Use `createServiceClient()` from `api/_supabase.ts`. This is the same pattern used by all API handlers. For a Node.js script, load env vars from `.env.local` before importing (or pass them via environment at runtime).

**Important**: `upsert_trip_with_stops` is `service_role` only and doesn't support the `legacy_plan_id` column we're adding. Insert directly into `trips` and `trip_stops` tables using the service client — do not go through the RPC.

### Pagination

The `trip_plans` table can be large. Use `.range(offset, offset + BATCH_SIZE - 1)` cursor-based reads to avoid loading all rows at once.

### Idempotency Guard

Before inserting, query `trips` for `(user_id = X, legacy_plan_id = plan_id)`. If found, skip. This check must happen per-row, not as a bulk pre-filter, so that concurrent runs are safe.

The `UNIQUE(user_id, legacy_plan_id)` constraint in the migration serves as a database-level guard — a duplicate insert will raise an error that the try/catch per trip catches and logs as `[SKIP idempotency]`.

### Rollback Path

The printed rollback statement:
```sql
DELETE FROM trips WHERE legacy_plan_id IS NOT NULL;
```
This removes all backfilled rows. `trip_stops` rows cascade via `ON DELETE CASCADE`. `trip_plans` rows are untouched.

### Scale Assumption

Designed for < 50,000 `trip_plans` rows. For larger datasets, the script batches reads at `BATCH_SIZE = 100`. Individual trip inserts are sequential (not bulk) to keep per-row error isolation clean. Each trip insert is at most 2 DB calls (1 insert trips + 1 insert trip_stops via `.insert(stops_array)`).

### Testing Pattern

The `transformLegacyPlan()` function must be a pure function exported from the script module so tests can exercise mapping logic without a real DB. The script's `main()` entry point handles all I/O and is not tested directly. Follow the pattern from `scripts/validate-model-precision.ts`.

### Project Structure Notes

- New files are strictly within `scripts/` (script + test) and `supabase/migrations/` (SQL)
- No changes to `src/`, `api/`, or `supabase/` outside of `migrations/`
- The new migration follows the `NNN_description.sql` naming pattern: `035_add_legacy_plan_id_to_trips.sql`
- Script uses `tsx` for running TypeScript directly (same as other scripts if applicable, otherwise compile via `tsc -p tsconfig.api.json`)

### References

- Legacy schema: [Source: supabase/migrations/017_create_trip_plans.sql], [Source: supabase/migrations/018_enable_trip_plan_sharing.sql]
- Normalized schema: [Source: supabase/migrations/028_create_normalized_trip_model.sql]
- TripPlan type: [Source: src/types/tripPlan.ts]
- DbTripPlan type: [Source: src/lib/supabase/types.ts#DbTripPlan]
- Snapshot parsing precedent: [Source: src/lib/supabase/tripPlans.ts#dbTripPlanToTripPlan]
- Service client: [Source: api/_supabase.ts]
- Script reference: [Source: scripts/validate-model-precision.ts]

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

- All 10 unit tests pass covering all ACs
- `transformLegacyPlan()` is a pure exported function — no I/O dependency in tests
- Individual malformed waypoints are silently dropped (trip preserved); missing destination returns null (trip skipped)
- Script uses BATCH_SIZE=100 pagination; per-trip try/catch prevents one bad row aborting the batch
- DB-level UNIQUE(user_id, legacy_plan_id) constraint provides race-safe idempotency
- `trip_plans` rows are never touched (read-only)

### File List

- `supabase/migrations/035_add_legacy_plan_id_to_trips.sql` (new)
- `scripts/backfill-legacy-trip-plans.ts` (new)
- `scripts/backfill-legacy-trip-plans.test.ts` (new)
