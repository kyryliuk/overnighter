# Story 2.1: Location Search & GPS "Near Me"

Status: done

## Story

As a user browsing the map,
I want to search for a location by name or address, or tap "Near Me" to center the map on my GPS position,
So that I can quickly navigate to the area I'm planning to stop in without manually panning the map.

## Acceptance Criteria

1. **Given** the map view is displayed **When** the user types a location name or address into the search field **Then** matching results appear as a dropdown list within 500ms **And** selecting a result re-centers the map on that location at zoom 12.

2. **Given** the map view is displayed **When** the user taps the "Near Me" button **Then** the browser requests geolocation permission **And** if granted, the map re-centers on the user's current GPS coordinates at zoom 12.

3. **Given** the user taps "Near Me" **When** the browser geolocation permission is denied **Then** the map remains on its current position **And** a non-blocking inline message is shown below the search bar: "Location access denied — search for a place to get started" **And** the search field remains fully functional.

4. **Given** the user taps "Near Me" **When** the GPS fix takes more than 3 seconds **Then** a loading indicator is shown on the "Near Me" button ("...") **And** the button is disabled during the wait **And** the map does not freeze or block interaction during the wait.

5. **Given** the app is accessed over HTTP (not HTTPS) or in a browser that does not support the Geolocation API **When** the user taps "Near Me" **Then** a graceful fallback message is shown: "Location not available — search for a place instead" **And** no error is thrown.

## Tasks / Subtasks

- [x] **Task 1: Create `src/hooks/useGeolocation.ts`** (AC: 2, 3, 4, 5)
  - [x] Export interface `GeolocationState { isLoading: boolean; coords: GeolocationCoordinates | null; error: 'denied' | 'no-api' | 'unavailable' | null }`
  - [x] Export `function useGeolocation(): [GeolocationState, () => void]`
  - [x] `request()` action: check `navigator.geolocation` — if absent, set `error: 'no-api'` and return early
  - [x] On request: set `isLoading: true`, clear previous error and coords
  - [x] On `getCurrentPosition` success: set `coords`, clear `isLoading`
  - [x] On `getCurrentPosition` error: map `PERMISSION_DENIED` → `'denied'`, all others → `'unavailable'`; clear `isLoading`
  - [x] Options: `{ timeout: 10000, maximumAge: 0 }` (10s timeout)
  - [x] Do NOT auto-request on mount — hook is passive until `request()` is called

- [x] **Task 2: Create `src/features/map/SearchBar.tsx`** (AC: 1, 2, 3, 4, 5)
  - [x] Props: `mapRef: React.RefObject<L.Map | null>`
  - [x] Internal state: `query: string`, `results: NominatimResult[]`, `isSearching: boolean`, `geoError: string | null`
  - [x] Import and use `useGeolocation()` hook
  - [x] Render layout: flex row with `<input>` (flex-1) and "📍 Near Me" `<button>`
  - [x] Input: `type="search"`, `placeholder="Search destination..."`, `aria-label="Search destination"`, `aria-autocomplete="list"`, `aria-controls="search-results"`, clear `×` button when query non-empty
  - [x] "Near Me" button: disabled when `geoState.isLoading`, shows "..." text during load, `aria-label` changes per state
  - [x] "Near Me" click: clears `geoError`, calls `requestGeo()`
  - [x] `useEffect([geoState])`: on `geoState.coords` → call `mapRef.current?.setView([latitude, longitude], 12)`; on `geoState.error` → set `geoError` message per error type
  - [x] **Nominatim debounce `useEffect([query])`:**
    - [x] Skip if `query.length < 3`: clear results, return
    - [x] Set 300ms `setTimeout`; clear on cleanup
    - [x] Fetch: `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`
    - [x] Headers: `{ Accept: 'application/json' }` (do NOT attempt to set `User-Agent` — browsers forbid it in fetch)
    - [x] Set `isSearching: true` before fetch, `false` in finally
    - [x] On error: set results to `[]` (silent failure, no throw)
    - [x] On success: set `results` array
  - [x] `selectResult(result: NominatimResult)`: call `mapRef.current?.setView([parseFloat(result.lat), parseFloat(result.lon)], 12)`, set `query` to first segment of `display_name` (split by `, `), clear `results`
  - [x] Results dropdown: `<ul id="search-results" role="listbox">` with `<li role="option">` items
  - [x] Each result `<button>`: `onClick={selectResult}`, full `display_name` as text, `min-h-[44px]`
  - [x] `geoError` message: render as `<p role="alert">` below the input row (only when non-null)
  - [x] Close dropdown when results empty or query cleared

