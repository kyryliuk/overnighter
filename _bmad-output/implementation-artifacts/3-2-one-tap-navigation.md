# Story 3.2: One-Tap Navigation

Status: done

## Story

As a user,
I want to launch native navigation to a stop with a single tap from the pin detail sheet,
so that the transition from planning to driving is instant with no copy-pasting or app-switching friction.

## Acceptance Criteria

**AC1 — Get Directions opens native maps with pin coordinates**
Given the pin detail sheet is open
When the user taps the "Get Directions" button
Then the device's native maps application opens with the pin's coordinates pre-filled as the destination

**AC2 — iOS uses `maps://` URI scheme**
Given the user taps "Get Directions" on an iOS device
When the native maps handoff executes
Then the `maps://` URI scheme is used to open Apple Maps with the destination set

**AC3 — Android uses `geo://` URI scheme**
Given the user taps "Get Directions" on an Android device
When the native maps handoff executes
Then the `geo://` URI scheme is used to open the default maps app with the destination set

**AC4 — Desktop opens Google Maps in new browser tab**
Given the user taps "Get Directions" on a desktop browser
When the native maps handoff executes
Then a web maps URL (Google Maps) opens in a new browser tab with the destination pre-filled

**AC5 — Touch target and prominence**
Given the "Get Directions" button
When it renders
Then it meets the minimum 44×44px touch target size (NFR-A4)
And it is the visually prominent primary CTA in the pin detail sheet (sky-blue, full-width)

## Tasks / Subtasks

- [x] Task 1: Add `buildMapsUrl` utility with platform detection (AC1, AC2, AC3, AC4)
  - [x] 1.1: Add `buildMapsUrl` as a named export in `src/features/pin-detail/PinDetailSheet.tsx`
    - Pure function, accepts optional `userAgent` parameter (defaults to `navigator.userAgent`) for testability
    - Signature: `export function buildMapsUrl(lat: number, lng: number, name: string, userAgent = navigator.userAgent): string`
    - iOS detection: `/iPhone|iPad|iPod/.test(userAgent)` → return `maps://?daddr=${lat},${lng}`
    - Android detection: `/Android/.test(userAgent)` → return `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(name)})`
    - Desktop fallback: return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    - Check order matters: iOS MUST be checked before Android (iOS devices only match iOS, but belt-and-suspenders)

- [x] Task 2: Add "Get Directions" button to `PinDetailSheet.tsx` (AC1, AC5)
  - [x] 2.1: Add `handleGetDirections` function inside the component
    - Only runs when `pin` is defined (guard: `if (!pin) return`)
    - Calls `buildMapsUrl(pin.latitude, pin.longitude, pin.name)`
    - Opens URL with `window.open(url, '_blank', 'noopener,noreferrer')`
    - Note: `window.open` with `_blank` works for both mobile (opens maps app via URI scheme handoff) and desktop (opens new tab)
  - [x] 2.2: Add button to the pin detail content section (after description/notes, at the bottom)
    - Full-width primary button: `className="w-full min-h-[44px] rounded-lg font-semibold text-white"` with inline style `backgroundColor: '#0ea5e9'`
    - Label: `Get Directions →`
    - Only rendered in the "pin found" branch (not in loading/error/not-found states)
    - Button position: last element in the `space-y-4` div, after community notes

- [x] Task 3: Add tests for `buildMapsUrl` and button (AC1–AC5)
  - [x] 3.1: Add `buildMapsUrl` unit tests in `src/features/pin-detail/PinDetailSheet.test.tsx`
    - Import: `import { buildMapsUrl } from './PinDetailSheet'`
    - Test: returns `maps://` URL when userAgent contains "iPhone"
    - Test: returns `maps://` URL when userAgent contains "iPad"
    - Test: returns `geo://` URL when userAgent contains "Android"
    - Test: returns Google Maps HTTPS URL for desktop userAgent (no iPhone/Android)
    - Test: coordinates are correctly embedded in the URL (use `lat=40, lng=-104`)
    - Test: pin name is URI-encoded in Android URL (e.g., space → `%20`)
  - [x] 3.2: Add component integration tests in `src/features/pin-detail/PinDetailSheet.test.tsx`
    - Test: "Get Directions" button renders when pin is found
    - Test: "Get Directions" button does NOT render when loading
    - Test: "Get Directions" button does NOT render when pin not found
    - Test: clicking "Get Directions" calls `window.open` with correct URL (mock `window.open` via `vi.spyOn`)
    - Test: button has `role="button"` and accessible name matching `/get directions/i`

## Dev Notes

### Critical: `buildMapsUrl` placement and export

The function must be a **named export** (alongside the default export of `PinDetailSheet`) so it can be unit-tested directly without needing to render the component or stub `navigator.userAgent` at the jsdom global level.

```typescript
// In PinDetailSheet.tsx — add this named export
export function buildMapsUrl(
  lat: number,
  lng: number,
  name: string,
  userAgent = navigator.userAgent
): string {
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    return `maps://?daddr=${lat},${lng}`
  }
  if (/Android/.test(userAgent)) {
    return `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(name)})`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}
