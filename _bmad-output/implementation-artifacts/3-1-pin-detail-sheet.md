# Story 3.1: Pin Detail Sheet

Status: done

## Story

As a user,
I want to tap any map pin and see a bottom sheet with the stop's full details,
So that I can make a confident go/no-go decision without leaving the app.

## Acceptance Criteria

**AC1 — Bottom sheet slides up within 300ms**
Given the map is displayed with pins
When the user taps a pin marker
Then a bottom sheet slides up from the bottom of the screen within 300ms (NFR-P3)
And the map remains visible behind the sheet

**AC2 — Full stop details visible**
Given the pin detail sheet is open
When the user views it
Then the following information is displayed: stop name, stop type/category, amenities list (icons + labels), fee (or "Free"), rig restrictions (max length, max height), last verified date, recency badge (green/yellow/red with icon), and any community notes (description)

**AC3 — All amenities listed**
Given the pin detail sheet is open for a pin with multiple amenities
When the user views the amenities section
Then all amenities offered at that location are listed (e.g., Dump, Water, Fuel, Overnight) — not just the primary category

**AC4 — Rig fit notice**
Given the pin detail sheet is open
When the user's rig profile exceeds the pin's rig restrictions
Then a clear inline notice is shown: "This spot may not fit your [rigType], [lengthFt]ft rig"

**AC5 — Swipe-to-dismiss**
Given the pin detail sheet is open
When the user swipes down on the sheet (or taps outside / presses Escape)
Then the sheet dismisses and the map returns to full view

**AC6 — Deep-link URL**
Given the pin detail sheet is open on a deep-linked URL (`/pin/:id`)
When the user shares the URL with another person
Then that person can open the same pin detail sheet directly (map loads with sheet open)

**AC7 — Screen reader accessibility**
Given the pin detail sheet is open
When a screen reader is active
Then all content is announced in a logical order: name, type, recency, amenities, fee, restrictions, notes
And the sheet has `role="dialog"` and `aria-labelledby` pointing to the stop name heading

## Tasks / Subtasks

- [x] Task 1: Update routing for nested sheet overlay (AC1, AC5, AC6)
  - [x] 1.1: Update `src/App.tsx` — nest `/pin/:id` as a child route of `/`
    - Change `<Route path="/pin/:id" element={<PinDetailSheet />} />` to be NESTED inside `<Route path="/" element={<MapView />} />`
    - Use React Router `<Outlet />` pattern so MapView stays mounted and PinDetailSheet overlays on top
    - Full pattern:
      ```tsx
      <Route path="/" element={<MapView />}>
        <Route path="pin/:id" element={<PinDetailSheet />} />
      </Route>
      ```
    - Note: `path="pin/:id"` (no leading slash) when nested
  - [x] 1.2: Update `src/features/map/MapView.tsx` — add `<Outlet />` for nested pin detail overlay
    - Import `Outlet` from `react-router-dom`
    - Add `<Outlet />` inside the main container div (after all other overlays) so PinDetailSheet renders on top of the map:
      ```tsx
      {/* Pin detail sheet overlay — rendered via nested route /pin/:id */}
      <Outlet />
      ```
    - Place it at the same level as the empty state and BadgeTooltip (outside the z-0 map div, inside the relative container)
  - [x] 1.3: Update `src/features/map/MapView.tsx` — wire `selectedPinId` to navigate
    - Import `useUIStore` from `@/store/uiStore`
    - Subscribe to `selectedPinId`: `const selectedPinId = useUIStore((state) => state.selectedPinId)`
    - Add `useEffect` to navigate when a pin is selected:
      ```typescript
      useEffect(() => {
        if (selectedPinId) navigate('/pin/' + selectedPinId)
      }, [selectedPinId]) // eslint-disable-line react-hooks/exhaustive-deps
      ```
    - This bridges the Leaflet click handler (which can only call `setSelectedPin`) to React Router navigation
    - Note: do NOT add `navigate` to the dependency array — it's stable but would cause lint warnings about exhaustive-deps

