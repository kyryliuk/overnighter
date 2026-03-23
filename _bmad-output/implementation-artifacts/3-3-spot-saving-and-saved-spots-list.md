# Story 3.3: Spot Saving & Saved Spots List

Status: done

## Story

As a user,
I want to save a spot pin for quick reference and view all my saved spots in a list,
so that I can bookmark promising stops and return to them without searching the map again.

## Acceptance Criteria

**AC1 — Bookmark toggles save state**
Given the pin detail sheet is open
When the user taps the save/bookmark icon
Then the spot is added to the `useSpotsStore` Zustand store
And the store persists the saved spots array to localStorage immediately
And the bookmark icon updates to a filled/active state

**AC2 — Active state on re-open**
Given a spot is already saved
When the user opens the same pin detail sheet
Then the bookmark icon is shown in its active/filled state (aria-pressed="true")

**AC3 — Toggle off removes spot**
Given a spot is saved and the user taps the active bookmark icon
When the action completes
Then the spot is removed from `useSpotsStore` and localStorage
And the bookmark icon returns to its inactive state (aria-pressed="false")

**AC4 — Saved spots list**
Given the user navigates to `/saved`
When the saved spots list renders
Then all saved spots are displayed as a scrollable list with: spot name, category label, recency badge, and distance from current location (if GPS available)

**AC5 — Tap navigates to pin**
Given the saved spots list is displayed
When the user taps a spot in the list
Then the map re-centers on that spot's coordinates and opens its pin detail sheet at `/pin/:id`

**AC6 — Empty state**
Given the user has no saved spots
When they navigate to `/saved`
Then an empty state is shown: "No saved spots yet — tap the bookmark icon on any pin to save it"

**AC7 — Persistence across sessions**
Given saved spots are stored in localStorage
When the user closes and reopens the app
Then all previously saved spots are still present in the list (handled by Zustand `persist` middleware — already implemented)

## Tasks / Subtasks

- [x] Task 1: Move `RecencyBadge` to shared components (AC4)
  - [x] 1.1: Move `src/features/pin-detail/RecencyBadge.tsx` → `src/components/RecencyBadge.tsx`
    - File content is IDENTICAL — this is a pure rename/move, NO logic changes
    - Update the `export default function RecencyBadge` — no other changes
  - [x] 1.2: Move `src/features/pin-detail/RecencyBadge.test.tsx` → `src/components/RecencyBadge.test.tsx`
    - Update the import path only: `from './RecencyBadge'` (relative, now in `src/components/`)
    - All 5 tests must continue to pass unchanged
  - [x] 1.3: Update import in `src/features/pin-detail/PinDetailSheet.tsx`
    - Change `import RecencyBadge from './RecencyBadge'` → `import RecencyBadge from '@/components/RecencyBadge'`
    - No other changes to PinDetailSheet.tsx in this subtask

- [x] Task 2: Add `pendingMapCenter` to UIStore (AC5)
  - [x] 2.1: Update `src/store/uiStore.ts`
    - Add to `UIStore` interface:
      ```typescript
      pendingMapCenter: { lat: number; lng: number } | null
      setPendingMapCenter: (coords: { lat: number; lng: number } | null) => void
      ```
    - Add initial state: `pendingMapCenter: null`
    - Add action: `setPendingMapCenter: (coords) => set({ pendingMapCenter: coords })`
  - [x] 2.2: Update `src/features/map/MapView.tsx` to consume `pendingMapCenter`
    - Add to UIStore subscriptions:
      ```typescript
      const pendingMapCenter = useUIStore((state) => state.pendingMapCenter)
      ```
    - Add `mapRef` usage — MapView already receives the map instance from LeafletMap via `onMapReady`. Verify the existing `mapRef` pattern and use it. If `mapRef` doesn't exist yet, add it with the existing `onMapReady` callback.
    - Add `useEffect`:
      ```typescript
      useEffect(() => {
        if (pendingMapCenter && mapRef.current) {
          mapRef.current.setView([pendingMapCenter.lat, pendingMapCenter.lng], 14)
          useUIStore.getState().setPendingMapCenter(null)
        }
      }, [pendingMapCenter]) // eslint-disable-line react-hooks/exhaustive-deps
      ```
    - Note: zoom level 14 gives a ~1km radius view — appropriate for showing a single stop
    - CRITICAL: Read `src/features/map/MapView.tsx` completely before editing — understand existing `mapRef` pattern from `onMapReady` prop

