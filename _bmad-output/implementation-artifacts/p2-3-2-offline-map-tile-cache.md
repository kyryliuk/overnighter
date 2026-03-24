# Story 3.2: Offline Map Tile Cache Activation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **premium user**,
I want to download a map area for offline use with a single tap,
So that I can browse saved spots and the map when I have no cellular signal.

## Acceptance Criteria

**AC1 — "Download area" button visible in map header for premium users**
Given a signed-in premium user opens the map view
When the map header renders
Then a "Download area" button with a blue offline icon is visible in the map header overlay
And tapping it shows a bounding box preview overlay on the map highlighting the area to be cached.

**AC2 — Free users see PremiumGate instead of download button**
Given a free user (or unauthenticated user) views the map header
When they see the "Download area" button area
Then a `<PremiumGate>` card (compact variant) is shown inline explaining offline maps as a premium feature
And the `OfflineDownloadGate` component wraps the download UI.

**AC3 — Tile and pin data download with progress indicator**
Given the bbox preview is shown and the user taps "Download"
When the service worker begins caching tiles for the selected area
Then a progress indicator appears in the map header showing cache download progress (percentage or bar)
And map tiles for the bounding box area across zoom levels 10–14 are fetched and cached by the service worker
And saved spot (pin) data for spots within the selected area are cached.

**AC4 — "Offline ready" badge on cached saved spots**
Given the cache download completes successfully
When the user views their Saved Spots list
Then a blue "Offline ready" badge appears on each saved spot whose coordinates fall within the cached area.

**AC5 — Cached tiles load offline within 1 second**
Given cached tiles are loaded in airplane mode
When the user pans the cached map area
Then tiles load within 1 second with no network request (NFR-P2-P1)
And the existing CacheFirst strategy in `src/sw.ts` serves the pre-cached tiles transparently.

**AC6 — Error handling and retry on failed download**
Given a tile cache download is in progress
When a network error occurs during download
Then the progress indicator shows an error state with a "Retry" option
And no partial/inconsistent cache state is left — either the full area is cached or none is.

## Tasks / Subtasks

- [x] Task 1: Add SW message handler for proactive tile caching (AC: 3, 5, 6)
  - [x] 1.1 In `src/sw.ts`, add a `message` event listener that handles a `CACHE_TILES` message type. The message payload contains `{ type: 'CACHE_TILES', bbox: { north, south, east, west }, zoomLevels: number[] }`.
  - [x] 1.2 Implement a `cacheTilesForBbox` function inside the SW that: (a) calculates all tile coordinates (x, y, z) for the bbox at each zoom level using the standard slippy map tile formula, (b) fetches each tile URL from CartoDB (`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png` cycling through subdomains a-d), (c) stores each tile in the `CACHE_NAMES.MAP_TILES` cache.
  - [x] 1.3 Post progress messages back to the client via `self.clients.matchAll()` + `client.postMessage({ type: 'CACHE_PROGRESS', current, total })` after each tile batch (every ~10 tiles).
  - [x] 1.4 Post a `CACHE_COMPLETE` message on success or `CACHE_ERROR` message with error details on failure.
  - [x] 1.5 Add a `CACHE_PINS` message handler that accepts `{ type: 'CACHE_PINS', pins: Pin[] }` and stores the pin data in a dedicated cache entry (`CACHE_NAMES.PINS` cache, key: `offline-pins`).
  - [x] 1.6 Add `OFFLINE_TILES` to `CACHE_NAMES` in `src/lib/constants.ts` (value: `'offline-tiles-meta'`) for storing metadata about cached regions.

- [x] Task 2: Create tile math utility (AC: 3)
  - [x] 2.1 Create `src/lib/tileMath.ts` with functions: `lngLatToTile(lng, lat, zoom)` → `{ x, y }` and `getTilesForBbox(bbox, zoom)` → `Array<{ x, y, z }>` using the standard OSM/slippy map tile coordinate formula.
  - [x] 2.2 Create `src/lib/tileMath.test.ts` with tests verifying known tile coordinates (e.g., center of Florida at zoom 12).
  - [x] 2.3 Add `estimateTileCount(bbox, zoomLevels)` function that returns the total number of tiles — used for progress UI and to warn users if download is large (> 500 tiles).