```

This is a pure utility with no cross-feature dependency — inlining it here (like `doesPinFitRig`) avoids creating a new `src/lib/navigation/` directory for a single function.

### Critical: URL schemes

| Platform | Detection | URL format |
|---|---|---|
| iOS | `/iPhone\|iPad\|iPod/.test(userAgent)` | `maps://?daddr=LAT,LNG` |
| Android | `/Android/.test(userAgent)` | `geo:LAT,LNG?q=LAT,LNG(NAME)` |
| Desktop | fallback (all others) | `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG` |

- iOS: `maps://` opens Apple Maps. `?daddr=` sets the destination. No `saddr=` needed — Apple Maps uses current location as start by default.
- Android: `geo:` is the standard intent URI. The `?q=` part is important for some apps. `(NAME)` adds a label — must be URI-encoded.
- Desktop: Google Maps Directions API URL. `&destination=LAT,LNG` sets the destination. Works without API key.

### Critical: `window.open` approach

Use `window.open(url, '_blank', 'noopener,noreferrer')` for ALL platforms:
- On iOS/Android: the browser intercepts `maps://` and `geo://` URIs and hands off to the native app
- On desktop: opens a new tab with Google Maps
- `noopener,noreferrer` is the security best practice for `_blank` links

```typescript
function handleGetDirections() {
  if (!pin) return
  const url = buildMapsUrl(pin.latitude, pin.longitude, pin.name)
  window.open(url, '_blank', 'noopener,noreferrer')
}
```

### Critical: Button placement in PinDetailSheet

Add the button as the **last element** inside the `<div className="space-y-4">` in the "pin found" branch. It goes after the community notes section:

```tsx
{/* Get Directions — primary CTA (Story 3.2) */}
<button
  onClick={handleGetDirections}
  className="w-full min-h-[44px] rounded-lg font-semibold text-white"
  style={{ backgroundColor: '#0ea5e9' }}
>
  Get Directions →
</button>
```

Use inline style for the exact design token color `#0ea5e9` — consistent with the `RecencyBadge` pattern established in Story 3.1. Do NOT use `bg-primary` (CSS var may not map to sky-blue) or `bg-sky-500` (Tailwind approximation — use the exact hex from UX spec).

**Important UX note from spec:** "Get Directions still available — warn, never block." This means the button renders even on stale (red badge) pins. Do NOT disable or hide it based on `badgeState`.

### Critical: shadcn/ui Button NOT installed

As learned in Story 3.1: `@radix-ui/react-button` and shadcn `Button` are NOT installed. Use a plain `<button>` element with Tailwind classes. Do NOT attempt `import { Button } from '@/components/ui/button'`.

### Testing: mocking `window.open`

```typescript
const mockWindowOpen = vi.spyOn(window, 'open').mockImplementation(() => null)

afterEach(() => {
  mockWindowOpen.mockRestore()
})

it('clicking Get Directions calls window.open', () => {
  renderSheet('pin-1')
  fireEvent.click(screen.getByRole('button', { name: /get directions/i }))
  expect(mockWindowOpen).toHaveBeenCalledWith(
    expect.stringContaining('maps.google.com') // or maps:// depending on userAgent
    '_blank',
    'noopener,noreferrer'
  )
})
```

For `buildMapsUrl` unit tests — call it directly with the `userAgent` parameter override:

```typescript
import { buildMapsUrl } from './PinDetailSheet'

it('returns maps:// for iPhone', () => {
  const url = buildMapsUrl(40, -104, 'Test Spot', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)')
  expect(url).toBe('maps://?daddr=40,-104')
})

it('returns geo:// for Android', () => {
  const url = buildMapsUrl(40, -104, 'Test Spot', 'Mozilla/5.0 (Linux; Android 13)')
  expect(url).toContain('geo:40,-104')
  expect(url).toContain('Test%20Spot')
})

it('returns Google Maps URL for desktop', () => {
  const url = buildMapsUrl(40, -104, 'Test Spot', 'Mozilla/5.0 (Windows NT 10.0)')
  expect(url).toBe('https://www.google.com/maps/dir/?api=1&destination=40,-104')
})
```

### Previous Story Intelligence (Story 3.1 learnings)