- [x] Task 3: Add bookmark button to `PinDetailSheet.tsx` (AC1, AC2, AC3)
  - [x] 3.1: Import `useSpotsStore` in `src/features/pin-detail/PinDetailSheet.tsx`
    - Add: `import { useSpotsStore } from '@/store/spotsStore'`
  - [x] 3.2: Add bookmark state inside component
    - Use selector subscription (not `.getState()`):
      ```typescript
      const isSaved = useSpotsStore((state) => state.isSaved(pin?.id ?? ''))
      ```
    - Note: compute `isSaved` reactively so the UI updates when `savedSpots` changes in other contexts
  - [x] 3.3: Add `handleBookmark` function
    ```typescript
    function handleBookmark() {
      if (!pin) return
      if (isSaved) {
        useSpotsStore.getState().removeSpot(pin.id)
      } else {
        useSpotsStore.getState().saveSpot(pin)
      }
    }
    ```
  - [x] 3.4: Add bookmark button to the sheet header (only in "pin found" branch)
    - Position: in the top bar row alongside the close button (top-right area)
    - Place the bookmark button to the LEFT of the close button
    - Styling:
      ```tsx
      <button
        onClick={handleBookmark}
        aria-label={isSaved ? 'Remove from saved spots' : 'Save spot'}
        aria-pressed={isSaved}
        className="absolute top-4 right-14 text-muted-foreground hover:text-foreground p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
        style={isSaved ? { color: '#0ea5e9' } : undefined}
      >
        {isSaved ? '★' : '☆'}
      </button>
      ```
    - `right-14` positions it left of the close button at `right-4` (close button already uses `right-4`)
    - Sky-blue `#0ea5e9` when active — consistent with "Get Directions" primary color
    - `★`/`☆` Unicode stars — simple, readable, no icon library needed
    - IMPORTANT: The bookmark button renders ONLY in the "pin found" branch, NOT in loading/error/not-found branches. The close button is outside this conditional so it always renders. The bookmark button goes INSIDE the "pin found" conditional block or at the sheet level but only when `pin` is defined.
    - CRITICAL: Place button inside the outermost sheet div (sibling to the scrollable content div), before the scrollable content. The sheet structure is: drag handle → close button (absolute) → scrollable content. Add bookmark button as another absolute-positioned button.

- [x] Task 4: Implement `SavedSpotsScreen.tsx` (AC4, AC5, AC6)
  - [x] 4.1: Replace stub in `src/features/saved-spots/SavedSpotsScreen.tsx`
    - Imports needed:
      ```typescript
      import { useNavigate } from 'react-router-dom'
      import { useSpotsStore } from '@/store/spotsStore'
      import { useUIStore } from '@/store/uiStore'
      import { useGeolocation } from '@/hooks/useGeolocation'
      import RecencyBadge from '@/components/RecencyBadge'
      import type { Pin, PinSource } from '@/types/pin'
      ```
    - Define inline (NOT imported from pin-detail — no cross-feature imports):
      ```typescript
      const PIN_TYPE_LABELS: Record<PinSource, string> = {
        blm: 'BLM Land',
        usfs: 'National Forest',
        nps: 'National Park',
        overpass: 'OpenStreetMap',
        community: 'Community Stop',
      }
      ```
    - Define inline haversine distance utility:
      ```typescript
      function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 3959 // Earth radius in miles
        const dLat = ((lat2 - lat1) * Math.PI) / 180
        const dLng = ((lng2 - lng1) * Math.PI) / 180
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      }
      ```
  - [x] 4.2: Implement component body
    ```typescript
    export default function SavedSpotsScreen() {
      const navigate = useNavigate()
      const savedSpots = useSpotsStore((state) => state.savedSpots)
      const [geoState, requestGeo] = useGeolocation()

      // Auto-request GPS on mount for distance display
      useEffect(() => { requestGeo() }, []) // eslint-disable-line react-hooks/exhaustive-deps

      function handleSpotTap(pin: Pin) {
        useUIStore.getState().setPendingMapCenter({ lat: pin.latitude, lng: pin.longitude })
        useUIStore.getState().setSelectedPin(pin.id)
        navigate('/pin/' + pin.id)
      }
      // ...
    }
    ```
  - [x] 4.3: Render structure
    - Full-screen layout: `className="min-h-screen bg-background text-foreground"`
    - Header bar: "Saved Spots" title (h1) + "← Map" back button (navigates to `/`)
    - Back button: `onClick={() => navigate('/')}` — left of header, `aria-label="Back to map"`
    - Empty state (when `savedSpots.length === 0`):
      ```tsx
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-16 text-center">
        <p className="text-muted-foreground mb-2">No saved spots yet</p>
        <p className="text-sm text-muted-foreground">Tap the bookmark icon on any pin to save it</p>
      </div>
      ```
    - Spot list: `<ul role="list">` with each spot as `<li>`:
      ```tsx
      <li key={pin.id}>
        <button
          onClick={() => handleSpotTap(pin)}
          className="w-full text-left px-4 py-3 border-b border-border flex flex-col gap-1 hover:bg-muted/20 active:bg-muted/30"
          aria-label={`View ${pin.name}`}
        >
          <span className="font-semibold text-foreground">{pin.name}</span>
          <span className="text-sm text-muted-foreground">{PIN_TYPE_LABELS[pin.pinType] ?? pin.pinType}</span>
          <div className="flex items-center gap-3 mt-1">
            <RecencyBadge badgeState={pin.badgeState} />
            {geoState.coords && (
              <span className="text-xs text-muted-foreground">
                {distanceMiles(
                  geoState.coords.latitude,
                  geoState.coords.longitude,
                  pin.latitude,
                  pin.longitude,
                ).toFixed(1)} mi
              </span>
            )}
          </div>
        </button>
      </li>
      ```

