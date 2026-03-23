# Story 2.2: Full Pin Layer with Rig-Aware Greying

Status: done

## Story

As a user,
I want to see all stop pins across all categories on a single map layer, with pins my rig cannot access displayed in a greyed-out state rather than hidden,
So that I can see the full landscape of stops while knowing at a glance which ones fit my rig.

## Acceptance Criteria

1. **Given** the map renders with a rig profile saved **When** pins load from Supabase **Then** all pins are displayed simultaneously on one layer — overnight, dump, water, fuel, propane, electric, shower categories all visible together (FR11)

2. **Given** a pin's rig constraints (max length or max height) are exceeded by the saved rig profile **When** that pin renders on the map **Then** it is displayed in a greyed-out visual state (grey ring, reduced opacity, grayscale filter) **And** it remains visible on the map — it is never hidden (FR12)

3. **Given** a greyed-out pin **When** the user taps it **Then** `useUIStore.setSelectedPin(pin.id)` is called — the full pin detail sheet behaviour is implemented in Story 3.1; this story only wires the click-to-selectedPin plumbing

4. **Given** all pins render on the map **When** a screen reader reads a pin **Then** the pin has an `aria-label` in the format: `"[SpotName]: [category], verified [recency]"` (NFR-A2)

5. **Given** pins are filtering based on rig profile in memory **When** the user changes the rig profile **Then** the rig filter re-applies within 200ms with no server round trip (NFR-P2) — React state propagation already satisfies this via PinLayer's `rigProfile` prop

6. **Given** a user has `prefers-reduced-motion` enabled **When** the map pans or zooms **Then** smooth pan/zoom animations are disabled (NFR-A5) — implement via `zoomAnimation: false, fadeAnimation: false` on L.map options when `window.matchMedia('(prefers-reduced-motion: reduce)').matches`

7. **Given** pins load progressively **When** `isLoading === true` **Then** the map canvas remains pannable and interactive (no full-screen blocker); current behaviour of deferring pin render until data ready is acceptable for MVP

## Tasks / Subtasks

- [x] **Task 1: Create `src/features/map/PinMarker.ts`** (AC: 1, 2, 4)
  - [x] Export pure helper `createPinIconConfig(pin: Pin, rigProfile: RigProfile): PinIconConfig` that returns `{ html: string; iconSize: [number, number]; iconAnchor: [number, number]; className: string }` — pure function with NO Leaflet import, fully testable in isolation
  - [x] `html` string: a `<div>` with inline styles forming the coloured recency ring + category emoji (see Dev Notes for exact style spec)
  - [x] Category emoji priority (check `pin.amenities` in this order): `overnight → 🏕`, `dump → 🚽`, `water → 💧`, `fuel → ⛽`, `propane → 🔵`, `electric → ⚡`, `shower → 🚿`, fallback `→ 📍`
  - [x] Ring colour based on `pin.badgeState` AND `doesPinFitRig` result: if NOT fits → grey `#6b7280` ring regardless of badge; if fits → green `#22c55e` / yellow `#eab308` / red `#ef4444` / grey `#6b7280`
  - [x] Unfit-pin additional styles: `filter:grayscale(1);opacity:0.5;`
  - [x] `aria-label` on the inner `<div>`: `"[SpotName]: [category], verified [recency]"` where category = emoji label text (overnight/dump/water/…) and recency = badge text (fresh/recent/stale/unknown) — MUST HTML-escape `pin.name` to prevent XSS
  - [x] Export `function createPinMarker(pin: Pin, rigProfile: RigProfile): L.Marker` that calls `L.marker([pin.latitude, pin.longitude], { icon: L.divIcon(createPinIconConfig(pin, rigProfile)), keyboard: false })` and attaches click handler `marker.on('click', () => useUIStore.getState().setSelectedPin(pin.id))`
  - [x] `iconSize: [36, 36]`, `iconAnchor: [18, 18]`, `className: ''` (empty string prevents Leaflet default white square background)

