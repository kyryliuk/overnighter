# Story 1.2: Rig Profile Onboarding Form

Status: done

## Story

As a first-time user,
I want to set my rig class, length, and height using visual selectors before accessing the map,
so that I can complete my profile in under 60 seconds without typing and immediately get a personalized experience.

## Acceptance Criteria

1. **Given** a user opens the app for the first time (no rig profile in localStorage) **When** the app loads **Then** the user is automatically redirected to `/onboarding` before seeing the map.

2. **Given** the user is on the onboarding screen **When** they view the rig class selector **Then** five options are displayed as visual chips or cards: Class A, Class B, Class C, Travel Trailer, 5th Wheel — not a text input.

3. **Given** the user is on the onboarding screen **When** they view the rig length selector **Then** a numeric input or stepper is shown labeled in feet, with a valid range of 10–65ft.

4. **Given** the user is on the onboarding screen **When** they view the rig height selector **Then** a numeric input is shown in feet and inches format (e.g., 12ft 6in), with a valid range of 6ft–16ft.

5. **Given** the user has selected rig class, length, and height **When** they tap the "Save My Rig" button **Then** the rig profile is saved to the Zustand `useRigStore` (persisted to localStorage via `persist` middleware) **And** the user is redirected to the map view at `/`.

6. **Given** a user is on the onboarding screen **When** they tap "Skip for now" **Then** they are redirected to the map at `/` without a rig profile saved **And** no rig filtering is applied to map pins.

7. **Given** the onboarding form **When** a user attempts to submit without selecting a rig class **Then** an inline validation message is shown and the form cannot be submitted.

8. **Given** the onboarding screen on a mobile device **When** the user interacts with any selector or button **Then** all interactive elements meet the minimum 44×44px touch target size (NFR-A4).

## Tasks / Subtasks

- [x] **Task 1: Implement first-launch redirect guard** (AC: 1)
  - [x] In `MapView.tsx`, read `hasRigProfile()` from `useRigStore` and call `useNavigate()` to redirect to `/onboarding` if false
  - [x] Use `useEffect` with `navigate` — redirect fires before map renders
  - [x] Ensure the redirect only fires on initial mount (not on every render)