- [x] Task 5: Add tests (AC1–AC7)
  - [x] 5.1: Add bookmark tests to `src/features/pin-detail/PinDetailSheet.test.tsx`
    - Add to imports: `import { useSpotsStore } from '@/store/spotsStore'`
    - Add to existing `beforeEach`: `useSpotsStore.setState({ savedSpots: [] })`
    - New describe block `'PinDetailSheet bookmark button'`:
      - Test: bookmark button renders when pin is found
      - Test: bookmark button does NOT render when loading
      - Test: bookmark button does NOT render when pin not found
      - Test: bookmark button does NOT render when error state
      - Test: bookmark button has `aria-pressed="false"` when pin is not saved
      - Test: bookmark button has `aria-pressed="true"` when pin is already saved
      - Test: clicking bookmark button (unsaved pin) calls `saveSpot` — verify `useSpotsStore.getState().isSaved('pin-1')` is true
      - Test: clicking bookmark button (saved pin) calls `removeSpot` — verify `useSpotsStore.getState().isSaved('pin-1')` is false after click

  - [x] 5.2: Create `src/features/saved-spots/SavedSpotsScreen.test.tsx`
    - Mock pattern:
      ```typescript
      const mockNavigate = vi.fn()
      vi.mock('react-router-dom', async () => {
        const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
        return { ...actual, useNavigate: () => mockNavigate }
      })
      ```
    - Mock `useGeolocation`:
      ```typescript
      const { mockUseGeolocation } = vi.hoisted(() => ({
        mockUseGeolocation: vi.fn(() => [
          { isLoading: false, coords: null, error: null },
          vi.fn(),
        ]),
      }))
      vi.mock('@/hooks/useGeolocation', () => ({ useGeolocation: mockUseGeolocation }))
      ```
    - Render helper using `MemoryRouter`:
      ```typescript
      function renderScreen() {
        return render(
          <MemoryRouter initialEntries={['/saved']}>
            <Routes>
              <Route path="/saved" element={<SavedSpotsScreen />} />
            </Routes>
          </MemoryRouter>
        )
      }
      ```
    - `beforeEach`: `mockNavigate.mockClear()` + `useSpotsStore.setState({ savedSpots: [] })` + reset geo mock
    - `afterEach`: `vi.restoreAllMocks()`
    - Tests:
      - renders heading "Saved Spots"
      - renders empty state when no saved spots
      - empty state message mentions "bookmark icon"
      - renders list of saved spot names when spots exist
      - renders category label for each spot
      - renders RecencyBadge for each spot
      - shows distance in miles when GPS coords available
      - does NOT show distance when GPS not available
      - clicking a spot navigates to `/pin/:id`
      - clicking a spot calls `setSelectedPin` with the pin's id
      - clicking a spot calls `setPendingMapCenter` with pin's lat/lng
      - clicking "Back to map" navigates to `/`

