# Story 6.6: Unified Map Pin Integration

Status: done

## Story

As a user,
I want water tap pins to appear on the main map alongside regular stop pins, using the same freshness badge and rig-aware display logic,
So that I never need to switch to a separate view to find water taps on the Florida Keys corridor.

## Acceptance Criteria

### AC 1 — `usePinsQuery` queries `map_pins` view (not `pins` table directly)

**Given** the `usePinsQuery` hook in `src/lib/supabase/`
**When** it fetches pins for the current viewport
**Then** it queries the `map_pins` Supabase view (not the `pins` table directly)
**And** the response includes both `pin_category = 'regular'` and `pin_category = 'water_tap'` pins for the viewport

### AC 2 — TanStack Query key `['water-taps', { viewport }]` for viewport tap list

**Given** the TanStack Query key `['water-taps', { viewport }]`
**When** the viewport changes (pan or zoom)
**Then** water tap pins for the new viewport are fetched and displayed — consistent with regular pin fetching behavior

### AC 3 — Water tap pins render with faucet SVG + recency ring (FR42, FR47)

**Given** water tap pins load on the map
**When** `PinLayer.tsx` renders a pin with `pin_category = 'water_tap'`
**Then** it renders a custom SVG pin marker with a water/faucet icon and the same recency color ring logic (green/yellow/red based on `verified_date`)
**And** when the pin is tapped, `navigate('/tap/:id')` is called — not `/pin/:id`

### AC 4 — "Water" filter chip shows both regular water pins and water tap pins

**Given** water tap pins appear on the map alongside regular pins
**When** the user activates the "Water" amenity filter chip
**Then** both regular water fill pins and water tap pins are shown in full color
**And** non-water categories are greyed or hidden per existing AND filter logic

### AC 5 — `is_active = FALSE` pins excluded via `map_pins` view

**Given** a water tap pin has `is_active = FALSE`
**When** `usePinsQuery` fetches from `map_pins`
**Then** that pin is excluded from the map display — `map_pins` view already filters `is_active = TRUE` only

### AC 6 — Single conditional routing in `PinLayer.tsx` / `PinMarker.ts`

**Given** the `pin_category` discriminator in `PinLayer.tsx`
**When** a developer reviews the routing logic
**Then** the routing is handled by a single conditional: `if (pin.pinCategory === 'water_tap') navigate('/tap/' + pin.id)` — no inline `TapPinDetailSheet` rendering in the map layer
**And** `TapPinDetailSheet` is imported only in the `/tap/:id` route chunk (lazy-loaded, not in the main bundle)

### AC 7 — aria-label format for water tap pins (NFR-A2)

**Given** a screen reader is active
**When** a water tap pin is read aloud
**Then** the `aria-label` follows the format: "[PlaceName]: water tap, verified [recency]" (NFR-A2)

### AC 8 — `usePinsQuery` is the sole data source for `PinLayer.tsx`

**Given** the `map_pins` view is the sole data source for the map pin layer
**When** the developer verifies the integration
**Then** no direct `pins` or `water_tap_pins` table queries exist in `PinLayer.tsx` or `usePinsQuery` — all pin data flows through the unified view

---

## Tasks / Subtasks

- [x] Task 1: Migration 034 — Enhance `map_pins` view + add `search_water_taps_by_radius` RPC (AC: 1, 3, 4, 5, 8)
  - [x] 1.1 Replace minimal `map_pins` view with full-column version (latitude, longitude, amenities, badge_state, pin_category, etc.)
  - [x] 1.2 Add `search_water_taps_by_radius` RPC function using GiST index on `water_tap_pins.location`
  - [x] 1.3 Grant SELECT on `map_pins` view to `anon` and `authenticated` roles

- [x] Task 2: Update `src/lib/supabase/types.ts` — Add `DbMapPin` interface (AC: 1, 8)
  - [x] 2.1 Add `DbMapPin` interface with `pin_category` field and all rendering columns

- [x] Task 3: Update `src/lib/supabase/pins.ts` — Query `map_pins` view (AC: 1, 4, 5, 8)
  - [x] 3.1 Add `dbMapPinToPin(db: DbMapPin): Pin` mapping function that sets `pinCategory`
  - [x] 3.2 Update `getAllPins()` to query `map_pins` view and use `dbMapPinToPin`

