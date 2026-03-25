# Story 7.2: Radius-Based Search API (Viewport Query Migration to ST_DWithin)

## Story

As a **user**,
I want the map to load pins within my visible viewport quickly regardless of which US state I'm in,
So that I get fast, relevant results everywhere across the continental US.

## Status

**Ready for Dev**

## Context

The Overnighter app currently fetches **all** non-archived pins via `getAllPins()` — a full table scan with no server-side spatial filtering. The client filters locally using viewport bounds. This worked for the Florida pilot (~5-10k pins) but will not scale to national coverage (100k+ pins).

Story 7.1 added PostGIS infrastructure: a `location geography(Point, 4326)` column, GiST spatial index (`idx_pins_location_gist`), and an auto-sync trigger from lat/lng. This story builds on that foundation by creating a radius-based search API endpoint and migrating the frontend to use it.

### What already exists

| Layer | File | What it does |
|-------|------|--------------|
| Migration | `026_add_postgis_spatial_index.sql` | PostGIS extension, `location` geography column, GiST index, auto-sync trigger |
| Query helper | `src/lib/supabase/pins.ts` | `getAllPins()` — `SELECT * FROM pins WHERE is_archived = false` (full table scan) |
| Hook | `src/hooks/usePinsQuery.ts` | React Query wrapper around `getAllPins()` with 5-min stale time, offline fallback |
| Types | `src/lib/supabase/types.ts` | `DbPin` interface with `location: string \| null` field |
| Mapper | `src/lib/supabase/pins.ts` | `dbPinToPin()` — maps snake_case DB rows to camelCase `Pin` domain objects |
| API patterns | `api/pins/[id].ts` | Vercel serverless handler, Zod validation, `{ error, message, status }` response shape |
| API helpers | `api/_supabase.ts` | `createServiceClient()` for server-side Supabase access |
| API middleware | `api/_middleware.ts` | `requireAdminAuth()` for bearer token auth |
| Frontend map | `src/components/MapView.tsx` | Uses `usePinsQuery()`, reads `map.getBounds()` for viewport |

### What does NOT exist yet

- No server-side spatial query endpoint (no radius or bounding-box API)
- No `ST_DWithin` usage in any API endpoint
- No Supabase RPC function for proximity search
- No frontend viewport-to-radius calculation
- No pagination support for pin queries

---

## Acceptance Criteria

### AC 1 — Supabase RPC Function for Radius Search

**Given** the PostGIS spatial index from Story 7.1 is in place
**When** the `search_pins_by_radius` RPC function is created in a new migration
**Then** it accepts `p_lat DOUBLE PRECISION`, `p_lng DOUBLE PRECISION`, `p_radius_m INTEGER`, `p_limit INTEGER`, `p_offset INTEGER`
**And** it executes `ST_DWithin(location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius_m)`
**And** results are ordered by `ST_Distance(location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) ASC`
**And** only non-archived pins are returned (`is_archived = false`)
**And** `EXPLAIN ANALYZE` shows the GiST index `idx_pins_location_gist` is used (no sequential scan)

### AC 2 — API Endpoint Accepts Radius Parameters

**Given** the API is deployed
**When** `GET /api/pins?lat=39.7&lng=-105.0&radiusM=50000` is called
**Then** the server validates all three parameters are present and numeric
**And** calls the `search_pins_by_radius` RPC function
**And** returns a JSON array of matching pins with HTTP 200

### AC 3 — Input Validation and Error Handling

**Given** a request to `GET /api/pins`
**When** `lat` is outside `[-90, 90]` or `lng` is outside `[-180, 180]`
**Then** the server returns HTTP 400 with `{ "error": "INVALID_PARAMS", "message": "...", "status": 400 }`

**Given** a request to `GET /api/pins`
**When** `radiusM` is less than 100 or greater than 500000 (500 km)
**Then** the server returns HTTP 400 with `{ "error": "INVALID_PARAMS", "message": "...", "status": 400 }`

**Given** a request with no `lat`/`lng`/`radiusM` parameters
**When** the request is processed
**Then** the server falls back to the existing `getAllPins()` behavior (returns all non-archived pins)
**And** no breaking change is introduced for any cached or older client requests