- [x] Task 2: Implement `PinDetailSheet.tsx` (AC1, AC2, AC3, AC4, AC5, AC6, AC7)
  - [x] 2.1: Scaffold `src/features/pin-detail/PinDetailSheet.tsx`
    - Replace the current stub (`export default function PinDetailSheet() { return <div>Pin Detail Sheet (Story 3.1)</div> }`)
    - Import: `useParams`, `useNavigate` from `react-router-dom`; `Sheet`, `SheetContent` from `@/components/ui/sheet`; `usePinsQuery` from `@/hooks/usePinsQuery`; `useUIStore` from `@/store/uiStore`; `useRigStore` from `@/store/rigStore`; `doesPinFitRig` from `@/features/map/PinLayer`
    - Use `useParams<{ id: string }>()` to get pin ID from URL
    - Use `usePinsQuery({ enabled: true })` to access pin data (works for both in-app navigation and deep-link)
    - Find pin: `const pin = pins.find((p) => p.id === id)`
    - Get rig profile: `const rigProfile = useRigStore((state) => state.rigProfile)`
    - Handle dismiss: call `useUIStore.getState().setSelectedPin(null)` and `navigate('/')` — clear both UIStore and URL
  - [x] 2.2: Render custom Tailwind bottom sheet (always open when route is active — shadcn not installed)
    - Use `<Sheet open={true} onOpenChange={(open) => { if (!open) handleDismiss() }}>`
    - Use `<SheetContent side="bottom">` for bottom sheet behavior
    - Sheet provides swipe-to-dismiss, backdrop click dismiss, and Escape key dismiss (AC5)
    - Add `aria-labelledby="pin-detail-name"` to SheetContent (AC7)
  - [x] 2.3: Render loading skeleton state
    - When `isLoading` is true OR pin is not yet found: show skeleton UI
    - Use `animate-pulse` Tailwind classes for skeleton placeholders matching sheet content shape
    - Skeleton: a tall bar for name, two shorter bars for details
  - [x] 2.4: Render pin not found state
    - When `!isLoading && !pin`: show "Spot not found" message with a "Back to map" button that calls `handleDismiss()`
  - [x] 2.5: Render full pin details (AC2, AC3, AC4, AC7)
    - **Name heading**: `<h2 id="pin-detail-name" className="text-lg font-bold">` — linked by `aria-labelledby`
    - **Category/type**: `pinType` displayed as human-readable label (e.g., "community" → "Community Stop", "blm" → "BLM Land")
    - **Recency badge**: Inline `RecencyBadge` component (see Task 3) — first element below name
    - **Amenities row**: All amenities from `pin.amenities` that are `true`, displayed as outlined pills with emoji + label. Use the same CHIPS definition from `AmenityFilterBar.tsx` for consistency:
      - Water 💧, Dump 🚽, Overnight 🏕, Fuel ⛽, Propane 🔵, Electric ⚡, Shower 🚿
      - Only show amenities where `pin.amenities[key] === true`
      - If no amenities: show "No amenity data"
    - **Fee**: Show "Free" when `pin.description` doesn't mention fee OR no fee data. Note: `Pin` type doesn't have a dedicated `fee` field — display from `description` context or omit the field. Do NOT invent a field that doesn't exist in the type.
    - **Rig restrictions**: Show `maxLengthFt` and `maxHeightFt` when not null (e.g., "Max length: 35ft, Max height: 13ft"). Show "No size restrictions" if both are null.
    - **Rig fit notice** (AC4): Compute `const fits = doesPinFitRig(pin, rigProfile)`. When `rigProfile !== null && !fits`, render:
      ```tsx
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 text-sm text-yellow-500">
        This spot may not fit your {rigProfile.rigType}, {rigProfile.lengthFt}ft rig
      </div>
      ```
    - **Last verified date**: Format `pin.lastCheckInAt` as human-readable date (e.g., "Verified Mar 10, 2026"). When null, show "Never verified".
    - **Notes/description**: Show `pin.description` when not null. Label it "Community notes". When null, omit this section.
    - Content order for screen reader (AC7): name → type → recency → amenities → rig restrictions → rig notice (if applies) → last verified → notes

