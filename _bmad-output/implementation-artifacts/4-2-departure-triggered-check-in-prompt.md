# Story 4.2: Departure-Triggered Check-In Prompt

Status: done

## Story

As a user,
I want to be prompted once to submit a check-in when I depart a location I previously viewed or saved,
so that the contribution moment arrives naturally at the right time without requiring me to remember or seek out the feature.

## Acceptance Criteria

**AC1 — Departure prompt shown when user has moved away from a visited pin**
Given a user has viewed or saved a pin during a session
When the user reopens the app and their GPS location is within the app (MapView mounts) and they are more than 0.5 miles from that pin
Then a departure check-in prompt is displayed: "How was [Spot Name] for your [rig class]? Help the next traveler."

**AC2 — Once-per-stay rule: prompt never repeats for same visit**
Given the departure prompt has been shown for a specific pin visit
When the user dismisses OR completes the check-in
Then the prompt is never shown again for that same visit (visitKey = `${pinId}:${YYYY-MM-DD}`)

**AC3 — No prompt when user is still at the location**
Given the user is still within 0.5 miles of a visited pin
When the app opens
Then no departure prompt is shown — the prompt only triggers when the user has moved away

**AC4 — No prompt when GPS is denied**
Given GPS permission has been denied or GPS is unavailable
When the app opens after a user viewed a pin
Then no departure prompt is shown — the prompt gracefully does not appear without GPS (NFR-I5)

**AC5 — "Skip" dismisses without check-in**
Given the departure prompt is displayed
When the user taps "Skip"
Then the prompt dismisses without submitting a check-in
And the once-per-stay flag is set (prompt will not reappear for this visit)

**AC6 — "Check In" dismisses and sets pending check-in**
Given the departure prompt is displayed
When the user taps "Check In"
Then the prompt dismisses
And `pendingCheckIn: { pinId }` is set in UIStore so Story 4.3 can detect it and open the check-in form

## Tasks / Subtasks

- [x] Task 1: Create `src/store/checkInPromptStore.ts` (AC2, AC5, AC6)
  - [x] 1.1: Define `VisitRecord` interface:
    ```typescript
    export interface VisitRecord {
      pinId: string
      pinName: string
      latitude: number
      longitude: number
      visitKey: string  // '${pinId}:${YYYY-MM-DD}'
    }
    ```
  - [x] 1.2: Define `CheckInPromptStore` interface and create Zustand persist store:
    ```typescript
    import { create } from 'zustand'
    import { persist } from 'zustand/middleware'

    interface CheckInPromptStore {
      visitRecords: VisitRecord[]
      dismissedKeys: string[]
      recordVisit: (pin: { id: string; name: string; latitude: number; longitude: number }) => void
      dismissVisit: (visitKey: string) => void
      isDismissed: (visitKey: string) => boolean
    }

    export const useCheckInPromptStore = create<CheckInPromptStore>()(
      persist(
        (set, get) => ({
          visitRecords: [],
          dismissedKeys: [],
          recordVisit: (pin) => {
            const today = new Date().toISOString().slice(0, 10)
            const visitKey = `${pin.id}:${today}`
            const existing = get().visitRecords.find(v => v.visitKey === visitKey)
            if (existing) return  // already recorded for today
            set((state) => ({
              visitRecords: [
                { pinId: pin.id, pinName: pin.name, latitude: pin.latitude, longitude: pin.longitude, visitKey },
                ...state.visitRecords,
              ],
            }))
          },
          dismissVisit: (visitKey) =>
            set((state) => ({
              dismissedKeys: state.dismissedKeys.includes(visitKey)
                ? state.dismissedKeys
                : [...state.dismissedKeys, visitKey],
            })),
          isDismissed: (visitKey) => get().dismissedKeys.includes(visitKey),
        }),
        { name: 'checkin-prompt' }
      )
    )
    ```