1. **shadcn NOT installed** — use plain `<button>` with Tailwind + inline style for exact hex colors. Sheet, Dialog, Button components from shadcn do NOT exist.
2. **Inline utility pattern** — `doesPinFitRig` was inlined in PinDetailSheet to avoid cross-feature imports. Apply same pattern for `buildMapsUrl` (but make it a named export for testability).
3. **`data-testid` for testability** — The backdrop had `data-testid="pin-detail-backdrop"`. Not needed for the button (it has accessible name via text content), but keep this pattern in mind.
4. **`useUIStore.getState()` in event handlers** — When calling Zustand outside React render (in event handlers), use `.getState()` directly. The dismiss handler pattern already does this.
5. **STUB_PIN structure in tests** — Tests use a `STUB_PIN` with `latitude: 40, longitude: -104`. The `buildMapsUrl` tests should use these same coordinates for consistency.
6. **`vi.hoisted` pattern** — `mockUsePinsQuery` is declared with `vi.hoisted` and referenced in `vi.mock`. Any new mocks for `window.open` should use `vi.spyOn` instead (no hoisting needed since it's mocking a global, not a module).

### Project Structure Notes

- **Modified**: `src/features/pin-detail/PinDetailSheet.tsx` — add `buildMapsUrl` named export + `handleGetDirections` function + "Get Directions" button in JSX
- **Modified**: `src/features/pin-detail/PinDetailSheet.test.tsx` — add `buildMapsUrl` unit tests + button render/click tests
- No new files required — all changes are additive to existing files

### What NOT to change

- `src/features/map/MapView.tsx` — no changes
- `src/features/map/MapView.test.tsx` — no changes
- `src/App.tsx` — no changes
- `src/features/pin-detail/RecencyBadge.tsx` — no changes
- `src/features/pin-detail/RecencyBadge.test.tsx` — no changes
- Any store files — no changes

### References

- Story requirements: [epics.md — Epic 3, Story 3.2](_bmad-output/planning-artifacts/epics.md)
- UX spec primary CTA: [ux-design-specification.md — Button Hierarchy](_bmad-output/planning-artifacts/ux-design-specification.md) — `primary: #0ea5e9, full-width in sheets`
- UX spec warning pattern: [ux-design-specification.md — Warning state](_bmad-output/planning-artifacts/ux-design-specification.md) — "Get Directions still available — warn, never block"
- UX spec Critical Success Moments: "Frictionless Navigation" — native maps opens instantly with correct destination
- Current PinDetailSheet: `src/features/pin-detail/PinDetailSheet.tsx` — add button at bottom of pin details section
- Platform URI schemes: iOS `maps://`, Android `geo://`, Desktop Google Maps HTTPS
- Touch target requirement: NFR-A4 — minimum 44×44px (`min-h-[44px]` + `w-full`)
- Test setup pattern: `src/features/pin-detail/PinDetailSheet.test.tsx` — existing mock structure to extend

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Used `window.open(url, '_blank', 'noopener,noreferrer')` for all platforms — this handles both mobile URI scheme handoff (maps://, geo://) and desktop new-tab opening uniformly.
- `buildMapsUrl` exported as named export (alongside default component export) so unit tests can call it directly with a mock `userAgent` parameter — avoids needing to stub `navigator.userAgent` at the jsdom global level.
- shadcn `Button` NOT installed — used plain `<button>` with Tailwind classes + inline `backgroundColor: '#0ea5e9'` for exact UX spec hex.

### Completion Notes List

- Task 1: Added `buildMapsUrl` as a named export in `PinDetailSheet.tsx`. Pure function accepting optional `userAgent` param (defaults to `navigator.userAgent`). iOS detection: `/iPhone|iPad|iPod/`, Android: `/Android/`, desktop fallback to Google Maps HTTPS URL. Check order ensures iOS matched before generic desktop.
- Task 2: Added `handleGetDirections()` inside component (guards on `!pin`). Added full-width primary CTA button "Get Directions →" at bottom of pin detail content section. Sky-blue `#0ea5e9` inline style, `min-h-[44px]` for AC5 touch target. Visible regardless of `badgeState` (warn never block).
- Task 3: Added 13 new tests across 2 new describe blocks:
  - `buildMapsUrl` (7 tests): iPhone/iPad/Android/desktop UA strings, coordinate embedding, URI-encoding of name
  - Get Directions button (6 tests): renders on pin found, hidden in loading/not-found/error states, `window.open` called with correct args via `vi.spyOn`, visible on stale (red) pin
- All 311 tests pass (22 test files). Previous count: 298. No regressions.

### File List

- `src/features/pin-detail/PinDetailSheet.tsx` — MODIFIED (added `buildMapsUrl` named export, `handleGetDirections`, "Get Directions →" button; code review: added `aria-label="Get Directions"` to button)
- `src/features/pin-detail/PinDetailSheet.test.tsx` — MODIFIED (added `buildMapsUrl` import, 13 new tests in 2 describe blocks; code review: strengthened `window.open` URL assertion, added iPod UA test, moved spy cleanup to `afterEach`)

### Code Review Record

**Reviewer:** claude-sonnet-4-6 | **Date:** 2026-03-18
**Outcome:** Approved with fixes (0H / 1M / 3L — all fixed automatically)

- M1 fixed: `window.open` integration test now asserts `url` contains STUB_PIN coordinates (`40`, `-104`) — catches wrong-coordinate regressions
- L1 fixed: Added `aria-label="Get Directions"` to button — screen readers no longer announce the `→` arrow character
- L2 fixed: Added iPod UA test case to `buildMapsUrl` describe block — explicit coverage for all three iOS device types in regex
- L3 fixed: Moved `vi.restoreAllMocks()` to `afterEach` in "Get Directions button" describe — spy cleanup now guaranteed even on assertion failure

All 312 tests pass. Story marked done.
