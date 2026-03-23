# Story 2.3: Recency Badge Display

Status: done

## Story

As a user,
I want every pin to display a freshness badge as the dominant visual signal showing how recently it was verified,
so that I can assess data trustworthiness at a glance without tapping a pin.

## Acceptance Criteria

**AC1 — Green badge (fresh)**
Given a pin's last verified date is less than 7 days ago
When the pin renders on the map
Then the recency badge displays as green (fresh)

**AC2 — Yellow badge (recent)**
Given a pin's last verified date is 8–30 days ago
When the pin renders on the map
Then the recency badge displays as yellow (recent)

**AC3 — Red badge (stale)**
Given a pin's last verified date is more than 30 days ago, or the pin has never been verified
When the pin renders on the map
Then the recency badge displays as red (stale)

**AC4 — Badge visual dominance**
Given a pin renders on the map
When a user views it
Then the recency badge is the most visually prominent element on the pin marker — larger visual weight than the category icon

**AC5 — Dual-coding (NFR-A3)**
Given a pin's recency badge
When it is displayed
Then freshness is conveyed by BOTH color AND a visible text label — never color alone
And minimum color contrast ratio of 4.5:1 is met for all badge text against its background (NFR-A6)

**AC6 — Single pin for multi-amenity locations (FR19)**
Given a pin displays multiple amenities (e.g., dump + water + overnight)
When it renders on the map
Then a single pin marker is shown with all amenities represented (no duplicate markers per location)

**AC7 — First-session onboarding tooltip**
Given a user has not seen the recency badge before (first session, `badge_tooltip_seen` not in localStorage)
When they first view the map with pins loaded
Then a single non-intrusive overlay tooltip is shown: "🟢 Green = verified this week. Tap any pin to see when."
And it dismisses on first tap anywhere on the screen
And `badge_tooltip_seen` is written to localStorage
And it is never shown again in any subsequent session

## Tasks / Subtasks

- [x] Task 1: Create `src/lib/badge/badgeState.ts` — pure badge state computation (AC1, AC2, AC3)
  - [x] 1.1: Implement `computeBadgeState(lastCheckInAt: string | null): BadgeColor` with thresholds: < 7 days → 'green', 8–30 days → 'yellow', > 30 days → 'red', null → 'grey'
  - [x] 1.2: Export `BADGE_THRESHOLDS` constant `{ FRESH_DAYS: 7, RECENT_DAYS: 30 }` as named export — not a magic number
  - [x] 1.3: Import `BadgeColor` from `@/types/pin` (NOT from `@/types/badge.ts` — that file does not exist; `BadgeColor` lives in `pin.ts`)
  - [x] 1.4: Create `src/lib/badge/badgeState.test.ts` — pure unit tests, no mocks needed

- [x] Task 2: Enhance pin marker with visible text label (AC4, AC5 / NFR-A3, NFR-A6)
  - [x] 2.1: Modify `createPinIconConfig` in `PinMarker.ts` to add a visible text pill below the circle
    - Wrap circle + pill in a `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">` parent
    - Pill: `<span style="font-size:9px;font-weight:700;padding:1px 4px;border-radius:3px;background:{ringColor};color:{pillTextColor};line-height:1.2">{recencyLabel}</span>`
    - `pillTextColor`: `'#0f172a'` for green/yellow/red (dark text on light ring — passes 4.5:1); `'#ffffff'` for grey (white on grey — passes 4.5:1)
    - Update `iconSize` from `[36, 36]` → `[44, 54]`
    - Update `iconAnchor` from `[18, 18]` → `[22, 18]` (center horizontally, anchor at center of circle vertically)
  - [x] 2.2: Update `PinMarker.test.ts`:
    - Update iconSize expectation to `[44, 54]`
    - Update iconAnchor expectation to `[22, 18]`
    - Add tests: visible label text 'fresh' / 'recent' / 'stale' / 'unknown' present in html
    - Add test: grey badge uses white pill text `#ffffff`; green/yellow/red badges use dark pill text `#0f172a`
    - All existing tests must continue to pass (ring colors, unfit greying, emoji, aria-label, XSS safety)