- [x] Task 2: Create `src/store/checkInPromptStore.test.ts` (AC2, AC5)
  - [x] 2.1: Store setup — `beforeEach` resets store: `useCheckInPromptStore.setState({ visitRecords: [], dismissedKeys: [] })`
  - [x] 2.2: Test — `recordVisit` stores a new VisitRecord with correct fields
  - [x] 2.3: Test — `recordVisit` sets visitKey as `'${pinId}:${YYYY-MM-DD}'` (mock Date to control)
  - [x] 2.4: Test — `recordVisit` does NOT duplicate a record with the same visitKey (same pin + same date)
  - [x] 2.5: Test — `recordVisit` DOES add a second record for same pin on a different date (different stay)
  - [x] 2.6: Test — `dismissVisit` adds visitKey to `dismissedKeys`
  - [x] 2.7: Test — `isDismissed` returns true for a dismissed visitKey
  - [x] 2.8: Test — `isDismissed` returns false for a non-dismissed visitKey
  - [x] 2.9: Test — `dismissVisit` is idempotent — calling twice doesn't duplicate dismissedKeys

  Note for 2.3 (mock Date):
  ```typescript
  it('sets visitKey using today\'s date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-19'))
    useCheckInPromptStore.getState().recordVisit({ id: 'p1', name: 'Test', latitude: 0, longitude: 0 })
    const records = useCheckInPromptStore.getState().visitRecords
    expect(records[0].visitKey).toBe('p1:2026-03-19')
    vi.useRealTimers()
  })
  ```

- [x] Task 3: Add `pendingCheckIn` to `src/store/uiStore.ts` (AC6)
  - [x] 3.1: Add to `UIStore` interface:
    ```typescript
    pendingCheckIn: { pinId: string } | null
    setPendingCheckIn: (state: { pinId: string } | null) => void
    ```
  - [x] 3.2: Add to initial state: `pendingCheckIn: null`
  - [x] 3.3: Add action: `setPendingCheckIn: (state) => set({ pendingCheckIn: state })`
  - CRITICAL: Read `src/store/uiStore.ts` fully first — current fields are `selectedPinId`, `isAdminPanelOpen`, `pendingMapCenter`. Add `pendingCheckIn` following the same flat pattern.

- [x] Task 4: Create `src/features/map/DeparturePrompt.tsx` (AC1, AC5, AC6)
  - [x] 4.1: Implement `DeparturePrompt` component:
    ```typescript
    interface DeparturePromptProps {
      pinName: string
      rigType: string | null
      onSkip: () => void
      onCheckIn: () => void
    }

    export default function DeparturePrompt({ pinName, rigType, onSkip, onCheckIn }: DeparturePromptProps) {
      return (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/50 z-40" aria-hidden="true" />
          {/* Prompt card */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Departure check-in prompt"
            className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border rounded-t-2xl p-6"
          >
            <p className="text-base font-semibold text-foreground mb-1">
              How was {pinName}
              {rigType ? ` for your ${rigType}` : ''}?
            </p>
            <p className="text-sm text-muted-foreground mb-6">Help the next traveler.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onSkip}
                className="flex-1 min-h-[44px] rounded-lg border border-border text-foreground text-sm font-medium"
                aria-label="Skip check-in"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={onCheckIn}
                className="flex-1 min-h-[44px] rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: '#0ea5e9' }}
                aria-label="Submit check-in"
              >
                Check In
              </button>
            </div>
          </div>
        </>
      )
    }
    ```

- [x] Task 5: Create `src/features/map/DeparturePrompt.test.tsx` (AC1, AC5, AC6)
  - [x] 5.1: Test — renders prompt message with spot name and rig type
  - [x] 5.2: Test — renders prompt message with spot name only when `rigType` is null
  - [x] 5.3: Test — "Skip" button calls `onSkip`
  - [x] 5.4: Test — "Check In" button calls `onCheckIn`
  - [x] 5.5: Test — has `role="dialog"` and `aria-modal="true"`
  - [x] 5.6: Test — both "Skip" and "Check In" buttons meet `min-h-[44px]` tap target

- [x] Task 6: Update `src/features/pin-detail/PinDetailSheet.tsx` to record visits (AC1)
  - [x] 6.1: Add import: `import { useCheckInPromptStore } from '@/store/checkInPromptStore'`
  - [x] 6.2: Add `useEffect` to record pin visit when pin is found:
    ```typescript
    useEffect(() => {
      if (pin) {
        useCheckInPromptStore.getState().recordVisit(pin)
      }
    }, [pin?.id]) // eslint-disable-line react-hooks/exhaustive-deps
    ```
    Place this AFTER the existing `useEffect` for `setSelectedPin(null)` cleanup.
    Note: Uses `.getState()` for the imperative side effect (same pattern as `handleBookmark`).
  - CRITICAL: Read `src/features/pin-detail/PinDetailSheet.tsx` fully before editing — current effects are the `setSelectedPin(null)` cleanup effect.