- [x] **Task 2: Build `OnboardingScreen` component** (AC: 2, 3, 4, 7, 8)
  - [x] Replace placeholder in `src/features/rig-profile/OnboardingScreen.tsx` with full implementation
  - [x] Step 1 — Rig class chips: render 5 tappable cards (Class A, Class B, Class C, Travel Trailer, 5th Wheel); selected card shows highlighted border (primary/10 bg + primary border); unselected cards show muted styling
  - [x] Step 2 — Length stepper: numeric input field labeled "Length (ft)", min=10, max=65; "–" / "+" stepper buttons flanking the number; pre-fill with class default on selection
  - [x] Step 3 — Height input: dual field ft + inches (separate inputs); stored as decimal feet (12ft 6in → 12.5); min=6ft, max=16ft; pre-fill with class default on selection
  - [x] Single scrollable screen with all three steps + fixed bottom action bar
  - [x] "Skip for now" button always visible in fixed bottom bar
  - [x] "Save My Rig" button: shows inline validation error when rigType is null (role="alert")
  - [x] All buttons and chips: min-h-[44px] and min-w-[44px] (NFR-A4)
  - [x] Dark theme: uses `bg-background`, `bg-secondary`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary-foreground` from `@theme`

- [x] **Task 3: Implement class-based default values** (AC: 3, 4)
  - [x] `RIG_DEFAULTS` constant defined in `OnboardingScreen.tsx`:
    Class A: length=35, height=12.5 | Class B: length=20, height=7.0 | Class C: length=28, height=11.0
    Travel Trailer: length=25, height=10.0 | 5th Wheel: length=30, height=12.0
  - [x] Selecting a rig class chip auto-fills length and height fields with class defaults

- [x] **Task 4: Implement Save and Skip actions** (AC: 5, 6)
  - [x] "Save My Rig": calls `setRigProfile({ rigType, lengthFt, heightFt })` then `navigate('/')`
  - [x] "Skip for now": calls `navigate('/')` only — does not touch rig store
  - [x] `toDecimalFeet(ft, inches)` converts ft+in → decimal heightFt before store
  - [x] Validation: rigType null → inline "Please select your rig class" error (role="alert"), no navigate

- [x] **Task 5: Write tests** (AC: 1–8)
  - [x] `src/features/map/MapView.test.tsx` — 2 tests: redirect when no profile, no redirect when profile set
  - [x] `src/features/rig-profile/OnboardingScreen.test.tsx` — 17 tests covering all ACs:
    renders 5 chips, aria-pressed on selection, class defaults (length + height ft + in),
    validation error on save without class, save writes store + navigates, skip navigates without saving,
    height stored as decimal, stepper clamping at boundaries, Travel Trailer defaults
  - [x] All 42 tests pass (19 new + 23 existing). Zero regressions.

## Dev Notes

### Critical Architecture Guardrails

**DO NOT break these rules established in Story 1.1:**

- **State ownership:** `useRigStore` is the ONLY place that writes the rig profile. **Never** call `localStorage.setItem('rig-profile', ...)` directly. Zustand's `persist` middleware handles persistence automatically.
- **Supabase NOT involved in this story.** Rig profile is 100% client-side (localStorage via Zustand persist). No server calls.
- **File location:** `src/features/rig-profile/OnboardingScreen.tsx` — skeleton already exists. The redirect guard goes in `src/features/map/MapView.tsx`.
- **Tests co-located:** `OnboardingScreen.test.tsx` lives next to `OnboardingScreen.tsx`. NOT in a `__tests__` folder.
- **No prop drilling:** Access `useRigStore` directly inside `OnboardingScreen.tsx` and `MapView.tsx`. Do not pass rig profile as props.

### Existing Infrastructure to Reuse

| What | Location | Notes |
|---|---|---|
| `useRigStore` | `src/store/rigStore.ts` | Has `setRigProfile`, `clearRigProfile`, `hasRigProfile` — use as-is |
| `RigProfile` type | `src/types/rigProfile.ts` | `{ rigType: RigType \| null, lengthFt: number \| null, heightFt: number \| null }` |
| `RigType` union | `src/types/rigProfile.ts` | `'Class A' \| 'Class B' \| 'Class C' \| 'Travel Trailer' \| '5th Wheel'` |
| `DEFAULT_RIG_PROFILE` | `src/types/rigProfile.ts` | `{ rigType: null, lengthFt: null, heightFt: null }` |
| `cn()` utility | `src/lib/utils.ts` | Use for conditional Tailwind class composition |
| CSS design tokens | `src/index.css` `@theme {}` | `--color-background`, `--color-surface`, `--color-primary`, etc. |
| `OnboardingScreen` skeleton | `src/features/rig-profile/OnboardingScreen.tsx` | Currently returns a placeholder div — **replace entirely** |
| `MapView` skeleton | `src/features/map/MapView.tsx` | Add redirect guard here |
| React Router navigation | `App.tsx` already configured | Use `useNavigate` from `react-router-dom` |

### Redirect Logic Pattern

The redirect guard in `MapView.tsx` must use the React Router `useNavigate` hook:

```typescript
// In MapView.tsx
import { useNavigate } from 'react-router-dom'
import { useRigStore } from '@/store/rigStore'
import { useEffect } from 'react'

