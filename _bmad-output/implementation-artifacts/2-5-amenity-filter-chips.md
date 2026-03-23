# Story 2.5: Amenity Filter Chips

Status: done

## Story

As a user,
I want to activate one or more amenity filter chips that persist as I pan and zoom the map,
so that I can quickly narrow results to exactly the services I need right now (e.g., dump + water only).

## Acceptance Criteria

**AC1 — Filter bar always visible**
Given the map view is displayed
When the user views the filter bar
Then a horizontally scrollable row of amenity chips is visible: Water, Dump, Overnight, Fuel, Propane, Electric, Shower
And the chip bar is never hidden behind a modal or hamburger menu

**AC2 — Single chip activates filter**
Given no filter chips are active
When the user taps a single chip (e.g., "Dump")
Then only pins offering dump services are shown in full color
And all other pins are either greyed (rig-filtered) or hidden (rig-fit but amenity-non-matching)

**AC3 — AND logic for multiple chips**
Given one filter chip is active
When the user taps a second chip (e.g., "Water")
Then AND logic applies — only pins offering BOTH dump AND water are shown in full color

**AC4 — Deactivate chip**
Given one or more filter chips are active
When the user taps an active chip to deactivate it
Then that filter is removed and the pin display updates accordingly

**AC5 — Filters persist across pan/zoom**
Given active filter chips are set
When the user pans or zooms the map
Then the active filter chips remain applied — they are not reset on viewport change

**AC6 — 200ms response**
Given filter chips are applied
When the pin filter recalculates
Then the result updates within 200ms of chip tap — client-side in-memory filtering, no server round trip

**AC7 — No active filters shows all rig-filtered pins**
Given all filter chips are inactive
When the map renders
Then all pins that pass the rig filter are displayed in full color

**AC8 — Empty state**
Given a filter chip is active
When no pins in the current dataset match the active filters
Then the map shows an empty state message: "No matching spots in this area — try zooming out or adjusting filters"

## Tasks / Subtasks

- [x] Task 1: Create `useAmenityFilterStore` (AC2, AC3, AC4, AC5)
  - [x] 1.1: Create `src/store/amenityFilterStore.ts` — Zustand store, NOT persisted
    - State: `activeFilters: Array<keyof PinAmenities>` (array, not Set — simpler Zustand state)
    - Actions: `toggleFilter(amenity)`, `clearFilters()`
    - Selector helper: `isFilterActive(amenity)`
    - NOT persisted: filters reset on page reload, persist only across pan/zoom (same session)

- [x] Task 2: Add `doesPinMatchFilters` to `PinLayer.tsx` (AC2, AC3, AC6)
  - [x] 2.1: Add and export pure function `doesPinMatchFilters(pin: Pin, activeFilters: Array<keyof PinAmenities>): boolean`
    - Empty filters → always returns `true`
    - Uses `Array.every` — AND logic: pin must have ALL active amenities set to `true`
  - [x] 2.2: Add `doesPinMatchFilters` tests to `src/features/map/PinLayer.test.ts` (alongside existing `doesPinFitRig` tests)
    - Test: no active filters → returns true for any pin
    - Test: single filter "water" → returns true only for pins with `amenities.water = true`
    - Test: two filters ["water", "dump"] → AND logic — only pins with BOTH true
    - Test: filter active but pin lacks that amenity → returns false

- [x] Task 3: Create `AmenityFilterBar.tsx` and tests (AC1, AC4, AC6)
  - [x] 3.1: Create `src/features/map/AmenityFilterBar.tsx`
    - 7 chips in order: Water 💧, Dump 🚽, Overnight 🏕, Fuel ⛽, Propane 🔵, Electric ⚡, Shower 🚿
    - Horizontally scrollable with `overflow-x-auto` on mobile, flex-nowrap
    - Each chip: `min-h-[44px]` minimum touch target (NFR-A4); `min-w-fit` to prevent overflow wrapping
    - Active chip: primary color `bg-sky-500 text-white border-sky-500`
    - Inactive chip: `bg-background/80 text-muted-foreground border-border`
    - Each chip calls `useAmenityFilterStore.toggleFilter(amenity)` on click
    - Each chip has `aria-pressed={isActive}` for accessibility (NFR-A1)
  - [x] 3.2: Create `src/features/map/AmenityFilterBar.test.tsx`
    - Test: renders all 7 chips by name
    - Test: tapping an inactive chip sets it active (aria-pressed=true)
    - Test: tapping an active chip deactivates it (aria-pressed=false)
    - Test: tapping two chips activates both (AND state visible)
    - Note: reset `useAmenityFilterStore` state between tests via `useAmenityFilterStore.setState({ activeFilters: [] })`