### AC 4 — Pagination Support

**Given** a radius search returns many results
**When** `GET /api/pins?lat=39.7&lng=-105.0&radiusM=50000&limit=50&offset=0` is called
**Then** at most 50 pins are returned
**And** the response includes a `total` count of matching pins
**And** `offset=50` returns the next page of results

**Given** no `limit` parameter is provided
**When** the query executes
**Then** the default limit is 200 pins
**And** the maximum allowed limit is 500

### AC 5 — Results Sorted by Distance

**Given** a radius search is executed
**When** results are returned
**Then** pins are ordered by ascending distance from the search center
**And** each pin in the response includes a `distanceM` field (distance in meters, rounded to nearest integer)

### AC 6 — Frontend Integration — Map Viewport Search

**Given** the user pans or zooms the map
**When** the viewport changes
**Then** `usePinsQuery` calls `GET /api/pins` with the viewport center (lat/lng) and a radius derived from the viewport diagonal
**And** pins outside the viewport radius are not fetched
**And** the query re-fires with debouncing (300ms) on viewport change

**Given** the user is at zoom level 10 (city-scale view)
**When** the radius is computed from the viewport
**Then** the radius is approximately 50,000 meters (50 km)

### AC 7 — Frontend Integration — Offline Fallback

**Given** the device is offline
**When** the viewport query fails
**Then** the cached pin snapshot from IndexedDB/localStorage is used as fallback (existing behavior preserved)
**And** no error is surfaced to the user

### AC 8 — Performance Requirements

**Given** the database contains 100,000 pins with populated `location` columns
**When** a radius search with `radiusM=50000` is executed
**Then** the query completes in under 300ms (verified via `EXPLAIN ANALYZE`)
**And** the GiST index is used (no sequential scan)
**And** end-to-end API response time is under 1 second on a cold start

### AC 9 — Backward Compatibility

**Given** the Phase 1 client or cached requests call `GET /api/pins` with no spatial parameters
**When** the request is processed
**Then** all non-archived pins are returned (same as current `getAllPins()` behavior)
**And** no breaking change is introduced

---

## Tasks / Subtasks

### Task 1 — Database Migration: Create `search_pins_by_radius` RPC Function

**File:** `supabase/migrations/027_search_pins_by_radius.sql`

Create a PostgreSQL function exposed via Supabase RPC for radius-based pin search:

#### 1.1 — Define the RPC Function

```sql
CREATE OR REPLACE FUNCTION search_pins_by_radius(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_m INTEGER,
  p_limit INTEGER DEFAULT 200,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  pin_type TEXT,
  source_id TEXT,
  max_length_ft INTEGER,
  max_height_ft NUMERIC,
  website TEXT,
  phone TEXT,
  elevation_m NUMERIC,
  amenities JSONB,
  badge_state TEXT,
  last_check_in_at TIMESTAMPTZ,
  recent_check_in_count INTEGER,
  is_verified BOOLEAN,
  is_flagged BOOLEAN,
  location TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  distance_m DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id, p.name, p.description, p.latitude, p.longitude,
    p.pin_type, p.source_id, p.max_length_ft, p.max_height_ft,
    p.website, p.phone, p.elevation_m, p.amenities, p.badge_state,
    p.last_check_in_at, p.recent_check_in_count,
    p.is_verified, p.is_flagged,
    p.location::text,
    p.created_at, p.updated_at,
    ST_Distance(
      p.location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) AS distance_m
  FROM pins p
  WHERE p.is_archived = false
    AND p.location IS NOT NULL
    AND ST_DWithin(
      p.location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
  ORDER BY distance_m ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;
```

- Uses `LANGUAGE sql` + `STABLE` for query planner optimization.
- `ST_DWithin` leverages the GiST index for fast spatial filtering.
- `ST_Distance` computes exact distance for sorting and the `distance_m` return field.
- PostGIS uses longitude-first ordering: `ST_MakePoint(lng, lat)`.

#### 1.2 — Create a Count Helper Function