- [x] **Task 2: Update `src/features/map/PinLayer.tsx`** (AC: 1, 2, 3)
  - [x] Replace `L.circleMarker` with `createPinMarker` from `./PinMarker`
  - [x] Remove `FIT_STYLE` and `UNFIT_STYLE` constants (no longer needed)
  - [x] Remove the direct import of `doesPinFitRig` inside PinLayer (still needed to keep the EXPORT so existing tests pass — keep the function definition and its export, just don't duplicate usage inside PinLayer's render loop)
  - [x] `markersRef` type changes from `L.CircleMarker[]` to `L.Marker[]`
  - [x] Keep `doesPinFitRig` exported — 12 existing tests in `PinLayer.test.ts` depend on it; do NOT change its logic or signature

- [x] **Task 3: Update `src/features/map/LeafletMap.tsx`** (AC: 6)
  - [x] Add `prefers-reduced-motion` detection: `const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches`
  - [x] Pass `zoomAnimation: !prefersReduced, fadeAnimation: !prefersReduced` into the `L.map(container, options)` call (alongside existing `center`, `zoom`, `tap: false`)
  - [x] Keep existing `as unknown as L.MapOptions` cast — these new options are also not in `@types/leaflet` correctly

- [x] **Task 4: Write tests** (AC: 1, 2, 4)
  - [x] `src/features/map/PinMarker.test.ts` — pure unit tests for `createPinIconConfig`, no Leaflet mock needed:
    - [x] HTML contains correct ring colour for each `badgeState` (green/yellow/red/grey)
    - [x] HTML contains grey colour override for unfit pins (rig constraints exceeded)
    - [x] HTML contains `filter:grayscale(1)` and `opacity:0.5` for unfit pins only
    - [x] HTML does NOT contain grayscale/opacity for fit pins
    - [x] `aria-label` contains correct format: `"[SpotName]: [category], verified [recency]"`
    - [x] Category emoji is correct for each amenity (overnight → 🏕, dump → 🚽, etc.)
    - [x] Category emoji priority: pin with both overnight+dump → 🏕 (overnight wins)
    - [x] `pin.name` with HTML special chars (`<`, `>`, `&`, `"`) is escaped in `aria-label`
    - [x] `iconSize` is `[36, 36]`, `iconAnchor` is `[18, 18]`, `className` is `''`
  - [x] `src/features/map/PinLayer.test.ts` — EXISTING 12 `doesPinFitRig` tests remain unchanged; update the Leaflet mock and add:
    - [x] Verify `L.marker` is called (not `L.circleMarker`) when `isLoading === false` and pins present
    - [x] Verify `setSelectedPin` in `useUIStore` is called when a pin marker's click event fires

## Dev Notes

### CRITICAL: What changed from Story 1.4 / Story 2.1

In Story 1.4, `PinLayer.tsx` used **`L.circleMarker`** as a simple coloured dot placeholder. Story 2.2 **replaces** these circle markers with proper **`L.marker` + `L.divIcon`** instances that have the full recency ring + category emoji design.

**Remove these from `PinLayer.tsx`:**
```typescript
// REMOVE these old constants:
const FIT_STYLE: L.CircleMarkerOptions = { ... }
const UNFIT_STYLE: L.CircleMarkerOptions = { ... }
```

**Replace the circleMarker call:**
```typescript
// OLD (remove):
const marker = L.circleMarker([pin.latitude, pin.longitude], fits ? FIT_STYLE : UNFIT_STYLE)

// NEW (use):
const marker = createPinMarker(pin, rigProfile)
marker.addTo(map)
```

### `PinMarker.ts` — Full Implementation Spec

