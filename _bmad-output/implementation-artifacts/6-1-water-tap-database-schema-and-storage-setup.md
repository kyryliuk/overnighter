# Story 6.1: Water Tap Database Schema & Storage Setup

Status: done

## Story

As a developer,
I want the Supabase database extended with water tap pin tables, a unified map pins view, and a photo storage bucket,
so that all subsequent ML pipeline and user-facing tap features have a stable, production-ready data layer to build on.

## Acceptance Criteria

### AC 1 — `water_tap_pins` table (migration 030)

**Given** the developer runs Supabase migration 030
**When** the migration completes
**Then** a `water_tap_pins` table exists with columns:
- `id` (UUID PK, DEFAULT gen_random_uuid())
- `location` (geography(POINT, 4326) NOT NULL)
- `place_name` (TEXT NOT NULL)
- `place_type` (TEXT NOT NULL — CHECK: `gas_station | campground | restaurant`)
- `access` (TEXT nullable)
- `confidence` (NUMERIC(3,2) NOT NULL)
- `source` (TEXT NOT NULL — CHECK: `ml_batch | user_submission | manual`)
- `photos` (TEXT[] NOT NULL DEFAULT '{}')
- `seasonal_notes` (TEXT nullable)
- `mile_marker` (NUMERIC(5,1) nullable)
- `is_active` (BOOLEAN NOT NULL DEFAULT TRUE)
- `verified_date` (TIMESTAMPTZ nullable)
- `place_ref` (TEXT nullable)
- `created_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW())

**And** three indexes exist:
- `idx_water_tap_pins_location` — GIST on `location`
- `idx_water_tap_pins_is_active` — B-tree on `is_active`
- `idx_water_tap_pins_mile_marker` — partial B-tree on `mile_marker WHERE mile_marker IS NOT NULL`

### AC 2 — `tap_verification_events` table (migration 031)

**Given** the developer runs Supabase migration 031
**When** the migration completes
**Then** a `tap_verification_events` table exists with columns:
- `id` (UUID PK, DEFAULT gen_random_uuid())
- `tap_pin_id` (UUID NOT NULL — FK → `water_tap_pins.id` ON DELETE RESTRICT)
- `device_id` (TEXT NOT NULL)
- `event_type` (TEXT NOT NULL — CHECK: `confirmed | denied | ml_scan | user_submission`)
- `confidence` (NUMERIC(3,2) nullable)
- `photo_url` (TEXT nullable)
- `created_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW())

**And** index `idx_tap_verification_tap_pin_id` exists on `tap_pin_id`
**And** UPDATE and DELETE are revoked from `PUBLIC`, `authenticated`, and `anon` roles — the table is append-only

### AC 3 — `map_pins` view (migration 032)

**Given** the developer runs Supabase migration 032
**When** the migration completes
**Then** a `map_pins` view exists that UNION ALLs:
- `pins` WHERE `is_archived = FALSE` → `pin_category = 'regular'`, `name` aliased as `place_name`
- `water_tap_pins` WHERE `is_active = TRUE` → `pin_category = 'water_tap'`

**And** the view exposes at minimum: `id`, `location`, `pin_category`, `place_name`

### AC 4 — `tap-photos` Storage bucket (migration 033)

**Given** the developer runs Supabase migration 033
**When** the migration completes
**Then** a `tap-photos` Supabase Storage bucket exists with:
- Public read access (SELECT policy: `true`)
- No INSERT/UPDATE/DELETE policies (service-role-key write only via RLS bypass)
- 5MB maximum file size (5,242,880 bytes)

### AC 5 — `.env.example` updated with new server-only vars

**Given** the `.env.example` file is reviewed
**When** the developer inspects it
**Then** the following server-only (non-VITE_) environment variables are documented:
- `SAGEMAKER_ENDPOINT_URL` — full HTTPS URL of the deployed SageMaker endpoint
- `AWS_ACCESS_KEY_ID` — already present ✓
- `AWS_SECRET_ACCESS_KEY` — already present ✓
- `AWS_REGION` — already present ✓
- `ML_SCAN_URL` — full URL of the deployed `/api/ml-scan` endpoint