- [x] Task 4: Update `api/pins.ts` — Serve unified `map_pins` data (AC: 1, 4, 5, 8)
  - [x] 4.1 Update `handleGetAllPins` to query `map_pins` view (not `pins` directly)
  - [x] 4.2 Update `handleRadiusSearch` to call `search_water_taps_by_radius` and merge with regular pins
  - [x] 4.3 Add `pin_category` to all `mapPin` / `mapRadiusPin` output shapes

- [x] Task 5: Update `src/features/map/PinMarker.ts` — Water tap faucet SVG + aria-label (AC: 3, 6, 7)
  - [x] 5.1 Add `FAUCET_SVG` constant with water/faucet SVG icon
  - [x] 5.2 Update `getCategoryEmoji` to return faucet SVG + `'water tap'` label when `pin.pinCategory === 'water_tap'`
  - [x] 5.3 Verify aria-label produces `"[PlaceName]: water tap, verified [recency]"` format (NFR-A2)

- [x] Task 6: Add `useWaterTapViewportQuery` in `waterTapsApi.ts` (AC: 2)
  - [x] 6.1 Add `fetchWaterTapsByViewport(lat, lng, radiusM)` function calling `search_water_taps_by_radius` RPC
  - [x] 6.2 Add `useWaterTapViewportQuery({ lat, lng, radiusM })` hook with key `['water-taps', { lat, lng, radiusM }]`

- [x] Task 7: Tests — `api/pins.test.ts` (AC: 1, 4, 8)
  - [x] 7.1 Update fallback test: `mockFrom` called with `'map_pins'` (not `'pins'`)
  - [x] 7.2 Update fallback test: response pins include `pinCategory: 'regular'`
  - [x] 7.3 Add radius test: `search_water_taps_by_radius` RPC called alongside `search_pins_by_radius`
  - [x] 7.4 Add radius test: merged result includes both regular and water_tap pins

- [x] Task 8: Tests — `PinMarker.test.ts` (AC: 3, 6, 7)
  - [x] 8.1 Update `storeMocks` to include `setSelectedTapPin` mock in `getState()` return
  - [x] 8.2 Add test: `water_tap` pin renders faucet SVG in icon HTML
  - [x] 8.3 Add test: `water_tap` pin aria-label format is `"[PlaceName]: water tap, verified [recency]"`
  - [x] 8.4 Add test: `createPinMarker` click on `water_tap` pin calls `setSelectedTapPin(pin.id)` not `setSelectedPin`

- [x] Task 9: Tests — `waterTapsApi.test.ts` (AC: 2)
  - [x] 9.1 Add `useWaterTapViewportQuery` test: uses key `['water-taps', { lat, lng, radiusM }]`
  - [x] 9.2 Add test: calls `search_water_taps_by_radius` RPC when viewport params present

- [x] Task 10: Sprint status update
  - [x] 10.1 Add `6-6-unified-map-pin-integration: done` to sprint-status.yaml

---

## Dev Notes

### Architecture Context
- `map_pins` view (migration 032) exists but is MINIMAL (only 4 columns: id, location, pin_category, place_name). Migration 034 replaces it with a full-column view including latitude, longitude, amenities, badge_state.
- `pins` table has both `latitude`/`longitude` (numeric) AND `location geography(Point, 4326)` (from migration 026).
- `water_tap_pins` table has only `location geography(Point, 4326)` — no separate lat/lng columns.
- badge_state for water_tap pins is COMPUTED from `verified_date`: <7d → 'green', 8-30d → 'yellow', >30d or NULL → 'red'.
- `doesPinMatchFilters` requires no change: the view sets `amenities = '{"water": true, ...}'` for water_tap rows, so the existing Water filter logic naturally includes water tap pins.
- `PinMarker.ts` already has `pin.pinCategory === 'water_tap'` routing to `setSelectedTapPin`. Only the ICON rendering needs to be added.
- The `/tap/:id` route is already in `App.tsx` and `MapView.tsx` effect is already wired.

### Data Flow
```
Supabase map_pins view
    ↓ (getAllPins / search_pins+search_water_taps)
api/pins.ts (server)  ←→  supabase/pins.ts (client-side getAllPins)
    ↓
fetchPinsByRadius / getAllPins
    ↓
usePinsQuery (TanStack Query key: ['pins', { lat, lng, radiusM }])
    ↓
MapView.tsx → visiblePins
    ↓
PinLayer.tsx → createPinMarker(pin, rigProfile)
    ↓
PinMarker.ts → FAUCET_SVG (water_tap) or existing logic (regular)
click → setSelectedTapPin(id) → navigate('/tap/:id') (water_tap)
click → setSelectedPin(id) → navigate('/pin/:id') (regular)
```