- [x] **Task 3: Update `src/features/map/LeafletMap.tsx`** (AC: 2)
  - [x] Add `onMapReady?: (map: L.Map) => void` to `LeafletMapProps` interface
  - [x] In the init `useEffect`, after `setMapInstance(map)`, call `onMapReady?.(map)`
  - [x] No other changes — existing GPS on mount (auto-center AC1 from Story 1.4) is PRESERVED

- [x] **Task 4: Update `src/features/map/MapView.tsx`** (AC: 1, 2, 3, 4, 5)
  - [x] Add `import { useRef } from 'react'` (already imported if used elsewhere)
  - [x] Add `import type * as L from 'leaflet'` at top (type-only import — Leaflet stays in lazy chunk)
  - [x] Add `import SearchBar from './SearchBar'`
  - [x] Add `const mapRef = useRef<L.Map | null>(null)` inside component
  - [x] Replace the current overlay layout with a floating UI stack
  - [x] Pass `onMapReady={(map) => { mapRef.current = map }}` to `<LeafletMap>`
  - [x] REMOVE the standalone `<RigFilterOverlay />` that was previously directly inside the root div

- [x] **Task 5: Update `src/features/map/RigFilterOverlay.tsx`** (layout change only)
  - [x] Remove the outer wrapper `<div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">`
  - [x] The component now renders the button directly (no positioning wrapper) — MapView's overlay stack handles layout
  - [x] Button styling remains unchanged

- [x] **Task 6: Write tests** (AC: 1–5)
  - [x] `src/hooks/useGeolocation.test.ts` — 9 unit tests for hook (mock `navigator.geolocation`)
  - [x] `src/features/map/SearchBar.test.tsx` — 17 component tests (mock fetch + fake timers + mock mapRef)
  - [x] `src/features/map/MapView.test.tsx` — updated mocks + 1 new test for SearchBar rendering
  - [x] All 114 tests pass (0 regressions)

## Dev Notes

### Critical Architecture Guardrails

**DO NOT break these rules:**

- **No leaflet import in SearchBar.** `SearchBar.tsx` must NOT import `leaflet` directly — it would drag Leaflet into the main bundle, breaking NFR-P5 (≤250KB gz). Accept `mapRef: React.RefObject<L.Map | null>` and call `.setView()` on it.
- **Type-only Leaflet import in MapView.** `import type * as L from 'leaflet'` (type-only) for the `useRef<L.Map | null>` type annotation — no runtime import of Leaflet in MapView. Leaflet stays in the lazy `LeafletMap` chunk.
- **Nominatim: fetch, not a library.** Do NOT install `leaflet-control-geocoder`, `nominatim-browser`, or any geocoding npm package. Use native `fetch()` directly to the Nominatim endpoint. Adding a geocoding library would add ~20–50KB to the bundle.
- **No direct Supabase calls.** This story adds no Supabase queries — search and GPS are client-only.
- **No cross-feature imports.** `SearchBar.tsx` stays in `src/features/map/`. It must NOT import from `src/features/rig-profile/`.
- **Nominatim usage policy.** For MVP (low traffic), direct browser-to-Nominatim calls are acceptable. Nominatim forbids `User-Agent` header via browser `fetch()` (browsers block custom UA headers). Do NOT try to set it. Add a comment noting this should be proxied via `/api/geocode` in production.

### `useGeolocation` Hook — Full Shape

