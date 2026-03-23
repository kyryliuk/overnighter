# Story 1.4: Map Shell & Rig Filter Reveal

Status: review

## Story

As a user who just completed onboarding,
I want to see the map immediately re-render with spots greyed out for rigs that don't fit my profile,
so that I experience the immediate payoff of setting up my rig and understand the app's core value.

## Acceptance Criteria

1. **Given** a user has just saved their rig profile during onboarding **When** they are redirected to the map view **Then** a Leaflet map renders centered on the user's approximate GPS location (or a default US location `[39.5, -98.35]` zoom 4 if GPS is denied/unavailable) **And** CartoDB Dark Matter tiles (`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`) are loaded.

2. **Given** the map renders with seed pin data from Supabase **When** the rig profile is active **Then** pins that exceed the user's rig constraints (length or height) are displayed as greyed-out circle markers (grey fill, 40% opacity) **And** pins that fit the rig are displayed as full-color green circle markers.

3. **Given** the map renders **When** a user with an active rig profile views the map **Then** a persistent "Filtering for: [RigClass], [length]ft" status bar is visible on the map at all times — not hidden, not conditional on pin load state.

4. **Given** a user with no rig profile (skipped onboarding via "Skip for now") **When** the map renders **Then** all pins are displayed in full color (no greying applied) **And** the rig status bar shows "No rig profile — set up your rig for filtered results" linking to `/onboarding`.

5. **Given** the map is loading pins from Supabase **When** pins are being fetched (TanStack Query `isLoading`) **Then** skeleton pin markers are displayed on the map — the map remains interactive and pannable during load (no full-screen spinner, no blocking the map).

6. **Given** the initial map load on a 4G connection **When** measured from first navigation to interactive map **Then** the map renders within 3 seconds (NFR-P1).

7. **Given** Leaflet is imported **When** the map component mounts **Then** Leaflet is loaded via `React.lazy()` on `LeafletMap.tsx` — NOT in the main bundle **And** the total initial JS bundle does not exceed 250KB gzipped (NFR-P5).

8. **Given** a user on iOS Safari **When** the map renders **Then** the map uses `100dvh` for viewport height so the address bar does not overlap the map **And** the Leaflet map instance has `tap: false` set to prevent iOS double-tap issues.

## Tasks / Subtasks

- [x] **Task 1: Extend rigStore with `onboardingDismissed` flag** (AC: 4)
  - [x] Add `onboardingDismissed: boolean` to `RigStore` interface in `src/store/rigStore.ts`
  - [x] Add `setOnboardingDismissed: () => void` action: `() => set({ onboardingDismissed: true })`
  - [x] Initialize `onboardingDismissed: false` in store state
  - [x] Include `onboardingDismissed` in persist (already covered by `{ name: 'rig-profile' }` key)

- [x] **Task 2: Update OnboardingScreen "Skip for now"** (AC: 4)
  - [x] In `OnboardingScreen.tsx`, read `setOnboardingDismissed` from `useRigStore`
  - [x] In `handleSkip()`, call `setOnboardingDismissed()` BEFORE `navigate('/')`

- [x] **Task 3: Update MapView redirect guard** (AC: 4)
  - [x] In `MapView.tsx`, also read `onboardingDismissed` from `useRigStore`
  - [x] Update guard to: `if (!hasRigProfile() && !onboardingDismissed)` → redirect to `/onboarding`
  - [x] This allows skipped users to land on map with no-filter overlay (AC4)

- [x] **Task 4: Create `src/features/map/RigFilterOverlay.tsx`** (AC: 3, 4)
  - [x] Props: none (reads store directly)
  - [x] Reads `rigProfile` and `onboardingDismissed` from `useRigStore`
  - [x] If `rigProfile.rigType` is set: render pill button "Filtering for: {rigType}, {lengthFt}ft" → `navigate('/rig-edit')`
  - [x] If `rigProfile.rigType` is null: render pill button "No rig profile — set up your rig for filtered results" → `navigate('/onboarding')`
  - [x] Always visible (both paths render a visible element)
  - [x] Position: `absolute top-4 left-1/2 -translate-x-1/2 z-10`
  - [x] Style: `bg-background/80 border border-border rounded-full px-4 py-2 text-sm text-foreground min-h-[44px] whitespace-nowrap`
  - [x] `type="button"` on button element (L1 pattern)

