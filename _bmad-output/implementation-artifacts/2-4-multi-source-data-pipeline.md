# Story 2.4: Multi-Source Data Pipeline

Status: done

## Story

As a user,
I want the map to display aggregated stop data from BLM/USFS/NPS public land APIs, OpenStreetMap Overpass, and community check-ins in a unified view,
so that I see all available stops in one place without switching apps or cross-referencing sources.

## Acceptance Criteria

**AC1 — Daily BLM/USFS/NPS sync via cron**
Given the GitHub Actions `sync.yml` cron runs at 2am UTC daily
When `POST /api/sync` is called with a valid Bearer token
Then the function fetches RIDB (recreation.gov) API data for BLM/USFS/NPS facilities,
normalizes it to the unified pin model, and upserts to the `pins` Supabase table

**AC2 — Stale data flagging (NFR-I1)**
Given BLM/USFS/NPS data has been synced
When any pin's `updated_at` is older than 48 hours
Then the sync function updates those pins' `badge_state` to `'red'` (stale)

**AC3 — Overpass server-side proxy (NFR-I2)**
Given the client requests OpenStreetMap Overpass data for a viewport
When the request is made
Then it goes through `GET /api/overpass` — direct client-to-Overpass calls never occur

**AC4 — 24h Overpass caching (NFR-SC3)**
Given an Overpass query is proxied through `GET /api/overpass`
When the same bounding box is requested within 24 hours
Then the cached response from the `overpass_cache` Supabase table is returned — no new Overpass API call is made

**AC5 — Unified pin model with source field**
Given all pin sources (BLM/USFS/NPS, Overpass, community)
When a pin is stored in Supabase
Then it follows the unified pin model with `pin_type` indicating its origin
And `source_id` stores the original ID from the source system for deduplication

**AC6 — CartoDB tile fallback (NFR-I3)**
⚠️ **ALREADY IMPLEMENTED** in Story 2.2 via `LeafletMap.tsx:54-59` — `tileerror` handler already switches to OSM fallback.
**No action required for this AC.**

**AC7 — Stale-while-revalidate for offline browsing (NFR-R3)**
Given the map is loaded and the data API is unavailable
When the user browses the map
Then previously cached pin data (TanStack Query stale-while-revalidate) continues to display
And the map remains fully browsable

## Tasks / Subtasks