```typescript
// src/hooks/useGeolocation.ts
import { useState } from 'react'

export interface GeolocationState {
  isLoading: boolean
  coords: GeolocationCoordinates | null
  error: 'denied' | 'no-api' | 'unavailable' | null
}

export function useGeolocation(): [GeolocationState, () => void] {
  const [state, setState] = useState<GeolocationState>({
    isLoading: false,
    coords: null,
    error: null,
  })

  function request() {
    if (!navigator.geolocation) {
      setState({ isLoading: false, coords: null, error: 'no-api' })
      return
    }
    setState({ isLoading: true, coords: null, error: null })
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({ isLoading: false, coords: position.coords, error: null })
      },
      (err) => {
        setState({
          isLoading: false,
          coords: null,
          error: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable',
        })
      },
      { timeout: 10000, maximumAge: 0 },
    )
  }

  return [state, request]
}
```

### Nominatim API Contract

**URL:** `https://nominatim.openstreetmap.org/search`

**Query params:**
| Param | Value | Notes |
|---|---|---|
| `q` | `encodeURIComponent(query)` | User's raw search text |
| `format` | `json` | Required |
| `limit` | `5` | Max 5 results in dropdown |

**Response shape (array):**
```typescript
interface NominatimResult {
  lat: string    // NOTE: string not number — parseFloat() before use
  lon: string    // NOTE: string not number — parseFloat() before use
  display_name: string  // Full formatted address
}
```

**Example response:**
```json
[
  {
    "lat": "40.7127281",
    "lon": "-74.0060152",
    "display_name": "New York City, New York, United States"
  }
]
```

**Key gotcha:** `lat` and `lon` are **strings** in the Nominatim response. Always use `parseFloat(result.lat)` and `parseFloat(result.lon)` before calling `map.setView()`.

**Debounce pattern:**
```typescript
useEffect(() => {
  if (query.length < 3) {
    setResults([])
    return
  }
  const timer = setTimeout(async () => {
    setIsSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
        { headers: { Accept: 'application/json' } },
      )
      if (!res.ok) throw new Error('search failed')
      const data: NominatimResult[] = await res.json()
      setResults(data)
    } catch {
      setResults([])  // Silent failure — don't show error for failed search
    } finally {
      setIsSearching(false)
    }
  }, 300)
  return () => clearTimeout(timer)
}, [query])
```

### MapView Overlay Stack Pattern

The current `MapView.tsx` has `RigFilterOverlay` as a standalone absolute element. Story 2.1 introduces a vertical overlay stack to add `SearchBar` above `RigFilterOverlay` without z-index conflicts:

```tsx
// MapView.tsx — overlay stack (replaces standalone <RigFilterOverlay />)
<div className="absolute top-0 left-0 right-0 z-10 p-4 flex flex-col gap-2 pointer-events-none">
  <div className="pointer-events-auto">
    <SearchBar mapRef={mapRef} />
  </div>
  <div className="pointer-events-auto flex justify-center">
    <RigFilterOverlay />
  </div>
</div>
```

`pointer-events-none` on the container prevents the overlay div from blocking map interactions. `pointer-events-auto` on each child re-enables pointer events only for the actual UI elements.

**Why `RigFilterOverlay` positioning changes:**
`RigFilterOverlay` currently has `absolute top-4 left-1/2 -translate-x-1/2 z-10` on its root div. In the new layout, the parent handles absolute positioning. The component should strip its outer wrapper div's absolute/z-index classes and just render the button. MapView's `flex justify-center` wrapping div handles the centering.

### `LeafletMap` — onMapReady Prop Addition

```typescript
// Add to LeafletMapProps:
interface LeafletMapProps {
  pins: Pin[]
  isLoading: boolean
  rigProfile: RigProfile
  onMapReady?: (map: L.Map) => void  // NEW
}

// In useEffect, after setMapInstance(map):
setMapInstance(map)
onMapReady?.(map)  // Expose to parent for SearchBar centering
```

**Do NOT add this to the cleanup function** — cleanup calls `map.remove()`, and the ref in MapView becomes stale automatically.

### `mapRef` Pattern in MapView

```typescript
// MapView.tsx
import { useEffect, lazy, Suspense, useRef } from 'react'
import type * as L from 'leaflet'  // type-only — no runtime Leaflet in main bundle

const mapRef = useRef<L.Map | null>(null)

// In JSX:
<LeafletMap
  pins={pins}
  isLoading={isLoading}
  rigProfile={rigProfile}
  onMapReady={(map) => { mapRef.current = map }}
/>
<SearchBar mapRef={mapRef} />
```

