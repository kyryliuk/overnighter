# Story 6.5: ML Batch Scan Pipeline & Monthly Cron

Status: done

## Story

As the system,
I want an admin-protected chunked ML scan endpoint triggered by a monthly GitHub Actions cron to scan the Florida Keys bounding box for water tap locations,
So that new publicly accessible water taps are automatically discovered and added to the map without manual data entry.

## Acceptance Criteria

### AC 1 — Bearer token authorization (NFR-S5)

**Given** `POST /api/ml-scan` is called without a valid `Authorization: Bearer <ADMIN_SECRET>` header
**When** the middleware processes the request
**Then** the function returns `{ "error": "UNAUTHORIZED", "status": 401 }` and performs no scan

### AC 2 — Overpass enumeration within bbox (FR39)

**Given** a valid Bearer token and a request body `{ bbox: { north, south, east, west } }` with `?offset=0&limit=50`
**When** `/api/ml-scan` runs
**Then** it queries the OpenStreetMap Overpass API (server-side proxy) for `amenity=fuel`, `amenity=campsite`, and `tourism=camp_site` nodes within the bounding box
**And** the Overpass response is fetched server-side — no client-to-Overpass calls occur (NFR-I2)

### AC 3 — Photo fetching with Mapillary/Google Places fallback (FR40, NFR-ML4)

**Given** the Overpass enumeration returns locations
**When** the pipeline processes each location in the offset/limit window
**Then** for each location, up to 5 street-level photos are fetched: Mapillary queried first; Google Places Photos API used as fallback when Mapillary coverage is insufficient
**And** a server-side delay is applied between external API calls to stay within published rate limits (NFR-ML4)

### AC 4 — ML inference per photo (FR41)

**Given** photos are fetched for a location
**When** each photo is processed
**Then** it is sent to `classifyImageUrl()` from `api/_sagemaker.ts` and the returned confidence (0.0–1.0) is recorded per photo per location

### AC 5 — DB write when confidence ≥0.75 (FR42, FR43, FR44)

**Given** at least one photo for a location returns confidence ≥0.75
**When** the scan writes results
**Then** a `water_tap_pins` row is upserted with: location coordinates, place name, place type, `access = NULL` (unverified at creation), highest-confidence photo URL, confidence score, `source = 'ml_batch'`, scan timestamp, and `place_ref` (OSM node ID for business location linking)
**And** a `tap_verification_events` row is appended with `event_type = 'ml_scan'` and the confidence score

### AC 6 — Skip locations below threshold

**Given** a location where all photos score below 0.75
**When** the scan processes that location
**Then** no `water_tap_pins` row is created or modified for that location

### AC 7 — Chunked response contract

**Given** the scan for an offset/limit window completes
**When** the response is returned
**Then** it includes `{ processed: <n>, created: <n>, updated: <n>, skipped: <n>, nextOffset: <offset + limit> }`
**And** when `processed < limit`, the GitHub Actions loop terminates (all locations exhausted)

### AC 8 — GitHub Actions ml-scan job (NFR-ML3, NFR-ML5)

**Given** the GitHub Actions `sync.yml` workflow
**When** a developer reviews it
**Then** a new `ml-scan` job is defined triggered by cron `0 3 1 * *` (1st of month, 3am UTC) (NFR-ML3)
**And** the job calls `POST /api/ml-scan` sequentially at offset 0, 50, 100… (using `ML_SCAN_URL` + `ADMIN_SECRET` from repository secrets) until `processed < limit`
**And** the existing daily BLM/USFS/NPS sync job is unchanged
**And** neither `ML_SCAN_URL` nor `ADMIN_SECRET` appear as `VITE_` variables (NFR-ML5)

### AC 9 — Rate limit errors skip location, do not fail pipeline (NFR-ML4)

**Given** an API provider (Mapillary or Google Places) returns a rate limit error during a scan
**When** the pipeline handles the error
**Then** the current location is skipped and logged — the pipeline does not fail entirely, and no data loss occurs for other locations

### AC 10 — Precision gate preserved (NFR-ML2)