- [x] **Task 5: Create `src/lib/supabase/pins.ts`** (AC: 2, 5)
  - [x] Import `supabase` from `@/lib/supabase/client`
  - [x] Import `DbPin` from `@/lib/supabase/types`
  - [x] Import `Pin`, `PinAmenities`, `BadgeColor`, `PinSource` from `@/types/pin`
  - [x] Export `async function getAllPins(): Promise<Pin[]>` that calls `supabase.from('pins').select('*')`
  - [x] On error: throw Error with message
  - [x] Export `function dbPinToPin(db: DbPin): Pin` — transforms snake_case to camelCase:
    - `pinType: db.pin_type as PinSource`
    - `sourceId: db.source_id`
    - `maxLengthFt: db.max_length_ft`
    - `maxHeightFt: db.max_height_ft`
    - `badgeState: db.badge_state as BadgeColor`
    - `lastCheckInAt: db.last_check_in_at`
    - `recentCheckInCount: db.recent_check_in_count`
    - `isVerified: db.is_verified`
    - `isFlagged: db.is_flagged`
    - `createdAt: db.created_at`
    - `updatedAt: db.updated_at`
    - `amenities: db.amenities as PinAmenities`

- [x] **Task 6: Create `src/hooks/usePinsQuery.ts`** (AC: 2, 5)
  - [x] Import `useQuery` from `@tanstack/react-query`
  - [x] Import `getAllPins` from `@/lib/supabase/pins`
  - [x] Export `function usePinsQuery()` returning `useQuery({ queryKey: ['pins'], queryFn: getAllPins })`
  - [x] Return the query result as-is (consumers use `.data`, `.isLoading`, `.error`)
  - [x] Note: query key `['pins']` — Epic 2.2 will extend to `['pins', { viewport }]`

- [x] **Task 7: Create `src/features/map/PinLayer.tsx`** (AC: 2, 5)
  - [x] Props: `map: L.Map`, `pins: Pin[]`, `rigProfile: RigProfile`, `isLoading: boolean`
  - [x] Import `* as L from 'leaflet'` (static import — Leaflet is already in scope from `LeafletMap.tsx` lazy chunk)
  - [x] Use `useRef<L.CircleMarker[]>([])` for tracking markers
  - [x] `useEffect([map, pins, rigProfile, isLoading])`:
    - Clear all existing markers: `markersRef.current.forEach(m => m.remove()); markersRef.current = []`
    - If `isLoading`: render skeleton markers (see skeleton pattern below)
    - Otherwise: create a `L.circleMarker` for each pin with fit/grey style
  - [x] Inline `doesPinFitRig(pin: Pin, rigProfile: RigProfile): boolean` — see logic below
  - [x] Returns `null` (renders nothing to React DOM — only to Leaflet map)
  - [x] Cleanup return: removes all markers

- [x] **Task 8: Create `src/features/map/LeafletMap.tsx`** (AC: 1, 5, 6, 7, 8)
  - [x] Static imports: `import * as L from 'leaflet'` and `import 'leaflet/dist/leaflet.css'`
  - [x] These static imports ensure Leaflet is bundled in the lazy chunk (not main bundle)
  - [x] Props: `pins: Pin[]`, `isLoading: boolean`, `rigProfile: RigProfile`
  - [x] `containerRef = useRef<HTMLDivElement>(null)` — DOM container for map
  - [x] `const [mapInstance, setMapInstance] = useState<L.Map | null>(null)`
  - [x] Map init `useEffect([], [])`:
    - Guard: `if (!containerRef.current || mapInstance) return`
    - `const map = L.map(containerRef.current, { tap: false, center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM })`
    - Add CartoDB tile layer with `{r}` for retina (see tile URL in Dev Notes)
    - Add `tileerror` handler: remove CartoDB, add OSM fallback
    - Try GPS: `navigator.geolocation?.getCurrentPosition(pos => map.setView([...], 10), () => {}, { timeout: 5000 })`
    - Call `setMapInstance(map)`
    - Cleanup: `map.remove(); setMapInstance(null)`
  - [x] Render: outer `<div style={{ height: '100dvh', width: '100%' }}>` containing `<div ref={containerRef} style={{ height: '100%', width: '100%' }} aria-label="Map of camping spots" />`
  - [x] When `mapInstance` is ready, render `<PinLayer map={mapInstance} pins={pins} rigProfile={rigProfile} isLoading={isLoading} />`

