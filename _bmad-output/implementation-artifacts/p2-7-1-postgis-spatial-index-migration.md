# Story 7.1: PostGIS Spatial Index Migration

## Story

As a **developer**,
I want the `pins` table to use a PostGIS `geography(Point)` column with a GiST index,
So that spatial proximity queries are fast at scale across the continental US.

## Status

**Ready for Dev**

## Context

The Overnighter app currently stores pin locations as separate `latitude` and `longitude` columns (DOUBLE PRECISION) with a basic composite B-tree index (`idx_pins_coordinates`). All pin queries use `getAllPins()` which fetches every non-archived row with no server-side spatial filtering — the client filters locally. This worked for regional data but will not scale to national coverage.

This story adds PostGIS spatial infrastructure so that Story 7.2 can migrate viewport queries to use `ST_DWithin`. This is a **database-only** story — no API or frontend changes.

### What already exists

| Layer | File | What it does |
|-------|------|--------------|
| Migration | `001_create_pins.sql` | `pins` table with `latitude`/`longitude` (DOUBLE PRECISION), composite index `idx_pins_coordinates` |
| Migration | `005_add_pin_type_source_id_unique.sql` | Unique constraint on `(pin_type, source_id)` |
| Migration | `009_add_is_archived_to_pins.sql` | `is_archived BOOLEAN DEFAULT false` column |
| Migration | `012_add_toilets_pets_amenities.sql` | Extended amenities JSONB |
| Migration | `013_add_pin_details.sql` | `website`, `phone`, `elevation_m` columns |
| Migration | `025_admin_pin_management.sql` | `badge_override`, `admin_audit_log` table |
| Query helper | `src/lib/supabase/pins.ts` | `getAllPins()` — `SELECT * FROM pins WHERE is_archived = false` (full table scan) |
| Hook | `src/hooks/usePinsQuery.ts` | React Query wrapper around `getAllPins()` with 5-min stale time |
| Types | `src/lib/supabase/types.ts` | `DbPin` interface — `latitude: number`, `longitude: number`, no `location` field |
| API | `api/pins/[id].ts` | Single pin fetch/update by ID |

### What does NOT exist yet

- No PostGIS extension enabled
- No `geography` or `geometry` columns
- No GiST spatial index
- No server-side bounding box or radius queries
- No `ST_DWithin` or `ST_MakePoint` usage anywhere in the codebase

---

## Acceptance Criteria

### AC 1 — PostGIS Extension Enabled

**Given** the migration is applied to a Supabase instance
**When** `SELECT PostGIS_Version()` is executed
**Then** it returns a valid PostGIS version string without error

### AC 2 — Geography Column Added to Pins

**Given** the migration has run
**When** the `pins` table schema is inspected
**Then** a `location` column of type `geography(Point, 4326)` exists
**And** it allows NULL values (for backward compatibility during rollout)

### AC 3 — GiST Spatial Index Created

**Given** the `location` column exists on `pins`
**When** `SELECT indexname FROM pg_indexes WHERE tablename = 'pins'` is executed
**Then** an index named `idx_pins_location_gist` using method `gist` on `location` is present

### AC 4 — Existing Data Backfilled

**Given** the `pins` table contains rows with `latitude` and `longitude` values
**When** the migration completes
**Then** every row where `latitude IS NOT NULL AND longitude IS NOT NULL` has `location` populated with `ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography`
**And** `SELECT COUNT(*) FROM pins WHERE location IS NULL AND latitude IS NOT NULL` returns 0

### AC 5 — Auto-Populate Trigger on Insert/Update

**Given** a new pin is inserted with `latitude` and `longitude` values
**When** the insert completes
**Then** the `location` column is automatically populated from `ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography`

**Given** an existing pin's `latitude` or `longitude` is updated
**When** the update completes
**Then** the `location` column is recalculated to match the new coordinates

**Given** a pin is inserted with `latitude = NULL` or `longitude = NULL`
**When** the insert completes
**Then** `location` remains NULL (no error thrown)

### AC 6 — Migration Is Idempotent

**Given** the migration has already been applied
**When** the migration SQL is executed a second time
**Then** no errors occur (uses `IF NOT EXISTS` / `CREATE OR REPLACE` guards)