**Given** the precision gate has not been passed (`PRECISION_GATE_PASSED !== "true"`)
**When** a POST request is made to `/api/ml-scan`
**Then** the endpoint returns `{ "error": "PRECISION_GATE_BLOCKED" }` with 403 and writes zero records

---

## Tasks / Subtasks

- [x] Task 1: Implement admin auth + precision gate in `api/ml-scan.ts` (AC: 1, 10)
  - [x] 1.1 Add `requireAdminAuth` import from `./_middleware` — return 401 if unauthorized
  - [x] 1.2 Keep `PRECISION_GATE_PASSED` check (403 if not set) from Story 6.2 stub
  - [x] 1.3 Parse `?offset=N&limit=50` query params with defaults (offset=0, limit=50)
  - [x] 1.4 Parse and validate `{ bbox: { north, south, east, west } }` from request body — return 400 if missing

- [x] Task 2: Implement Overpass enumeration (AC: 2)
  - [x] 2.1 Export `buildMlScanOverpassQuery(bbox)` — queries `amenity=fuel`, `amenity=campsite`, `tourism=camp_site` nodes
  - [x] 2.2 Export `fetchOverpassLocations(bbox)` — server-side POST to Overpass API, returns parsed node list
  - [x] 2.3 Apply offset/limit slicing to returned node list for chunked processing

- [x] Task 3: Implement photo fetching (AC: 3, 9)
  - [x] 3.1 Export `fetchMapillaryPhotos(lat, lon)` — calls Mapillary v4 API with bbox around location, returns up to 5 photo URLs; skips + logs on 429 rate-limit error
  - [x] 3.2 Export `fetchGooglePlacesPhotos(lat, lon)` — calls Google Places Nearby Search + photo URL construction; skips + logs on 429
  - [x] 3.3 Export `fetchPhotosForLocation(lat, lon)` — Mapillary first, Google Places fallback if < 5 photos
  - [x] 3.4 Export `delay(ms)` — 200ms server-side delay between external API calls (NFR-ML4)

- [x] Task 4: Implement ML inference + confidence recording (AC: 4)
  - [x] 4.1 For each photo URL, call `classifyImageUrl(url)` from `api/_sagemaker.ts`
  - [x] 4.2 Track highest confidence score and corresponding photo URL across all photos for a location
  - [x] 4.3 Log + skip individual photo classify errors without failing the whole location

- [x] Task 5: Implement DB upsert logic (AC: 5, 6)
  - [x] 5.1 Skip location entirely if highest confidence < 0.75 (no DB writes)
  - [x] 5.2 Check for existing `water_tap_pins` row by `place_ref` (OSM node ID format: `osm:node:<id>`)
  - [x] 5.3 If existing: UPDATE `confidence`, `photos[]`, `updated_at`, `verified_date`; INSERT `tap_verification_events` row
  - [x] 5.4 If new: INSERT `water_tap_pins` with all required fields (`access=NULL`, `source='ml_batch'`); INSERT `tap_verification_events` row
  - [x] 5.5 Return `{ processed, created, updated, skipped, nextOffset }` response (AC: 7)

- [x] Task 6: Create `.github/workflows/sync.yml` with ml-scan job (AC: 8)
  - [x] 6.1 Add `schedule` with both `0 2 * * *` (daily BLM/USFS/NPS, unchanged) and `0 3 1 * *` (monthly ML scan)
  - [x] 6.2 `sync-gov` job: copy from `sync-gov.yml` verbatim, unchanged, with `if: github.event.schedule == '0 2 * * *'` guard
  - [x] 6.3 `ml-scan` job: exact shell loop from architecture doc using `ML_SCAN_URL` + `ADMIN_SECRET` secrets
  - [x] 6.4 Verify no `VITE_` prefix on any secret references (NFR-ML5)