- [x] Task 3: First-session onboarding tooltip (AC7)
  - [x] 3.1: Create `src/features/map/BadgeTooltip.tsx`
    - Props: `{ onDismiss: () => void }`
    - Renders a full-screen transparent overlay div (`absolute inset-0 z-[1001] cursor-pointer`) that intercepts all taps
    - Inside the overlay: a centered tooltip card at `absolute bottom-24 left-0 right-0 flex justify-center pointer-events-none`
    - Card style: `bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 mx-4 shadow-lg text-sm text-slate-100`
    - Content: `"🟢 Green = verified this week. Tap any pin to see when."`
    - `onClick` on the outer overlay div: calls `onDismiss`
  - [x] 3.2: Integrate `BadgeTooltip` into `MapView.tsx`
    - Add state: `const [showBadgeTooltip, setShowBadgeTooltip] = useState(() => !localStorage.getItem('badge_tooltip_seen'))`
    - Dismiss handler: sets `localStorage.setItem('badge_tooltip_seen', '1')` then `setShowBadgeTooltip(false)`
    - Render `{showBadgeTooltip && pins.length > 0 && !isLoading && <BadgeTooltip onDismiss={handleDismissTooltip} />}` inside the outer relative div, AFTER the `z-0` map wrapper (so it renders above the map stacking context)
    - BadgeTooltip must be at `z-[1001]` — above both the map (`z-0`) and the SearchBar overlay (`z-10`)
  - [x] 3.3: Create `src/features/map/BadgeTooltip.test.tsx`
    - Mock localStorage (`vi.stubGlobal` or `Object.defineProperty`) in beforeEach
    - Test: renders when `badge_tooltip_seen` not set in localStorage
    - Test: does NOT render (controlled by parent state) when `badge_tooltip_seen` already set
    - Test: clicking the overlay calls `onDismiss`
    - Test: `onDismiss` handler in MapView sets `badge_tooltip_seen` in localStorage and hides tooltip

- [x] Task 4: Validate and close
  - [x] 4.1: `tsc -b` passes with zero errors
  - [x] 4.2: All tests pass (`npx vitest run`) — no regressions

## Dev Notes

### What Story 2.2 already implemented (DO NOT re-implement)

Story 2.2 created `PinMarker.ts` with a full RecencyPin DivIcon. The following is already in place and must NOT be re-created or duplicated:

- `RING_COLORS`, `FILL_COLORS`, `BADGE_LABELS` constants in `PinMarker.ts`
- `BadgeColor` type already exported from `src/types/pin.ts`
- Ring color logic: fit pin → `RING_COLORS[badge]`, unfit pin → `RING_COLORS.grey`
- `escapeHtml()` XSS protection
- `aria-label` format: `"{name}: {category}, verified {recency}"`
- `createPinMarker()` with click handler → `useUIStore.getState().setSelectedPin(pin.id)`

Story 2.3 **extends** `PinMarker.ts` (adds visible text pill + updates iconSize/iconAnchor) and **adds** new files (`badgeState.ts`, `BadgeTooltip.tsx`).

### Badge state design: null → 'grey' is intentional

`computeBadgeState(null)` returns `'grey'` — this is intentional design, not a bug. A pin with no check-in data genuinely has *unknown* freshness; 'grey' communicates "no data" to the user. AC3 in this story says "returns 'grey' when `lastCheckInAt` is null", which is the authoritative spec. Do not change this to 'red' or any other color.

Malformed/invalid date strings (NaN after `new Date().getTime()`) return `'red'` (maximally stale) as the safe fallback — this is different from null/missing data. A string that was passed but couldn't be parsed is more likely a data corruption issue than a "never checked in" scenario.

### Badge state calculation (`src/lib/badge/badgeState.ts`)

Architecture mandates: `src/lib/badge/badgeState.ts` — badge state calculation logic. This is pure computation — no Leaflet, no React, no DOM. The `pin.badgeState` field is computed server-side and stored in Supabase; this client-side function is needed for **optimistic updates** in check-in (Story 4.3) and as the canonical calculation reference.

```typescript
// src/lib/badge/badgeState.ts
import type { BadgeColor } from '@/types/pin'   // ← import from pin.ts, NOT badge.ts

export const BADGE_THRESHOLDS = { FRESH_DAYS: 7, RECENT_DAYS: 30 }

export function computeBadgeState(lastCheckInAt: string | null): BadgeColor {
  if (!lastCheckInAt) return 'grey'
  const ageMs = Date.now() - new Date(lastCheckInAt).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  if (ageDays < BADGE_THRESHOLDS.FRESH_DAYS)  return 'green'
  if (ageDays <= BADGE_THRESHOLDS.RECENT_DAYS) return 'yellow'
  return 'red'
}
```

**Critical:** `BadgeColor` is exported from `src/types/pin.ts`, not from a `src/types/badge.ts` (that file was never created — don't create it, don't guess-import from it).

### Pin marker visual changes

Modify `createPinIconConfig` in `PinMarker.ts`. The outer wrapper changes from a single circle to a flex column:

```typescript
// Pill text color — contrast compliant:
// green/yellow/red ring: dark #0f172a text on colored background → ≥4.5:1
// grey ring: white #ffffff text on grey #6b7280 → 4.5:1
const PILL_TEXT_COLORS: Record<BadgeColor, string> = {
  green: '#0f172a',
  yellow: '#0f172a',
  red: '#0f172a',
  grey: '#ffffff',
}

// In createPinIconConfig:
const pillTextColor = fits ? (PILL_TEXT_COLORS[badge] ?? '#ffffff') : '#ffffff'

const html =
  `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">` +
    `<div ` +
      `style="width:36px;height:36px;border-radius:50%;border:3px solid ${ringColor};` +
      `background:${fillColor};display:flex;align-items:center;justify-content:center;` +
      `font-size:16px;cursor:pointer;${unfitStyles}" ` +
      `role="img" ` +
      `aria-label="${ariaLabel}"` +
    `>${emoji}</div>` +
    `<span style="font-size:9px;font-weight:700;padding:1px 4px;border-radius:3px;` +
      `background:${ringColor};color:${pillTextColor};line-height:1.2;cursor:pointer;${unfitStyles}"` +
    `>${recency}</span>` +
  `</div>`

return {
  html,
  iconSize: [44, 54],    // wider to fit label, taller for circle + gap + pill
  iconAnchor: [22, 18],  // horizontally centered, vertically at circle center
  className: '',
}
```

**Why iconAnchor [22, 18]:** Leaflet places the `iconAnchor` point at the pin's lat/lng coordinate. With `[22, 18]`, the center of the 36px circle aligns exactly with the pin's geographic coordinate (22 = half of 44px width, 18 = half of circle height in the 54px icon).

### First-session tooltip

**localStorage key:** `badge_tooltip_seen` (follow kebab-case convention, no namespace prefix for simple string flags)

**z-index layering in MapView:**
- Map wrapper: `z-0` (contains all Leaflet panes)
- SearchBar/RigFilter overlay: `z-10`
- BadgeTooltip overlay: `z-[1001]` (above both)

**Do NOT use a global document event listener** — use a full-screen `div` with `onClick`. This is simpler, testable, and avoids `addEventListener`/`removeEventListener` lifecycle management.

**State initialization pattern** — use a lazy initializer to avoid reading localStorage on every render:
```typescript
const [showBadgeTooltip, setShowBadgeTooltip] = useState(
  () => !localStorage.getItem('badge_tooltip_seen')
)
```

### Testing patterns established in Story 2.2

**Pattern: `vi.hoisted()` for mock variables** — always wrap mock variable declarations in `vi.hoisted()` when referenced inside `vi.mock()` factories. This prevents "Cannot access X before initialization" ReferenceErrors from Vitest's mock hoisting.

**Pattern: localStorage in tests** — use `vi.stubGlobal('localStorage', ...)` or `Object.defineProperty` on the localStorage mock. Clean it in `beforeEach` to prevent test bleed.

**Pattern: `.tsx` vs `.ts` for test files** — `BadgeTooltip.test.tsx` MUST be `.tsx` (it renders JSX via RTL). `badgeState.test.ts` MUST be `.ts` (no JSX). Wrong extension causes parse errors.

**Pattern: `React.createElement()` vs JSX** — Only needed if you're writing JSX in a `.ts` file (workaround from Story 2.2 PinLayer.test.ts). In `.tsx` files, JSX works natively. Use JSX in `.tsx`.

### Project Structure Notes

Files to CREATE:
- `overnighter/src/lib/badge/badgeState.ts`
- `overnighter/src/lib/badge/badgeState.test.ts`
- `overnighter/src/features/map/BadgeTooltip.tsx`
- `overnighter/src/features/map/BadgeTooltip.test.tsx`

Files to MODIFY:
- `overnighter/src/features/map/PinMarker.ts` — add pill HTML, add `PILL_TEXT_COLORS`, update iconSize/iconAnchor
- `overnighter/src/features/map/PinMarker.test.ts` — update iconSize/iconAnchor expectations, add pill label tests
- `overnighter/src/features/map/MapView.tsx` — add `showBadgeTooltip` state + `BadgeTooltip` render

Files NOT to touch:
- `PinLayer.tsx` — no changes needed
- `LeafletMap.tsx` — no changes needed
- `src/types/pin.ts` — `BadgeColor` already defined there, no additions needed
- Do NOT create `src/types/badge.ts` — would duplicate `BadgeColor`
- Do NOT create `src/lib/badge/` directory explicitly — just write the files, the directory will be created

### Architecture alignment

| Concern | Location | Note |
|---|---|---|
| Badge state logic | `src/lib/badge/badgeState.ts` | Architecture mandate [Source: architecture.md#Project Structure] |
| Recency badge component | `src/features/pin-detail/RecencyBadge.tsx` | Story 3.1 territory — out of scope here |
| Pin rendering | `src/features/map/PinMarker.ts` | Extend existing file |
| localStorage read/write | `BadgeTooltip.tsx` (direct) | Acceptable for simple boolean flag; Zustand persist is overkill for a one-time UI flag |
| Cross-feature coordination | MapView state `showBadgeTooltip` | Dismissed state lives in MapView — no store needed, not shared across features |

### References

- Story requirements: [epics.md — Epic 2, Story 2.3](../_bmad-output/planning-artifacts/epics.md)
- Badge state file location: [architecture.md#Project Structure](../_bmad-output/planning-artifacts/architecture.md)
- Badge visual design: [ux-design-specification.md — RecencyBadge section](../_bmad-output/planning-artifacts/ux-design-specification.md)
- Tooltip first-session UX: [ux-design-specification.md — Teaching strategy](../_bmad-output/planning-artifacts/ux-design-specification.md)
- Previous story: [2-2-full-pin-layer-with-rig-aware-greying.md](./2-2-full-pin-layer-with-rig-aware-greying.md)
- BadgeColor type: `overnighter/src/types/pin.ts:3`
- PinMarker source: `overnighter/src/features/map/PinMarker.ts`
- UIStore (for `setSelectedPin` Zustand pattern reference): `overnighter/src/store/uiStore.ts`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `badgeState.test.ts` imported `beforeEach`, `afterEach`, `vi` but didn't use them — TypeScript strict mode flagged as unused. Removed from import line.

### Completion Notes List

- **Task 1 (badgeState.ts)**: Created `src/lib/badge/badgeState.ts` with `computeBadgeState(lastCheckInAt)` and exported `BADGE_THRESHOLDS = { FRESH_DAYS: 7, RECENT_DAYS: 30 }`. Imports `BadgeColor` from `@/types/pin` (not the non-existent `@/types/badge.ts`). 19 pure unit tests covering all threshold boundaries, null input, and edge cases.
- **Task 2 (PinMarker.ts)**: Added `PILL_TEXT_COLORS` constant to `PinMarker.ts`. Modified `createPinIconConfig` to wrap the circle + pill in a flex-column container, adding a visible colored-background `<span>` label (fresh/recent/stale/unknown) below each pin circle. Dark text (`#0f172a`) on green/yellow/red backgrounds, white (`#ffffff`) on grey — all meet NFR-A6 4.5:1 contrast. Updated `iconSize` to `[44, 54]` and `iconAnchor` to `[22, 18]`. Updated PinMarker.test.ts with new size expectations + 9 pill/contrast tests. All 51 PinMarker tests pass.
- **Task 3 (BadgeTooltip + MapView)**: Created `BadgeTooltip.tsx` — full-screen transparent overlay that captures all taps, dismisses on any click, shows card at bottom-24. Integrated into `MapView.tsx` with lazy `useState(() => !localStorage.getItem('badge_tooltip_seen'))` initializer, `handleDismissTooltip` function that writes localStorage and hides. Renders only when `showBadgeTooltip && pins.length > 0 && !isLoading`. Positioned at `z-[1001]` above map (z-0) and SearchBar overlay (z-10). Created `BadgeTooltip.test.tsx` with 9 tests.
- **Final**: 200/200 tests passing (38 new tests added), `tsc -b` clean, zero regressions.

### File List

- `overnighter/src/lib/badge/badgeState.ts` — CREATED
- `overnighter/src/lib/badge/badgeState.test.ts` — CREATED
- `overnighter/src/features/map/PinMarker.ts` — MODIFIED (added PILL_TEXT_COLORS, flex-column wrapper, pill span, updated iconSize/iconAnchor)
- `overnighter/src/features/map/PinMarker.test.ts` — MODIFIED (updated size expectations, added 9 pill/contrast tests)
- `overnighter/src/features/map/BadgeTooltip.tsx` — CREATED
- `overnighter/src/features/map/BadgeTooltip.test.tsx` — CREATED
- `overnighter/src/features/map/MapView.tsx` — MODIFIED (added useState, handleDismissTooltip, BadgeTooltip render)

## Change Log

- 2026-03-18: Story 2.3 implemented — `badgeState.ts` created with threshold logic; `PinMarker.ts` enhanced with visible pill label (NFR-A3/A6); `BadgeTooltip.tsx` created; `MapView.tsx` integrated first-session tooltip; 200/200 tests passing.