```sql
CREATE OR REPLACE FUNCTION count_pins_by_radius(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_m INTEGER
)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM pins
  WHERE is_archived = false
    AND location IS NOT NULL
    AND ST_DWithin(
      location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    );
$$;
```

- Separate count function avoids returning all rows just to count them.
- Used by the API to populate the `total` field in paginated responses.

**Acceptance Criteria:** AC 1, AC 4, AC 5, AC 8

---

### Task 2 — API Endpoint: `GET /api/pins` with Radius Search

**File:** `api/pins.ts` (new file)

Create a Vercel serverless handler for the public pin search endpoint:

#### 2.1 — Request Schema with Zod

```typescript
import { z } from 'zod'

const RadiusSearchSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusM: z.coerce.number().int().min(100).max(500000),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
})
```

- Uses `z.coerce.number()` to handle query string values (always strings).
- Validates lat/lng bounds, radius range, and pagination limits.

#### 2.2 — Handler Logic

```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'GET only', status: 405 })
  }

  const hasRadiusParams = req.query.lat !== undefined
    && req.query.lng !== undefined
    && req.query.radiusM !== undefined

  // Fallback: no spatial params → return all pins (backward compat)
  if (!hasRadiusParams) {
    return handleGetAllPins(req, res)
  }

  // Spatial search path
  return handleRadiusSearch(req, res)
}
```

- **No auth required** — pin reads are public (matches existing `getAllPins()` pattern).
- Falls back to full pin list when no spatial parameters are provided (AC 9).
- Follows existing API patterns: Zod validation, `{ error, message, status }` errors, `createServiceClient()`.

#### 2.3 — Radius Search Implementation

```typescript
async function handleRadiusSearch(req: VercelRequest, res: VercelResponse) {
  const parsed = RadiusSearchSchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_PARAMS',
      message: parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      status: 400,
    })
  }

  const { lat, lng, radiusM, limit, offset } = parsed.data
  const supabase = createServiceClient()

  const [{ data, error }, { data: total, error: countError }] = await Promise.all([
    supabase.rpc('search_pins_by_radius', {
      p_lat: lat, p_lng: lng, p_radius_m: radiusM,
      p_limit: limit, p_offset: offset,
    }),
    supabase.rpc('count_pins_by_radius', {
      p_lat: lat, p_lng: lng, p_radius_m: radiusM,
    }),
  ])

  if (error || countError) {
    console.error('[api/pins] radius search error', error || countError)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }

  const pins = (data as DbRadiusPin[]).map(dbRadiusPinToPin)

  return res.status(200).json({ pins, total: total ?? 0, limit, offset })
}
```

#### 2.4 — Response Mapping

Map DB rows to the camelCase `Pin` domain shape, adding the `distanceM` field:

```typescript
interface DbRadiusPin extends Omit<DbPin, 'is_archived'> {
  distance_m: number
}

function dbRadiusPinToPin(db: DbRadiusPin) {
  return {
    ...dbPinToPin(db as unknown as DbPin),
    distanceM: Math.round(db.distance_m),
  }
}
```

#### 2.5 — Fallback Handler for All Pins

```typescript
async function handleGetAllPins(req: VercelRequest, res: VercelResponse) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('pins').select('*').eq('is_archived', false)

  if (error) {
    console.error('[api/pins] getAllPins error', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }

  const pins = (data as DbPin[]).map(dbPinToPin)
  return res.status(200).json({ pins, total: pins.length, limit: pins.length, offset: 0 })
}
```

**Acceptance Criteria:** AC 2, AC 3, AC 4, AC 5, AC 9

---

### Task 3 — API Unit Tests

**File:** `api/pins.test.ts` (new file)

Write Vitest tests covering:

1. **Radius search happy path** — valid lat/lng/radiusM → 200 with pins array, total, distance
2. **Input validation** — invalid lat (>90) → 400, invalid radiusM (<100) → 400, missing params
3. **Fallback to getAllPins** — no spatial params → returns all non-archived pins
4. **Pagination** — limit/offset are forwarded to RPC, response shape includes total
5. **Method not allowed** — POST/PUT/DELETE → 405
6. **RPC error handling** — Supabase error → 500 with standard error shape