- [x] Task 7: Comprehensive unit tests for `api/ml-scan.ts` (AC: 1–10)
  - [x] 7.1 Auth tests: missing token → 401; wrong token → 401; valid token passes
  - [x] 7.2 Precision gate tests: no env var → 403; `false` → 403; `true` passes
  - [x] 7.3 Bbox validation tests: missing bbox → 400; invalid bbox → 400; valid bbox accepted
  - [x] 7.4 Overpass query builder tests: `buildMlScanOverpassQuery` produces correct node types and bbox
  - [x] 7.5 Photo fetching tests: Mapillary primary, Google Places fallback, rate-limit skip behavior
  - [x] 7.6 Confidence threshold tests: ≥0.75 creates DB rows; <0.75 skips; highest confidence tracked
  - [x] 7.7 DB upsert tests: new pin creates both `water_tap_pins` + `tap_verification_events`; existing pin updates
  - [x] 7.8 Response shape tests: `{ processed, created, updated, skipped, nextOffset }` matches contract
  - [x] 7.9 Error resilience tests: API errors logged + location skipped; pipeline continues for other locations

---

## Dev Notes

### Architecture Context

- **Extends Story 6.2 `api/ml-scan.ts`** — replace the stub 200 response with full pipeline logic; keep the precision gate and 405 guard.
- **Bearer token auth** — `requireAdminAuth(req, res)` from `api/_middleware.ts` returns `false` (and writes 401) if invalid. Pattern used in `api/sync-gov.ts`.
- **Overpass server-side proxy pattern** — `api/overpass.ts` shows the POST-to-Overpass pattern. Story 6.5 builds its own query (different node types: `amenity=fuel`, `amenity=campsite`, `tourism=camp_site`) and does NOT use the overpass cache (batch scan always wants fresh data).
- **`classifyImageUrl(url)`** — imported from `api/_sagemaker.ts` (Story 6.2). Accepts a publicly accessible URL, returns `{ confidence: 0.0–1.0 }`. May throw on SageMaker errors.
- **Supabase client** — `createServiceClient()` from `api/_supabase.ts`. Service role bypasses RLS.
- **`water_tap_pins` geography insert** — use WKT format: `SRID=4326;POINT(<lon> <lat>)` (lon before lat per PostGIS convention). `place_ref` pattern: `osm:node:<osmId>`.
- **NFR-ML4 rate limit compliance** — 200ms delay between all external API calls (Mapillary, Google Places, SageMaker). Use `setTimeout`-based `delay()` helper.
- **NFR-ML5** — `MAPILLARY_ACCESS_TOKEN`, `GOOGLE_PLACES_API_KEY`, `ML_SCAN_URL`, `ADMIN_SECRET` are server-only. No `VITE_` prefix anywhere.
- **sync.yml** — The existing BLM/USFS/NPS job lives in `.github/workflows/sync-gov.yml` with cron `0 2 * * *`. The story spec calls for a new `.github/workflows/sync.yml` containing BOTH the daily sync-gov job pattern AND the new ml-scan job. Use `if: github.event.schedule == '0 2 * * *'` guard on sync-gov and `if: github.event.schedule == '0 3 1 * *'` on ml-scan.

### API Reference

**Mapillary v4 Images endpoint:**
```
GET https://graph.mapillary.com/images
  ?access_token=<MAPILLARY_ACCESS_TOKEN>
  &fields=id,thumb_original_url
  &bbox=<west>,<south>,<east>,<north>
  &limit=5
Response: { data: [{ id, thumb_original_url }, ...] }
```

**Google Places Nearby Search (legacy):**
```
GET https://maps.googleapis.com/maps/api/place/nearbysearch/json
  ?location=<lat>,<lon>&radius=50&key=<GOOGLE_PLACES_API_KEY>
Photo URL: https://maps.googleapis.com/maps/api/place/photo
  ?maxwidth=800&photo_reference=<ref>&key=<key>
```

**Overpass query for ML scan (different from `api/overpass.ts` which queries water/dump/etc):**
```
[out:json][timeout:60];
(
  node["amenity"="fuel"](<south>,<west>,<north>,<east>);
  node["amenity"="campsite"](<south>,<west>,<north>,<east>);
  node["tourism"="camp_site"](<south>,<west>,<north>,<east>);
);
out body;
```

### Key Env Vars (all server-only, never VITE_)