- [x] Task 7: Update `src/features/pin-detail/PinDetailSheet.test.tsx` to test visit recording (AC1)
  - [x] 7.1: Add import: `import { useCheckInPromptStore } from '@/store/checkInPromptStore'`
  - [x] 7.2: Add to existing `beforeEach`: `useCheckInPromptStore.setState({ visitRecords: [], dismissedKeys: [] })`
  - [x] 7.3: Add new describe block `'PinDetailSheet visit recording'`:
    - Test: records a visit in checkInPromptStore when pin is found (visitRecords has 1 entry)
    - Test: recorded visit has correct pinId, pinName, latitude, longitude
    - Test: does NOT record a visit when in loading state
    - Test: does NOT record a visit when pin is not found

- [x] Task 8: Update `src/features/map/MapView.tsx` to check for departure and render prompt (AC1–AC6)
  - [x] 8.1: Add imports at top:
    ```typescript
    import { useCheckInPromptStore, type VisitRecord } from '@/store/checkInPromptStore'
    ```
  - [x] 8.2: Add inline distance helper (same haversine formula as in SavedSpotsScreen — intentional inline per architecture pattern):
    ```typescript
    function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
      const R = 3959
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
    Place this as a module-level function (not inside the component), before `export default function MapView`.
  - [x] 8.3: Import DeparturePrompt:
    ```typescript
    import DeparturePrompt from './DeparturePrompt'
    ```
  - [x] 8.4: Add state and store subscriptions inside `MapView()`:
    ```typescript
    const [pendingDeparturePin, setPendingDeparturePin] = useState<VisitRecord | null>(null)
    const [departureChecked, setDepartureChecked] = useState(false)
    const visitRecords = useCheckInPromptStore((state) => state.visitRecords)
    const isDismissed = useCheckInPromptStore((state) => state.isDismissed)
    const rigType = useRigStore((state) => state.rigProfile.rigType)
    const setPendingCheckIn = useUIStore((state) => state.setPendingCheckIn)
    ```
    Note: `rigType` already available via `rigProfile` which is subscribed. Use `rigProfile.rigType` if rigProfile is already subscribed, or add `rigType` selector. Check existing MapView — `rigProfile` IS already subscribed via `useRigStore((state) => state.rigProfile)`.
    So use `rigProfile.rigType` (no new selector needed).
  - [x] 8.5: Add departure check `useEffect` (fires when GPS coords first become available):
    ```typescript
    useEffect(() => {
      if (!geoState.coords || departureChecked) return
      setDepartureChecked(true)
      const { latitude, longitude } = geoState.coords
      const candidates = visitRecords.filter(
        (v) => !isDismissed(v.visitKey) && distanceMiles(latitude, longitude, v.latitude, v.longitude) > 0.5,
      )
      if (candidates.length > 0) setPendingDeparturePin(candidates[0])
    }, [geoState.coords]) // eslint-disable-line react-hooks/exhaustive-deps
    ```
    CRITICAL: `departureChecked` prevents re-triggering if the user taps "Near Me" again (GPS coords update). Departure check should run only ONCE per app session.
  - [x] 8.6: Add `handleDepartureSkip` and `handleDepartureCheckIn` handlers:
    ```typescript
    function handleDepartureSkip() {
      if (pendingDeparturePin) {
        useCheckInPromptStore.getState().dismissVisit(pendingDeparturePin.visitKey)
      }
      setPendingDeparturePin(null)
    }

    function handleDepartureCheckIn() {
      if (pendingDeparturePin) {
        useCheckInPromptStore.getState().dismissVisit(pendingDeparturePin.visitKey)
        setPendingCheckIn({ pinId: pendingDeparturePin.pinId })
      }
      setPendingDeparturePin(null)
    }
    ```
  - [x] 8.7: Add `DeparturePrompt` to the JSX return (inside the outermost `<div>`, after the Near Me FAB, before `<Outlet />`):
    ```tsx
    {pendingDeparturePin && (
      <DeparturePrompt
        pinName={pendingDeparturePin.pinName}
        rigType={rigProfile.rigType}
        onSkip={handleDepartureSkip}
        onCheckIn={handleDepartureCheckIn}
      />
    )}
    ```

- [x] Task 9: Update `src/features/map/MapView.test.tsx` for departure prompt (AC1–AC6)
  - [x] 9.1: Add to imports: `import { useCheckInPromptStore } from '@/store/checkInPromptStore'`
  - [x] 9.2: Add mock for DeparturePrompt (isolate MapView integration):
    ```typescript
    vi.mock('./DeparturePrompt', () => ({
      default: vi.fn(({ pinName, onSkip, onCheckIn }: { pinName: string; onSkip: () => void; onCheckIn: () => void }) => (
        <div data-testid="departure-prompt">
          <span>{pinName}</span>
          <button onClick={onSkip}>skip</button>
          <button onClick={onCheckIn}>check-in</button>
        </div>
      )),
    }))
    ```
  - [x] 9.3: Add to existing `beforeEach` blocks in relevant describe sections:
    `useCheckInPromptStore.setState({ visitRecords: [], dismissedKeys: [] })`
  - [x] 9.4: Add new describe block `'MapView DeparturePrompt integration'`:
    - `beforeEach`: set `onboardingDismissed: true`, set `activeFilters: []`, set `selectedPinId: null`, clear localStorage, mock geolocation with coords
    - Test: DeparturePrompt rendered when visitRecords has an undismissed pin >0.5mi away
    - Test: DeparturePrompt NOT rendered when geoState has no coords
    - Test: DeparturePrompt NOT rendered when visited pin is within 0.5mi (still at location)
    - Test: DeparturePrompt NOT rendered when visitKey is already dismissed
    - Test: Skip button calls `dismissVisit` and hides the prompt
    - Test: Check In button calls `dismissVisit` AND sets `pendingCheckIn` in UIStore

  Note for proximity test setup:
  ```typescript
  // Denver coords: 39.7392, -104.9903
  // Pin at 39.7392, -104.9903 → distance = 0mi (at location)
  // Pin at 40.7128, -74.0060 (NYC) → distance >> 0.5mi
  const FAR_VISIT: VisitRecord = {
    pinId: 'far-pin', pinName: 'Far Spot',
    latitude: 40.7128, longitude: -74.0060,
    visitKey: 'far-pin:2026-03-19',
  }
  const NEAR_VISIT: VisitRecord = {
    pinId: 'near-pin', pinName: 'Near Spot',
    latitude: 39.7392, longitude: -104.9903,  // same as GPS coords
    visitKey: 'near-pin:2026-03-19',
  }
  // Mock geolocation with Denver coords:
  mockUseGeolocation.mockReturnValue([
    { isLoading: false, coords: { latitude: 39.7392, longitude: -104.9903 } as GeolocationCoordinates, error: null },
    vi.fn(),
  ])
  ```

## Dev Notes

### Critical: `departureChecked` flag prevents re-triggering

The departure check MUST run only once per app session (per MapView mount). Without `departureChecked`, any update to `geoState.coords` (e.g., pressing "Near Me" again) would re-trigger the check and re-show a prompt the user already dismissed within the session.

```typescript
// ✅ CORRECT — one-shot check
useEffect(() => {
  if (!geoState.coords || departureChecked) return
  setDepartureChecked(true)
  // ... check logic
}, [geoState.coords])