**And** none of these variables are prefixed with `VITE_` — they must never appear in the client bundle (NFR-ML5)

### AC 6 — Vercel environment variable documentation

**Given** the Vercel project settings (documented in `.env.example` notes)
**When** the admin reviews the environment variable section
**Then** `SAGEMAKER_ENDPOINT_URL` and `ML_SCAN_URL` are clearly documented as server-only, required for the ML scan pipeline

---

## Tasks / Subtasks

- [x] Task 1: Create migration 030 — `water_tap_pins` table (AC: 1)
  - [x] 1.1 Define table with all 15 columns, CHECK constraints, and defaults
  - [x] 1.2 Create GIST index `idx_water_tap_pins_location` on `location`
  - [x] 1.3 Create B-tree index `idx_water_tap_pins_is_active` on `is_active`
  - [x] 1.4 Create partial index `idx_water_tap_pins_mile_marker` on `mile_marker WHERE NOT NULL`
- [x] Task 2: Create migration 031 — `tap_verification_events` table (AC: 2)
  - [x] 2.1 Define table with 7 columns, FK to water_tap_pins, CHECK on event_type
  - [x] 2.2 Create index `idx_tap_verification_tap_pin_id` on `tap_pin_id`
  - [x] 2.3 REVOKE UPDATE, DELETE from PUBLIC, authenticated, and anon roles
- [x] Task 3: Create migration 032 — `map_pins` view (AC: 3)
  - [x] 3.1 CREATE OR REPLACE VIEW using UNION ALL of pins and water_tap_pins
  - [x] 3.2 Verify view exposes id, location, pin_category, place_name
- [x] Task 4: Create migration 033 — `tap-photos` Storage bucket (AC: 4)
  - [x] 4.1 INSERT into storage.buckets with public=true, file_size_limit=5242880
  - [x] 4.2 INSERT public SELECT policy into storage.policies
  - [x] 4.3 Confirm NO INSERT/UPDATE/DELETE policies (service-role-only write)
- [x] Task 5: Update `.env.example` with new server-only env vars (AC: 5, 6)
  - [x] 5.1 Add `SAGEMAKER_ENDPOINT_URL` to SageMaker section
  - [x] 5.2 Add `ML_SCAN_URL` to Sync section with clear server-only documentation

---

## Dev Notes

### Architecture Context

- **PostGIS is already enabled** via migration `026_add_postgis_spatial_index.sql` — `CREATE EXTENSION IF NOT EXISTS postgis` is safe to omit from 030, or include idempotently.
- **Migration numbering:** Existing migrations go up to `029_create_profile_on_signup.sql`. New migrations must start at `030`.
- **`pins` table uses `is_archived`** (from migration 009), NOT `is_active`. The `map_pins` view must use `WHERE is_archived = FALSE` for the `pins` side and `WHERE is_active = TRUE` for the `water_tap_pins` side.
- **`pins.location` exists** (geography(Point, 4326), added in migration 026) — use it in the view.
- **Storage bucket pattern:** Migration `024_create_pin_photos_storage_bucket.sql` is the reference — it inserts into `storage.policies` but notes the bucket is created via Dashboard or CLI. For 033, attempt bucket creation via `storage.buckets` INSERT with `ON CONFLICT DO NOTHING` for idempotency.
- **Append-only enforcement:** `tap_verification_events` must explicitly REVOKE UPDATE and DELETE from the standard roles. The service role bypasses RLS and is the only writer in the ML pipeline.
- **NFR-ML5:** `SAGEMAKER_ENDPOINT_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `ML_SCAN_URL` must NEVER be prefixed with `VITE_`. These are server-side secrets; any `VITE_` prefix would embed them in the browser bundle.

### Existing `.env.example` State

The following vars from the story's AC 5 **already exist** in `.env.example`:
- `AWS_REGION` (line 100)
- `AWS_ACCESS_KEY_ID` (line 103)
- `AWS_SECRET_ACCESS_KEY` (line 106)

The following are **missing and must be added**:
- `SAGEMAKER_ENDPOINT_URL` (story AC wants the full URL, not just the endpoint name — `SAGEMAKER_ENDPOINT_NAME` exists but is different)
- `ML_SCAN_URL`

### Storage Bucket Details

- Bucket name: `tap-photos`
- Public read: yes (objects accessible without auth token)
- Write access: service-role-key only (no policy = only service role can write)
- Max file size: 5,242,880 bytes (5MB)
- Path pattern: `tap-photos/{tap_pin_id}/{timestamp}.jpg`
- Reference: `024_create_pin_photos_storage_bucket.sql`

### Epic 6 Architecture Reference

[Source: `_bmad-output/planning-artifacts/epics.md` — Architecture — ML Pipeline Extension (Epic 6 triggers)]

- `map_pins` view unions pins + water_tap_pins; `pin_category` discriminator routes `PinLayer.tsx` to correct detail sheet
- New env vars: all server-only, never VITE_ prefixed (NFR-ML5)
- `tap-photos` bucket: public read, service-role-key write only, path pattern `tap-photos/{tap_pin_id}/{timestamp}.jpg`, 5MB max

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 6.1`] — Full acceptance criteria
- [Source: `supabase/migrations/026_add_postgis_spatial_index.sql`] — PostGIS setup pattern
- [Source: `supabase/migrations/024_create_pin_photos_storage_bucket.sql`] — Storage bucket migration pattern
- [Source: `supabase/migrations/001_create_pins.sql`] — `pins` table schema
- [Source: `supabase/migrations/009_add_is_archived_to_pins.sql`] — `is_archived` on pins

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5 (2025)