`import type * as L from 'leaflet'` is a TypeScript type-only import — it compiles away to nothing at runtime. This is the correct pattern to get `L.Map` type annotation without importing Leaflet's runtime code into the main bundle.

### Geolocation Error Messages (AC3, AC5)

| Error type | User message |
|---|---|
| `'denied'` | "Location access denied — search for a place to get started" |
| `'no-api'` | "Location not available — search for a place instead" |
| `'unavailable'` | "Could not get location — try again or search for a place" |

### "Near Me" Button States

| State | Text | Disabled | aria-label |
|---|---|---|---|
| Idle | `📍 Near Me` | false | "Use my current location" |
| Loading | `...` | true | "Getting location..." |
| Error | `📍 Near Me` | false | "Use my current location" |

### Tailwind CSS v4 Note

Use existing tokens from `src/index.css`:
- `bg-surface` — for search input and results dropdown background
- `bg-surface-raised` — for dropdown hover state
- `border-border` — for input and dropdown borders
- `text-foreground` / `text-muted-foreground` — for input text / placeholder
- `ring-primary` — for input focus ring
- Minimum tap target: `min-h-[44px]` on all interactive elements
- Existing pattern: `bg-background/80` (from RigFilterOverlay) — OK but `bg-surface` is more appropriate for an input field

### Testing Patterns

**Mock `navigator.geolocation` in Vitest (jsdom):**

```typescript
// In useGeolocation.test.ts
const mockGetCurrentPosition = vi.fn()

beforeEach(() => {
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: mockGetCurrentPosition,
    },
  })
})

// Success case:
mockGetCurrentPosition.mockImplementation((success) => {
  success({ coords: { latitude: 40.7, longitude: -74.0 } })
})

// Denied case:
mockGetCurrentPosition.mockImplementation((_, error) => {
  error({ code: 1 }) // 1 = PERMISSION_DENIED
})

// No geolocation API:
vi.stubGlobal('navigator', { geolocation: undefined })
```

**Mock `fetch` for Nominatim in SearchBar tests:**

```typescript
import { vi } from 'vitest'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

// Mock successful response:
vi.mocked(fetch).mockResolvedValue({
  ok: true,
  json: async () => [
    { lat: '40.7127281', lon: '-74.0060152', display_name: 'New York City, New York, United States' },
  ],
} as Response)
```

**Fake timers for debounce in SearchBar tests:**

```typescript
import { vi } from 'vitest'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

// After user types:
fireEvent.change(input, { target: { value: 'New York' } })
await vi.advanceTimersByTimeAsync(300)  // Trigger debounce
```

**Mock mapRef for SearchBar tests:**

```typescript
const mockSetView = vi.fn()
const mapRef = { current: { setView: mockSetView } as unknown as L.Map }

render(<SearchBar mapRef={mapRef} />, { wrapper: Wrapper })
```

**MapView test — `onMapReady` callthrough:**

The existing `vi.mock('./LeafletMap', () => ({ default: vi.fn(() => <div data-testid="leaflet-map" />) }))` mock doesn't call `onMapReady`, so `mapRef.current` will remain `null` in `MapView` tests. This is fine — `SearchBar` tests validate the actual integration via the `mapRef` mock. `MapView` tests only need to verify `SearchBar` is rendered.

### SearchBar Accessibility Notes

- `<input>` must have `aria-label="Search destination"` (not a visible label per UX)
- Results `<ul>` must have `id="search-results"` (matches `aria-controls` on input)
- Each result `<li>` must have `role="option"`
- `geoError` message must have `role="alert"` for screen readers
- All interactive elements: `min-h-[44px]` minimum tap target

### Project Structure After This Story

```
src/
  hooks/
    usePinsQuery.ts              ← existing (no change)
    useGeolocation.ts            ← create new (GPS hook)

  features/
    map/
      MapView.tsx                ← modified (overlay stack, mapRef, SearchBar)
      MapView.test.tsx           ← modified (SearchBar now rendered — update mocks)
      LeafletMap.tsx             ← modified (onMapReady prop)
      LeafletMap.test.tsx        ← modified (pass onMapReady to renders)
      SearchBar.tsx              ← create new
      SearchBar.test.tsx         ← create new
      RigFilterOverlay.tsx       ← modified (strip outer absolute positioning div)
      PinLayer.tsx               ← no change
      PinLayer.test.ts           ← no change
```