```typescript
// src/features/map/PinMarker.ts
import * as L from 'leaflet'
import type { Pin } from '@/types/pin'
import type { RigProfile } from '@/types/rigProfile'
import { doesPinFitRig } from './PinLayer'
import { useUIStore } from '@/store/uiStore'

// ---------------------------------------------------------------------------
// Pure config builder — no Leaflet dependency; fully testable in isolation
// ---------------------------------------------------------------------------

export interface PinIconConfig {
  html: string
  iconSize: [number, number]
  iconAnchor: [number, number]
  className: string
}

type BadgeColor = 'green' | 'yellow' | 'red' | 'grey'

const RING_COLORS: Record<BadgeColor, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  grey: '#6b7280',
}

const FILL_COLORS: Record<BadgeColor, string> = {
  green: 'rgba(34,197,94,0.15)',
  yellow: 'rgba(234,179,8,0.15)',
  red: 'rgba(239,68,68,0.15)',
  grey: 'rgba(107,114,128,0.1)',
}

const BADGE_LABELS: Record<BadgeColor, string> = {
  green: 'fresh',
  yellow: 'recent',
  red: 'stale',
  grey: 'unknown',
}

function getCategoryEmoji(pin: Pin): { emoji: string; label: string } {
  const a = pin.amenities
  // Priority: overnight → dump → water → fuel → propane → electric → shower → fallback
  if (a.overnight) return { emoji: '🏕', label: 'overnight' }
  if (a.dump)      return { emoji: '🚽', label: 'dump' }
  if (a.water)     return { emoji: '💧', label: 'water' }
  if (a.fuel)      return { emoji: '⛽', label: 'fuel' }
  if (a.propane)   return { emoji: '🔵', label: 'propane' }
  if (a.electric)  return { emoji: '⚡', label: 'electric' }
  if (a.shower)    return { emoji: '🚿', label: 'shower' }
  return { emoji: '📍', label: 'stop' }
}

// HTML-escaping to prevent XSS in aria-label via pin.name from DB
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function createPinIconConfig(pin: Pin, rigProfile: RigProfile): PinIconConfig {
  const fits = doesPinFitRig(pin, rigProfile)
  const badge = pin.badgeState as BadgeColor

  const ringColor = fits ? RING_COLORS[badge] : '#6b7280'
  const fillColor = fits ? FILL_COLORS[badge] : 'rgba(107,114,128,0.1)'

  const { emoji, label } = getCategoryEmoji(pin)
  const recency = BADGE_LABELS[badge] ?? 'unknown'
  const ariaLabel = `${escapeHtml(pin.name)}: ${label}, verified ${recency}`

  const unfitStyles = fits ? '' : 'filter:grayscale(1);opacity:0.5;'

  const html = `<div ` +
    `style="width:36px;height:36px;border-radius:50%;border:3px solid ${ringColor};` +
    `background:${fillColor};display:flex;align-items:center;justify-content:center;` +
    `font-size:16px;cursor:pointer;${unfitStyles}" ` +
    `role="img" ` +
    `aria-label="${ariaLabel}"` +
    `>${emoji}</div>`

  return {
    html,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    className: '',  // MUST be '' — prevents Leaflet adding a white square div background
  }
}

// ---------------------------------------------------------------------------
// Marker factory — imports Leaflet
// ---------------------------------------------------------------------------

export function createPinMarker(pin: Pin, rigProfile: RigProfile): L.Marker {
  const icon = L.divIcon(createPinIconConfig(pin, rigProfile))
  const marker = L.marker([pin.latitude, pin.longitude], {
    icon,
    keyboard: false,  // keyboard: false because the inner div has role="img", not role="button"
                      // Story 3.1 will wire keyboard navigation to the full pin detail sheet
  })
  marker.on('click', () => {
    useUIStore.getState().setSelectedPin(pin.id)
  })
  return marker
}
```

### `PinLayer.tsx` — Changes Required

```typescript
// src/features/map/PinLayer.tsx
import { useEffect, useRef } from 'react'
import * as L from 'leaflet'
import type { Pin } from '@/types/pin'
import type { RigProfile } from '@/types/rigProfile'
import { createPinMarker } from './PinMarker'  // ADD this import

// KEEP doesPinFitRig export unchanged (12 tests depend on it):
export function doesPinFitRig(pin: Pin, rigProfile: RigProfile): boolean { ... }

// REMOVE FIT_STYLE and UNFIT_STYLE constants