- [x] **Task 9: Update `src/features/map/MapView.tsx`** (AC: 1, 3, 4, 7, 8)
  - [x] Add `const LeafletMap = lazy(() => import('./LeafletMap'))` at top of file (same lazy pattern as App.tsx routes)
  - [x] Add `import RigFilterOverlay from './RigFilterOverlay'`
  - [x] Add `import { usePinsQuery } from '@/hooks/usePinsQuery'`
  - [x] Remove the inline rig context indicator (moved to `RigFilterOverlay`)
  - [x] Update redirect guard to include `onboardingDismissed` (Task 3)
  - [x] Connect `const { data: pins = [], isLoading } = usePinsQuery()`
  - [x] Replace placeholder `<div>Map View (Story 1.4)</div>` with lazy LeafletMap + Suspense
  - [x] Remove `min-h-screen` from the outer wrapper (replaced by `100dvh`)
  - [x] Add `import { Suspense } from 'react'` if not already present

- [x] **Task 10: Write tests** (AC: 1–8)
  - [x] `src/features/map/LeafletMap.test.tsx` — created new, co-located (6 tests)
  - [x] `src/features/map/MapView.test.tsx` — updated (9 tests: 3 redirect + 6 overlay)
  - [x] `src/store/rigStore.test.ts` — updated (2 new tests for onboardingDismissed)
  - [x] All 74 tests pass, 0 regressions

## Dev Notes

### Critical Architecture Guardrails

**DO NOT break these rules:**

- **No react-leaflet.** Use vanilla Leaflet imperative API via `L.map()`. `react-leaflet` is NOT in the dependencies and must NOT be installed.
- **Leaflet in lazy chunk.** `LeafletMap.tsx` statically imports `leaflet` and `leaflet/dist/leaflet.css`. `MapView.tsx` uses `React.lazy(() => import('./LeafletMap'))`. This ensures Leaflet (~40KB gz) is excluded from the main bundle (NFR-P5: main ≤150KB gz total).
- **No snake_case leaks.** `src/lib/supabase/pins.ts` is the ONLY place that handles `DbPin` (snake_case). Everything passed to React components is `Pin` (camelCase).
- **No direct Supabase calls in components.** All Supabase queries go through `src/lib/supabase/pins.ts`, surfaced via `src/hooks/usePinsQuery.ts` (TanStack Query). Never `supabase.from('pins')` directly in a component.
- **No cross-feature imports.** `RigFilterOverlay.tsx`, `LeafletMap.tsx`, `PinLayer.tsx` are all in `src/features/map/`. They must NOT import from `src/features/rig-profile/`.
- **Tests co-located** — all new test files in `src/features/map/` next to their source files.
- **`doesPinFitRig` is local to `src/features/map/`.** Do NOT put it in `src/store/rigStore.ts`. The architecture specifies `src/lib/pin-model/` for this eventually — for Story 1.4, inline it in `PinLayer.tsx`.

### `doesPinFitRig` Logic

A pin is GREYED when the user's rig EXCEEDS the pin's constraints:

```typescript
function doesPinFitRig(pin: Pin, rigProfile: RigProfile): boolean {
  if (!rigProfile.rigType) return true // No profile → all pins fit (no greying)

  const lengthOk =
    pin.maxLengthFt === null ||         // pin has no length limit
    rigProfile.lengthFt === null ||      // user hasn't set length
    rigProfile.lengthFt <= pin.maxLengthFt // rig fits

  const heightOk =
    pin.maxHeightFt === null ||
    rigProfile.heightFt === null ||
    rigProfile.heightFt <= pin.maxHeightFt

  return lengthOk && heightOk
}
```

### LeafletMap Constants

```typescript
const CARTO_DARK_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const OSM_FALLBACK_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const DEFAULT_CENTER: [number, number] = [39.5, -98.35] // Center of continental US
const DEFAULT_ZOOM = 4
```

**IMPORTANT — `{r}` in CartoDB URL:** The `{r}` placeholder is Leaflet's retina tile syntax. Do NOT substitute it manually — Leaflet replaces it with `@2x` on retina displays automatically. Use the URL exactly as shown.