- [x] Task 1: Create service role Supabase client for API functions (AC1, AC3, AC4)
  - [x] 1.1: Create `api/_supabase.ts` — service role client using `process.env`
  - [x] 1.2: `createServiceClient()` throws on missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` env vars

- [x] Task 2: Create normalization layer (AC1, AC3, AC5)
  - [x] 2.1: Create `api/_normalize.ts` — pure normalization functions (no Supabase, no HTTP calls)
    - `normalizeRidbFacility(facility: RidbFacility) → DbPinInsert | null` — returns null if no lat/lng
    - `normalizeOverpassElement(el: OverpassElement) → DbPinInsert | null` — returns null if no lat/lng
    - Export types: `RidbFacility`, `OverpassElement`, `DbPinInsert`
  - [x] 2.2: Create `api/_normalize.test.ts` — unit tests for both normalizers
    - Test: RIDB facility with known BLM org maps to `pin_type: 'blm'`
    - Test: RIDB facility with USFS org maps to `pin_type: 'usfs'`
    - Test: RIDB facility with NPS org maps to `pin_type: 'nps'`
    - Test: RIDB facility with no lat/lng returns null
    - Test: Overpass `drinking_water` node maps to `amenities.water = true`
    - Test: Overpass `fuel` node maps to `amenities.fuel = true`
    - Test: Overpass node with no lat/lng returns null

- [x] Task 3: Implement `POST /api/sync` (AC1, AC2)
  - [x] 3.1: Fill in `api/sync.ts` — paginate RIDB API, normalize, batch upsert to Supabase
    - Loop pages until `METADATA.RESULTS.CURRENT_COUNT < limit` (page size = 50)
    - Filter to BLM/USFS/NPS facilities only (org IDs: USFS=128, NPS=129, BLM=131)
    - Upsert with conflict resolution on `(source_id, pin_type)`
    - After upsert, flag pins with `updated_at < NOW() - INTERVAL '48 hours'` as `badge_state = 'red'`
    - Return `{ message, synced: count }`
  - [x] 3.2: Create `api/sync.test.ts` — handler tests using `mockReq`/`mockRes` pattern
    - Test: returns 405 for non-POST methods
    - Test: returns 401 without valid Bearer token
    - Test: fetches RIDB, calls Supabase upsert, returns synced count (fetch + supabase mocked)
    - Test: returns 500 on fetch failure with error logged

- [x] Task 4: Implement `GET /api/overpass` (AC3, AC4)
  - [x] 4.1: Fill in `api/overpass.ts` — check cache → fetch Overpass → store → return
    - Accept `?bbox=south,west,north,east` query param
    - Return 400 if bbox is missing or not 4 comma-separated numbers
    - Query `overpass_cache` table: find row where `bbox_key = bbox` AND `cached_at > NOW() - INTERVAL '24 hours'`
    - Cache hit → return `res.status(200).json(row.payload)`
    - Cache miss → POST to Overpass interpreter, upsert to cache, return response
  - [x] 4.2: Create `api/overpass.test.ts`
    - Test: returns 405 for non-GET methods
    - Test: returns 400 when bbox param is missing
    - Test: returns 400 when bbox has fewer than 4 parts
    - Test: returns cached response when cache hit (Supabase mocked)
    - Test: fetches from Overpass and stores in cache when cache miss
    - Test: returns 500 on Overpass fetch failure

- [x] Task 5: Create GitHub Actions workflow (AC1)
  - [x] 5.1: Create `.github/workflows/sync.yml` — daily cron at 2am UTC
    - Schedule: `cron: '0 2 * * *'`
    - Single step: `curl -X POST ${{ secrets.SYNC_URL }} -H "Authorization: Bearer ${{ secrets.ADMIN_SECRET }}"`

- [x] Task 6: TanStack Query stale-while-revalidate config (AC7)
  - [x] 6.1: Update `src/hooks/usePinsQuery.ts` — add `staleTime: 5 * 60 * 1000` (5 minutes)
    - staleTime: data considered fresh for 5 min (no background refetch during that window)
    - No change to gcTime (default 5 min is fine — keeps data in memory for offline browsing)

- [x] Task 7: Validate and close
  - [x] 7.1: `tsc -b && npx tsc -p tsconfig.api.json --noEmit` passes with zero errors
  - [x] 7.2: All tests pass (`npx vitest run`) — no regressions

## Dev Notes

### ⚠️ CRITICAL: What's already done — DO NOT re-implement

**AC6 (CartoDB fallback) is ALREADY LIVE.** `LeafletMap.tsx:54-59` already has:
```typescript
cartoTile.on('tileerror', () => {
  if (map.hasLayer(cartoTile)) {
    cartoTile.remove()
    osmFallback.addTo(map)
  }
})
```
Touch nothing in `LeafletMap.tsx`.

**Pin schema already has `pin_type` and `source_id`.** The Supabase migration `001_create_pins.sql` already defines `pin_type TEXT CHECK (pin_type IN ('blm', 'usfs', 'nps', 'overpass', 'community'))` and `source_id TEXT`. The `Pin` TypeScript interface in `src/types/pin.ts` already has `pinType: PinSource` and `sourceId: string | null`. **Do not modify schema or types.**

### API TypeScript module boundary — CRITICAL

`tsconfig.api.json` (compiled separately from the Vite app):
```json
{
  "compilerOptions": {
    "module": "CommonJS",  // ← Node.js, not ESM
    "include": ["api/**/*.ts"]
  }
}
```

**Consequences:**
- `api/` files CANNOT use `@/` path aliases — no Vite resolution
- `api/` files CANNOT reliably import from `src/` — not in tsconfig include
- `api/` files use `process.env`, NOT `import.meta.env`
- All API utility files follow the `_prefix` convention: `_middleware.ts`, `_supabase.ts`, `_normalize.ts`
- Running `npm run typecheck:api` (`tsc -p tsconfig.api.json --noEmit`) validates the API files separately from the main app

### `api/_supabase.ts` — Service role client

```typescript
import { createClient } from '@supabase/supabase-js'