export default function PinLayer({ map, pins, rigProfile, isLoading }: PinLayerProps) {
  const markersRef = useRef<L.Marker[]>([])  // Type changes from L.CircleMarker[] to L.Marker[]

  useEffect(() => {
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    if (isLoading) return

    pins.forEach((pin) => {
      const marker = createPinMarker(pin, rigProfile)  // REPLACES L.circleMarker(...)
      marker.addTo(map)
      markersRef.current.push(marker)
    })

    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
    }
  }, [map, pins, rigProfile, isLoading])

  return null
}
```

### `LeafletMap.tsx` — prefers-reduced-motion

```typescript
// In the useEffect where L.map() is called:
const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const map = L.map(containerRef.current, {
  center: DEFAULT_CENTER,
  zoom: DEFAULT_ZOOM,
  tap: false,
  zoomAnimation: !prefersReduced,
  fadeAnimation: !prefersReduced,
} as unknown as L.MapOptions)  // Keep existing 'as unknown as' cast
```

### DivIcon Style Details

| State | Ring border | Background | Extra styles |
|---|---|---|---|
| Fit + green badge | `#22c55e` | `rgba(34,197,94,0.15)` | — |
| Fit + yellow badge | `#eab308` | `rgba(234,179,8,0.15)` | — |
| Fit + red badge | `#ef4444` | `rgba(239,68,68,0.15)` | — |
| Fit + grey badge | `#6b7280` | `rgba(107,114,128,0.1)` | — |
| Unfit (any badge) | `#6b7280` | `rgba(107,114,128,0.1)` | `filter:grayscale(1);opacity:0.5;` |

`iconSize: [36, 36]` — minimum 32×32px required per UX spec; 36px provides adequate tap target at normal zoom
`iconAnchor: [18, 18]` — anchors center of the circle to the pin's lat/lon coordinate
`className: ''` — CRITICAL: Leaflet's default className adds a `leaflet-div-icon` class with `background: white; border: 1px solid #ccc`. Setting `className: ''` removes this, letting the inner div styles control appearance.

### aria-label Format (NFR-A2)

Required format: `"[SpotName]: [category], verified [recency]"`

Examples:
- `"Mojave Dispersed Site: overnight, verified fresh"`
- `"Love's Truck Stop: dump, verified recent"`
- `"Flying J: water, verified stale"`
- `"BLM Site 12: stop, verified unknown"`

**XSS prevention**: Pin names come from the Supabase `pins` table which accepts data from the sync pipeline and community submissions. Always HTML-escape the pin name before inserting into the DivIcon HTML string. Failing to do so could allow `<script>` tags in pin names to execute in the map DOM.

### `useUIStore.getState()` — Why It's Used Here

Inside Leaflet event callbacks (`.on('click', ...)`), we are NOT in a React component render context. Using `useUIStore(selector)` (the React hook) would throw an error outside React. Instead, Zustand stores expose a `.getState()` method for non-React contexts:

```typescript
// ✅ Correct — Zustand store access outside React
useUIStore.getState().setSelectedPin(pin.id)

// ❌ Wrong — React hook, cannot use outside component
const { setSelectedPin } = useUIStore()
setSelectedPin(pin.id)
```

### Story 3.1 Dependency

AC3 requires that tapping a greyed-out pin shows "This spot may not fit your [class], [length]ft rig". This message is inside the `PinDetailSheet`, which is created in **Story 3.1**. Story 2.2 ONLY wires the click handler to `setSelectedPin`. The `PinDetailSheet` in 3.1 will read `useUIStore.selectedPinId`, fetch the pin, compare against `useRigStore.rigProfile`, and show the appropriate message.

Do NOT create a stub sheet in this story — the plumbing (`setSelectedPin`) is all that's needed.

### Performance Note (NFR-P5)

`L.divIcon` creates real DOM elements (unlike `L.circleMarker` which uses SVG/canvas). For the current MVP seed data (~10–50 pins), this is fine. At 500+ pins, `leaflet.markercluster` should be added (Phase 2, not this story). Do NOT add clustering now — defer.

### Testing `createPinIconConfig` — No Leaflet Mock Needed

Since `createPinIconConfig` takes only `Pin` and `RigProfile` and returns a plain object with string/array fields, it can be tested with pure Jest/Vitest assertions. No Leaflet mock is required.