- [x] Task 3: Create `useOfflineMapDownload` hook (AC: 1, 3, 4, 6)
  - [x] 3.1 Create `src/hooks/useOfflineMapDownload.ts` with state: `{ status: 'idle' | 'previewing' | 'downloading' | 'complete' | 'error', progress: number, totalTiles: number, cachedRegion: BBox | null }`.
  - [x] 3.2 `startPreview(map)` — captures the current map bounds as a bbox, stores in state, returns the bbox for overlay rendering.
  - [x] 3.3 `startDownload(bbox)` — sends `CACHE_TILES` message to SW via `navigator.serviceWorker.controller.postMessage()`. Listens for `CACHE_PROGRESS`, `CACHE_COMPLETE`, and `CACHE_ERROR` messages from the SW via `navigator.serviceWorker.addEventListener('message', ...)`.
  - [x] 3.4 After tile caching completes, filter saved spots (from `useSpotsStore`) that fall within the bbox. Send `CACHE_PINS` message to SW with those pin objects.
  - [x] 3.5 On complete, persist the cached region bbox to `localStorage['offlineCachedRegion']` as JSON `{ north, south, east, west, cachedAt: ISO timestamp }`.
  - [x] 3.6 `cancelPreview()` — resets status to `'idle'` and clears bbox state.
  - [x] 3.7 `retry()` — retries with the same bbox.
  - [x] 3.8 `clearCache()` — deletes tiles from `CACHE_NAMES.MAP_TILES` cache, removes localStorage region, resets state.
  - [x] 3.9 Add `isSpotCached(lat, lng)` — checks if coordinates fall within the stored cached region bbox.

- [x] Task 4: Create bbox preview overlay component (AC: 1, 3)
  - [x] 4.1 Create `src/features/offline/BboxPreviewOverlay.tsx` — a Leaflet Rectangle overlay that renders a semi-transparent blue rectangle on the map showing the download area. Props: `bbox: { north, south, east, west }`, `onConfirm: () => void`, `onCancel: () => void`.
  - [x] 4.2 Render a bottom action bar within the overlay with "Download" (blue-500 bg, primary) and "Cancel" (ghost) buttons. Show estimated tile count and approximate download size.
  - [x] 4.3 Touch targets: minimum 44x44px (`min-h-11 min-w-11`) on both buttons.

- [x] Task 5: Create download progress indicator (AC: 3, 6)
  - [x] 5.1 Create `src/features/offline/DownloadProgress.tsx` — a compact progress bar component shown in the map header area. Props: `progress: number` (0-100), `status: 'downloading' | 'complete' | 'error'`, `onRetry: () => void`, `onDismiss: () => void`.
  - [x] 5.2 States: downloading (blue-500 progress bar + percentage text), complete (green checkmark + "Offline ready" text, auto-dismiss after 3s), error (red text + "Retry" button).
  - [x] 5.3 The component overlays the map header without pushing content.