### Debug Log References

### Completion Notes List

- Migration 030 (`030_create_water_tap_pins.sql`): Created `water_tap_pins` table with 15 columns, 3 indexes (GIST, B-tree, partial). Uses `IF NOT EXISTS` for idempotency. PostGIS already enabled via migration 026. Added CHECK (confidence BETWEEN 0.00 AND 1.00) per code review.
- Migration 031 (`031_create_tap_verification_events.sql`): Created `tap_verification_events` with FK → water_tap_pins, 1 index, and explicit REVOKE of UPDATE/DELETE from PUBLIC/authenticated/anon — append-only enforced. Added CHECK on confidence per code review.
- Migration 032 (`032_create_map_pins_view.sql`): Created `map_pins` view as UNION ALL of `pins` (is_archived=FALSE, pin_category='regular') + `water_tap_pins` (is_active=TRUE, pin_category='water_tap'). Exposes id, location, pin_category, place_name.
- Migration 033 (`033_create_tap_photos_storage_bucket.sql`): Created `tap-photos` bucket (public=true, 5MB limit) + public SELECT policy. No write policies → service-role-only write via RLS bypass. Removed non-standard `allowed_mime_types` column per code review (consistent with migration 024 pattern).
- `.env.example`: Added `SAGEMAKER_ENDPOINT_URL` (under SageMaker section) and `ML_SCAN_URL` (under Sync section). Both clearly documented as server-only / never VITE_-prefixed.
- NOTE: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` were already present in `.env.example` — no duplication needed.
- NOTE: Existing migrations were 001–029; new migrations start at 030 (not 005–008 as originally spec'd — the folder already had 005–029 when work began).
- CODE REVIEW FIXES: (1) Added confidence CHECK BETWEEN 0.00 AND 1.00 to both water_tap_pins and tap_verification_events; (2) Removed non-standard allowed_mime_types column from storage.buckets INSERT in migration 033.

### File List

- `supabase/migrations/030_create_water_tap_pins.sql` — NEW
- `supabase/migrations/031_create_tap_verification_events.sql` — NEW
- `supabase/migrations/032_create_map_pins_view.sql` — NEW
- `supabase/migrations/033_create_tap_photos_storage_bucket.sql` — NEW
- `.env.example` — MODIFIED (added SAGEMAKER_ENDPOINT_URL, ML_SCAN_URL)
- `_bmad-output/implementation-artifacts/6-1-water-tap-database-schema-and-storage-setup.md` — MODIFIED
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED (added epic-6, story 6-1 through 6-5)