```typescript
// src/features/map/PinMarker.test.ts
import { describe, it, expect } from 'vitest'
import { createPinIconConfig } from './PinMarker'
import type { Pin } from '@/types/pin'
import type { RigProfile } from '@/types/rigProfile'

function makePin(overrides: Partial<Pin> = {}): Pin {
  return {
    id: 'pin-1',
    name: 'Test Spot',
    // ... (same shape as in PinLayer.test.ts)
    badgeState: 'green',
    amenities: { overnight: true, dump: false, water: false, fuel: false, propane: false, electric: false, shower: false },
    ...overrides,
  }
}

it('aria-label format is correct', () => {
  const config = createPinIconConfig(makePin({ name: 'Mojave Site', badgeState: 'green' }), { rigType: 'Class A', lengthFt: 35, heightFt: 12.5 })
  expect(config.html).toContain('aria-label="Mojave Site: overnight, verified fresh"')
})

it('HTML-escapes pin.name in aria-label', () => {
  const config = createPinIconConfig(makePin({ name: '<script>alert(1)</script>' }), { rigType: null, lengthFt: null, heightFt: null })
  expect(config.html).not.toContain('<script>')
  expect(config.html).toContain('&lt;script&gt;')
})
```

### Testing `PinLayer` — Marker Type Verification

The `PinLayer.test.ts` currently mocks leaflet with `circleMarker`. Update the mock to replace `circleMarker` with `marker` and `divIcon`, then verify `L.marker` (not `L.circleMarker`) is called:

```typescript
// In LeafletMap.test.tsx's existing mock — no change needed there
// In PinLayer.test.ts Leaflet mock — ADD:
const mockMarkerOn = vi.fn().mockReturnThis()
const mockMarkerAddTo = vi.fn().mockReturnThis()
const mockMarkerRemove = vi.fn()

vi.mock('leaflet', () => ({
  ...existingMock,
  divIcon: vi.fn((config) => config),  // returns config as-is for inspection
  marker: vi.fn(() => ({
    on: mockMarkerOn,
    addTo: mockMarkerAddTo,
    remove: mockMarkerRemove,
  })),
}))
```

For the `setSelectedPin` test — mock `useUIStore`:
```typescript
vi.mock('@/store/uiStore', () => ({
  useUIStore: {
    getState: vi.fn(() => ({ setSelectedPin: mockSetSelectedPin })),
  },
}))
```

### Project Structure After This Story

```
src/
  features/
    map/
      MapView.tsx              ← no change
      LeafletMap.tsx           ← modified (prefers-reduced-motion)
      PinLayer.tsx             ← modified (L.marker replaces L.circleMarker)
      PinLayer.test.ts         ← modified (update mock, add 2 new tests)
      PinMarker.ts             ← CREATE NEW (icon config + marker factory)
      PinMarker.test.ts        ← CREATE NEW (~10 pure unit tests)
      SearchBar.tsx            ← no change
      RigFilterOverlay.tsx     ← no change
```

### References

- Story requirements: [epics.md](_bmad-output/planning-artifacts/epics.md) — Epic 2, Story 2.2
- Architecture patterns: [architecture.md](_bmad-output/planning-artifacts/architecture.md) — Frontend Architecture, Bundle Strategy
- UX RecencyPin spec: [ux-design-specification.md](_bmad-output/planning-artifacts/ux-design-specification.md) — Custom Components, RecencyPin section
- Current `PinLayer.tsx`: [overnighter/src/features/map/PinLayer.tsx](overnighter/src/features/map/PinLayer.tsx)
- Current `PinLayer.test.ts`: [overnighter/src/features/map/PinLayer.test.ts](overnighter/src/features/map/PinLayer.test.ts)
- Current `LeafletMap.tsx`: [overnighter/src/features/map/LeafletMap.tsx](overnighter/src/features/map/LeafletMap.tsx)
- `useUIStore`: [overnighter/src/store/uiStore.ts](overnighter/src/store/uiStore.ts) — `selectedPinId`, `setSelectedPin`
- `useRigStore`: [overnighter/src/store/rigStore.ts](overnighter/src/store/rigStore.ts)
- Pin types: [overnighter/src/types/pin.ts](overnighter/src/types/pin.ts) — `Pin`, `PinAmenities`, `BadgeColor`
- NFR-P2 (200ms filter): client-side in-memory via `rigProfile` prop on `PinLayer` — no additional work needed
- NFR-A2 (aria-label): UX spec says `"[SpotName]: [category], verified [recency]"` — implement exactly this format
- NFR-A5 (prefers-reduced-motion): architecture.md — "NFR-A5: Users with prefers-reduced-motion enabled must not experience map pan/zoom animations"
- NFR-P5 (bundle): `L.divIcon` stays inside `LeafletMap` lazy chunk — no new imports in main bundle

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `PinLayer.test.ts` JSX syntax error — `.ts` extension does not support JSX. Fixed by using `React.createElement(...)` instead of JSX syntax, keeping the file as `.ts`.
- `LeafletMap.test.tsx` — `window.matchMedia is not a function` in jsdom. Fixed by adding `Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn(() => ({ matches: false, ... })) })` in `beforeEach`.
- `vi.mock` factory hoisting error — `mockCreatePinMarker` referenced before initialization because `vi.mock` is hoisted above variable declarations. Fixed by using `vi.hoisted(() => { ... })` to declare mock variables before hoisting.