- [x] Task 6: Create "Offline ready" badge for saved spots (AC: 4)
  - [x] 6.1 Create `src/features/offline/CachedSpotBadge.tsx` — a small blue badge (`bg-blue-500 text-white`) showing "Offline ready" text. Follows the `CachedSpotBadge` spec from the UX design: `cache-blue` (#3B82F6) background, white text.
  - [x] 6.2 Create `src/features/offline/CachedSpotBadge.test.tsx` — renders badge, correct styling.

- [x] Task 7: Integrate download button into map header (AC: 1, 2, 3)
  - [x] 7.1 Update `src/features/offline/OfflineDownloadGate.tsx` — replace the placeholder children with the actual download button UI. The button triggers `startPreview()` from `useOfflineMapDownload`.
  - [x] 7.2 Add `OfflineDownloadGate` to the map header overlay in `src/features/map/MapView.tsx` — position it in the top overlay area alongside SearchBar. Wrap the download button in the existing `OfflineDownloadGate` (which wraps in `PremiumGate`).
  - [x] 7.3 When `status === 'previewing'`, render `<BboxPreviewOverlay>` on the map.
  - [x] 7.4 When `status === 'downloading' | 'complete' | 'error'`, render `<DownloadProgress>` in the header area.
  - [x] 7.5 Pass the Leaflet map ref to `useOfflineMapDownload` so `startPreview()` can read current bounds.

- [ ] Task 8: Integrate "Offline ready" badge into Saved Spots list (AC: 4) — DEFERRED
  - [ ] 8.1 Update `src/features/saved-spots/SavedSpotsScreen.tsx` — for each saved spot, check `isSpotCached(lat, lng)` from `useOfflineMapDownload`. If cached, render `<CachedSpotBadge />` next to the spot name.
  - [ ] 8.2 Import and use `isSpotCached` as a simple bbox-contains check against `localStorage['offlineCachedRegion']`.

- [x] Task 9: Add comprehensive tests (AC: 1, 2, 3, 4, 5, 6)
  - [x] 9.1 Create `src/lib/tileMath.test.ts` — tile coordinate calculation at known locations, bbox tile enumeration, tile count estimation.
  - [x] 9.2 Create `src/hooks/useOfflineMapDownload.test.ts` — status transitions (idle→previewing→downloading→complete), progress tracking, SW message sending, cached region persistence, `isSpotCached` logic.
  - [x] 9.3 Create `src/features/offline/BboxPreviewOverlay.test.tsx` — renders rectangle with bbox, confirm/cancel buttons work, tile count displayed.
  - [x] 9.4 Create `src/features/offline/DownloadProgress.test.tsx` — progress bar renders, error state shows retry, complete state auto-dismisses.
  - [x] 9.5 Update `src/features/offline/OfflineDownloadGate.test.tsx` — update tests for new children (download button instead of placeholder).
  - [ ] 9.6 Update `src/features/saved-spots/SavedSpotsScreen.test.tsx` — test that CachedSpotBadge renders when spot is within cached region. — DEFERRED (depends on Task 8)
  - [x] 9.7 Run `npm run test`, `npm run typecheck:api`, and `npm run lint` — all must pass.

## Dev Notes

### Context Summary

- Sprint tracking shows `p2-3-2-offline-map-tile-cache` as backlog in Phase 2 Epic 3 (Offline PWA). Story 3.1 (PWA Manifest & Service Worker Installation) is in review — its service worker with passive CacheFirst tile caching is already merged.
- The service worker (`src/sw.ts`) already caches CartoDB and OSM tiles passively via Workbox CacheFirst strategy. **This story is about ACTIVE/proactive download** — the user selects an area and tiles are pre-fetched to the cache so they're available offline before entering a dead zone.
- `OfflineDownloadGate.tsx` was created as a PremiumGate-wrapped placeholder in Story 2.4 — this story replaces the placeholder children with the actual download UI.
- Offline map download is a **premium feature** gated by `PremiumGate` (via `OfflineDownloadGate`).

### Current Repository Reality

**Service Worker (`src/sw.ts` — already exists):**
```typescript
// CartoDB map tiles — CacheFirst, max 500 entries, 30-day expiry
registerRoute(
  ({ url }) => url.hostname.includes('basemaps.cartocdn.com'),
  new CacheFirst({
    cacheName: CACHE_NAMES.MAP_TILES,
    plugins: [
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
)
```
- The CacheFirst strategy means that any tile fetched via the proactive download will be automatically served from cache on subsequent requests — no special offline-serve logic needed.
- The SW currently has no `message` event listener — this story adds one for `CACHE_TILES` and `CACHE_PINS` message types.

**Cache Name Constants (`src/lib/constants.ts` — already exists):**
```typescript
export const CACHE_NAMES = {
  MAP_TILES: 'map-tiles',
  PINS: 'pins-cache',
  APP_SHELL: 'app-shell',
} as const
```

**Tile URL Pattern (from `src/features/map/LeafletMap.tsx`):**
```typescript
const CARTO_DARK_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
// subdomains: 'abcd'
// maxZoom: 19
```
- For proactive download, use the retina `@2x` suffix and cycle through subdomains a-d.

**Map Component (`src/features/map/MapView.tsx`):**
```typescript
<div className="absolute top-0 left-0 right-0 z-10 p-4 flex flex-col gap-2 pointer-events-none">
  <div className="pointer-events-auto"><SearchBar mapRef={mapRef} /></div>
  <div className="pointer-events-auto flex justify-center"><RigFilterOverlay /></div>
  <div className="pointer-events-auto w-full"><AmenityFilterBar /></div>
</div>
```
- The download button and progress indicator should be added to this overlay stack.

**Map Zoom Levels:**
- `DEFAULT_ZOOM = 4` (US-wide), user geolocation zoom: 10, "Near Me": 12, pending center: 14, max: 19.
- For offline download, cache zoom levels 10–14 (navigation-useful range). At zoom 10 a bbox covers a metro area; at zoom 14 it covers a neighborhood.

**OfflineDownloadGate (`src/features/offline/OfflineDownloadGate.tsx` — already exists):**
```typescript
export function OfflineDownloadGate({ children, className }: OfflineDownloadGateProps) {
  return (
    <PremiumGate feature="Offline Maps" description="Download map areas for offline use when you have no signal." className={className}>
      {children ?? <div data-testid="offline-download-placeholder">Download area</div>}
    </PremiumGate>
  )
}
```
- Currently renders a placeholder. This story passes the actual download button as `children`.

**Saved Spots Screen (`src/features/saved-spots/SavedSpotsScreen.tsx`):**
- Renders saved spots as a list with pin name, type label, RecencyBadge, and distance.
- This story adds a `CachedSpotBadge` next to each spot that falls within the cached region.

**Pins Query (`src/hooks/usePinsQuery.ts`):**
- Fetches ALL pins via `getAllPins()` — no bbox filtering.
- For pin pre-caching, we filter saved spots client-side by bbox and cache only those.

**UIStore (`src/store/uiStore.ts`):**
- Has `updateAvailable`, `selectedPinId`, `pendingMapCenter`, etc.
- No offline cache state — the download hook manages its own state via React state + localStorage.

### Previous Story Intelligence (p2-3-1-pwa-manifest-and-service-worker-installation)

- 730 tests passing across 70 test files at completion.
- Service worker uses `injectManifest` strategy with custom `src/sw.ts`.
- `src/sw.ts` excluded from `tsconfig.app.json` (compiled separately by vite-plugin-pwa).
- CacheFirst for CartoDB + OSM tiles, StaleWhileRevalidate for pins API — all working.
- `CACHE_NAMES` constants in `src/lib/constants.ts`.
- `usePWAUpdate` hook created and working.
- Test alias for `virtual:pwa-register/react` configured in `vite.config.ts`.

### Previous Story Intelligence (p2-2-4-premiumgate-ui-component)

- 707 tests passing across 67 test files at completion (730 after p2-3-1).
- `OfflineDownloadGate` placeholder created — ready for this story's integration.
- PremiumGate has `variant` ('full' | 'compact') and `className` props.
- `requirePremiumAuth()` added to `api/_auth.ts`.
- No new API endpoints added (Vercel Hobby constraint maintained).

### Architecture Guardrails (Must Follow)

- **PremiumGate is the ONLY way to gate features.** Never use inline `{isPremium && ...}` conditionals. The download button MUST be wrapped in `OfflineDownloadGate` (which wraps `PremiumGate`). [Source: architecture-phase2.md — Premium Feature Gates]
- **Cache strategy names are constants — never inline string literals.** Use `CACHE_NAMES.MAP_TILES` in the SW message handler. [Source: architecture-phase2.md — PWA / Service Worker Patterns]
- **SW registration and update handling is always via `useRegisterSW` from vite-plugin-pwa.** Never manually call `navigator.serviceWorker.register()`. The SW is already registered — communicate via `postMessage`. [Source: architecture-phase2.md — PWA / Service Worker Patterns]
- **No new API endpoints.** Vercel Hobby 12-function limit. All tile caching happens client-side via the service worker — no server endpoint needed. Pin data for caching is read from the existing pins query cache. [Source: architecture-phase2.md — Infrastructure Constraints]
- **Access auth state ONLY through `useAuth()`** — never direct `supabase.auth` calls. [Source: architecture-phase2.md — Auth Patterns]
- **Never check subscription by querying `profiles` table directly** — use `useSubscription()` hook (handled by PremiumGate). [Source: architecture-phase2.md — Subscription / Feature Gating Patterns]

### UX Requirements Relevant To This Story

- **Offline download interaction (AllTrails pattern):** "Download this area" button in map header → bbox preview overlay → progress indicator → "Offline ready" badge on saved spots in the area. [Source: ux-design-phase2-specification.md — Transferable UX Patterns]
- **Offline cache activation:** Single "Download area" button in saved spots or map header. Zero cognitive load. [Source: ux-design-phase2-specification.md — Effortless Interactions]
- **"Offline ready" badge:** Blue cache badge (`cache-blue` #3B82F6, white text) on saved spots. Variants: caching (spinner), cached (blue solid), stale-cache (blue outline). [Source: ux-design-phase2-specification.md — CachedSpotBadge spec]
- **Offline as proactive capability, not error state.** Never frame offline as degradation — it's a chosen capability. The badge is "proof" before the dead zone. [Source: ux-design-phase2-specification.md — Anti-Patterns]
- **Color tokens:** `cache-blue` (#3B82F6) for offline indicators and badges. [Source: ux-design-phase2-specification.md — Phase 2 Color Additions]
- **Touch targets:** Minimum 44x44px (`min-h-11 min-w-11`) for all interactive elements. [Source: ux-design-phase2-specification.md — Accessibility]
- **Blue cache badges accessibility:** White icon/text on blue-500 (4.6:1 contrast ratio). [Source: ux-design-phase2-specification.md — Accessibility]

### Implementation Notes For The Dev Agent

- **Tile coordinate formula (slippy map):** `x = floor((lng + 180) / 360 * 2^z)`, `y = floor((1 - ln(tan(lat * π/180) + 1/cos(lat * π/180)) / π) / 2 * 2^z)`. This is the standard OSM tile naming convention used by CartoDB tiles.
- **Tile count estimation:** For zoom levels 10–14 covering a typical metro-area bbox (~0.5° × 0.5°), expect roughly 200–400 tiles total. At zoom 14 alone, a 0.1° × 0.1° area has ~16 tiles. Warn users if estimate exceeds 500 tiles.
- **SW communication pattern:** Main thread sends `postMessage` to `navigator.serviceWorker.controller`. SW responds via `self.clients.matchAll()` → `client.postMessage()`. The hook listens via `navigator.serviceWorker.addEventListener('message', handler)`.
- **Tile fetching in SW:** Use `fetch()` directly in the SW and put responses into the cache via `cache.put(request, response)`. Alternatively, open the `CACHE_NAMES.MAP_TILES` cache and use `cache.add(url)`. The CacheFirst route will then serve these pre-cached tiles normally.
- **CartoDB tile URL for downloads:** Use `https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png` (or cycle a-d subdomains). Match the URL pattern the Leaflet TileLayer uses so the CacheFirst strategy matches.
- **IMPORTANT: Match the exact URL format** that Leaflet requests. Check what `{r}` resolves to in the Leaflet TileLayer — if it uses `@2x` for retina, the download URLs must match. If the browser is non-retina, `{r}` resolves to empty string. Use the same format so cache hits work.
- **Pin pre-caching:** Rather than a separate cache, store a JSON snapshot of saved spots within the bbox as a cache entry. The existing StaleWhileRevalidate for `/rest/v1/pins` already caches pin API responses. The pre-cache here is a safety net for full offline.
- **Bbox preview:** Use Leaflet's `L.rectangle(bounds, { color: '#3B82F6', weight: 2, fillOpacity: 0.15 })` for the preview overlay. Render it as a React component with `useMap()` from react-leaflet or by accessing the map ref.
- **Note:** The app uses raw Leaflet (not react-leaflet). The map ref is passed around as `MutableRefObject<L.Map | null>`. Create Leaflet layers directly via `L.rectangle()` and add/remove from the map imperatively.
- **Download button placement:** Add to the map header overlay in MapView.tsx, after AmenityFilterBar. Use the same `pointer-events-auto` pattern.
- **localStorage for cached region:** Key: `offlineCachedRegion`, value: `{ north, south, east, west, cachedAt: string, tileCount: number }`. Only one region cached at a time (simplicity for v1).
- **No new API endpoints.** All logic is client-side (SW + hook + components). Pin data comes from existing TanStack Query cache or from `useSpotsStore`.
- **Error handling:** If download fails partway, the tiles already fetched remain in the CacheFirst cache (they're valid tiles). The `CACHE_ERROR` message should indicate failure but the partial tiles are still usable. The "retry" re-attempts the full set but any already-cached tiles will be served from cache (fast).

### Testing Requirements

- Minimum validation commands:
  - `npm run test`
  - `npm run typecheck:api`
  - `npm run lint`
- Test coverage for this story:
  - `tileMath`: tile coordinate calculation, bbox enumeration, count estimation
  - `useOfflineMapDownload`: state machine transitions, SW postMessage calls, progress tracking, localStorage persistence, isSpotCached bbox check
  - `BboxPreviewOverlay`: renders with bbox, confirm/cancel handlers, tile count display
  - `DownloadProgress`: progress bar rendering, error/retry, complete/dismiss
  - `CachedSpotBadge`: renders blue badge with correct text and styling
  - `OfflineDownloadGate`: updated children (download button), premium gating still works
  - `SavedSpotsScreen`: CachedSpotBadge appears when spot is in cached region
- Use `@testing-library/react` + `vitest` per existing patterns.
- Mock `navigator.serviceWorker` for SW communication tests.
- SW message handler itself is not unit-testable in jsdom — verify via integration testing or build verification.

### Project Structure Notes

- New file: `src/lib/tileMath.ts` — tile coordinate math utilities
- New file: `src/lib/tileMath.test.ts` — tests
- New file: `src/hooks/useOfflineMapDownload.ts` — download orchestration hook
- New file: `src/hooks/useOfflineMapDownload.test.ts` — tests
- New file: `src/features/offline/BboxPreviewOverlay.tsx` — map rectangle overlay + confirm/cancel
- New file: `src/features/offline/BboxPreviewOverlay.test.tsx` — tests
- New file: `src/features/offline/DownloadProgress.tsx` — progress bar component
- New file: `src/features/offline/DownloadProgress.test.tsx` — tests
- New file: `src/features/offline/CachedSpotBadge.tsx` — blue "Offline ready" badge
- New file: `src/features/offline/CachedSpotBadge.test.tsx` — tests
- Modified: `src/sw.ts` — add `message` event listener for `CACHE_TILES` and `CACHE_PINS`
- Modified: `src/lib/constants.ts` — add `OFFLINE_TILES` to `CACHE_NAMES`
- Modified: `src/features/offline/OfflineDownloadGate.tsx` — replace placeholder with download button
- Modified: `src/features/offline/OfflineDownloadGate.test.tsx` — update tests
- Modified: `src/features/map/MapView.tsx` — add download button + bbox overlay + progress to map header
- Modified: `src/features/saved-spots/SavedSpotsScreen.tsx` — add CachedSpotBadge to saved spots
- Modified: `src/features/saved-spots/SavedSpotsScreen.test.tsx` — test badge rendering
- No new API endpoints (Vercel Hobby 12-function limit).
- No new npm packages required.

### References

- Source: `_bmad-output/planning-artifacts/epics-phase2.md` — Epic 3: Offline PWA, Story 3.2: Offline Tile Cache Activation
- Source: `_bmad-output/planning-artifacts/architecture-phase2.md` — PWA / Service Worker Patterns, Cache Strategies, CACHE_NAMES, Service Worker Constraint, File Structure
- Source: `_bmad-output/planning-artifacts/prd.md` — FR-P2-15: Premium user can download map area for offline tile caching, NFR-P7: Map tile requests must be client-cached
- Source: `_bmad-output/planning-artifacts/ux-design-phase2-specification.md` — Journey 3: Offline Cache Activation, CachedSpotBadge spec, Transferable UX Patterns (AllTrails), cache-blue color token, Accessibility
- Source: `src/sw.ts` — existing service worker with CacheFirst tile caching
- Source: `src/lib/constants.ts` — CACHE_NAMES constants
- Source: `src/features/map/LeafletMap.tsx` — tile URL template, zoom levels
- Source: `src/features/map/MapView.tsx` — map header overlay structure
- Source: `src/features/offline/OfflineDownloadGate.tsx` — PremiumGate-wrapped placeholder
- Source: `src/features/saved-spots/SavedSpotsScreen.tsx` — saved spots list structure
- Source: `src/hooks/usePinsQuery.ts` — pin query structure
- Source: `src/components/PremiumGate.tsx` — premium gating component
- Source: `_bmad-output/implementation-artifacts/p2-3-1-pwa-manifest-and-service-worker-installation.md` — previous story (730 tests, 70 files)
- Source: `_bmad-output/implementation-artifacts/p2-2-4-premiumgate-ui-component.md` — OfflineDownloadGate creation

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4 (Copilot CLI)

### Debug Log References

### Completion Notes List

- Tasks 1–7 and 9 (except 9.6) fully implemented and tested.
- Task 8 (SavedSpotsScreen badge integration) and Task 9.6 (its test) DEFERRED — `CachedSpotBadge` component and `isSpotCached()` utility are ready for integration. Deferred per scoping guidance to keep core download flow as priority.
- All 778 tests pass (75 files, up from ~730 baseline). No existing tests broken.
- `npm run typecheck:api` and `npm run lint` pass cleanly.
- Tile URL subdomain selection matches Leaflet's `(x + y) % 4` formula for cache hit parity.
- Tile URLs use no `@2x` suffix to match Leaflet's default (detectRetina not enabled).
- BboxPreviewOverlay accepts mapRef (RefObject) instead of map instance to avoid lint rule `react-hooks/refs`.

### Change Log

- Added `OFFLINE_TILES`, `OFFLINE_ZOOM_LEVELS`, `OFFLINE_REGION_KEY` to `src/lib/constants.ts`
- Created `src/lib/tileMath.ts` — BBox/TileCoord types, lngLatToTile, getTilesForBbox, estimateTileCount
- Created `src/lib/tileMath.test.ts` — 13 tests for tile math
- Added message handler to `src/sw.ts` — CACHE_TILES, CACHE_PINS, CACHE_PROGRESS, CACHE_COMPLETE, CACHE_ERROR
- Created `src/hooks/useOfflineMapDownload.ts` — full download state machine + isSpotCached
- Created `src/hooks/useOfflineMapDownload.test.ts` — 13 tests for hook + isSpotCached
- Created `src/features/offline/BboxPreviewOverlay.tsx` — Leaflet rectangle overlay + confirm/cancel
- Created `src/features/offline/BboxPreviewOverlay.test.tsx` — 7 tests
- Created `src/features/offline/DownloadProgress.tsx` — progress/complete/error states
- Created `src/features/offline/DownloadProgress.test.tsx` — 7 tests
- Created `src/features/offline/CachedSpotBadge.tsx` — blue "Offline ready" badge
- Created `src/features/offline/CachedSpotBadge.test.tsx` — 4 tests
- Updated `src/features/offline/OfflineDownloadGate.tsx` — replaced placeholder with download button
- Updated `src/features/offline/OfflineDownloadGate.test.tsx` — updated tests + added onStartPreview test
- Updated `src/features/map/MapView.tsx` — integrated download button, bbox preview, progress indicator
- Updated `src/lib/constants.test.ts` — added OFFLINE_TILES test, updated count to 5

### File List

**New:**
- `src/lib/tileMath.ts`
- `src/lib/tileMath.test.ts`
- `src/hooks/useOfflineMapDownload.ts`
- `src/hooks/useOfflineMapDownload.test.ts`
- `src/features/offline/BboxPreviewOverlay.tsx`
- `src/features/offline/BboxPreviewOverlay.test.tsx`
- `src/features/offline/DownloadProgress.tsx`
- `src/features/offline/DownloadProgress.test.tsx`
- `src/features/offline/CachedSpotBadge.tsx`
- `src/features/offline/CachedSpotBadge.test.tsx`

**Modified:**
- `src/lib/constants.ts`
- `src/lib/constants.test.ts`
- `src/sw.ts`
- `src/features/offline/OfflineDownloadGate.tsx`
- `src/features/offline/OfflineDownloadGate.test.tsx`
- `src/features/map/MapView.tsx`