- [x] Task 3: Create `RecencyBadge.tsx` component (AC2, AC7)
  - [x] 3.1: Create `src/features/pin-detail/RecencyBadge.tsx`
    - Props: `badgeState: BadgeColor` (import `BadgeColor` from `@/types/pin`)
    - Three states — use design tokens from UX spec:
      | badgeState | bg | text color | icon | label |
      |---|---|---|---|---|
      | green | rgba(34,197,94,0.15) | #22c55e | ✓ | Verified recently |
      | yellow | rgba(234,179,8,0.15) | #eab308 | 🕐 | Verified 8–30 days ago |
      | red | rgba(239,68,68,0.15) | #ef4444 | ⚠ | Stale — verify before visiting |
      | grey | rgba(107,114,128,0.15) | #6b7280 | ? | Unknown recency |
    - Never color-only — always include icon (AC7, NFR-A1)
    - Use inline styles for exact color tokens (same approach as PinMarker.ts — consistent with established pattern)
    - Render as: `<span role="status" aria-label="[label]"><span aria-hidden="true">[icon]</span> [label]</span>`
  - [x] 3.2: Create `src/features/pin-detail/RecencyBadge.test.tsx`
    - Test: renders green badge with ✓ icon for badgeState "green"
    - Test: renders yellow badge with 🕐 icon for badgeState "yellow"
    - Test: renders red badge with ⚠ icon for badgeState "red"
    - Test: renders grey badge for badgeState "grey"
    - Test: each badge has `role="status"` and `aria-label` with descriptive text

- [x] Task 4: Create `PinDetailSheet.test.tsx` (all ACs)
  - [x] 4.1: Create `src/features/pin-detail/PinDetailSheet.test.tsx`
    - Setup: mock `react-router-dom` (`useParams`, `useNavigate`, `Outlet`); mock `usePinsQuery`; mock `useUIStore`; mock `useRigStore`; wrap with `MemoryRouter` + `QueryClientProvider`
    - Test: renders loading skeleton when `isLoading=true` (AC1)
    - Test: renders "Spot not found" when pin ID not in data (AC6 fallback)
    - Test: renders pin name, type, and recency badge when pin is found (AC2)
    - Test: renders all active amenities as pills — only amenities where value is `true` (AC3)
    - Test: renders rig fit notice when rig profile is set and `doesPinFitRig` returns false (AC4)
    - Test: does NOT render rig fit notice when pin fits rig (AC4)
    - Test: does NOT render rig fit notice when no rig profile set (AC4)
    - Test: calls `navigate('/')` and `setSelectedPin(null)` when sheet `onOpenChange(false)` fires (AC5)
    - Test: SheetContent has `aria-labelledby` matching the name heading id (AC7)
    - Test: renders rig restrictions when maxLengthFt/maxHeightFt are not null (AC2)
    - Test: renders "No size restrictions" when both are null (AC2)
    - Test: renders description when not null (AC2)
  - [x] 4.2: Update `src/features/map/MapView.test.tsx`
    - Add import of `useUIStore` reset in existing `beforeEach` blocks if not present (already done in Story 2.5)
    - Add test: `<Outlet />` is rendered in MapView (for nested route support) — verify by checking `screen.getByTestId` or using React Testing Library route setup
    - Add test: when `selectedPinId` is set in UIStore, `navigate` is called with `/pin/[id]`

## Dev Notes

### Critical: Routing architecture — nested routes

The `/pin/:id` route MUST be nested inside the `/` route in `App.tsx` so MapView stays mounted and the sheet overlays on top. This is how the "map remains visible behind the sheet" UX is achieved. Do NOT keep them as sibling routes.

**Before (current):**
```tsx
<Route path="/" element={<MapView />} />
<Route path="/pin/:id" element={<PinDetailSheet />} />
```

**After (required):**
```tsx
<Route path="/" element={<MapView />}>
  <Route path="pin/:id" element={<PinDetailSheet />} />
</Route>
```

MapView must add `<Outlet />` at the end of its render for the nested route to render.

### Critical: Why `setSelectedPin` + `useEffect` navigate (not direct Leaflet navigate)

`PinMarker.createPinMarker` runs in a Leaflet event callback — outside React render context. React hooks (`useNavigate`) cannot be called there. The solution is a two-step bridge:
1. `PinMarker` calls `useUIStore.getState().setSelectedPin(pin.id)` (already implemented — DO NOT CHANGE)
2. MapView adds a `useEffect` that watches `selectedPinId` and calls `navigate('/pin/' + selectedPinId)`

DO NOT try to import `useNavigate` into `PinMarker.ts` — it will not work outside React.

### Critical: Do NOT modify these files
- **`PinMarker.ts`** — click handler is already correct; do NOT change it
- **`LeafletMap.tsx`** — do NOT modify
- **`PinLayer.tsx`** component — only IMPORT `doesPinFitRig` from it; do NOT change the component
- **`usePinsQuery.ts`** — no server changes needed; all data comes from existing query

### Pin type — no `fee` field exists