| Variable | Purpose |
|---|---|
| `ADMIN_SECRET` | Bearer token for admin-protected endpoints |
| `PRECISION_GATE_PASSED` | `"true"` after model validation passes |
| `MAPILLARY_ACCESS_TOKEN` | Mapillary v4 API access token |
| `GOOGLE_PLACES_API_KEY` | Google Places API key for photo fallback |
| `SAGEMAKER_ENDPOINT_URL` | SageMaker endpoint (used by `_sagemaker.ts`) |

### Test Framework

- Tests run with `vitest` — use `vi.hoisted`, `vi.mock` pattern (see `api/sync-gov.test.ts`, `api/checkin.test.ts`)
- Mock `fetch` globally with `vi.stubGlobal('fetch', vi.fn())`
- Mock `_supabase`, `_middleware`, `_sagemaker` modules
- Existing 5 tests in `api/ml-scan.test.ts` from Story 6.2 must still pass (405, 3× precision gate, 200 stub) — or be updated for the new full implementation

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 6.5`] — Full acceptance criteria
- [Source: `_bmad-output/planning-artifacts/architecture.md#ML Pipeline Extension`] — GitHub Actions shell loop, chunking contract
- [Source: `api/overpass.ts`] — Server-side Overpass proxy pattern
- [Source: `api/_middleware.ts`] — `requireAdminAuth` Bearer token pattern
- [Source: `api/_sagemaker.ts`] — `classifyImageUrl` utility
- [Source: `api/sync-gov.ts`] — Admin auth + sync pattern
- [Source: `api/ml-scan.ts`] — Story 6.2 stub to extend
- [Source: `.github/workflows/sync-gov.yml`] — Existing daily sync job to preserve

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5 (2025)

### Debug Log References

### Completion Notes List

- `api/ml-scan.ts` — FULL PIPELINE IMPLEMENTED (replaces Story 6.2 stub). Exports: `CONFIDENCE_THRESHOLD`, `RATE_LIMIT_DELAY_MS`, `MAX_PHOTOS_PER_LOCATION`, `delay`, `buildMlScanOverpassQuery`, `fetchOverpassLocations`, `fetchMapillaryPhotos`, `fetchGooglePlacesPhotos`, `fetchPhotosForLocation`, `BBox`, `OverpassNode`, `ScanResult`. Handler: 405 guard → 401 auth (requireAdminAuth) → 403 precision gate → 400 bbox validation → Overpass query → per-location photo fetch → SageMaker classify → DB upsert. Returns `{ processed, created, updated, skipped, nextOffset }`.
- `api/ml-scan.test.ts` — REPLACED: 56 tests across 13 describe blocks covering all 10 ACs: constants, delay(), buildMlScanOverpassQuery, fetchOverpassLocations (POST pattern, filter, error), fetchMapillaryPhotos (token guard, results, cap, 429, network error, missing field), fetchGooglePlacesPhotos (key guard, results, cap, 429, network error, empty), fetchPhotosForLocation (Mapillary primary, fallback, combine, empty), auth (401 guard), precision gate (3 cases), bbox validation (4 cases), chunked response (offset/limit, field shape, processed<limit), DB write ≥0.75 (new pin + event), DB write existing (update + event), skip <0.75 (2 cases), error resilience (3 cases), place_type mapping (3 cases), NFR-ML5 source scan.
- `.github/workflows/sync.yml` — NEW FILE. Combines: (1) `sync-gov` job (unchanged daily BLM/USFS/NPS sync, cron `0 2 * * *`, guarded by `if: github.event.schedule == '0 2 * * *'`) + (2) `ml-scan` job (monthly, cron `0 3 1 * *`, uses exact shell loop from architecture doc, `ML_SCAN_URL` + `ADMIN_SECRET` secrets, `jq` for processing count). No VITE_ prefix anywhere.
- NOTE: `sync-gov.yml` remains UNCHANGED. `sync.yml` is a new combined file as specified in the story AC.
- NOTE: Pre-existing TypeScript errors in `api/_multipart.ts` (formidable types) are unrelated to Story 6.5.
- TESTS: 1337 tests passing across 112 test files (0 regressions).

### File List