### References

- Story requirements: [_bmad-output/planning-artifacts/epics.md](_bmad-output/planning-artifacts/epics.md) — Epic 2, Story 2.1
- Architecture data flow: [_bmad-output/planning-artifacts/architecture.md](_bmad-output/planning-artifacts/architecture.md)
- UX search bar spec: [_bmad-output/planning-artifacts/ux-design-specification.md](_bmad-output/planning-artifacts/ux-design-specification.md)
- `useRigStore`: [overnighter/src/store/rigStore.ts](overnighter/src/store/rigStore.ts)
- `useUIStore`: [overnighter/src/store/uiStore.ts](overnighter/src/store/uiStore.ts)
- Current `MapView.tsx`: [overnighter/src/features/map/MapView.tsx](overnighter/src/features/map/MapView.tsx)
- Current `LeafletMap.tsx`: [overnighter/src/features/map/LeafletMap.tsx](overnighter/src/features/map/LeafletMap.tsx)
- Current `RigFilterOverlay.tsx`: [overnighter/src/features/map/RigFilterOverlay.tsx](overnighter/src/features/map/RigFilterOverlay.tsx)
- NFR-P5 bundle budget: architecture.md — "main ≤150KB gz; Leaflet ~40KB gz; total ≤250KB gz"
- Nominatim API: https://nominatim.openstreetmap.org/search (free, no API key, no npm package needed)

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

- SearchBar tests: 4 initial timeouts due to fake-timers + async fetch conflict; fixed with `act(async () => { await vi.advanceTimersByTimeAsync(300) })` pattern
- SearchBar mapRef typing: used `React.RefObject<unknown>` with runtime cast to avoid importing Leaflet in main bundle

### Completion Notes List

- Created `useGeolocation` hook — passive GPS wrapper, 3 error states (`denied`, `no-api`, `unavailable`), 10s timeout, no auto-request on mount
- Created `SearchBar` component — Nominatim geocoding with 300ms debounce (min 3 chars), "Near Me" GPS button with loading/error states, accessible combobox dropdown (`role="combobox"`, `aria-expanded`, `role="listbox"` / `role="option"`)
- Updated `LeafletMap` — added `onMapReady` + `onMapRemove` callback props for safe mapRef lifecycle management
- Updated `MapView` — floating overlay stack with `pointer-events-none` container pattern, `mapRef` via `useRef<L.Map | null>`, cleared on map remove
- Updated `RigFilterOverlay` — stripped absolute positioning wrapper div; parent MapView now handles layout via flex column
- Code review fixes: added `role="combobox"` + `aria-expanded` (M1), removed dead `isSearching` state (M2), added `unavailable` error test (M3), added `onMapRemove` null-reset (M4)
- 29 new tests total (9 useGeolocation + 19 SearchBar + 1 MapView), all 116 pass, 0 regressions

### Change Log

- 2026-03-18: Story 2.1 implemented — Location search via Nominatim API, GPS "Near Me" button, overlay stack refactor
- 2026-03-18: Code review fixes — ARIA combobox attributes, dead state removal, missing test coverage, mapRef lifecycle safety

### File List

- `overnighter/src/hooks/useGeolocation.ts` — created (GPS hook)
- `overnighter/src/hooks/useGeolocation.test.ts` — created (9 tests)
- `overnighter/src/features/map/SearchBar.tsx` — created (search + Near Me component)
- `overnighter/src/features/map/SearchBar.test.tsx` — created (17 tests)
- `overnighter/src/features/map/LeafletMap.tsx` — modified (added `onMapReady` + `onMapRemove` props)
- `overnighter/src/features/map/MapView.tsx` — modified (overlay stack, mapRef, SearchBar integration)
- `overnighter/src/features/map/MapView.test.tsx` — modified (SearchBar mock, +1 test)
- `overnighter/src/features/map/RigFilterOverlay.tsx` — modified (stripped absolute positioning wrapper)