The `Pin` type in `src/types/pin.ts` does NOT have a dedicated `fee` field. The UX spec mentions fee display but the data model doesn't support it yet. Do NOT add a fee field to the Pin type. Display fee information from `pin.description` if present, or omit the fee row entirely. Never render a hardcoded "Free" without data source.

### shadcn/ui Sheet API

`Sheet` from `@/components/ui/sheet` is already installed (used in previous stories). Key props:
- `open={boolean}` — controlled open state
- `onOpenChange={(open: boolean) => void}` — called when user swipes down, clicks backdrop, or presses Escape
- `<SheetContent side="bottom">` — positions sheet at bottom of screen
- Sheet automatically handles swipe-to-dismiss and backdrop click (AC5 is satisfied by the library)

Sheet does NOT need `open` to be derived from state — since PinDetailSheet is only rendered when the nested route is active, it's always `open={true}` when mounted.

### Finding pin from usePinsQuery cache

For both in-app navigation AND deep-link:
```typescript
const { data: pins = [], isLoading } = usePinsQuery({ enabled: true })
const { id } = useParams<{ id: string }>()
const pin = pins.find((p) => p.id === id)
```

`usePinsQuery` fetches all pins from Supabase. On deep-link, the query runs and `isLoading` is true until data arrives — show skeleton. On in-app navigation, pins are already in TanStack Query cache (no network request needed).

### `doesPinFitRig` import path

```typescript
import { doesPinFitRig } from '@/features/map/PinLayer'
```

This cross-feature import is ALLOWED by architecture: `src/features/*` can import from `src/lib/`, `src/hooks/`, `src/store/`, `src/types/`. However `doesPinFitRig` is in `src/features/map/`. Per architecture: "Features do NOT import from other features — cross-feature coordination goes through stores or React Router navigation."

To stay compliant: either (a) move `doesPinFitRig` to `src/lib/rig/rigFilter.ts` (cleaner but more scope), or (b) duplicate the small function inline in PinDetailSheet. Option (b) is simpler for this story:

```typescript
// Inline in PinDetailSheet.tsx — avoids cross-feature import
function doesPinFitRig(pin: Pin, rigProfile: RigProfile | null): boolean {
  if (!rigProfile) return true
  if (pin.maxLengthFt !== null && rigProfile.lengthFt > pin.maxLengthFt) return false
  if (pin.maxHeightFt !== null && rigProfile.heightFt > pin.maxHeightFt) return false
  return true
}
```

Verify the exact logic against `src/features/map/PinLayer.tsx:doesPinFitRig` before implementing — the logic must be IDENTICAL.

### Dismiss flow

Both `setSelectedPin(null)` AND `navigate('/')` must be called on dismiss to keep UIStore and URL in sync:

```typescript
function handleDismiss() {
  useUIStore.getState().setSelectedPin(null)
  navigate('/')
}
```

### `pinType` display labels

The `PinSource` type is: `'blm' | 'usfs' | 'nps' | 'overpass' | 'community'`

Render human-readable labels:
```typescript
const PIN_TYPE_LABELS: Record<PinSource, string> = {
  blm: 'BLM Land',
  usfs: 'National Forest',
  nps: 'National Park',
  overpass: 'OpenStreetMap',
  community: 'Community Stop',
}
```

### Sheet design tokens (from UX spec)

- Background: `bg-background` (CSS var, maps to `#1e293b` in dark theme)
- Border top: `border-t border-border` (maps to `#334155`)
- Horizontal padding: `px-6` (24px)
- Vertical padding: `py-5` (20px)
- Max height: `max-h-[60vh]` for compact; overflow-y-auto on content
- Drag handle: built into shadcn Sheet component

### RecencyBadge — reuse NOT color-only signal

The `RecencyBadge` created here is for the detail sheet — it's inline text+icon+color, different from the pin ring on the map. The pin ring is rendered in `PinMarker.ts` via HTML string (no React component). Do NOT try to reuse `RecencyBadge.tsx` inside `PinMarker.ts`.

### Date formatting — no external library

Format `lastCheckInAt` using native Intl API (no date-fns needed):
```typescript
const formatted = pin.lastCheckInAt
  ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      .format(new Date(pin.lastCheckInAt))
  : 'Never verified'
```

### Project Structure Notes

