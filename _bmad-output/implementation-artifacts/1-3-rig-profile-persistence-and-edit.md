# Story 1.3: Rig Profile Persistence & Edit

Status: done

## Story

As a returning user,
I want my rig profile to be remembered between sessions and editable at any time,
so that I never have to re-enter my rig details and can update them when I change vehicles.

## Acceptance Criteria

1. **Given** a user has completed onboarding and saved a rig profile **When** they close the browser and reopen the app **Then** the rig profile is loaded from localStorage and the user lands directly on the map (not onboarding).

2. **Given** a user has a saved rig profile **When** they navigate to the rig profile edit screen (accessible from the map's rig context indicator) **Then** all three fields (class, length, height) are pre-populated with the saved values.

3. **Given** a user is editing their rig profile **When** they change one or more values and tap "Save Changes" **Then** the Zustand `useRigStore` updates immediately **And** the localStorage value is updated **And** the user is returned to the map with the updated filter applied.

4. **Given** a user is editing their rig profile **When** they tap "Cancel" without saving **Then** the original profile values are preserved unchanged and the user is returned to the map.

5. **Given** the localStorage rig profile data **When** any component reads rig profile values **Then** they are always read from the Zustand store — never directly from localStorage.

6. **Given** a user with a saved rig profile **When** they view the map **Then** a persistent rig context indicator is visible showing "Filtering for: [class], [length]ft" with a tappable link to the edit screen.

## Tasks / Subtasks

- [x] **Task 1: Add `/rig-edit` route to App.tsx** (AC: 2, 3, 4)
  - [x] Add `const RigEditScreen = lazy(() => import('@/features/rig-profile/RigEditScreen'))` with other lazy imports
  - [x] Add `<Route path="/rig-edit" element={<RigEditScreen />} />` inside `<Routes>` after the `/onboarding` route

- [x] **Task 2: Build `RigEditScreen` component** (AC: 2, 3, 4, 5)
  - [x] Create `src/features/rig-profile/RigEditScreen.tsx`
  - [x] Read current profile from `useRigStore`: `const rigProfile = useRigStore((state) => state.rigProfile)`
  - [x] Initialize all state from saved profile values using `fromDecimalFeet()` for height decomposition
  - [x] Reuse same UI patterns from `OnboardingScreen.tsx`: radio chips (`role="radiogroup"` + `role="radio"` + `aria-checked`), length stepper (–/+), dual height inputs (ft + in), string-state pattern with blur-to-commit
  - [x] Pre-populate `selectedRigType` from `rigProfile.rigType` (null-safe)
  - [x] Pre-populate `lengthFt` / `lengthInput` from `rigProfile.lengthFt ?? 25`
  - [x] Pre-populate `heightFtPart` / `heightFtInput` and `heightInPart` / `heightInInput` from `fromDecimalFeet(rigProfile.heightFt ?? 10)`
  - [x] "Save Changes" button: validate rigType not null → call `setRigProfile({rigType, lengthFt, heightFt})` → `navigate('/')`
  - [x] "Cancel" button: `navigate('/')` only — does not touch store
  - [x] Apply same cross-field height clamp: at 16ft, force inches to 0 (M2 pattern from Story 1.2)
  - [x] Apply same validation: inline `role="alert"` error if rigType is null on save attempt (M1 pattern from Story 1.2)
  - [x] All buttons: `type="button"` (L1 pattern from Story 1.2)
  - [x] All interactive elements: `min-h-[44px]` and `min-w-[44px]` touch targets
  - [x] Dark theme: use same `bg-background`, `bg-secondary`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary-foreground` classes

- [x] **Task 3: Add rig context indicator to MapView** (AC: 1, 6)
  - [x] In `MapView.tsx`, read `rigProfile` from `useRigStore`: `const rigProfile = useRigStore((state) => state.rigProfile)`
  - [x] Render a persistent overlay div (position fixed or absolute over map) showing:
    - If `rigProfile.rigType` is set: `"Filtering for: {rigType}, {lengthFt}ft"` as a tappable button that calls `navigate('/rig-edit')`
    - If no rig profile: render nothing (no indicator — empty state is handled by Story 1.4)
  - [x] Style: dark semi-transparent pill/chip at top of map area, visible but not blocking content
  - [x] Use `useNavigate` from react-router-dom (already imported from Story 1.2 redirect guard)
  - [x] AC1 persistence is already handled by Zustand `persist` middleware — no code change needed; just verify via test

- [x] **Task 4: Write tests** (AC: 1–6)
  - [x] `src/features/rig-profile/RigEditScreen.test.tsx` — create new, co-located:
    - Renders all 5 rig class chips as radio buttons
    - Pre-populates selectedRigType from store (aria-checked="true" on saved class)
    - Pre-populates length input from store value
    - Pre-populates height ft and inches from store value (decimal → ft+in)
    - "Save Changes" with changed values updates store and navigates to /
    - "Cancel" navigates to / without changing store
    - Validation error shown when rigType cleared then Save attempted
    - Height 16ft max clamp: inches reset to 0 when feet set to 16
    - Length stepper clamps at 10 min and 65 max
  - [x] `src/features/map/MapView.test.tsx` — add tests:
    - Shows rig context indicator when rig profile is saved
    - Indicator text contains rig class and length
    - Does not show indicator when no rig profile set (AC1 already tested — redirect fires when no profile)
    - Indicator navigates to /rig-edit on click
  - [x] Verify all existing tests still pass (zero regressions)

## Dev Notes

### Critical Architecture Guardrails

**DO NOT break these rules established in Stories 1.1 and 1.2:**

- **State ownership:** `useRigStore` is the ONLY place that writes the rig profile. **Never** call `localStorage.setItem('rig-profile', ...)` directly. Zustand's `persist` middleware handles persistence automatically.
- **Supabase NOT involved in this story.** Rig profile is 100% client-side (localStorage via Zustand persist). No server calls.
- **No cross-feature imports.** `RigEditScreen.tsx` must not import anything from `src/features/map/`. Navigation is via `useNavigate` only.
- **Tests co-located:** `RigEditScreen.test.tsx` lives next to `RigEditScreen.tsx`. NOT in a `__tests__` folder.
- **No prop drilling:** Access `useRigStore` directly inside `RigEditScreen.tsx`. Do not pass rig profile as props.

### Key Difference from OnboardingScreen

`RigEditScreen.tsx` is NOT a copy-paste of `OnboardingScreen.tsx`. The critical differences:

| | OnboardingScreen | RigEditScreen |
|---|---|---|
| Initial state | All empty / defaults | Pre-populated from `useRigStore` |
| Primary action | "Save My Rig" (creates profile) | "Save Changes" (updates profile) |
| Secondary action | "Skip for now" (no store write, goes to map) | "Cancel" (no store write, goes to map) |
| Validation | rigType required | rigType required (same logic) |
| Navigation on save | `navigate('/')` | `navigate('/')` |

### Existing Infrastructure to Reuse

| What | Location | Notes |
|---|---|---|
| `useRigStore` | `src/store/rigStore.ts` | Has `setRigProfile`, `clearRigProfile`, `hasRigProfile` — use as-is |
| `RigProfile` type | `src/types/rigProfile.ts` | `{ rigType: RigType \| null, lengthFt: number \| null, heightFt: number \| null }` |
| `RigType` union | `src/types/rigProfile.ts` | `'Class A' \| 'Class B' \| 'Class C' \| 'Travel Trailer' \| '5th Wheel'` |
| `DEFAULT_RIG_PROFILE` | `src/types/rigProfile.ts` | `{ rigType: null, lengthFt: null, heightFt: null }` |
| `cn()` utility | `src/lib/utils.ts` | Use for conditional Tailwind class composition |
| CSS design tokens | `src/index.css` `@theme {}` | `--color-background`, `--color-surface`, `--color-primary`, etc. |
| `OnboardingScreen.tsx` | `src/features/rig-profile/OnboardingScreen.tsx` | Reference implementation for all UI patterns |
| `MapView.tsx` | `src/features/map/MapView.tsx` | Add rig context indicator here |
| `App.tsx` | `src/App.tsx` | Add lazy import + route for `/rig-edit` |
| React Router navigation | `App.tsx` already configured | Use `useNavigate` from `react-router-dom` |

### Component Structure

```
src/features/rig-profile/
  OnboardingScreen.tsx          ← existing (do not modify)
  OnboardingScreen.test.tsx     ← existing (do not modify)
  RigEditScreen.tsx             ← create new (this story)
  RigEditScreen.test.tsx        ← create new (this story)
```

### Pre-Population Pattern

Read the saved profile on mount; initialize state from it:

```typescript
// In RigEditScreen.tsx
import { useRigStore } from '@/store/rigStore'
import { type RigType } from '@/types/rigProfile'

export default function RigEditScreen() {
  const navigate = useNavigate()
  const rigProfile = useRigStore((state) => state.rigProfile)
  const setRigProfile = useRigStore((state) => state.setRigProfile)

  // Pre-populate from saved profile
  const initialHeightParts = fromDecimalFeet(rigProfile.heightFt ?? 10)

  const [selectedRigType, setSelectedRigType] = useState<RigType | null>(
    rigProfile.rigType
  )
  const [lengthFt, setLengthFt] = useState<number>(rigProfile.lengthFt ?? 25)
  const [lengthInput, setLengthInput] = useState<string>(
    String(rigProfile.lengthFt ?? 25)
  )
  const [heightFtPart, setHeightFtPart] = useState<number>(initialHeightParts.ft)
  const [heightInPart, setHeightInPart] = useState<number>(initialHeightParts.inches)
  const [heightFtInput, setHeightFtInput] = useState<string>(String(initialHeightParts.ft))
  const [heightInInput, setHeightInInput] = useState<string>(String(initialHeightParts.inches))
  const [validationError, setValidationError] = useState<string | null>(null)

  // ... rest same as OnboardingScreen patterns
}
```

**Important:** Do NOT use `useEffect` to sync store → state. Initialize directly from `rigProfile` in `useState` calls. The store value is available synchronously on mount (Zustand persist rehydrates before render).

### Cancel Pattern

```typescript
function handleCancel() {
  navigate('/') // Simply navigate away — state is local, store untouched
}
```

No need to "restore" the store — the store never changed. Local component state is discarded on unmount.

### Rig Context Indicator Pattern

```typescript
// In MapView.tsx — add after existing redirect guard
import { useNavigate } from 'react-router-dom'
import { useRigStore } from '@/store/rigStore'

export default function MapView() {
  const navigate = useNavigate()
  const hasRigProfile = useRigStore((state) => state.hasRigProfile)
  const rigProfile = useRigStore((state) => state.rigProfile)

  useEffect(() => {
    if (!hasRigProfile()) {
      navigate('/onboarding', { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative min-h-screen bg-background">
      {/* Rig context indicator — shown only when profile exists */}
      {rigProfile.rigType && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <button
            type="button"
            onClick={() => navigate('/rig-edit')}
            className="bg-background/80 border border-border rounded-full px-4 py-2 text-sm text-foreground min-h-[44px]"
          >
            Filtering for: {rigProfile.rigType}, {rigProfile.lengthFt}ft
          </button>
        </div>
      )}
      <div className="flex items-center justify-center min-h-screen">
        Map (Story 1.4)
      </div>
    </div>
  )
}
```

### Height Storage Format (same as Story 1.2)

```
12ft 0in  → 12.0
12ft 6in  → 12.5
13ft 0in  → 13.0
 6ft 0in  →  6.0
```

Copy helpers from `OnboardingScreen.tsx` into `RigEditScreen.tsx` (inline — no shared utility file):

```typescript
function toDecimalFeet(ft: number, inches: number): number {
  return ft + inches / 12
}

function fromDecimalFeet(decimal: number): { ft: number; inches: number } {
  const ft = Math.floor(decimal)
  const inches = Math.round((decimal - ft) * 12)
  return { ft, inches }
}
```

### Constants (same as Story 1.2 — redefine in RigEditScreen.tsx)

```typescript
const RIG_DEFAULTS: Record<RigType, { lengthFt: number; heightFt: number }> = {
  'Class A': { lengthFt: 35, heightFt: 12.5 },
  'Class B': { lengthFt: 20, heightFt: 7.0 },
  'Class C': { lengthFt: 28, heightFt: 11.0 },
  'Travel Trailer': { lengthFt: 25, heightFt: 10.0 },
  '5th Wheel': { lengthFt: 30, heightFt: 12.0 },
}

const RIG_TYPES: RigType[] = ['Class A', 'Class B', 'Class C', 'Travel Trailer', '5th Wheel']
const LENGTH_MIN = 10
const LENGTH_MAX = 65
const HEIGHT_FT_MIN = 6
const HEIGHT_FT_MAX = 16
```

Selecting a class chip still auto-fills defaults (same as OnboardingScreen — if user picks a different class, sensible defaults populate).

### AC1 — Persistence Already Implemented

AC1 ("returning user lands on map") is already handled by the Zustand `persist` middleware from Story 1.1 and the redirect guard in `MapView.tsx` from Story 1.2. The `persist` middleware rehydrates `useRigStore` from localStorage automatically before the first render.

- **No new implementation needed for AC1 persistence itself.**
- **Test needed:** Verify that when a rig profile is stored in localStorage and the app reloads, the redirect guard does NOT fire and the user stays on the map. This is covered by the existing MapView test "does not redirect when rig profile is set" — confirm it passes and add a more explicit description if needed.

### Tailwind CSS v4 Reminder (from Story 1.1/1.2 learnings)

- **Use `@theme` CSS variables** — the tokens are in `src/index.css` under `@theme {}`
- **Do NOT use `@layer base`** — this caused build failures in Story 1.1
- Reference CSS variables via Tailwind classes: `bg-background`, `text-foreground`, `border-border`, `bg-primary`
- The `cn()` utility (`src/lib/utils.ts`) handles conditional class composition

### Testing Setup (same as Story 1.2)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RigEditScreen from './RigEditScreen'
import { useRigStore } from '@/store/rigStore'
import { DEFAULT_RIG_PROFILE } from '@/types/rigProfile'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('RigEditScreen', () => {
  beforeEach(() => {
    localStorage.clear()
    mockNavigate.mockClear()
  })

  // Seed a saved profile before tests that need it:
  function seedProfile() {
    useRigStore.getState().setRigProfile({
      rigType: 'Class A',
      lengthFt: 35,
      heightFt: 12.5,
    })
  }

  // ...tests
})
```

**Key difference from OnboardingScreen tests:** The store must be seeded with a saved profile before rendering in tests that check pre-population. Use `useRigStore.getState().setRigProfile(...)` in the test or `beforeEach`.

### References

- Story requirements: [_bmad-output/planning-artifacts/epics.md](_bmad-output/planning-artifacts/epics.md) (lines 294–328)
- Rig profile types: [overnighter/src/types/rigProfile.ts](overnighter/src/types/rigProfile.ts)
- Zustand store: [overnighter/src/store/rigStore.ts](overnighter/src/store/rigStore.ts)
- Routing config: [overnighter/src/App.tsx](overnighter/src/App.tsx)
- OnboardingScreen (reference implementation): [overnighter/src/features/rig-profile/OnboardingScreen.tsx](overnighter/src/features/rig-profile/OnboardingScreen.tsx)
- MapView (add rig indicator): [overnighter/src/features/map/MapView.tsx](overnighter/src/features/map/MapView.tsx)
- Architecture naming conventions: [_bmad-output/planning-artifacts/architecture.md](_bmad-output/planning-artifacts/architecture.md#naming-patterns)
- Architecture structure patterns: [_bmad-output/planning-artifacts/architecture.md](_bmad-output/planning-artifacts/architecture.md#structure-patterns)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- No issues encountered. All patterns inherited cleanly from Story 1.2.

### Completion Notes List

- ✅ Task 1: Added `RigEditScreen` lazy import and `/rig-edit` route to `App.tsx` after `/onboarding` route.
- ✅ Task 2: Created `RigEditScreen.tsx` pre-populated from `useRigStore`. Reused all Story 1.2 patterns: radiogroup ARIA (M4), string-state blur-commit (M3), cross-field height clamp at 16ft (M2), validation error clear on chip click (M1), `type="button"` on all buttons (L1). Cancel navigates without touching store.
- ✅ Task 3: Updated `MapView.tsx` to read `rigProfile` from store and render a persistent pill button showing `"Filtering for: {rigType}, {lengthFt}ft"` that navigates to `/rig-edit`. Button hidden when `rigProfile.rigType` is null.
- ✅ Task 4: Created `RigEditScreen.test.tsx` (9 tests co-located). Updated `MapView.test.tsx` (4 new tests: indicator visible, correct text, hidden when no profile, navigates to /rig-edit). All 61 tests pass, 0 regressions. Lint clean.

### Senior Developer Review (AI)

**Review Date:** 2026-03-17
**Outcome:** Changes Requested → Fixed
**Issues Found:** 0 High, 3 Medium, 2 Low
**Issues Fixed:** 3 Medium + 1 Low (L2)

#### Action Items (all resolved)

- [x] [M1] Missing test: validation error clears when chip clicked after failed save — added `'clears validation error when user selects a rig class after failed save'` test to `RigEditScreen.test.tsx`
- [x] [M2] "Save Changes" test missing `heightFt` assertion — added `expect(profile.heightFt).toBe(7.0)` to AC3 test
- [x] [M3] `MapView.test.tsx` beforeEach changed from Story 1.2's `clearRigProfile()` to `setState({...})` — restored `clearRigProfile()` in both describe blocks, removed unused `DEFAULT_RIG_PROFILE` import
- [x] [L2] Cancel test only checked `rigType`, not all 3 fields — added `lengthFt` and `heightFt` assertions
- [ ] [L1] `initialHeightParts` computed on every render (trivial O(1) cost, accepted as-is)

### File List

- `overnighter/src/App.tsx` — modified (added RigEditScreen lazy import + /rig-edit route)
- `overnighter/src/features/rig-profile/RigEditScreen.tsx` — created
- `overnighter/src/features/rig-profile/RigEditScreen.test.tsx` — created (updated by review: M1, M2, L2 fixes)
- `overnighter/src/features/map/MapView.tsx` — modified (added rig context indicator)
- `overnighter/src/features/map/MapView.test.tsx` — modified (added 4 rig indicator tests; updated by review: M3 fix)