// Service role client for Vercel serverless functions.
// Uses process.env, NOT import.meta.env (Vite browser convention).
// Vercel makes ALL env vars (including VITE_ prefixed ones) available
// in the serverless function process via process.env.
export function createServiceClient() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key)
}
```

**Important:** Vercel makes all environment variables available as `process.env` in serverless functions, including `VITE_` prefixed variables. The env var name in Vercel Dashboard must match exactly. The RIDB API key is `RIDB_API_KEY`.

### `api/_normalize.ts` — Normalization functions

```typescript
// Types used only within api/ — cannot import from src/types/pin.ts (different tsconfig)

export type PinTypeValue = 'blm' | 'usfs' | 'nps' | 'overpass' | 'community'

export interface DbPinInsert {
  name: string
  description: string | null
  latitude: number
  longitude: number
  pin_type: PinTypeValue
  source_id: string
  max_length_ft: number | null
  max_height_ft: number | null
  amenities: Record<string, boolean>
  badge_state: 'grey'        // All newly synced pins start as grey (no check-ins yet)
  last_check_in_at: null
  recent_check_in_count: 0   // literal 0 for insert
  is_verified: false         // literal false for new sync data
  is_flagged: false
}

// RIDB org → pin_type mapping
// ParentOrgID values from recreation.gov (verify against RIDB API docs if behavior differs):
// 128 = USFS (US Forest Service)
// 129 = NPS  (National Park Service)
// 131 = BLM  (Bureau of Land Management)
const RIDB_ORG_TO_SOURCE: Record<string, PinTypeValue | undefined> = {
  '128': 'usfs',
  '129': 'nps',
  '131': 'blm',
}

export interface RidbFacility {
  FacilityID: string
  FacilityName: string
  FacilityLatitude: number
  FacilityLongitude: number
  FacilityDescription?: string
  ParentOrgID: string
  ACTIVITY?: Array<{ ActivityName: string }>
}

export function normalizeRidbFacility(facility: RidbFacility): DbPinInsert | null {
  if (!facility.FacilityLatitude || !facility.FacilityLongitude) return null

  const pinType = RIDB_ORG_TO_SOURCE[facility.ParentOrgID]
  if (!pinType) return null // Skip unknown orgs

  const activities = (facility.ACTIVITY ?? []).map(a => a.ActivityName.toLowerCase())
  const amenities = {
    overnight: activities.some(a => a.includes('camping') || a.includes('overnight')),
    dump: activities.some(a => a.includes('dump')),
    water: activities.some(a => a.includes('water')),
    fuel: false,
    propane: false,
    electric: activities.some(a => a.includes('electric')),
    shower: activities.some(a => a.includes('shower')),
  }

  return {
    name: facility.FacilityName,
    description: facility.FacilityDescription ?? null,
    latitude: facility.FacilityLatitude,
    longitude: facility.FacilityLongitude,
    pin_type: pinType,
    source_id: facility.FacilityID,
    max_length_ft: null,
    max_height_ft: null,
    amenities,
    badge_state: 'grey',
    last_check_in_at: null,
    recent_check_in_count: 0,
    is_verified: false,
    is_flagged: false,
  }
}

export interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  tags?: Record<string, string>
}