### Completion Notes List

- **Task 1 (PinMarker.ts)**: Created `createPinIconConfig` as a pure function with no Leaflet dependency — fully unit-testable. Created `createPinMarker` factory that wraps `L.marker`, applies `L.divIcon`, and attaches a click handler using `useUIStore.getState().setSelectedPin(pin.id)` (Zustand `.getState()` pattern required because Leaflet callbacks run outside React render context). HTML-escaping applied to `pin.name` via `escapeHtml()` to prevent XSS from DB-sourced pin names.
- **Task 2 (PinLayer.tsx)**: Replaced `L.circleMarker` with `createPinMarker`. Removed `FIT_STYLE`/`UNFIT_STYLE` constants. Changed `markersRef` type from `L.CircleMarker[]` to `L.Marker[]`. Kept `doesPinFitRig` export intact for backward compatibility.
- **Task 3 (LeafletMap.tsx)**: Added `prefers-reduced-motion` detection using `window.matchMedia`. Passes `zoomAnimation: !prefersReduced, fadeAnimation: !prefersReduced` to `L.map()` options.
- **Task 4 (Tests)**: Created `PinMarker.test.ts` with 36 pure unit tests (no Leaflet mock). Updated `PinLayer.test.ts` with `vi.hoisted()` mock pattern and 3 new component tests. Updated `LeafletMap.test.tsx` with `window.matchMedia` stub. **155/155 tests passing, zero regressions, `tsc -b` clean.**
- **Code Review fixes (2026-03-18)**: H1 — added 5 `createPinMarker — click handler` tests verifying `setSelectedPin(pin.id)` is called on click and unfit pins remain tappable; M1 — removed stale `circleMarker` mock from `LeafletMap.test.tsx`; M2 — fixed misleading "no Leaflet import" comment in `PinMarker.ts`; M3 — added 2 `prefers-reduced-motion` tests (true/false) to `LeafletMap.test.tsx`; L1 — removed duplicate `UNFIT_RING`/`UNFIT_FILL` constants, now uses `RING_COLORS.grey`/`FILL_COLORS.grey`. **162/162 tests passing.**

### File List

- `overnighter/src/features/map/PinMarker.ts` — CREATED
- `overnighter/src/features/map/PinMarker.test.ts` — CREATED
- `overnighter/src/features/map/PinLayer.tsx` — MODIFIED
- `overnighter/src/features/map/PinLayer.test.ts` — MODIFIED
- `overnighter/src/features/map/LeafletMap.tsx` — MODIFIED
- `overnighter/src/features/map/LeafletMap.test.tsx` — MODIFIED

## Change Log

- 2026-03-18: Story 2.2 implemented — `PinMarker.ts` created with full recency ring + category emoji DivIcon; `PinLayer.tsx` updated to use `L.marker` (replacing `L.circleMarker`); `LeafletMap.tsx` updated with `prefers-reduced-motion` support; 36 new unit tests + 3 component tests added; 155/155 total tests passing.
- 2026-03-18: Code review applied — 5 click-handler tests added, stale mock removed, comments corrected, reduced-motion tests added, duplicate constants removed; 162/162 tests passing.