### Tile Layer Setup (with fallback)

```typescript
// In LeafletMap.tsx useEffect
const cartoTile = L.tileLayer(CARTO_DARK_URL, {
  attribution: '© <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 19,
})

const osmFallback = L.tileLayer(OSM_FALLBACK_URL, {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
})

cartoTile.on('tileerror', () => {
  if (map.hasLayer(cartoTile)) {
    cartoTile.remove()
    osmFallback.addTo(map)
  }
})

cartoTile.addTo(map)
```

### Leaflet Map Init (iOS fix + GPS)

```typescript
// In LeafletMap.tsx
const map = L.map(containerRef.current, {
  center: DEFAULT_CENTER,
  zoom: DEFAULT_ZOOM,
  tap: false, // CRITICAL: prevents iOS double-tap ghost events
})

// Attempt GPS location after tiles are ready
navigator.geolocation?.getCurrentPosition(
  (position) => {
    map.setView([position.coords.latitude, position.coords.longitude], 10)
  },
  () => {
    // GPS denied or unavailable — keep default US center (silent failure)
  },
  { timeout: 5000 }
)
```

### PinLayer Marker Styles

```typescript
// Fit pin: full-color green circle marker
const fitStyle: L.CircleMarkerOptions = {
  radius: 8,
  fillColor: '#22c55e',   // green-500
  fillOpacity: 0.9,
  color: '#16a34a',       // green-600 border
  weight: 2,
}

// Unfit pin: greyed-out, low opacity
const unfitStyle: L.CircleMarkerOptions = {
  radius: 8,
  fillColor: '#6b7280',   // gray-500
  fillOpacity: 0.35,
  color: '#4b5563',       // gray-600 border
  weight: 1,
}
```

### Skeleton Markers Pattern

When `isLoading = true`, render placeholder markers at a known grid or no markers at all (map itself renders tiles as skeleton content). For MVP, the simplest approach: render nothing during load (tiles still appear, map is interactive). The loading state is communicated via the query state but the map is never blocked.

```typescript
// In PinLayer.tsx useEffect
if (isLoading) {
  // Tiles still load; no markers yet — map is interactive
  // Future: SkeletonPin markers from src/components/SkeletonPin.tsx (Epic 2 scope)
  return
}
```

### Vitest Leaflet Mock

In `LeafletMap.test.tsx`, mock the entire `leaflet` module before tests:

```typescript
const mockMap = {
  remove: vi.fn(),
  setView: vi.fn(),
}

const mockTileLayer = {
  on: vi.fn().mockReturnThis(),
  addTo: vi.fn().mockReturnThis(),
  remove: vi.fn(),
}

vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => mockMap),
    tileLayer: vi.fn(() => mockTileLayer),
    circleMarker: vi.fn(() => ({ addTo: vi.fn(), remove: vi.fn() })),
  },
  map: vi.fn(() => mockMap),
  tileLayer: vi.fn(() => mockTileLayer),
  circleMarker: vi.fn(() => ({ addTo: vi.fn(), remove: vi.fn() })),
}))
```

**CSS import in tests:** `import 'leaflet/dist/leaflet.css'` is a no-op in Vitest's jsdom environment. No mock needed — CSS transforms are handled by Vite (the test runner ignores CSS by default in jsdom mode).

### MapView.tsx Updated Redirect Guard

```typescript
// Add to existing MapView store reads:
const onboardingDismissed = useRigStore((state) => state.onboardingDismissed)

// Updated redirect guard:
useEffect(() => {
  if (!hasRigProfile() && !onboardingDismissed) {
    navigate('/onboarding', { replace: true })
  }
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

### rigStore.ts Updated Interface

```typescript
interface RigStore {
  rigProfile: RigProfile
  onboardingDismissed: boolean            // NEW: true after Skip or Save
  setRigProfile: (profile: RigProfile) => void
  clearRigProfile: () => void
  hasRigProfile: () => boolean
  setOnboardingDismissed: () => void      // NEW
}

// In store factory:
onboardingDismissed: false,
setOnboardingDismissed: () => set({ onboardingDismissed: true }),
```

### OnboardingScreen Skip Update

```typescript
// Existing handleSkip in OnboardingScreen.tsx
const setOnboardingDismissed = useRigStore((state) => state.setOnboardingDismissed)