Follow existing test patterns in `api/pins/[id].test.ts`:
- Mock `createServiceClient()` with `vi.mock()`
- Test request/response with `VercelRequest`/`VercelResponse` mocks

**Acceptance Criteria:** AC 2, AC 3, AC 4, AC 9

---

### Task 4 — Frontend: Update `usePinsQuery` for Viewport-Based Fetching

**File:** `src/hooks/usePinsQuery.ts`

#### 4.1 — Accept Viewport Parameters

```typescript
interface PinsQueryParams {
  enabled?: boolean
  lat?: number
  lng?: number
  radiusM?: number
}

export function usePinsQuery({ enabled = true, lat, lng, radiusM }: PinsQueryParams = {}) {
  const hasViewport = lat !== undefined && lng !== undefined && radiusM !== undefined

  return useQuery({
    queryKey: hasViewport ? ['pins', { lat, lng, radiusM }] : ['pins'],
    queryFn: async () => {
      if (hasViewport) {
        return fetchPinsByRadius(lat, lng, radiusM)
      }
      // Fallback: fetch all (backward compat for non-map views)
      const pins = await getAllPins()
      savePinsCacheSnapshot(pins)
      return pins
    },
    enabled,
    staleTime: hasViewport ? 30_000 : 5 * 60 * 1000, // 30s for viewport, 5min for all
  })
}
```

- `queryKey` includes viewport params so React Query deduplicates and caches per viewport.
- Shorter stale time for viewport queries (user is actively browsing).

#### 4.2 — Add Radius Fetch Function

**File:** `src/lib/supabase/pins.ts`

```typescript
export async function fetchPinsByRadius(
  lat: number, lng: number, radiusM: number,
  limit = 200, offset = 0
): Promise<{ pins: Pin[]; total: number }> {
  const params = new URLSearchParams({
    lat: String(lat), lng: String(lng),
    radiusM: String(radiusM),
    limit: String(limit), offset: String(offset),
  })
  const res = await fetch(`/api/pins?${params}`)
  if (!res.ok) throw new Error(`Radius search failed: ${res.status}`)
  return res.json()
}
```

**Acceptance Criteria:** AC 6, AC 7

---

### Task 5 — Frontend: Viewport-to-Radius Calculation in MapView

**File:** `src/components/MapView.tsx` (modify existing)

#### 5.1 — Compute Radius from Viewport Bounds

```typescript
function viewportToRadius(map: L.Map): { lat: number; lng: number; radiusM: number } {
  const center = map.getCenter()
  const bounds = map.getBounds()
  const ne = bounds.getNorthEast()
  // Diagonal distance / 2 gives the circumscribed radius
  const radiusM = Math.round(center.distanceTo(ne))
  return { lat: center.lat, lng: center.lng, radiusM }
}
```

#### 5.2 — Debounced Viewport Change Handler

Use a 300ms debounce on `moveend` / `zoomend` events to update the query params passed to `usePinsQuery`:

```typescript
const [viewport, setViewport] = useState<{ lat: number; lng: number; radiusM: number } | null>(null)

useEffect(() => {
  if (!map) return
  const handler = debounce(() => setViewport(viewportToRadius(map)), 300)
  map.on('moveend', handler)
  return () => { map.off('moveend', handler); handler.cancel() }
}, [map])

const { data: pins } = usePinsQuery({
  enabled: shouldShowMap,
  ...viewport,
})
```

- Uses `moveend` (fires after both pan and zoom complete — avoids intermediate states).
- Debounce prevents rapid re-fetching during continuous pan/zoom.
- Initial load computes viewport from map's initial bounds.

**Acceptance Criteria:** AC 6

---

### Task 6 — Verify Migration and Performance Locally

Run the migration and verify all acceptance criteria:

```bash
npx supabase db reset
```

#### 6.1 — Verify RPC Function Exists

```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'search_pins_by_radius';
```

#### 6.2 — Verify Index Usage