- [x] Task 4: Integrate filters + empty state into `MapView.tsx` (AC1, AC2, AC3, AC5, AC7, AC8)
  - [x] 4.1: Add `useAmenityFilterStore` and filtering logic
    - Import `useAmenityFilterStore` from `@/store/amenityFilterStore`
    - Import `doesPinMatchFilters` and `doesPinFitRig` from `./PinLayer`
    - Use `useMemo` to compute `visiblePins`:
      ```typescript
      const visiblePins = useMemo(() => {
        if (activeFilters.length === 0) return pins
        return pins.filter(pin =>
          doesPinMatchFilters(pin, activeFilters) || !doesPinFitRig(pin, rigProfile)
        )
      }, [pins, activeFilters, rigProfile])
      ```
      Logic: show pin if it matches amenity filters OR if it's already rig-greyed (rig-greyed pins remain visible in grey state regardless of amenity filter)
    - Pass `visiblePins` to `<LeafletMap>` instead of `pins`
  - [x] 4.2: Add `AmenityFilterBar` to overlay stack
    - Place below `RigFilterOverlay` in the top overlay stack (same z-10 container)
    - Full-width with horizontal scroll: `<div className="w-full pointer-events-auto"><AmenityFilterBar /></div>`
  - [x] 4.3: Add empty state
    - Compute `hasAnyMatch = useMemo(() => activeFilters.length === 0 || pins.some(pin => doesPinMatchFilters(pin, activeFilters)), [pins, activeFilters])`
    - Render when `!hasAnyMatch && !isLoading`:
      ```tsx
      <div className="absolute bottom-20 left-0 right-0 flex justify-center z-10 pointer-events-none">
        <div className="bg-background/90 border border-border rounded-lg px-4 py-3 text-sm text-foreground max-w-xs text-center">
          No matching spots in this area — try zooming out or adjusting filters
        </div>
      </div>
      ```
  - [x] 4.4: Add MapView integration tests to `src/features/map/MapView.test.tsx`
    - Test: AmenityFilterBar renders in MapView
    - Test: activating "Water" filter hides pins without water (verifies filtered visiblePins passed to LeafletMap)
    - Test: empty state message appears when active filters match no pins
    - Test: empty state not shown when no filters active

## Dev Notes

### Critical: What NOT to change

- **`LeafletMap.tsx`** — do NOT modify; just pass `visiblePins` instead of `pins` from MapView
- **`PinMarker.ts`** — do NOT modify; greying logic driven by `doesPinFitRig` remains unchanged
- **`PinLayer.tsx` component** — only ADD the `doesPinMatchFilters` export; do NOT change the component
- **`usePinsQuery.ts`** — filter is entirely client-side; no server-side changes needed
- **`rigStore.ts`** — amenity filter is a separate store; do not pollute rig store with filter state

### Architecture: Filter is client-side in-memory (NFR-P2)

All filtering happens in `MapView.tsx` via `useMemo` before passing to `LeafletMap`. No additional Supabase queries. The `pins` array from `usePinsQuery` holds ALL pins; the filter just reduces what gets rendered. This guarantees the 200ms response time (NFR-P2).

### State design: NOT persisted

`useAmenityFilterStore` must use plain `create()` WITHOUT `persist()` middleware. Reasoning:
- AC5 says filters persist across pan/zoom — that's satisfied by in-memory Zustand state (pan/zoom doesn't unmount MapView)
- Filters should NOT persist across page reloads (UX: user opens fresh, expects all pins visible by default)

```typescript
// ✅ Correct — no persist middleware
export const useAmenityFilterStore = create<AmenityFilterStore>()((set, get) => ({
  activeFilters: [],
  toggleFilter: (amenity) =>
    set((state) => ({
      activeFilters: state.activeFilters.includes(amenity)
        ? state.activeFilters.filter((a) => a !== amenity)
        : [...state.activeFilters, amenity],
    })),
  clearFilters: () => set({ activeFilters: [] }),
  isFilterActive: (amenity) => get().activeFilters.includes(amenity),
}))
```