function handleSkip() {
  setOnboardingDismissed()  // NEW: mark as seen before navigating
  navigate('/')
}
```

Note: `handleSave` does NOT need to call `setOnboardingDismissed()` because `hasRigProfile()` already returns true after save, which satisfies the redirect guard independently.

### `src/lib/supabase/pins.ts` Structure

```typescript
import { supabase } from '@/lib/supabase/client'
import type { DbPin } from '@/lib/supabase/types'
import type { Pin, PinAmenities, BadgeColor, PinSource } from '@/types/pin'

export function dbPinToPin(db: DbPin): Pin {
  return {
    id: db.id,
    name: db.name,
    description: db.description,
    latitude: db.latitude,
    longitude: db.longitude,
    pinType: db.pin_type as PinSource,
    sourceId: db.source_id,
    maxLengthFt: db.max_length_ft,
    maxHeightFt: db.max_height_ft,
    amenities: db.amenities as PinAmenities,
    badgeState: db.badge_state as BadgeColor,
    lastCheckInAt: db.last_check_in_at,
    recentCheckInCount: db.recent_check_in_count,
    isVerified: db.is_verified,
    isFlagged: db.is_flagged,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  }
}

export async function getAllPins(): Promise<Pin[]> {
  const { data, error } = await supabase.from('pins').select('*')
  if (error) throw new Error(`Failed to fetch pins: ${error.message}`)
  return (data as DbPin[]).map(dbPinToPin)
}
```

### `src/hooks/usePinsQuery.ts` Structure

```typescript
import { useQuery } from '@tanstack/react-query'
import { getAllPins } from '@/lib/supabase/pins'

export function usePinsQuery() {
  return useQuery({
    queryKey: ['pins'],
    queryFn: getAllPins,
  })
}
```

TanStack Query key `['pins']` is intentionally minimal for Story 1.4. Epic 2.2 will extend this to `['pins', { viewport: { ne, sw } }]` for viewport-based fetching. Do NOT pre-optimize with viewport params now.

### RigFilterOverlay.tsx Full Pattern

```typescript
import { useNavigate } from 'react-router-dom'
import { useRigStore } from '@/store/rigStore'

export default function RigFilterOverlay() {
  const navigate = useNavigate()
  const rigProfile = useRigStore((state) => state.rigProfile)

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
      {rigProfile.rigType ? (
        <button
          type="button"
          onClick={() => navigate('/rig-edit')}
          className="bg-background/80 border border-border rounded-full px-4 py-2 text-sm text-foreground min-h-[44px] whitespace-nowrap"
        >
          Filtering for: {rigProfile.rigType}, {rigProfile.lengthFt}ft
        </button>
      ) : (
        <button
          type="button"
          onClick={() => navigate('/onboarding')}
          className="bg-background/80 border border-border rounded-full px-4 py-2 text-sm text-muted-foreground min-h-[44px] whitespace-nowrap"
        >
          No rig profile — set up your rig for filtered results
        </button>
      )}
    </div>
  )
}
```

### MapView.tsx Final Shape

```typescript
import { useEffect, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRigStore } from '@/store/rigStore'
import { usePinsQuery } from '@/hooks/usePinsQuery'
import RigFilterOverlay from './RigFilterOverlay'

const LeafletMap = lazy(() => import('./LeafletMap'))