// ❌ WRONG — fires every time coords update
useEffect(() => {
  if (!geoState.coords) return
  // ... check logic
}, [geoState.coords])
```

### Critical: `recordVisit` uses `.getState()` in PinDetailSheet

The `recordVisit` call is an imperative side effect, NOT a UI subscription. Use `.getState()` directly (same pattern as `handleBookmark` using `useSpotsStore.getState()`):

```typescript
// ✅ CORRECT — imperative side effect
useEffect(() => {
  if (pin) {
    useCheckInPromptStore.getState().recordVisit(pin)
  }
}, [pin?.id])

// ❌ WRONG — subscribing to an action (causes re-renders)
const recordVisit = useCheckInPromptStore((state) => state.recordVisit)
```

### Critical: visitKey format and date comparison

```typescript
const today = new Date().toISOString().slice(0, 10)  // '2026-03-19'
const visitKey = `${pin.id}:${today}`                 // 'abc-123:2026-03-19'
```

`new Date().toISOString()` returns UTC time. This means a user visiting a pin at 11pm EST on March 19 and departing at 1am EST on March 20 would have two different visitKeys — they'd be prompted again. This is an acceptable edge case for MVP; the once-per-stay rule is best-effort.

### Critical: MapView already subscribes to `rigProfile`

`MapView.tsx` already has `const rigProfile = useRigStore((state) => state.rigProfile)`. Do NOT add a separate `rigType` selector — just use `rigProfile.rigType` in the DeparturePrompt JSX and handlers. Verify this by reading MapView.tsx before editing.

### Critical: DeparturePrompt z-index must be above map overlay controls

Map overlays are at `z-10`. PinDetailSheet is at `z-30`. DeparturePrompt must be ABOVE the pin sheet:
- Backdrop: `z-40`
- Prompt card: `z-50`

### Critical: Architecture — no cross-feature imports

`DeparturePrompt.tsx` is in `src/features/map/` — same feature as MapView. It can be imported directly. Do NOT put it in `src/components/` (it's a map-feature-specific component, not globally shared).

### Critical: `checkInPromptStore` persist key is `'checkin-prompt'`

Existing localStorage keys (NEVER reuse):
- `'rig-profile'` — rigStore
- `'saved-spots'` — spotsStore
- `'device-id'` — useDeviceId (Story 4.1)
- `'badge_tooltip_seen'` — MapView inline localStorage

New key: `'checkin-prompt'` — safe to use.

### Critical: UIStore `pendingCheckIn` — consumed by Story 4.3

After adding `pendingCheckIn` to UIStore, Story 4.3 will read it to open the check-in form. For Story 4.2, we just SET it — we don't need to BUILD the check-in form UI. The field is set and will be null until Story 4.3 implements the form.

### MapView overlay structure (reference)

Current MapView JSX at end of `return`:
```tsx
{showBadgeTooltip && pins.length > 0 && !isLoading && (
  <BadgeTooltip onDismiss={handleDismissTooltip} />
)}
{/* Pin detail sheet overlay — rendered via nested route /pin/:id */}
<Outlet />
```

Add DeparturePrompt BEFORE `<Outlet />` so it renders above the map but below the pin sheet:
```tsx
{pendingDeparturePin && (
  <DeparturePrompt ... />
)}
{showBadgeTooltip && ...}
<Outlet />
```

Actually, DeparturePrompt has higher z-index (z-50) than BadgeTooltip, so order in JSX doesn't matter for visual stacking. But placing it before BadgeTooltip is cleaner.

### haversine `distanceMiles` — inline in MapView (not extracted)

This is the SAME function already inline in `SavedSpotsScreen.tsx`. Intentional per architecture pattern ("features don't import from other features," and `src/lib/utils.ts` is currently only `cn()`). Define it as a module-level function in `MapView.tsx` — NOT inside the component.

```typescript
// Module-level (before export default function MapView)
function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
```

### Testing: `mockUseGeolocation` typing pattern (from Story 4.1 learnings)

```typescript
mockUseGeolocation.mockReturnValue([
  { isLoading: false, coords: { latitude: 39.7392, longitude: -104.9903 } as GeolocationCoordinates, error: null as 'denied' | 'no-api' | 'unavailable' | null },
  vi.fn(),
])
```

### Testing: `vi.useFakeTimers()` for date-dependent tests

In `checkInPromptStore.test.ts`, use `vi.useFakeTimers()` + `vi.setSystemTime()` in tests that check the visitKey date:
```typescript
vi.useFakeTimers()
vi.setSystemTime(new Date('2026-03-19'))
// ... test
vi.useRealTimers()
```

Call `vi.useRealTimers()` in `afterEach` to prevent leaking fake timers to other tests.

### Testing: MapView DeparturePrompt mock

The `vi.mock('./DeparturePrompt')` factory pattern must use a function component that accepts and uses the props. The `onSkip` and `onCheckIn` callbacks must be wired to buttons for `fireEvent.click` to work in tests.

### Testing: MapView test proximity setup

For departure prompt tests, use Denver coords for GPS mock and NYC coords for the "far" pin:
- Denver: lat=39.7392, lng=-104.9903 (GPS mock position)
- NYC: lat=40.7128, lng=-74.0060 (~1,780 miles away — clearly >0.5mi)
- Near: same coords as GPS mock → 0 miles distance (< 0.5mi — no prompt)

### Project Structure Notes

**Files to create:**
- `src/store/checkInPromptStore.ts` — NEW Zustand persist store
- `src/store/checkInPromptStore.test.ts` — NEW store tests (9 tests)
- `src/features/map/DeparturePrompt.tsx` — NEW component
- `src/features/map/DeparturePrompt.test.tsx` — NEW component tests (6 tests)

**Files to modify:**
- `src/store/uiStore.ts` — add `pendingCheckIn` + `setPendingCheckIn`
- `src/features/map/MapView.tsx` — add departure check logic + DeparturePrompt + distanceMiles
- `src/features/map/MapView.test.tsx` — add DeparturePrompt mock + 6 integration tests
- `src/features/pin-detail/PinDetailSheet.tsx` — add `recordVisit` useEffect
- `src/features/pin-detail/PinDetailSheet.test.tsx` — add visit recording tests

**No changes to:**
- `src/hooks/useGeolocation.ts` — already implemented
- `src/store/spotsStore.ts` — not involved (visit tracking is separate from saving)
- `src/App.tsx` — no changes needed
- `src/lib/utils.ts` — haversine is intentionally inlined per established pattern

### References

- Story requirements: [epics.md — Epic 4, Story 4.2](_bmad-output/planning-artifacts/epics.md)
- Architecture anonymous identity: [architecture.md](_bmad-output/planning-artifacts/architecture.md) — departure tracking, device UUID, no PII
- Current MapView.tsx: [src/features/map/MapView.tsx](overnighter/src/features/map/MapView.tsx) — already has `useGeolocation`, `rigProfile`, `mapRef`, overlay stack
- Current PinDetailSheet.tsx: [src/features/pin-detail/PinDetailSheet.tsx](overnighter/src/features/pin-detail/PinDetailSheet.tsx) — `useEffect` cleanup pattern at line 81
- Current uiStore.ts: [src/store/uiStore.ts](overnighter/src/store/uiStore.ts) — flat shape, add `pendingCheckIn` following existing pattern
- rigStore persist key: `'rig-profile'`; spotsStore persist key: `'saved-spots'`; device-id key: `'device-id'`
- Story 4.1 learnings: `DEVICE_ID_KEY` exported from hook; `vi.unstubAllGlobals()` for global stubs; valid UUID format for stubs
- Story 3.3 learnings: `useEffect` from 'react' not 'react-router-dom'; `vi.restoreAllMocks()` in afterEach; `.getState()` for imperative calls; `vi.hoisted` for mocks needing variable in scope
- Story 3.1 learnings: no shadcn/ui — plain `<button>` + Tailwind; `role="dialog"` + `aria-modal="true"` on sheet overlays
- haversine reference: [src/features/saved-spots/SavedSpotsScreen.tsx](overnighter/src/features/saved-spots/SavedSpotsScreen.tsx) — identical formula to inline

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — all tasks completed without errors.

### Completion Notes List

- `departureChecked` flag prevents re-triggering when user taps "Near Me" again; departure check runs once per MapView mount
- `recordVisit` uses `.getState()` imperative pattern (not reactive subscription) in PinDetailSheet
- `distanceMiles` inlined as module-level function per architecture pattern (same as SavedSpotsScreen)
- DeparturePrompt z-index: backdrop z-40, card z-50 (above PinDetailSheet at z-30)
- All 369 tests pass (368 implementation + 1 added by code review)

### Code Review Record

**Reviewer:** claude-sonnet-4-6 | **Date:** 2026-03-19
**Result:** 0 HIGH, 1 MEDIUM fixed, 4 LOW noted
- M1 FIXED: Added explicit AC4 test — "does not show DeparturePrompt when GPS coords are null (GPS denied/unavailable) with existing undismissed visit records" in `MapView.test.tsx`
- L1 noted: `DeparturePrompt.tsx` in `map/` feature vs architecture spec `check-in/` — acceptable for current cross-feature-import constraint
- L2 noted: `isDismissed`/`visitRecords` reactive subscriptions in once-running effect — functionally correct, could use `getState()` for consistency
- L3 noted: `setPendingCheckIn` parameter named `state` in `uiStore.ts` — confusing shadow of Zustand idiom
- L4 noted: `visitRecords`/`dismissedKeys` grow unboundedly — acceptable for MVP scale

### File List

- `src/store/checkInPromptStore.ts` — NEW
- `src/store/checkInPromptStore.test.ts` — NEW
- `src/features/map/DeparturePrompt.tsx` — NEW
- `src/features/map/DeparturePrompt.test.tsx` — NEW
- `src/store/uiStore.ts` — MODIFIED (added pendingCheckIn + setPendingCheckIn)
- `src/features/map/MapView.tsx` — MODIFIED (departure check logic + DeparturePrompt)
- `src/features/map/MapView.test.tsx` — MODIFIED (DeparturePrompt mock + 7 integration tests, +1 from code review)
- `src/features/pin-detail/PinDetailSheet.tsx` — MODIFIED (recordVisit useEffect)
- `src/features/pin-detail/PinDetailSheet.test.tsx` — MODIFIED (visit recording tests)