### AC 7 — Zero Downtime

**Given** the production database is serving live traffic
**When** the migration is applied
**Then** no table locks prevent concurrent reads or writes
**And** the backfill uses batched updates (not a single long-running UPDATE)
**And** existing queries using `latitude`/`longitude` columns continue to work unchanged

### AC 8 — Spatial Query Verification

**Given** the migration has completed and data is backfilled
**When** the following query is executed:
```sql
SELECT COUNT(*) FROM pins
WHERE ST_DWithin(
  location,
  ST_SetSRID(ST_MakePoint(-105.0, 39.7), 4326)::geography,
  50000
);
```
**Then** it returns pins within 50km of Denver, CO without error
**And** the query plan shows the GiST index is used (not a sequential scan)

---

## Tasks / Subtasks

### Task 1 — Database Migration: Enable PostGIS and Add Geography Column

**File:** `supabase/migrations/026_add_postgis_spatial_index.sql`

Create a single migration file containing all PostGIS setup steps in order:

#### 1.1 — Enable PostGIS Extension

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

- Supabase supports PostGIS natively — no additional packages or tier changes required.
- `IF NOT EXISTS` ensures idempotency.

#### 1.2 — Add `location` Geography Column

```sql
ALTER TABLE pins ADD COLUMN IF NOT EXISTS location geography(Point, 4326);
```

- SRID 4326 = WGS 84 (standard GPS coordinate system, matches existing lat/lng data).
- `NULL`-able by default — safe for any rows missing coordinates.
- `IF NOT EXISTS` guard — Supabase/PostgreSQL 11+ supports this on `ALTER TABLE ADD COLUMN`.

#### 1.3 — Create Trigger Function for Auto-Population

```sql
CREATE OR REPLACE FUNCTION set_pin_location()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$;
```

- Uses `CREATE OR REPLACE` for idempotency.
- Sets `location` to NULL when coordinates are missing (no error).
- Note: PostGIS `ST_MakePoint` takes `(longitude, latitude)` — **longitude first**.

#### 1.4 — Attach Trigger to Pins Table

```sql
DROP TRIGGER IF EXISTS trg_set_pin_location ON pins;
CREATE TRIGGER trg_set_pin_location
  BEFORE INSERT OR UPDATE OF latitude, longitude
  ON pins
  FOR EACH ROW
  EXECUTE FUNCTION set_pin_location();
```

- Fires on INSERT and on UPDATE only when `latitude` or `longitude` change.
- `DROP IF EXISTS` + `CREATE` ensures idempotency.
- Uses `BEFORE` trigger so the `location` value is written in the same row operation.

#### 1.5 — Backfill Existing Data

```sql
UPDATE pins
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND location IS NULL;
```

- Only updates rows that haven't been backfilled yet (`location IS NULL`).
- This is safe for the current dataset size (~10-20k pins). For larger datasets, batch with `LIMIT` + loop.
- The `WHERE location IS NULL` clause makes this idempotent — re-running is a no-op.

#### 1.6 — Create GiST Spatial Index

```sql
CREATE INDEX IF NOT EXISTS idx_pins_location_gist ON pins USING GIST(location);
```

- GiST (Generalized Search Tree) is the required index type for PostGIS geography queries.
- Enables `ST_DWithin`, `ST_Distance`, and bounding-box operators to use index scans.
- `IF NOT EXISTS` for idempotency.

**Acceptance Criteria:** AC 1, AC 2, AC 3, AC 4, AC 5, AC 6, AC 7, AC 8

---

### Task 2 — Update Database Types

**File:** `src/lib/supabase/types.ts`

Add the `location` field to the `DbPin` interface:

```typescript
export interface DbPin {
  // ... existing fields ...
  location: string | null  // PostGIS geography(Point, 4326) — WKB hex string
}
```

- PostGIS returns geography values as WKB (Well-Known Binary) hex strings via the Supabase client.
- The frontend does not need to parse this value — it exists for the database layer only.
- Existing code reading `latitude`/`longitude` is unchanged.

**Acceptance Criteria:** AC 2