export default function MapView() {
  const navigate = useNavigate()
  const hasRigProfile = useRigStore((state) => state.hasRigProfile)
  const rigProfile = useRigStore((state) => state.rigProfile)
  const onboardingDismissed = useRigStore((state) => state.onboardingDismissed)
  const { data: pins = [], isLoading } = usePinsQuery()

  useEffect(() => {
    if (!hasRigProfile() && !onboardingDismissed) {
      navigate('/onboarding', { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative bg-background" style={{ height: '100dvh' }}>
      <RigFilterOverlay />
      <Suspense
        fallback={
          <div className="flex items-center justify-center" style={{ height: '100dvh' }}>
            <span className="text-muted-foreground text-sm">Loading map…</span>
          </div>
        }
      >
        <LeafletMap pins={pins} isLoading={isLoading} rigProfile={rigProfile} />
      </Suspense>
    </div>
  )
}
```

### Project Structure After This Story

```
src/features/map/
  MapView.tsx                ← modified (lazy LeafletMap, RigFilterOverlay, usePinsQuery)
  MapView.test.tsx           ← modified (new tests for map shell)
  LeafletMap.tsx             ← create new (Leaflet instance + tiles + GPS)
  LeafletMap.test.tsx        ← create new (mocked Leaflet tests)
  PinLayer.tsx               ← create new (markers + rig-aware greying)
  RigFilterOverlay.tsx       ← create new (extracted + enhanced status bar)

src/lib/supabase/
  client.ts                  ← existing (no change)
  types.ts                   ← existing (no change)
  pins.ts                    ← create new (getAllPins, dbPinToPin)

src/hooks/
  usePinsQuery.ts            ← create new

src/store/
  rigStore.ts                ← modified (add onboardingDismissed)
  rigStore.test.ts           ← modified (test new field)

src/features/rig-profile/
  OnboardingScreen.tsx       ← modified (call setOnboardingDismissed on skip)
```

### Tailwind CSS v4 Reminder

- Use `@theme` CSS variables only — tokens in `src/index.css`
- Tokens: `bg-background`, `bg-background/80`, `text-foreground`, `text-muted-foreground`, `border-border`
- Do NOT use `@layer base` — it caused build failures in Story 1.1
- `bg-background/80` = background color at 80% opacity (Tailwind v4 opacity modifier syntax)

### Testing Setup Pattern

```typescript
// In MapView.test.tsx and LeafletMap.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRigStore } from '@/store/rigStore'

// Create fresh QueryClient per test to avoid cache pollution
function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

// Wrapper with all providers
function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

// Reset store between tests
beforeEach(() => {
  useRigStore.getState().clearRigProfile()
  // onboardingDismissed resets to false via clearRigProfile? No — add explicit reset:
  useRigStore.setState({ onboardingDismissed: false })
  localStorage.clear()
})
```

**Note on Zustand persist in tests:** The `persist` middleware writes to `localStorage`. Always call `localStorage.clear()` in `beforeEach`. For `onboardingDismissed`, since it's in the persisted store, also call `useRigStore.setState({ onboardingDismissed: false })` explicitly to ensure clean state between tests.

### `usePinsQuery` Mock in MapView Tests

```typescript
vi.mock('@/hooks/usePinsQuery', () => ({
  usePinsQuery: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
}))
```

Seed test data when needed:
```typescript
;(usePinsQuery as ReturnType<typeof vi.fn>).mockReturnValue({
  data: [{ id: '1', name: 'Test Pin', latitude: 40.0, longitude: -90.0, maxLengthFt: 40, maxHeightFt: 12.5, /* ... */ }],
  isLoading: false,
  error: null,
})
```

### Supabase Environment Variables

Already configured in Story 1.1:
- `VITE_SUPABASE_URL` — set in `.env.local` (not committed)
- `VITE_SUPABASE_ANON_KEY` — set in `.env.local` (not committed)

In tests, `supabase.from('pins').select('*')` must be mocked:
```typescript
vi.mock('@/lib/supabase/pins', () => ({
  getAllPins: vi.fn(() => Promise.resolve([])),
}))
```

Or mock the Supabase client directly if testing the pins helper itself.

### References

- Story requirements: [_bmad-output/planning-artifacts/epics.md](_bmad-output/planning-artifacts/epics.md) (lines 330–374)
- Architecture map section: [_bmad-output/planning-artifacts/architecture.md](_bmad-output/planning-artifacts/architecture.md#frontend-architecture)
- Architecture data flow: [_bmad-output/planning-artifacts/architecture.md](_bmad-output/planning-artifacts/architecture.md#integration-points)
- UX map stack: [_bmad-output/planning-artifacts/ux-design-specification.md](_bmad-output/planning-artifacts/ux-design-specification.md#map-stack) (CartoDB tile URL, tap:false, 100dvh)
- Pin type definition: [overnighter/src/types/pin.ts](overnighter/src/types/pin.ts)
- Supabase DB types: [overnighter/src/lib/supabase/types.ts](overnighter/src/lib/supabase/types.ts)
- Supabase client: [overnighter/src/lib/supabase/client.ts](overnighter/src/lib/supabase/client.ts)
- Rig store: [overnighter/src/store/rigStore.ts](overnighter/src/store/rigStore.ts)
- Current MapView: [overnighter/src/features/map/MapView.tsx](overnighter/src/features/map/MapView.tsx)
- App.tsx routing pattern: [overnighter/src/App.tsx](overnighter/src/App.tsx)
- Architecture project structure: [_bmad-output/planning-artifacts/architecture.md](_bmad-output/planning-artifacts/architecture.md#project-structure)
- NFR-P5 bundle budget: architecture.md — "main ≤150KB gz; Leaflet ~40KB gz; admin ~30KB gz; total ≤250KB gz"

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- No issues. Leaflet mocked cleanly in jsdom via `vi.mock('leaflet', ...)`. PinLayer also mocked in LeafletMap tests to prevent double-init conflicts.

### Completion Notes List

- ✅ Task 1: Added `onboardingDismissed: boolean` + `setOnboardingDismissed()` to `useRigStore`. Persisted via existing `{ name: 'rig-profile' }` key.
- ✅ Task 2: `OnboardingScreen.tsx` handleSkip now calls `setOnboardingDismissed()` before `navigate('/')`. Enables skip path to land on map (AC4).
- ✅ Task 3: MapView redirect guard updated to `if (!hasRigProfile() && !onboardingDismissed)` — skipped users bypass redirect.
- ✅ Task 4: `RigFilterOverlay.tsx` created. Has-profile path: "Filtering for: {class}, {length}ft" → /rig-edit. No-profile path: "No rig profile — set up your rig for filtered results" → /onboarding. Both always visible.
- ✅ Task 5: `src/lib/supabase/pins.ts` created with `dbPinToPin()` (snake→camelCase transform) and `getAllPins()`.
- ✅ Task 6: `src/hooks/usePinsQuery.ts` created with TanStack Query key `['pins']`.
- ✅ Task 7: `PinLayer.tsx` created. `doesPinFitRig()` inline. Fit pins: green (#22c55e, 0.9 opacity). Unfit: grey (#6b7280, 0.35 opacity). No markers during isLoading.
- ✅ Task 8: `LeafletMap.tsx` created. CartoDB Dark Matter tiles + OSM fallback on tileerror. `tap: false` (iOS). GPS with 5s timeout + silent fallback. `100dvh` container. Renders `<PinLayer>` once map is initialized.
- ✅ Task 9: `MapView.tsx` fully updated. `React.lazy(() => import('./LeafletMap'))` keeps Leaflet out of main bundle. Suspense fallback. RigFilterOverlay + usePinsQuery connected.
- ✅ Task 10: 74 tests pass (0 regressions). 6 new LeafletMap tests, 9 MapView tests (3 redirect + 6 overlay), 2 rigStore tests. All with mocked Leaflet, LeafletMap, and usePinsQuery.

### File List

- `overnighter/src/store/rigStore.ts` — modified (onboardingDismissed + setOnboardingDismissed)
- `overnighter/src/store/rigStore.test.ts` — modified (2 new tests for onboardingDismissed)
- `overnighter/src/features/rig-profile/OnboardingScreen.tsx` — modified (setOnboardingDismissed on skip)
- `overnighter/src/features/map/RigFilterOverlay.tsx` — created
- `overnighter/src/lib/supabase/pins.ts` — created (dbPinToPin, getAllPins)
- `overnighter/src/hooks/usePinsQuery.ts` — created
- `overnighter/src/features/map/PinLayer.tsx` — created (doesPinFitRig, marker lifecycle)
- `overnighter/src/features/map/LeafletMap.tsx` — created (Leaflet init, CartoDB, GPS, iOS fix)
- `overnighter/src/features/map/LeafletMap.test.tsx` — created (6 tests)
- `overnighter/src/features/map/MapView.tsx` — modified (lazy LeafletMap, RigFilterOverlay, usePinsQuery, 100dvh)
- `overnighter/src/features/map/MapView.test.tsx` — modified (9 tests)
- `overnighter/.npmrc` — created (legacy-peer-deps=true for Vercel deployment peer dep conflict)
- `overnighter/vercel.json` — modified (removed stale functions block with wrong @vercel/node version)
- `overnighter/.gitignore` — modified (added .vercel to ignored paths)