- Modified: `src/App.tsx` — nest `/pin/:id` under `/`
- Modified: `src/features/map/MapView.tsx` — add `<Outlet />`, add `useEffect` navigation bridge, import `useUIStore`
- Modified: `src/features/map/MapView.test.tsx` — add Outlet-related tests
- New: `src/features/pin-detail/PinDetailSheet.tsx` — replace stub with full implementation
- New: `src/features/pin-detail/PinDetailSheet.test.tsx`
- New: `src/features/pin-detail/RecencyBadge.tsx`
- New: `src/features/pin-detail/RecencyBadge.test.tsx`

### References

- Story requirements: [epics.md — Epic 3, Story 3.1](_bmad-output/planning-artifacts/epics.md)
- UX spec: [ux-design-specification.md — SpotBottomSheet, RecencyBadge](_bmad-output/planning-artifacts/ux-design-specification.md)
- Architecture routing: [architecture.md — Frontend Architecture, Routing](_bmad-output/planning-artifacts/architecture.md) — `/pin/:id` route
- Architecture feature boundaries: [architecture.md — Component Boundaries](_bmad-output/planning-artifacts/architecture.md) — features don't import other features
- shadcn Sheet: `src/components/ui/sheet.tsx` — already installed
- UIStore: `src/store/uiStore.ts` — `selectedPinId`, `setSelectedPin`
- SpotsStore: `src/store/spotsStore.ts` — for Story 3.3 (not in scope now)
- PinMarker click handler: `src/features/map/PinMarker.ts:createPinMarker` — calls `setSelectedPin(pin.id)` on click
- doesPinFitRig: `src/features/map/PinLayer.tsx` — verify logic before duplicating
- Pin type: `src/types/pin.ts` — `Pin`, `BadgeColor`, `PinSource`, `PinAmenities`
- AmenityFilterBar chip order: `src/features/map/AmenityFilterBar.tsx:CHIPS` — reuse for amenity display consistency
- Existing Zustand reset pattern in tests: `src/features/map/MapView.test.tsx:beforeEach`
- React Router nested routes: https://reactrouter.com/en/main/route/route#layout-routes

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- shadcn/ui Sheet NOT installed — implemented custom Tailwind bottom sheet (fixed backdrop + sheet div) with `role="dialog"`, `aria-modal`, close button, and backdrop click dismiss. Satisfies AC5 and AC7 without the library dependency.
- `doesPinFitRig` duplicated inline in PinDetailSheet per architecture rule (features must not import from other features). Logic verified identical to PinLayer.tsx:doesPinFitRig.

### Completion Notes List

- Task 1: Updated App.tsx to nest `/pin/:id` under `/` (nested routes). Added `<Outlet />` to MapView + `useEffect` bridge that watches `selectedPinId` and calls `navigate('/pin/' + selectedPinId)` when set. This connects Leaflet click handler (outside React) to React Router navigation.
- Task 2: Implemented PinDetailSheet.tsx — custom bottom sheet overlay (backdrop + fixed-bottom panel), loading skeleton (`aria-label="Loading pin details"`), not-found state, full pin details (name/type/recency/amenities/restrictions/rig notice/verified date/notes), dismiss clears UIStore + navigates to `/`.
- Task 3: Created RecencyBadge.tsx — 4 states (green/yellow/red/grey), inline styles with exact UX design tokens, `role="status"` + `aria-label`, icon always present (never color-only). 5 tests pass.
- Task 4: Created PinDetailSheet.test.tsx (13 tests). Updated MapView.test.tsx — added useUIStore reset to all 5 describe blocks, added "MapView pin selection navigation" describe with 2 tests.
- All 293 tests pass across 22 test files. No regressions.
- Code review fixes (3M, 3L resolved): M1 unmount cleanup in PinDetailSheet, M2 deep-link onboarding redirect bypass, M3 error state added, L2 redundant cast removed, L3 RecencyBadge test added. 298 tests pass after fixes.

### File List

- `src/App.tsx` — MODIFIED (nested /pin/:id under /)
- `src/features/map/MapView.tsx` — MODIFIED (Outlet, useUIStore, selectedPinId effect, useLocation for deep-link fix)
- `src/features/map/MapView.test.tsx` — MODIFIED (useUIStore import+reset, WrapperAtPath helper, 3 new tests)
- `src/features/pin-detail/PinDetailSheet.tsx` — MODIFIED (replaced stub; code review: useEffect unmount cleanup, error state, removed BadgeColor cast)
- `src/features/pin-detail/PinDetailSheet.test.tsx` — NEW (18 tests)
- `src/features/pin-detail/RecencyBadge.tsx` — NEW
- `src/features/pin-detail/RecencyBadge.test.tsx` — NEW (5 tests)