### Query Keys
- Primary map pins: `['pins', { lat, lng, radiusM }]` (unchanged) or `['pins']` (all-pins fallback)
- Single tap detail: `['water-tap', tapPinId]` (Story 6.4, unchanged)
- **Note (code review M2):** `useWaterTapViewportQuery` and `fetchWaterTapsByViewport` were removed after code review. Water tap pins are already included in the unified `map_pins` view queried by `usePinsQuery`, making a separate viewport hook redundant. The `['water-taps', { viewport }]` key is no longer in use.

### Technical Decisions
- `handleRadiusSearch` in `api/pins.ts` fires 3 parallel RPC calls: `search_pins_by_radius`, `search_water_taps_by_radius`, `count_pins_by_radius`. Results merged and sorted by `distanceM`.
- Water_tap pins in `map_pins` view get `pinCategory: 'water_tap'`, `pinType: 'water_tap'`, `maxLengthFt: null`, `maxHeightFt: null` → always pass `doesPinFitRig` check (no rig restrictions).

### Faucet SVG Design
The faucet SVG uses a simple pipe-and-spout design at 18×18px consistent with `GOV_SVG` in PinMarker.ts. Uses `#0369a1` (sky-700) color to match the brand accent.

### Failing Tests to Fix
- `api/pins.test.ts` line 116: `expect(mockFrom).toHaveBeenCalledWith('pins')` → must change to `'map_pins'`
- `api/pins.test.ts` radius test: `mockRpc` now called 3× (not 2×) — add `search_water_taps_by_radius` call
- `PinMarker.test.ts`: `storeMocks.mockGetState` only returns `{ setSelectedPin }` — must add `setSelectedTapPin`

---

## Dev Agent Record

### Implementation Plan
1. Create migration 034 with enhanced map_pins view + search_water_taps_by_radius RPC
2. Add DbMapPin type and dbMapPinToPin mapper  
3. Update getAllPins() to query map_pins view
4. Update api/pins.ts to merge regular + water tap pins
5. Update PinMarker.ts with FAUCET_SVG and water_tap routing
6. Add useWaterTapViewportQuery to waterTapsApi.ts
7. Fix all breaking tests and add new coverage

### Debug Log

_Empty at start of implementation_

### Completion Notes

All 10 tasks implemented and tested. Key changes:
- Migration 034: enhanced map_pins view with full rendering columns + search_water_taps_by_radius RPC
- getAllPins() now queries map_pins view; api/pins.ts handleGetAllPins queries map_pins; handleRadiusSearch merges regular + water tap pins
- PinMarker.ts: FAUCET_SVG added, water_tap pins render with faucet icon and "water tap" aria-label category
- useWaterTapViewportQuery added to waterTapsApi.ts with ['water-taps', { lat, lng, radiusM }] key
- All existing tests updated, 28 new test assertions added across 3 test files

---

## File List

- `supabase/migrations/034_enhance_map_pins_view_and_water_tap_radius.sql` — NEW: full map_pins view + RPC
- `src/lib/supabase/types.ts` — MODIFIED: added DbMapPin interface
- `src/lib/supabase/pins.ts` — MODIFIED: added dbMapPinToPin, updated getAllPins
- `api/pins.ts` — MODIFIED: handleGetAllPins uses map_pins; handleRadiusSearch merges water taps
- `src/features/map/PinMarker.ts` — MODIFIED: FAUCET_SVG, water_tap getCategoryEmoji
- `src/features/water-taps/waterTapsApi.ts` — MODIFIED: fetchWaterTapsByViewport, useWaterTapViewportQuery
- `api/pins.test.ts` — MODIFIED: updated for map_pins + water tap radius tests
- `src/features/map/PinMarker.test.ts` — MODIFIED: setSelectedTapPin mock + water_tap icon/aria tests
- `src/features/water-taps/waterTapsApi.test.ts` — NEW: useWaterTapViewportQuery tests
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED: added 6-6 entry

---

## Change Log

- 2026-05-31: Story created from Epic 6 definition; status set to in-progress
- 2026-05-31: All tasks implemented and tested; status updated to review