## Dev Notes

### Critical: RecencyBadge move — do it first, before all other tasks

Task 1 (moving RecencyBadge) must be done before Task 4 (SavedSpotsScreen) because SavedSpotsScreen imports from `@/components/RecencyBadge`. Do Task 1 first, run tests to confirm 0 regressions, then proceed.

After the move:
- `src/features/pin-detail/RecencyBadge.tsx` → **DELETE** (moved to `src/components/`)
- `src/features/pin-detail/RecencyBadge.test.tsx` → **DELETE** (moved to `src/components/`)
- New: `src/components/RecencyBadge.tsx`
- New: `src/components/RecencyBadge.test.tsx`
- Modified: `src/features/pin-detail/PinDetailSheet.tsx` — import path updated

### Critical: `isSaved` reactive subscription pattern

Use Zustand selector subscription (NOT `.getState()`) for `isSaved` so the UI re-renders when saved spots change:

```typescript
// ✅ CORRECT — reactive, re-renders when savedSpots changes
const isSaved = useSpotsStore((state) => state.isSaved(pin?.id ?? ''))

// ❌ WRONG — reads once at render, not reactive
const isSaved = useSpotsStore.getState().isSaved(pin?.id ?? '')
```

The `pin` may be undefined while loading. Use `pin?.id ?? ''` — `isSaved('')` returns false (no pin has empty id).

### Critical: MapView mapRef pattern

Read `src/features/map/MapView.tsx` completely before Task 2.2. The map instance is exposed via the `onMapReady` callback prop on `<LeafletMap>`. MapView stores it in a ref:

```typescript
const mapRef = useRef<L.Map | null>(null)
// ...
<LeafletMap
  onMapReady={(map) => { mapRef.current = map }}
  onMapRemove={() => { mapRef.current = null }}
  ...
/>
```

Use `mapRef.current.setView(...)` — this is the ONLY safe way to control the Leaflet map from React.

If `mapRef` doesn't exist yet in MapView (check first!), add it alongside the `onMapReady` callback.

### Critical: Bookmark button placement — z-index and positioning

The sheet structure (from Story 3.1):
```tsx
<>
  {/* Backdrop */}
  <div data-testid="pin-detail-backdrop" className="fixed inset-0 bg-black/50 z-20" onClick={handleDismiss} aria-hidden="true" />
  {/* Sheet */}
  <div role="dialog" ... className="fixed bottom-0 left-0 right-0 z-30 ... flex flex-col">
    {/* Drag handle */}
    <div className="flex justify-center pt-3 pb-1 flex-shrink-0"> ... </div>
    {/* Close button — absolute top-4 right-4 */}
    <button aria-label="Close pin details" className="absolute top-4 right-4 ...">✕</button>
    {/* Scrollable content */}
    <div className="overflow-y-auto px-6 pb-6 pt-2 flex-1">
      {isLoading ? ... : error ? ... : !pin ? ... : (
        <div className="space-y-4">
          {/* pin details */}
        </div>
      )}
    </div>
  </div>
</>
```

The bookmark button should be `absolute top-4 right-14` — right of the pin name area, left of the close button. Both buttons are within the sheet div which has `position: relative` implied by `fixed` positioning.

IMPORTANT: The bookmark button should only be visible when the pin is found. Since it's `absolute` positioned OUTSIDE the `overflow-y-auto` scrollable div, place it as a sibling to the close button (both inside the sheet div, before the scrollable content div), but conditionally render it only when `pin` is defined.

### Critical: No shadcn/ui — pure HTML + Tailwind

Confirmed from Story 3.1: `@radix-ui` and shadcn UI components (Button, Sheet, etc.) are NOT installed. Use:
- Plain `<button>` with Tailwind classes
- Plain `<ul>/<li>` for the spots list
- No `<Sheet>`, no `<Dialog>`, no `<Card>` components from shadcn

### Critical: PIN_TYPE_LABELS duplication is intentional

`PIN_TYPE_LABELS` is defined inline in `PinDetailSheet.tsx` AND must be redefined inline in `SavedSpotsScreen.tsx`. This duplication is required because features cannot import from other features. The pattern is established from Story 3.1 (`doesPinFitRig` was similarly duplicated).