export default function MapView() {
  const navigate = useNavigate()
  const hasRigProfile = useRigStore((state) => state.hasRigProfile)

  useEffect(() => {
    if (!hasRigProfile()) {
      navigate('/onboarding', { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps — intentional empty dep array, first-mount only

  return <div>Map (Story 1.4)</div>
}
```

**Why `replace: true`:** So the back button doesn't loop the user back to an empty map. Replace the map history entry with onboarding.

**Why empty dep array:** The redirect should only fire on initial mount, not re-run if the store changes. The user will not be on this component if they need to be redirected.

### Height Storage Format

Height is stored as a single `number | null` in `heightFt` (decimal feet). The UI must present it as feet + inches but store as decimal:

```
12ft 0in  → 12.0
12ft 6in  → 12.5
13ft 0in  → 13.0
 6ft 0in  →  6.0
```

Conversion helpers to implement inside `OnboardingScreen.tsx`:

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

### Validation Pattern

Do NOT use a form library (no react-hook-form — keep bundle lean). Simple React state validation:

```typescript
const [validationError, setValidationError] = useState<string | null>(null)

function handleSave() {
  if (!selectedRigType) {
    setValidationError('Please select your rig class')
    return
  }
  setValidationError(null)
  useRigStore.getState().setRigProfile({ rigType: selectedRigType, lengthFt, heightFt })
  navigate('/')
}
```

Render the error inline below the rig class chips (not a toast, not a modal).

### UX Spec: Onboarding Screen Design

From UX spec Journey 2 (ux-design-specification.md):

- **Flow:** Step 1 (rig class visual chips) → Step 2 (length stepper with class default) → Step 3 (height stepper with class default) → "See Your Filtered Map" / "Save My Rig" button
- **Target emotion:** "Impressed — it knows my rig" — the class chips with icons + instant default pre-fill is the key delight moment
- **Completion time:** Under 60 seconds, all taps, no keyboard required
- **Skip path:** Always available — never block a user from the map
- UX calls this a "step flow" but in MVP a single scrollable screen with all three sections is acceptable (simplicity > multi-page wizard)

**Rig class chip design (Tailwind, no shadcn):**
- Card-like chips with enough height for 44px tap targets
- Muted/grey background when unselected, `--color-primary` (#0ea5e9) border/background when selected
- Each chip: icon + label (e.g., 🚐 Class A — use simple emoji or inline SVG)
- Layout: 2-column grid or 1-column stacked list (stack is safer for all screen widths)

**Length and height stepper:**
- Simple `<input type="number">` with flanking `–` and `+` buttons, each 44×44px minimum
- Label above: "Length (ft)" and "Height"
- Constraint validation: clamp on blur or on increment/decrement

### Component Structure

```
src/features/rig-profile/
  OnboardingScreen.tsx          ← full implementation
  OnboardingScreen.test.tsx     ← co-located tests (create new)
```

Do NOT create sub-components in separate files for this story — keep the rig chip and stepper inline in `OnboardingScreen.tsx` to avoid over-engineering for a single-screen form.

### Testing Setup

Tests use Vitest + React Testing Library. Setup file at `src/test/setup.ts` already imports `@testing-library/jest-dom`. Mock `useNavigate`:

```typescript
import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
```

Wrap component in `<MemoryRouter>` for all tests (needed for `useNavigate`).

Reset store and localStorage in `beforeEach`:
```typescript
beforeEach(() => {
  localStorage.clear()
  useRigStore.setState({ rigProfile: DEFAULT_RIG_PROFILE })
  mockNavigate.mockClear()
})
```

### Tailwind CSS v4 Reminder (from Story 1.1 learnings)

- **Use `@theme` CSS variables** — the tokens are in `src/index.css` under `@theme {}`
- **Do NOT use `@layer base`** — this caused build failures in Story 1.1
- Reference CSS variables via Tailwind classes: `bg-background`, `text-foreground`, `border-border`, `bg-primary`
- The `cn()` utility (`src/lib/utils.ts`) handles conditional class composition: `cn('base-classes', { 'conditional-class': condition })`

### References

- Story requirements: [_bmad-output/planning-artifacts/epics.md](_bmad-output/planning-artifacts/epics.md#story-12-rig-profile-onboarding-form) (lines 250–292)
- Rig profile types: [overnighter/src/types/rigProfile.ts](overnighter/src/types/rigProfile.ts)
- Zustand store: [overnighter/src/store/rigStore.ts](overnighter/src/store/rigStore.ts)
- Routing config: [overnighter/src/App.tsx](overnighter/src/App.tsx)
- Onboarding skeleton: [overnighter/src/features/rig-profile/OnboardingScreen.tsx](overnighter/src/features/rig-profile/OnboardingScreen.tsx)
- MapView skeleton: [overnighter/src/features/map/MapView.tsx](overnighter/src/features/map/MapView.tsx)
- UX Journey 2 (The Reveal): [_bmad-output/planning-artifacts/ux-design-specification.md](_bmad-output/planning-artifacts/ux-design-specification.md) (Journey 2 section)
- Architecture naming conventions: [_bmad-output/planning-artifacts/architecture.md](_bmad-output/planning-artifacts/architecture.md#naming-patterns)
- Architecture structure patterns: [_bmad-output/planning-artifacts/architecture.md](_bmad-output/planning-artifacts/architecture.md#structure-patterns)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Installed missing peer dep `@testing-library/dom` (required by `@testing-library/react@16` — was not auto-installed by npm)
- Fixed pre-existing lint error in `src/lib/utils.test.ts` line 10: `false && 'skipped'` → `const show = false; show && 'skipped'` (no-constant-binary-expression)

### Completion Notes List

- ✅ Task 1: MapView redirect guard implemented using `useEffect` + `useNavigate({ replace: true })` reading `hasRigProfile()` from Zustand store. Empty deps array fires on mount only.
- ✅ Task 2: OnboardingScreen built as single scrollable screen with fixed bottom action bar. 5 rig class chips with `aria-pressed`, length stepper (–/+) with clamped range 10–65ft, height dual-input (ft+in) with range 6–16ft.
- ✅ Task 3: `RIG_DEFAULTS` constant defined; selecting a class chip auto-populates length and height via `fromDecimalFeet()` helper.
- ✅ Task 4: `toDecimalFeet(ft, inches)` converts before storing. `setRigProfile` called only on Save; Skip navigates without touching store. Inline `role="alert"` validation for missing class.
- ✅ Task 5: 19 new tests across MapView.test.tsx (2) and OnboardingScreen.test.tsx (17). All 42 tests pass (0 regressions). Lint clean.

### Senior Developer Review (AI)

**Review Date:** 2026-03-17
**Outcome:** Changes Requested → Fixed
**Issues Found:** 0 High, 4 Medium, 3 Low
**Issues Fixed:** 4 Medium + 1 Low (L1, L3 added as bonus)

#### Action Items (all resolved)

- [x] [M1] Validation error not cleared on rig class chip click — `handleSelectRigType` missing `setValidationError(null)`
- [x] [M2] Height exceeds 16ft max — `16ft 11in = 16.916ft` allowed. Added cross-field clamp in `handleHeightFtChange` and `handleSave`
- [x] [M3] Number input empty/clear snaps to minimum — Added separate string display states (`lengthInput`, `heightFtInput`, `heightInInput`) with `onBlur` commit
- [x] [M4] `aria-pressed` semantically wrong for exclusive selection — Changed to `role="radiogroup"` + `role="radio"` + `aria-checked`
- [x] [L1] Missing `type="button"` on all buttons — Added to all 7 buttons
- [x] [L3] Missing 5th Wheel test + height max clamp test — Added both

### File List

- `overnighter/src/features/map/MapView.tsx` — modified (added redirect guard)
- `overnighter/src/features/map/MapView.test.tsx` — created
- `overnighter/src/features/rig-profile/OnboardingScreen.tsx` — modified (full implementation + code review fixes)
- `overnighter/src/features/rig-profile/OnboardingScreen.test.tsx` — created (+ updated for review fixes)
- `overnighter/src/lib/utils.test.ts` — modified (lint fix, pre-existing issue)
- `overnighter/package.json` — modified (@testing-library/dom added as devDependency)
- `overnighter/package-lock.json` — modified