- `api/ml-scan.ts` — MODIFIED (full pipeline replacing 6.2 stub)
- `api/ml-scan.test.ts` — MODIFIED (62-test suite replacing 5-test stub; +6 tests added during code review)
- `.github/workflows/sync.yml` — NEW (combined daily sync + monthly ml-scan job)
- `_bmad-output/implementation-artifacts/6-5-ml-batch-scan-pipeline-and-monthly-cron.md` — MODIFIED

### Change Log

- Story 6.5 implementation (2026-05-01): Full ML batch scan pipeline implemented in `api/ml-scan.ts`; `sync.yml` created with ml-scan cron job; 56-test suite added covering all 10 ACs.
- Story 6.5 code review (2026-05-01): Fixed 7 issues (2 HIGH, 3 MEDIUM, 2 LOW). Tests expanded from 56 → 62. All 1344 project tests passing.

---

## Senior Developer Review (AI)

**Reviewer:** claude-sonnet-4-5 (2025)
**Review Date:** 2026-05-01
**Story:** 6-5-ml-batch-scan-pipeline-and-monthly-cron
**Git vs Story Discrepancies:** 0
**Issues Found:** 2 High, 3 Medium, 2 Low — all fixed

### Task Completion Audit

- [x] **Task 1** — Auth gate (`requireAdminAuth`), precision gate (`PRECISION_GATE_PASSED === 'true'`), bbox validation confirmed at `api/ml-scan.ts:206–237`
- [x] **Task 2** — `buildMlScanOverpassQuery`, `fetchOverpassLocations` confirmed at `api/ml-scan.ts:55–83`; POST to `https://overpass-api.de/api/interpreter` with encoded `data=` body
- [x] **Task 3** — `fetchMapillaryPhotos`, `fetchGooglePlacesPhotos`, `fetchPhotosForLocation`, `delay` confirmed at `api/ml-scan.ts:89–193`
- [x] **Task 4** — Classification loop tracking `highestConfidence` / `highestPhotoUrl` confirmed at `api/ml-scan.ts:270–291`
- [x] **Task 5** — `maybeSingle()` lookup by `place_ref`, branch INSERT (new) / UPDATE (existing) + `tap_verification_events` INSERT confirmed at `api/ml-scan.ts:299–368`
- [x] **Task 6** — `.github/workflows/sync.yml` created; sync-gov job (daily `0 2 * * *`) + ml-scan job (monthly `0 3 1 * *`) with architecture shell loop; `workflow_dispatch` support on both jobs
- [x] **Task 7** — 62 unit tests covering all 10 ACs and all new constants; 1344/1344 total tests passing

### Issues Found and Fixed

#### 🔴 HIGH — Fixed

**[CR-6.5-H1] Google Places API key persisted in DB** (`api/ml-scan.ts:151`)

*Problem:* `fetchGooglePlacesPhotos` constructs photo URLs containing `&key=${GOOGLE_PLACES_API_KEY}`. When these URLs become `highestPhotoUrl` they were being stored in `water_tap_pins.photos[]` and `tap_verification_events.photo_url`, persisting the server-side API key in the database and exposing it to any client that reads those columns.

*Fix:* Added `highestPhotoIsSafe` boolean (false when URL contains `maps.googleapis.com/maps/api/place/photo`). Introduced `storedPhotoUrl = highestPhotoIsSafe ? highestPhotoUrl : ''`. DB writes use `storedPhotoUrl` — Google Places URLs are used for SageMaker classification only, never stored. Two new tests added: `Security: Google Places API key not persisted in DB`.

**[CR-6.5-H2] No cap on `limit` query parameter** (`api/ml-scan.ts:220`)

*Problem:* `?limit=10000` would attempt to fetch and process 10,000 locations in a single request, bypassing the intended chunking design.

*Fix:* Added `MAX_LOCATIONS_PER_INVOCATION = 200` constant. Changed limit parsing to `Math.min(MAX_LOCATIONS_PER_INVOCATION, Math.max(1, parseInt(rawLimit) || 50))`. New test added: `caps limit at MAX_LOCATIONS_PER_INVOCATION (200)`.

#### 🟡 MEDIUM — Fixed