### visiblePins logic: rig-greyed pins stay visible

When amenity filters are active, pins are divided into three visual groups:
1. **Full color**: rig-fit AND matches all amenity filters
2. **Grey** (existing rig behavior): does NOT fit rig → always shown grey, regardless of amenity filter
3. **Hidden**: fits rig BUT does NOT match amenity filters → removed from `visiblePins`

This is why the filter is `doesPinMatchFilters(pin, activeFilters) || !doesPinFitRig(pin, rigProfile)` — rig-greyed pins "pass through" the amenity filter unchanged. The greying is handled by `PinMarker.ts:doesPinFitRig` which already runs for each visible pin.

### `doesPinMatchFilters` signature

Place this function in `PinLayer.tsx` alongside `doesPinFitRig` (same file, same export pattern):

```typescript
import type { PinAmenities } from '@/types/pin'

type AmenityKey = keyof PinAmenities  // 'water' | 'dump' | 'electric' | 'shower' | 'fuel' | 'propane' | 'overnight'

export function doesPinMatchFilters(pin: Pin, activeFilters: AmenityKey[]): boolean {
  if (activeFilters.length === 0) return true
  return activeFilters.every((amenity) => pin.amenities[amenity])
}
```

### AmenityFilterBar chip order and labels

Match the PRD chip order (FR13) exactly: Water, Dump, Overnight, Fuel, Propane, Electric, Shower

```typescript
const CHIPS: Array<{ key: keyof PinAmenities; label: string; emoji: string }> = [
  { key: 'water',    label: 'Water',    emoji: '💧' },
  { key: 'dump',     label: 'Dump',     emoji: '🚽' },
  { key: 'overnight',label: 'Overnight',emoji: '🏕' },
  { key: 'fuel',     label: 'Fuel',     emoji: '⛽' },
  { key: 'propane',  label: 'Propane',  emoji: '🔵' },
  { key: 'electric', label: 'Electric', emoji: '⚡' },
  { key: 'shower',   label: 'Shower',   emoji: '🚿' },
]
```

The emojis match the category icons already used in `PinMarker.ts:getCategoryEmoji` — visual consistency.

### MapView overlay structure after this story

The top overlay stack in `MapView.tsx` should look like:
```tsx
<div className="absolute top-0 left-0 right-0 z-10 p-4 flex flex-col gap-2 pointer-events-none">
  <div className="pointer-events-auto">
    <SearchBar mapRef={mapRef} />
  </div>
  <div className="pointer-events-auto flex justify-center">
    <RigFilterOverlay />
  </div>
  <div className="pointer-events-auto w-full">
    <AmenityFilterBar />
  </div>
</div>
```

### Testing `AmenityFilterBar` with Zustand store

Reset store state between tests to prevent cross-test contamination:
```typescript
import { useAmenityFilterStore } from '@/store/amenityFilterStore'

beforeEach(() => {
  useAmenityFilterStore.setState({ activeFilters: [] })
})
```

Zustand stores expose `.setState()` directly — no wrapper needed. This is the established pattern in the project (see `useRigStore.setState` in `MapView.test.tsx:149`).

### MapView integration test pattern for filtering

The existing `MapView.test.tsx` already mocks `usePinsQuery` and `BadgeTooltip`. Add to the existing mocks:
- Mock `useAmenityFilterStore` with `vi.mock('@/store/amenityFilterStore')` OR use real store + reset in beforeEach (preferred — tests real behavior)
- Verify filtering by checking how many markers are passed to `LeafletMap` prop

Actually the current MapView tests use `screen.getByTestId('leaflet-map')` but LeafletMap is mocked. For the filter tests, use the real store and verify empty state text appears.

### Color tokens for chip active/inactive states

From architecture color tokens:
- **Primary / active:** `#0ea5e9` → Tailwind `sky-500` (matches `bg-sky-500`)
- **Background/inactive:** `#0f172a` background, `#1e293b` surface → use `bg-background/80`
- **Border inactive:** `border-border` (Tailwind CSS var)
- **Text active:** white `text-white`
- **Text inactive:** `text-muted-foreground`