### UIStore pendingMapCenter — one-shot pattern

`pendingMapCenter` must be cleared immediately after use (single-use signal):
- Set in `handleSpotTap` (SavedSpotsScreen) along with `setSelectedPin` and `navigate`
- Consumed and cleared in MapView's `useEffect([pendingMapCenter])`
- The order: SavedSpotsScreen sets → navigation occurs → MapView mounts → effect fires → map centers → pendingMapCenter cleared

```typescript
// In SavedSpotsScreen
function handleSpotTap(pin: Pin) {
  useUIStore.getState().setPendingMapCenter({ lat: pin.latitude, lng: pin.longitude })
  useUIStore.getState().setSelectedPin(pin.id)
  navigate('/pin/' + pin.id)
}

// In MapView useEffect
useEffect(() => {
  if (pendingMapCenter && mapRef.current) {
    mapRef.current.setView([pendingMapCenter.lat, pendingMapCenter.lng], 14)
    useUIStore.getState().setPendingMapCenter(null)
  }
}, [pendingMapCenter]) // eslint-disable-line react-hooks/exhaustive-deps
```

### Distance display formatting

Show 1 decimal place with "mi" suffix. No distance shown if GPS unavailable (no error message, just omit):

```typescript
// When geoState.coords is available:
distanceMiles(geoState.coords.latitude, geoState.coords.longitude, pin.latitude, pin.longitude).toFixed(1) + ' mi'
// e.g.: "12.3 mi", "0.5 mi", "145.0 mi"
```

### `useEffect` import

`useEffect` must come from `'react'` NOT from `'react-router-dom'`:
```typescript
import { useEffect } from 'react'  // ✅
```
This was a bug in a previous story — confirmed the lesson.

### TypeScript strict build — mock type pattern

From Story 3.2 TS fix: always type error fields in mocks as `Error | null`, never just `null`:
```typescript
// ✅ CORRECT
mockUsePinsQuery: vi.fn(() => ({ data: [] as Pin[], isLoading: false, error: null as Error | null }))
```

Same applies to useGeolocation mock — type coords properly:
```typescript
mockUseGeolocation: vi.fn(() => [
  { isLoading: false, coords: null as GeolocationCoordinates | null, error: null as 'denied' | 'no-api' | 'unavailable' | null },
  vi.fn(),
])
```

### `vi.restoreAllMocks()` in afterEach

Established pattern from Story 3.2 code review fix — always use `afterEach(() => vi.restoreAllMocks())` when using `vi.spyOn`. Put it at the describe block level.

### `useGeolocation` hook behavior

`useGeolocation` returns `[state, request]`. The `request` function triggers the browser's Geolocation API. Call `request()` in a `useEffect` on mount to auto-start GPS detection:

```typescript
const [geoState, requestGeo] = useGeolocation()
useEffect(() => { requestGeo() }, []) // eslint-disable-line react-hooks/exhaustive-deps
```

`geoState.coords` is `null` until GPS resolves. `geoState.coords.latitude` and `.longitude` when available.

### Project Structure Notes

**Files created:**
- `src/components/RecencyBadge.tsx` — MOVED from `src/features/pin-detail/`
- `src/components/RecencyBadge.test.tsx` — MOVED from `src/features/pin-detail/`
- `src/features/saved-spots/SavedSpotsScreen.test.tsx` — NEW

**Files modified:**
- `src/store/uiStore.ts` — add `pendingMapCenter` + `setPendingMapCenter`
- `src/features/map/MapView.tsx` — consume `pendingMapCenter`, add `mapRef` if not present
- `src/features/pin-detail/PinDetailSheet.tsx` — bookmark button + updated RecencyBadge import
- `src/features/pin-detail/PinDetailSheet.test.tsx` — bookmark button tests + `useSpotsStore` reset
- `src/features/saved-spots/SavedSpotsScreen.tsx` — replace stub with full implementation

**Files deleted:**
- `src/features/pin-detail/RecencyBadge.tsx` — moved to `src/components/`
- `src/features/pin-detail/RecencyBadge.test.tsx` — moved to `src/components/`

**No changes to:**
- `src/App.tsx` — `/saved` route already registered
- `src/store/spotsStore.ts` — fully implemented, no changes
- `src/hooks/useGeolocation.ts` — already implemented, no changes
- `src/features/map/MapView.test.tsx` — only if mapRef additions require test updates