export function normalizeOverpassElement(el: OverpassElement): DbPinInsert | null {
  if (el.lat === undefined || el.lon === undefined) return null

  const tags = el.tags ?? {}
  const amenity = tags['amenity'] ?? ''
  const tourism = tags['tourism'] ?? ''

  const amenities = {
    overnight: tourism === 'camp_site' || tourism === 'caravan_site',
    dump: amenity === 'waste_disposal',
    water: amenity === 'drinking_water',
    fuel: amenity === 'fuel',
    propane: false,
    electric: false,
    shower: amenity === 'shower',
  }

  const name = tags['name'] ?? tags['operator'] ?? `OSM ${el.id}`

  return {
    name,
    description: null,
    latitude: el.lat,
    longitude: el.lon,
    pin_type: 'overpass',
    source_id: String(el.id),
    max_length_ft: null,
    max_height_ft: null,
    amenities,
    badge_state: 'grey',
    last_check_in_at: null,
    recent_check_in_count: 0,
    is_verified: false,
    is_flagged: false,
  }
}
```

### `api/sync.ts` — Implementation guide

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdminAuth } from './_middleware'
import { createServiceClient } from './_supabase'
import { normalizeRidbFacility } from './_normalize'
import type { RidbFacility } from './_normalize'

const RIDB_BASE = 'https://ridb.recreation.gov/api/v1/facilities'
const PAGE_SIZE = 50
// Activity 9 = Camping (verified against RIDB API documentation)
const RIDB_PARAMS = `activity=9&full=true&limit=${PAGE_SIZE}`

interface RidbResponse {
  RECDATA: RidbFacility[]
  METADATA: { RESULTS: { CURRENT_COUNT: number; TOTAL_COUNT: number } }
}

async function fetchRidbPage(offset: number): Promise<RidbResponse> {
  const apiKey = process.env.RIDB_API_KEY
  const url = `${RIDB_BASE}?apikey=${apiKey}&${RIDB_PARAMS}&offset=${offset}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`RIDB API ${res.status}: ${await res.text()}`)
  return res.json() as Promise<RidbResponse>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only', status: 405 })
  }
  if (!requireAdminAuth(req, res)) return

  const supabase = createServiceClient()
  let offset = 0
  let totalSynced = 0

  try {
    while (true) {
      const data = await fetchRidbPage(offset)
      const rows = data.RECDATA
        .map(normalizeRidbFacility)
        .filter((r): r is NonNullable<ReturnType<typeof normalizeRidbFacility>> => r !== null)

      if (rows.length > 0) {
        const { error } = await supabase
          .from('pins')
          .upsert(rows, { onConflict: 'pin_type,source_id' })
        if (error) throw new Error(`Supabase upsert: ${error.message}`)
        totalSynced += rows.length
      }

      if (data.METADATA.RESULTS.CURRENT_COUNT < PAGE_SIZE) break
      offset += PAGE_SIZE
    }

    // Flag stale pins: any pin not updated in the last 48h → badge_state = 'red' (NFR-I1)
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    await supabase
      .from('pins')
      .update({ badge_state: 'red' })
      .lt('updated_at', cutoff)
      .eq('badge_state', 'grey') // Only flag grey pins (don't override green/yellow from real check-ins)

    return res.status(200).json({ message: 'sync complete', synced: totalSynced })
  } catch (error) {
    console.error('[api/sync]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
```

**Note on `onConflict: 'pin_type,source_id'`:** Supabase upsert requires a unique constraint on `(pin_type, source_id)` in the database. The migration `001_create_pins.sql` should have this. If it's missing, you'll need a migration to add it:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_pins_pin_type_source_id ON pins (pin_type, source_id)
  WHERE source_id IS NOT NULL;
```

### `api/overpass.ts` — Implementation guide

**Overpass API endpoint:** `https://overpass-api.de/api/interpreter`
- Method: POST
- Content-Type: `application/x-www-form-urlencoded`
- Body: `data=<urlencoded_query>`

**Overpass QL query template** (replace `{s}`, `{w}`, `{n}`, `{e}` with bbox values):
```
[out:json][timeout:30];
(
  node["amenity"="drinking_water"]({s},{w},{n},{e});
  node["amenity"="waste_disposal"]({s},{w},{n},{e});
  node["amenity"="fuel"]({s},{w},{n},{e});
  node["amenity"="shower"][access!="private"]({s},{w},{n},{e});
  node["tourism"="camp_site"]({s},{w},{n},{e});
  node["tourism"="caravan_site"]({s},{w},{n},{e});
);
out body;
```

**bbox_key format:** The `bbox` query param is `{south},{west},{north},{east}` (standard Leaflet convention). Use the raw bbox string as the `bbox_key` in `overpass_cache`.

```typescript
// Cache TTL — 24 hours in milliseconds
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { ... }

  const bbox = req.query.bbox as string | undefined
  if (!bbox) return res.status(400).json({ error: 'MISSING_BBOX', ... })
  const parts = bbox.split(',')
  if (parts.length !== 4 || parts.some(isNaN as (v: unknown) => v is never)) {
    return res.status(400).json({ error: 'INVALID_BBOX', ... })
  }

  const supabase = createServiceClient()

  // Check cache
  const { data: cached } = await supabase
    .from('overpass_cache')
    .select('payload, cached_at')
    .eq('bbox_key', bbox)
    .single()

  if (cached) {
    const ageMs = Date.now() - new Date(cached.cached_at).getTime()
    if (ageMs < CACHE_TTL_MS) {
      return res.status(200).json(cached.payload)
    }
  }

  // Cache miss or stale — fetch from Overpass
  const [s, w, n, e] = parts
  const query = buildOverpassQuery(s, w, n, e)
  const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  })
  if (!overpassRes.ok) throw new Error(`Overpass ${overpassRes.status}`)
  const payload = await overpassRes.json()

  // Upsert to cache (insert or replace on bbox_key conflict)
  await supabase
    .from('overpass_cache')
    .upsert({ bbox_key: bbox, payload, cached_at: new Date().toISOString() }, { onConflict: 'bbox_key' })

  return res.status(200).json(payload)
}
```

### API Testing Pattern (follow `_middleware.test.ts`)

```typescript
// api/sync.test.ts — use vi.mock for fetch and supabase
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function mockReq(method = 'POST', headers = {}): VercelRequest {
  return { method, headers } as unknown as VercelRequest
}

function mockRes() {
  const ctx = { statusCode: null as number | null, body: null as unknown }
  const res = {
    status(code: number) { ctx.statusCode = code; return res },
    json(data: unknown) { ctx.body = data },
  } as unknown as VercelResponse
  return { res, ctx }
}

// Mock global fetch
vi.stubGlobal('fetch', vi.fn())

// Mock the _supabase module
vi.mock('./_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        lt: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      }),
    }),
  })),
}))
```

### GitHub Actions workflow (`.github/workflows/sync.yml`)

```yaml
name: Daily Data Sync

on:
  schedule:
    - cron: '0 2 * * *'  # 2am UTC daily
  workflow_dispatch:      # Allow manual trigger from GitHub UI

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger sync API
        run: |
          curl -f -X POST "${{ secrets.SYNC_URL }}" \
            -H "Authorization: Bearer ${{ secrets.ADMIN_SECRET }}"
```

**`workflow_dispatch`** allows manual triggering from GitHub Actions UI — useful for testing without waiting for 2am. Add it alongside the schedule trigger.

### `usePinsQuery.ts` — staleTime enhancement

```typescript
export function usePinsQuery({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['pins'],
    queryFn: getAllPins,
    enabled,
    staleTime: 5 * 60 * 1000,  // 5 min — don't refetch if pins fetched within last 5 min
    // gcTime: default 5 min — data stays in cache for background tab / offline scenarios
  })
}
```

TanStack Query's stale-while-revalidate: with `staleTime`, even if stale, the component renders immediately with cached data while a background refetch is triggered. With default `gcTime: 5min`, the cache is garbage collected after 5 min of no active subscribers — meaning the map remains fully browsable for 5 min after losing connectivity.

### Environment Variables Required

All env vars must be set in Vercel Dashboard and GitHub Actions Secrets:

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Vercel (all envs) | Supabase project URL — used by both client and API |
| `VITE_SUPABASE_ANON_KEY` | Vercel (all envs) | Supabase anon key — client reads |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (all envs) | Supabase service role — API writes |
| `ADMIN_SECRET` | Vercel + GitHub Secrets | Bearer token for admin endpoints |
| `SYNC_URL` | GitHub Secrets | Full URL to `POST /api/sync` endpoint |
| `RIDB_API_KEY` | Vercel (all envs) | Free API key from recreation.gov |

**`RIDB_API_KEY` registration:** Free at https://ridb.recreation.gov — sign up with email, get key instantly.

### Supabase unique constraint requirement

`api/sync.ts` uses `upsert` with `onConflict: 'pin_type,source_id'`. This requires a unique constraint in Supabase. Check if `001_create_pins.sql` has:
```sql
CREATE UNIQUE INDEX idx_pins_pin_type_source_id ON pins (pin_type, source_id)
  WHERE source_id IS NOT NULL;
```

If the migration doesn't include this index, add it as a new migration file `005_add_pin_type_source_id_unique.sql` before running `api/sync.ts`.

### Project Structure Notes

Files to CREATE:
- `api/_supabase.ts` — Service role Supabase client
- `api/_normalize.ts` — RIDB + Overpass normalization functions
- `api/_normalize.test.ts` — Normalization unit tests
- `api/sync.test.ts` — Sync handler tests
- `api/overpass.test.ts` — Overpass proxy tests
- `.github/workflows/sync.yml` — GitHub Actions cron

Files to MODIFY:
- `api/sync.ts` — Fill in TODO (currently skeleton)
- `api/overpass.ts` — Fill in TODO (currently skeleton)
- `src/hooks/usePinsQuery.ts` — Add `staleTime`

Files NOT to touch:
- `LeafletMap.tsx` — CartoDB fallback already implemented (AC6 done)
- `src/types/pin.ts` — `PinSource`, `Pin` already correct — no changes needed
- `src/lib/supabase/types.ts` — `DbPin` already correct — no changes
- `src/lib/supabase/client.ts` — client-side anon key client — no changes
- `api/_middleware.ts` — Bearer auth already correct
- `src/lib/pin-model/` — Leave empty; normalize logic lives in `api/_normalize.ts` for tsconfig isolation

### References

- Story requirements: [epics.md — Epic 2, Story 2.4](_bmad-output/planning-artifacts/epics.md)
- Architecture data pipeline: [architecture.md#Data Architecture](_bmad-output/planning-artifacts/architecture.md)
- Architecture API routes table: [architecture.md#API & Communication Patterns](_bmad-output/planning-artifacts/architecture.md)
- Architecture GitHub Actions cron: [architecture.md#CI/CD](_bmad-output/planning-artifacts/architecture.md)
- Architecture env vars: [architecture.md#Environment Variables](_bmad-output/planning-artifacts/architecture.md)
- Pin type definition: `overnighter/src/types/pin.ts`
- DB types (snake_case): `overnighter/src/lib/supabase/types.ts`
- Existing Supabase client (anon): `overnighter/src/lib/supabase/client.ts`
- Admin middleware pattern: `overnighter/api/_middleware.ts` + `_middleware.test.ts`
- Existing sync skeleton: `overnighter/api/sync.ts`
- Existing overpass skeleton: `overnighter/api/overpass.ts`
- RIDB API docs: https://ridb.recreation.gov/docs
- Overpass API docs: https://wiki.openstreetmap.org/wiki/Overpass_API
- Previous story: [2-3-recency-badge-display.md](_bmad-output/implementation-artifacts/2-3-recency-badge-display.md)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- AC6 (CartoDB fallback) was already implemented in Story 2.2 — no action taken.
- `vi.mock('./_middleware')` does not intercept correctly when Vitest runs from parent directory; workaround: use real `requireAdminAuth` by passing valid Bearer token in test request headers.
- `vi.mock('@supabase/supabase-js')` doesn't intercept the actual `createClient` import in `_supabase.ts`; tests assert behavior (return value + throw) instead of spy calls.
- All 7 new API files use `vi.hoisted()` for mock variables referenced in `vi.mock()` factories (Vitest hoisting requirement).
- `STUB_PIN` in MapView.test.tsx required all 13 `Pin` fields after `pin.ts` type was expanded in a prior story.
- `sync.yml` was already created; no action taken for Task 5.

### File List

- `api/_supabase.ts` — CREATED
- `api/_supabase.test.ts` — CREATED (3 tests)
- `api/_normalize.ts` — CREATED
- `api/_normalize.test.ts` — CREATED (21 tests)
- `api/sync.ts` — MODIFIED (TODO filled in)
- `api/sync.test.ts` — CREATED (7 tests)
- `api/overpass.ts` — MODIFIED (TODO filled in)
- `api/overpass.test.ts` — CREATED (8 tests)
- `src/hooks/usePinsQuery.ts` — MODIFIED (staleTime added)
- `src/features/map/MapView.test.tsx` — MODIFIED (STUB_PIN fields completed)
- `supabase/migrations/005_add_pin_type_source_id_unique.sql` — CREATED (code-review fix H1)
- `src/api/overpass.ts` — CREATED (code-review fix M2)

### Code Review Fixes Applied
- **H1**: Added `005_add_pin_type_source_id_unique.sql` — unique index on `(pin_type, source_id)` required for sync upsert
- **H2**: `sync.ts` upsert now strips status fields (`badge_state`, `last_check_in_at`, etc.) so existing pins' badge state is never overwritten by sync
- **H3**: `sync.ts` upsert now adds `updated_at: now` so stale detection resets correctly on each sync
- **M1**: Added 2 tests to `sync.test.ts` — verify upsert excludes status fields and stale-pin update is called with correct cutoff/filter
- **M2**: Created `src/api/overpass.ts` — typed client-side wrapper calling `/api/overpass` (architecture compliance)
- **M3**: Fixed bbox validation in `overpass.ts` — `p.trim() === ''` catches empty string segments
- **L1**: Supabase cache read now destructures `error`, logs unexpected errors (skips PGRST116 = no rows)