**[CR-6.5-M3] `delay()` called even when API tokens absent** (`api/ml-scan.ts:169,177`)

*Problem:* `fetchPhotosForLocation` called `delay(200ms)` unconditionally after both `fetchMapillaryPhotos` and `fetchGooglePlacesPhotos`, even when those functions returned immediately due to missing tokens (making 0 API calls). This wasted 400ms/location in dev/test environments and was misleading (delays should only rate-limit actual API calls).

*Fix:* Changed to `if (process.env.MAPILLARY_ACCESS_TOKEN) await delay(RATE_LIMIT_DELAY_MS)` and `if (process.env.GOOGLE_PLACES_API_KEY) await delay(RATE_LIMIT_DELAY_MS)`. Delays now only fire when a real API call was made.

**[CR-6.5-M4] `rateLimitResponse()` test helper — dead code** (`api/ml-scan.test.ts:161`)

*Problem:* `rateLimitResponse()` helper was defined but never called anywhere in the test suite — residue from an earlier iteration. Dead code increases maintenance surface.

*Fix:* Removed the helper function.

**[CR-6.5-M5] Confidence values not clamped before DB insert** (`api/ml-scan.ts:270`)

*Problem:* `classifyImageUrl` return value was used directly without validation. DB schema has `NUMERIC(3,2) CHECK BETWEEN 0.00 AND 1.00` — a value outside [0,1] would fail the constraint at the DB level, and though this would be caught by the per-location try/catch (incrementing `skipped`), the pin would be lost rather than safely stored.

*Fix:* Added `const safeConfidence = Math.min(1.0, Math.max(0.0, confidence))` before comparison. All confidence comparisons and DB writes use `safeConfidence`. New test: `Confidence clamping before DB write`.

#### 🟢 LOW — Fixed

**[CR-6.5-L6] `'ml_batch_cron'` magic string used in 4 locations** (`api/ml-scan.ts:317,320,343,348`)

*Problem:* `device_id: 'ml_batch_cron'` was repeated literally in both the UPDATE and INSERT event paths. A typo or inconsistency would create orphaned records that don't match ML batch query patterns.

*Fix:* Extracted to exported constant `ML_BATCH_DEVICE_ID = 'ml_batch_cron'`. All 4 usages now reference the constant. Constant test added.

**[CR-6.5-L7] `ml-scan` GitHub Actions job had no `workflow_dispatch` support** (`.github/workflows/sync.yml:33`)

*Problem:* The `if: github.event.schedule == '0 3 1 * *'` condition meant the ml-scan job could never be triggered manually, making integration testing and emergency reruns impossible.

*Fix:* Changed condition to `github.event.schedule == '0 3 1 * *' || github.event_name == 'workflow_dispatch'`.

### All Acceptance Criteria Verified

| AC | Description | Verified At |
|---|---|---|
| AC 1 | Bearer token 401 gate | `api/ml-scan.ts:206` + 2 tests |
| AC 2 | Overpass enumeration with bbox | `api/ml-scan.ts:55–83` + 4 tests |
| AC 3 | Mapillary → Google Places photo fetch | `api/ml-scan.ts:89–193` + 11 tests |
| AC 4 | SageMaker classify per photo, highest confidence | `api/ml-scan.ts:270–291` + 1 test |
| AC 5 | DB upsert ≥0.75 (new + existing paths) | `api/ml-scan.ts:299–368` + 5 tests |
| AC 6 | Skip <0.75 threshold | `api/ml-scan.ts:293–295` + 2 tests |
| AC 7 | Chunked response shape + offset/limit | `api/ml-scan.ts:217–224,362–370` + 5 tests |
| AC 8 | Env vars server-only (NFR-ML5) | `api/ml-scan.ts` (all process.env) + 1 test |
| AC 9 | Error resilience (per-location catch) | `api/ml-scan.ts:354–357` + 3 tests |
| AC 10 | Precision gate 403 | `api/ml-scan.ts:208–213` + 3 tests |

### Final Test Count

- ml-scan.test.ts: **62 tests** (56 implementation + 6 code review additions)
- Full suite: **1344/1344 tests passing** across 112 test files (0 regressions)