```sql
EXPLAIN ANALYZE
SELECT * FROM search_pins_by_radius(39.7, -105.0, 50000, 50, 0);
-- Expected: Index Scan using idx_pins_location_gist
```

#### 6.3 — Verify Distance Ordering

```sql
SELECT name, distance_m FROM search_pins_by_radius(39.7, -105.0, 50000, 10, 0);
-- distance_m values should be in ascending order
```

**Acceptance Criteria:** AC 1, AC 5, AC 8

---

## Dev Notes

### Architecture Guardrails

1. **Public read endpoint — no auth required.** Pin data is public (no RLS on `pins` table). The `GET /api/pins` endpoint does not require authentication, matching the existing `getAllPins()` direct PostgREST pattern. This is intentional per the architecture doc.

2. **RPC function over raw SQL.** Using a Supabase RPC function (instead of raw PostGIS SQL via the Supabase client) keeps spatial logic in the database layer. The Supabase JS client calls `supabase.rpc('search_pins_by_radius', {...})`.

3. **`geography` type for distance calculations.** The RPC uses `geography` (not `geometry`) — distances are in meters on the spheroid, correct for US-scale queries. This matches the SRID 4326 geography column from Story 7.1.

4. **PostGIS longitude-first ordering.** `ST_MakePoint(lng, lat)` — longitude is X, latitude is Y. The API receives `lat`/`lng` as separate params and maps them correctly in the RPC call.

5. **camelCase query parameters.** Per the architecture doc, query parameters use camelCase: `radiusM`, not `radius_m`. The API maps to the PostgreSQL function's `p_radius_m` parameter.

6. **Standard error response shape.** All errors follow `{ error: "CODE", message: "...", status: 4xx|5xx }` per the architecture doc.

7. **Backward compatibility is mandatory.** When `lat`/`lng`/`radiusM` are omitted, the endpoint returns all non-archived pins — identical to the current `getAllPins()` behavior. No existing client code breaks.

### Performance Considerations

- **GiST index:** `ST_DWithin` on a `geography` column with a GiST index is O(log n) — it filters spatially before loading rows. The planner uses the index for any radius under ~1000 km.
- **Parallel count + data queries:** The API fires `search_pins_by_radius` and `count_pins_by_radius` in parallel via `Promise.all` to minimize latency.
- **Default limit of 200:** Prevents accidentally fetching huge result sets. The frontend typically displays 50-100 pins in a viewport.
- **30-second stale time for viewport queries:** Balances freshness with re-fetch cost during active map browsing. The all-pins query keeps the existing 5-minute stale time.
- **Debounced viewport handler (300ms):** Prevents rapid API calls during continuous panning.

### Testing Plan

1. **Migration test:** `npx supabase db reset` — verify function exists, index is used.
2. **API unit tests (`api/pins.test.ts`):**
   - Happy path: radius search returns pins with distance
   - Validation: invalid params return 400
   - Fallback: no params returns all pins
   - Pagination: limit/offset forwarded correctly
   - Error handling: RPC failure returns 500
3. **Frontend unit tests:**
   - `usePinsQuery` with viewport params uses correct query key
   - `fetchPinsByRadius` constructs correct URL params
   - `viewportToRadius` calculates radius from map bounds
4. **Integration test (manual or E2E):**
   - Pan map → new pins load for new area
   - Zoom out → radius increases, more pins returned
   - Offline → cached pins displayed, no error

### Dependencies

- **Depends on:** Story 7.1 (PostGIS Spatial Index Migration) — must be complete (geography column, GiST index, trigger all in place).
- **Blocks:** Nothing currently — this is the last story in Epic 7.

### Rollback Plan

If the migration needs to be reverted:

```sql
DROP FUNCTION IF EXISTS search_pins_by_radius(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS count_pins_by_radius(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER);
```

If the API endpoint needs to be reverted:
- Delete `api/pins.ts` — the frontend fallback in `usePinsQuery` will revert to `getAllPins()`.

If the frontend changes need to be reverted:
- Revert `usePinsQuery.ts` to the pre-Story 7.2 version (fetch all pins, no viewport params).