### References

- Story requirements: [epics.md — Epic 3, Story 3.3](_bmad-output/planning-artifacts/epics.md)
- Architecture state boundaries: [architecture.md — State Boundaries](_bmad-output/planning-artifacts/architecture.md) — Zustand owns persisted client state; no direct localStorage in components
- Architecture component boundaries: [architecture.md — Component Boundaries](_bmad-output/planning-artifacts/architecture.md) — features don't import from other features
- Current `useSpotsStore`: `src/store/spotsStore.ts` — `saveSpot(pin)`, `removeSpot(pinId)`, `isSaved(pinId)` — fully implemented
- Current `useUIStore`: `src/store/uiStore.ts` — add `pendingMapCenter` here
- Current `MapView.tsx`: `src/features/map/MapView.tsx` — verify mapRef, add pendingMapCenter effect
- Current `PinDetailSheet.tsx`: `src/features/pin-detail/PinDetailSheet.tsx` — add bookmark button
- `RecencyBadge.tsx` source: `src/features/pin-detail/RecencyBadge.tsx` — move to `src/components/`
- `useGeolocation` hook: `src/hooks/useGeolocation.ts` — `[geoState, request]` return type
- `SavedSpotsScreen` stub: `src/features/saved-spots/SavedSpotsScreen.tsx` — replace
- App routing: `src/App.tsx` — `/saved` already registered
- Story 3.1 learnings: [3-1-pin-detail-sheet.md](_bmad-output/implementation-artifacts/3-1-pin-detail-sheet.md) — custom Tailwind sheet pattern, no shadcn, doesPinFitRig duplication pattern
- Story 3.2 learnings: [3-2-one-tap-navigation.md](_bmad-output/implementation-artifacts/3-2-one-tap-navigation.md) — `error: null as Error | null` TS fix, `vi.restoreAllMocks()` afterEach, `useEffect` from 'react' not 'react-router-dom'
- `spotsStore.test.ts`: `src/store/spotsStore.test.ts` — existing store reset pattern: `useSpotsStore.setState({ savedSpots: [] })`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

**Created:**
- `src/components/RecencyBadge.tsx` — moved from `src/features/pin-detail/` (shared component)
- `src/components/RecencyBadge.test.tsx` — moved from `src/features/pin-detail/`
- `src/features/saved-spots/SavedSpotsScreen.test.tsx` — new test file

**Modified:**
- `src/store/uiStore.ts` — added `pendingMapCenter` + `setPendingMapCenter`
- `src/features/map/MapView.tsx` — added `pendingMapCenter` effect for map centering
- `src/features/pin-detail/PinDetailSheet.tsx` — bookmark button + updated RecencyBadge import
- `src/features/pin-detail/PinDetailSheet.test.tsx` — bookmark button tests + `useSpotsStore` reset
- `src/features/saved-spots/SavedSpotsScreen.tsx` — replaced stub with full implementation

**Deleted:**
- `src/features/pin-detail/RecencyBadge.tsx` — moved to `src/components/`
- `src/features/pin-detail/RecencyBadge.test.tsx` — moved to `src/components/`

## Code Review Record

### Review Date: 2026-03-18

### Reviewer: claude-sonnet-4-6

### Findings: 1H / 2M / 3L

- **H1 (FIXED)** — TS build failure in `SavedSpotsScreen.test.tsx`: `coords: null` in `vi.hoisted` inferred as `null` type, rejecting `GeolocationCoordinates` in `mockReturnValue`. Fixed: `null as GeolocationCoordinates | null`.
- **M1 (FIXED)** — Dev Agent Record → File List was empty. Populated with all created/modified/deleted files.
- **M2 (FIXED)** — All task checkboxes `[ ]` despite full implementation. Marked all `[x]`.
- **L1** — Bookmark `aria-label` uses `'Remove saved spot'` vs spec's `'Remove from saved spots'`. Tests consistent with implementation.
- **L2** — `saveSpot`/`removeSpot` extracted via selector subscription instead of `.getState()` pattern for imperative calls.
- **L3** — Empty state text split across two `<p>` elements; AC6 wording uses em-dash connector.

### Outcome: APPROVED — all HIGH and MEDIUM issues resolved. 332 tests pass. `tsc -b` clean.