The dark theme has been working since Story 1.4 — these tokens are already configured in `tailwind.config.ts` and `index.css`.

### Project Structure Notes

- New file: `src/store/amenityFilterStore.ts` — follow `uiStore.ts` pattern (plain `create()`, no persist)
- New files: `src/features/map/AmenityFilterBar.tsx` + `AmenityFilterBar.test.tsx` — co-located with other map feature files
- Modified: `src/features/map/PinLayer.tsx` — add `doesPinMatchFilters` export only; no component change
- Modified: `src/features/map/PinLayer.test.ts` — add `doesPinMatchFilters` tests in new `describe` block
- Modified: `src/features/map/MapView.tsx` — add `useMemo`, `AmenityFilterBar`, `visiblePins`, empty state
- Modified: `src/features/map/MapView.test.tsx` — add AmenityFilterBar integration tests

### References

- Story requirements: [epics.md — Epic 2, Story 2.5](_bmad-output/planning-artifacts/epics.md)
- FR13–FR16 (amenity filter chips): [epics.md line ~534](_bmad-output/planning-artifacts/epics.md)
- Architecture filter patterns: [architecture.md#Communication Patterns](_bmad-output/planning-artifacts/architecture.md) — "NFR-P2: Client-side in-memory filter via rigStore → 200ms filter target"
- Color tokens: [architecture.md#Frontend Architecture](_bmad-output/planning-artifacts/architecture.md) — brand accent #0ea5e9
- UX chip bar spec: [ux-design-specification.md](_bmad-output/planning-artifacts/ux-design-specification.md)
- Existing rig filter pattern: `src/features/map/PinLayer.tsx:doesPinFitRig` (exact analog)
- Existing Zustand store pattern (no persist): `src/store/uiStore.ts`
- Existing Zustand store reset in tests: `src/features/map/MapView.test.tsx:149` — `useRigStore.setState`
- PinAmenities type: `src/types/pin.ts:PinAmenities`
- CHIPS emoji consistency: `src/features/map/PinMarker.ts:getCategoryEmoji`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Fixed `AmenityFilterBar` re-render issue: `isFilterActive` function selector doesn't trigger React re-renders when `activeFilters` changes (function reference is stable). Resolved by subscribing to `activeFilters` array directly and computing `activeFilters.includes(key)` inline.

### Completion Notes List

- Task 1: Created `src/store/amenityFilterStore.ts` — plain Zustand store (no persist), `activeFilters: AmenityKey[]`, `toggleFilter`, `clearFilters`, `isFilterActive`.
- Task 2: Exported `doesPinMatchFilters` from `PinLayer.tsx` (AND logic via `Array.every`). Added 6 tests to `PinLayer.test.ts`.
- Task 3: Created `AmenityFilterBar.tsx` — 7 chips, horizontal scroll, 44px touch targets, `aria-pressed`, sky-500 active state. Created `AmenityFilterBar.test.tsx` — 4 tests.
- Task 4: Updated `MapView.tsx` — `useMemo` for `visiblePins` and `hasAnyMatch`, `AmenityFilterBar` in overlay stack, empty state message. Added 5 integration tests to `MapView.test.tsx`.
- All 261 tests pass across 19 test files. No regressions.

### File List

- `src/store/amenityFilterStore.ts` — NEW
- `src/features/map/AmenityFilterBar.tsx` — NEW
- `src/features/map/AmenityFilterBar.test.tsx` — NEW
- `src/features/map/PinLayer.tsx` — MODIFIED (added `doesPinMatchFilters` export, `PinAmenities` import)
- `src/features/map/PinLayer.test.ts` — MODIFIED (added `doesPinMatchFilters` describe block, 6 tests)
- `src/features/map/MapView.tsx` — MODIFIED (useMemo, AmenityFilterBar, visiblePins, hasAnyMatch, empty state)
- `src/features/map/MapView.test.tsx` — MODIFIED (added AmenityFilterBar integration tests, 5 tests; added amenity store reset to 3 existing beforeEach blocks)
- `src/store/amenityFilterStore.test.ts` — NEW (10 unit tests: initial state, toggleFilter add/remove/multi, clearFilters, isFilterActive)