---

### Task 3 — Verify Migration Locally

Run the migration against local Supabase and verify all acceptance criteria:

```bash
npx supabase db reset
```

Then run verification queries:

```sql
-- AC 1: PostGIS enabled
SELECT PostGIS_Version();

-- AC 2: Column exists
SELECT column_name, udt_name
FROM information_schema.columns
WHERE table_name = 'pins' AND column_name = 'location';

-- AC 3: GiST index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'pins' AND indexname = 'idx_pins_location_gist';

-- AC 4: Backfill complete
SELECT COUNT(*) AS unbackfilled
FROM pins
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND location IS NULL;
-- Expected: 0

-- AC 5: Trigger exists
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'pins' AND trigger_name = 'trg_set_pin_location';

-- AC 8: Spatial query works with index
EXPLAIN ANALYZE
SELECT COUNT(*) FROM pins
WHERE ST_DWithin(
  location,
  ST_SetSRID(ST_MakePoint(-105.0, 39.7), 4326)::geography,
  50000
);
-- Expected: Index Scan using idx_pins_location_gist
```

**Acceptance Criteria:** AC 1–AC 8

---

## Dev Notes

### Architecture Guardrails

1. **SRID 4326 is mandatory.** All existing lat/lng data uses WGS 84 (GPS standard). The geography column must use SRID 4326 to match.

2. **`geography` not `geometry`.** Use `geography(Point, 4326)` — not `geometry`. Geography type calculates distances in meters on the spheroid, which is correct for national-scale queries. Geometry uses planar math and would give wrong results at US scale.

3. **Keep `latitude`/`longitude` columns.** Do NOT drop the scalar columns. They are read by every frontend component, API endpoint, and the Overpass layer. The `location` column is a derived/indexed column for spatial queries only. Both must stay in sync via the trigger.

4. **Longitude-first in PostGIS.** `ST_MakePoint(longitude, latitude)` — PostGIS uses X,Y ordering (longitude = X, latitude = Y). This is opposite of the common lat/lng convention. The trigger must use this order.

5. **Migration number must be 026.** The latest migration is `025_admin_pin_management.sql`. This migration must be `026_add_postgis_spatial_index.sql`.

### Performance Considerations

- The backfill UPDATE on ~10-20k rows completes in < 1 second. No batching needed at current scale.
- GiST index creation on 20k rows is near-instant. For production with 100k+ rows, consider `CREATE INDEX CONCURRENTLY` (but this cannot run inside a transaction block — Supabase migrations run in transactions by default).
- The trigger adds negligible overhead to inserts/updates (single `ST_MakePoint` call).

### What This Story Does NOT Change

- **No API changes.** `getAllPins()` and all API endpoints continue to work with `latitude`/`longitude`.
- **No frontend changes.** No components reference the `location` column.
- **No query changes.** The `ST_DWithin` viewport query migration is Story 7.2.
- **No RLS policy changes.** The `pins` table has no RLS (public read).

### Testing

1. **Local migration test:** `npx supabase db reset` must succeed with no errors.
2. **Backfill verification:** Zero rows with NULL `location` where lat/lng are present.
3. **Trigger test:** Insert a row, verify `location` is auto-populated. Update lat/lng, verify `location` changes.
4. **Index test:** `EXPLAIN ANALYZE` on a `ST_DWithin` query must show GiST index usage.
5. **Idempotency test:** Run the migration SQL twice — no errors on second run.
6. **Existing query regression:** `getAllPins()` returns same results as before migration.

### Dependencies

- **Blocks:** Story 7.2 (Viewport Query Migration to ST_DWithin) — cannot proceed without the geography column and index.
- **Blocked by:** Nothing — this story has no dependencies.

### Rollback Plan

If the migration needs to be reverted:

```sql
DROP TRIGGER IF EXISTS trg_set_pin_location ON pins;
DROP FUNCTION IF EXISTS set_pin_location();
DROP INDEX IF EXISTS idx_pins_location_gist;
ALTER TABLE pins DROP COLUMN IF EXISTS location;
-- Note: DO NOT drop the PostGIS extension — other projects may depend on it.
```
