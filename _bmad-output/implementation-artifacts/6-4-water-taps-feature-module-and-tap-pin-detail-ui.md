# Story 6.4: Water Taps Feature Module & Tap Pin Detail UI

Status: done

## Story

As a Keys corridor traveler,
I want to view a dedicated tap pin detail sheet showing the tap's confidence source, photos, mile marker, and seasonal notes, and be able to submit a photo or confirm/deny the tap from that sheet,
So that I have complete, contextual information for every water tap pin without leaving the app.

## Acceptance Criteria

### AC 1 — PinLayer routes water_tap pins to `/tap/:id` (pin_category discriminator)

**Given** the user taps a `water_tap` pin on the map
**When** `PinLayer.tsx` handles the tap event
**Then** `navigate('/tap/:id')` is called — not `/pin/:id`
**And** `TapPinDetailSheet` loads as a lazy-loaded chunk separate from the main bundle

### AC 2 — TapPinDetailSheet bottom sheet renders within 300ms (NFR-P3)

**Given** the `/tap/:id` route loads
**When** `TapPinDetailSheet` renders
**Then** a bottom sheet slides up from the bottom of the screen within 300ms (NFR-P3)
**And** the sheet displays: place name, place type, access classification, confidence score/source, photos (scrollable if multiple), mile marker (if present), seasonal notes (if present), last verified date, and `TapConfidenceBadge`

### AC 3 — TapConfidenceBadge: ML Discovered state (FR47)

**Given** a water tap pin was created by the ML batch scan (`source = 'ml_batch'`)
**When** `TapConfidenceBadge` renders
**Then** it shows the ML model confidence as a percentage (e.g., "ML Confidence: 87%") alongside the data source label "ML Discovered"

### AC 4 — TapConfidenceBadge: community confirmation count (FR47)

**Given** a water tap pin has accumulated ≥1 user confirmations but `verified_date IS NULL`
**When** `TapConfidenceBadge` renders
**Then** it shows the community verification count (e.g., "1 traveler confirmed") alongside the ML confidence if available

### AC 5 — TapConfidenceBadge: Community Verified (FR47 highest-trust signal)

**Given** a water tap pin has `verified_date IS NOT NULL` (≥2 independent confirmed events)
**When** `TapConfidenceBadge` renders
**Then** it displays "Community Verified" status — the highest-trust signal — replacing the ML confidence indicator

### AC 6 — TapConfirmDeny: "Still here" fires confirmed event (FR46)

**Given** `TapPinDetailSheet` is open
**When** the user taps "Still here"
**Then** `useTapVerifyMutation` fires `POST /api/tap-verify` with `event_type = 'confirmed'`
**And** the verification count in the sheet increments optimistically before the server responds

### AC 7 — TapConfirmDeny: "No longer here" fires denied event (FR46)

**Given** `TapPinDetailSheet` is open
**When** the user taps "No longer here"
**Then** `useTapVerifyMutation` fires `POST /api/tap-verify` with `event_type = 'denied'`
**And** the verification count updates optimistically

### AC 8 — TapPhotoSubmission input and pending state (FR45)

**Given** `TapPinDetailSheet` is open
**When** the user taps "Submit a Photo"
**Then** `TapPhotoSubmission` renders: a camera/file input, a preview of the selected photo, and a "Submit" button
**And** while `useTapSubmitMutation` is pending, "Checking photo..." is shown

### AC 9 — TapPhotoSubmission: success message on created/confirmed (FR45)

**Given** the submission returns `status: 'created'` or `'confirmed'`
**When** the result renders
**Then** a success message is shown: "Photo added! This tap is now on the map."
**And** `['water-tap', tapPinId]` TanStack Query key is invalidated and refetched

### AC 10 — TapPhotoSubmission: neutral message on below_threshold (FR45)

**Given** the submission returns `status: 'below_threshold'`
**When** the result renders
**Then** a neutral message is shown: "Our model couldn't confirm a tap in that photo. Try a closer shot of the faucet."
**And** no pin is created

### AC 11 — 44×44px touch targets + swipe dismiss (NFR-A4)

**Given** the `TapPinDetailSheet`
**When** it renders on a mobile device
**Then** all interactive elements (Still here, No longer here, Submit a Photo) meet the minimum 44×44px touch target size (NFR-A4)
**And** swiping down on the sheet dismisses it and returns to the map

### AC 12 — Module isolation and structure

**Given** the `src/features/water-taps/` module
**When** a developer reviews its structure
**Then** it contains: `TapPinDetailSheet.tsx`, `TapConfidenceBadge.tsx`, `TapPhotoSubmission.tsx`, `TapConfirmDeny.tsx`, `TapPinDetailSheet.test.tsx`, `TapPhotoSubmission.test.tsx`, `waterTapsApi.ts`
**And** no water-taps components import from `src/features/pin-detail/` — modules are isolated

---

## Tasks / Subtasks

- [x] Task 1: Create `src/features/water-taps/waterTapsApi.ts` — types, Supabase query, fetch wrappers, TanStack hooks (AC: 1, 6, 7, 8, 9, 10)
  - [x] 1.1 Define `WaterTapPin`, `TapDetail`, `TapSubmitResponse`, `TapVerifyResponse` interfaces
  - [x] 1.2 `fetchWaterTapPin(id)` — queries `water_tap_pins` by ID + `tap_verification_events` confirmed/denied counts
  - [x] 1.3 `useWaterTapQuery(id)` — `useQuery` with key `['water-tap', id]`
  - [x] 1.4 `submitTapPhoto(formData)` — multipart POST `/api/tap-submit`
  - [x] 1.5 `verifyTap(payload)` — JSON POST `/api/tap-verify`
  - [x] 1.6 `useTapSubmitMutation()` — optimistic "pending" badge; invalidates `['water-tap', tapPinId]` on settle
  - [x] 1.7 `useTapVerifyMutation()` — optimistic confirm/deny count update; invalidates `['water-tap', tapPinId]` on settle

- [x] Task 2: Create `src/features/water-taps/TapConfidenceBadge.tsx` (AC: 3, 4, 5)
  - [x] 2.1 Props: `{ source: string, confidence: number, verifiedDate: string | null, confirmedCount: number }`
  - [x] 2.2 `verified_date IS NOT NULL` → "Community Verified" (replaces ML confidence)
  - [x] 2.3 `confirmedCount >= 1` && `verifiedDate == null` → "N traveler(s) confirmed" + ML confidence if source='ml_batch'
  - [x] 2.4 Default → "ML Confidence: X%" + "ML Discovered" label

- [x] Task 3: Create `src/features/water-taps/TapConfirmDeny.tsx` (AC: 6, 7, 11)
  - [x] 3.1 Props: `{ tapPinId: string }`
  - [x] 3.2 "Still here" button fires `useTapVerifyMutation` with `event_type='confirmed'`
  - [x] 3.3 "No longer here" button fires `useTapVerifyMutation` with `event_type='denied'`
  - [x] 3.4 Both buttons have `min-h-[44px]` touch targets (NFR-A4)
  - [x] 3.5 Uses `useDeviceId` for deviceId

- [x] Task 4: Create `src/features/water-taps/TapPhotoSubmission.tsx` (AC: 8, 9, 10, 11)
  - [x] 4.1 Props: `{ tapPinId: string, tapPinLocation: [number, number] }`
  - [x] 4.2 File input (`accept="image/*"`) with camera capture support
  - [x] 4.3 Photo preview when file is selected
  - [x] 4.4 "Submit" button fires `useTapSubmitMutation` via FormData
  - [x] 4.5 "Checking photo..." pending state during submission
  - [x] 4.6 "Photo added! This tap is now on the map." on created/confirmed
  - [x] 4.7 "Our model couldn't confirm a tap in that photo. Try a closer shot of the faucet." on below_threshold
  - [x] 4.8 Submit button meets 44×44px touch target (NFR-A4)
  - [x] 4.9 Uses `useDeviceId` for deviceId

- [x] Task 5: Create `src/features/water-taps/TapPinDetailSheet.tsx` (AC: 2, 11, 12)
  - [x] 5.1 Route component for `/tap/:id` using `useParams`
  - [x] 5.2 Fetches tap data via `useWaterTapQuery(id)`
  - [x] 5.3 Bottom sheet with slide-up animation (300ms transition on mount)
  - [x] 5.4 Swipe-down dismiss via touch events (>80px swipe → navigate('/'))
  - [x] 5.5 Displays: place_name, place_type, access, TapConfidenceBadge, photos (scrollable), mile_marker (if present), seasonal_notes (if present), verified_date
  - [x] 5.6 Renders `TapConfirmDeny` component
  - [x] 5.7 Renders `TapPhotoSubmission` component
  - [x] 5.8 Loading skeleton state, error state, not-found state
  - [x] 5.9 Close button with aria-label + 44×44px touch target; calls navigate('/')
  - [x] 5.10 Backdrop overlay with click-to-dismiss
  - [x] 5.11 `role="dialog" aria-modal="true" aria-labelledby="tap-detail-name"`
  - [x] 5.12 No imports from `src/features/pin-detail/` (module isolation)

- [x] Task 6: Update `src/types/pin.ts` — add `pinCategory` field (AC: 1)
  - [x] 6.1 Add `pinCategory?: string` to `Pin` interface

- [x] Task 7: Update `src/store/uiStore.ts` — water tap pin routing state (AC: 1)
  - [x] 7.1 Add `selectedTapPinId: string | null`
  - [x] 7.2 Add `setSelectedTapPin: (id: string | null) => void`

- [x] Task 8: Update `src/features/map/PinLayer.tsx` / `MapView.tsx` — routing conditional (AC: 1)
  - [x] 8.1 Update `PinMarker.ts` click handler: `if (pin.pinCategory === 'water_tap') → setSelectedTapPin(id); else → setSelectedPin(id)`
  - [x] 8.2 Update `MapView.tsx` navigation effect: watch `selectedTapPinId` → `navigate('/tap/' + id)`
  - [x] 8.3 Update `MapView.tsx` `useEffect` cleanup: clear `selectedTapPinId` on tap detail unmount path

- [x] Task 9: Update `src/App.tsx` — add `/tap/:id` lazy-loaded route (AC: 1, 2)
  - [x] 9.1 `const TapPinDetailSheet = lazy(() => import('@/features/water-taps/TapPinDetailSheet'))`
  - [x] 9.2 `<Route path="tap/:id" element={<TapPinDetailSheet />} />` nested under MapView route

- [x] Task 10: Component tests — `TapPinDetailSheet.test.tsx` (AC: 2, 3, 4, 5, 11, 12)
  - [x] 10.1 Renders loading skeleton when query is loading
  - [x] 10.2 Renders "Tap not found" when query returns null
  - [x] 10.3 Renders place_name when tap is found
  - [x] 10.4 Renders place_type and access classification
  - [x] 10.5 Renders mile_marker section when present; hides when null
  - [x] 10.6 Renders seasonal_notes when present; hides when null
  - [x] 10.7 Renders `TapConfidenceBadge` with correct props
  - [x] 10.8 Renders `TapConfirmDeny` with correct tapPinId
  - [x] 10.9 Renders `TapPhotoSubmission` with correct tapPinId
  - [x] 10.10 Calls navigate('/') when close button clicked
  - [x] 10.11 Close button has min 44px touch target (min-h-[44px])
  - [x] 10.12 Shows verified date when verified_date is set
  - [x] 10.13 TapConfidenceBadge "Community Verified" when verifiedDate not null
  - [x] 10.14 TapConfidenceBadge "N traveler(s) confirmed" when confirmedCount >= 1
  - [x] 10.15 TapConfidenceBadge "ML Confidence" label for ml_batch source

- [x] Task 11: Component tests — `TapPhotoSubmission.test.tsx` (AC: 8, 9, 10, 11)
  - [x] 11.1 Renders file input with accept="image/*"
  - [x] 11.2 Renders submit button with min 44px touch target
  - [x] 11.3 Shows preview img element after file selected
  - [x] 11.4 Shows "Checking photo..." when mutation isPending
  - [x] 11.5 Shows success message on 'created' status
  - [x] 11.6 Shows success message on 'confirmed' status
  - [x] 11.7 Shows neutral message on 'below_threshold' status
  - [x] 11.8 Submit button is disabled when no file selected

- [x] Task 12: Update `_bmad-output/implementation-artifacts/sprint-status.yaml` (tracking)
  - [x] 12.1 Update `6-4-water-taps-feature-module-and-tap-pin-detail-ui` → `in-progress`

---

## Dev Notes

### Architecture Context

- **Extends Stories 6.1–6.3**: Uses `water_tap_pins` table (migration 030), `tap_verification_events` table (migration 031), and the `/api/tap-submit` + `/api/tap-verify` Vercel serverless endpoints from Story 6.3.
- **Module isolation**: All new components live in `src/features/water-taps/`. Zero imports from `src/features/pin-detail/`.
- **DB schema** (`water_tap_pins`): `id uuid PK, location geography(POINT,4326), place_name text, place_type text (CHECK: gas_station|campground|restaurant), access text, confidence float8, source text (CHECK: ml_batch|user_submission|manual), photos text[], seasonal_notes text, mile_marker float8, is_active bool, verified_date timestamptz, place_ref text`
- **verified signal**: `verified_date IS NOT NULL` (not `source='verified'`). Story 6.3 Dev Note: the CHECK constraint on `water_tap_pins.source` does not include 'verified'. FR47 promotion sets `verified_date = now()`.
- **Verification counts**: query `tap_verification_events` for a tap pin — count rows where `event_type='confirmed'` and where `event_type='denied'`. This is read-only from the frontend (INSERT-only via serverless API).
- **Location field**: `water_tap_pins.location` returns as GeoJSON from Supabase: `{ type: 'Point', coordinates: [lng, lat] }`. Parse `coordinates[1]` for lat, `coordinates[0]` for lng.
- **Routing discriminator**: `Pin.pinCategory = 'water_tap'` is the signal in `PinMarker.ts` to call `setSelectedTapPin(id)` instead of `setSelectedPin(id)`. A new `selectedTapPinId` field is added to `uiStore.ts`. `MapView.tsx` watches it and navigates to `/tap/:id`.
- **Lazy chunk**: `TapPinDetailSheet` must be `React.lazy(() => import('@/features/water-taps/TapPinDetailSheet'))` in App.tsx — separate chunk from main bundle.
- **Bottom sheet pattern**: Use the same CSS structure as `PinDetailSheet` (backdrop + fixed sheet div). DO NOT import from `src/features/pin-detail/`.
- **Slide-up animation**: CSS `transition: transform 300ms ease-out`, toggling `transform: translateY(100%)` → `translateY(0)` via a mount-effect state.
- **Swipe-down dismiss**: `onTouchStart` records Y, `onTouchEnd` checks diff > 80px → `navigate('/')`.
- **FormData for photo submission**: `TapPhotoSubmission` builds `FormData({ photo: File, location: '[lat,lng]', deviceId })` and calls `submitTapPhoto(formData)` from `waterTapsApi.ts`.
- **Optimistic verify count**: `useTapVerifyMutation.onMutate` updates `['water-tap', tapPinId]` cache by incrementing `confirmedCount` or `deniedCount` before server responds. `onError` rolls back to snapshot.
- **useDeviceId**: Use `DEVICE_ID_KEY` from `@/hooks/useDeviceId` to read `localStorage.getItem(DEVICE_ID_KEY)` or call `useDeviceId()` hook.
- **Touch target sizes**: All buttons use `min-h-[44px] min-w-[44px]` Tailwind classes (NFR-A4).

### Test Strategy

- Mock `@/lib/supabase/client` (`vi.mock`) in `TapPinDetailSheet.test.tsx` when testing components that call the query — OR mock `waterTapsApi` module functions directly via `vi.mock('@/features/water-taps/waterTapsApi', ...)`.
- Use `vi.mock('react-router-dom')` to capture `useNavigate` and `useParams`.
- `TapPhotoSubmission.test.tsx`: mock `useTapSubmitMutation` return values to simulate pending, success, and failure states.
- `TapPinDetailSheet.test.tsx`: mock `useWaterTapQuery` (from `waterTapsApi`) to control loading/data states.
- Wrap all component renders in `QueryClientProvider` + `MemoryRouter`.

### References

- `src/features/pin-detail/PinDetailSheet.tsx` — bottom sheet layout pattern (DO NOT import)
- `src/store/uiStore.ts` — UIStore pattern for routing state
- `src/features/map/PinMarker.ts` — pin click handler pattern
- `src/features/map/MapView.tsx` — navigation effect pattern
- `src/hooks/useDeviceId.ts` — deviceId pattern
- `src/hooks/useCheckInMutation.ts` — TanStack optimistic mutation pattern
- `api/tap-submit.ts`, `api/tap-verify.ts` — serverless endpoints (from Story 6.3)
- `supabase/migrations/030_create_water_tap_pins.sql` — table schema
- `supabase/migrations/031_create_tap_verification_events.sql` — events table

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5 (2025)

### Debug Log References

### Completion Notes List

- `src/features/water-taps/waterTapsApi.ts` — NEW. Types: `WaterTapPin`, `TapDetail`, `TapSubmitResponse`, `TapVerifyResponse`, `VerifyPayload`. `fetchWaterTapPin(id)` queries `water_tap_pins` by ID (Supabase anon client) and `tap_verification_events` for confirmed/denied counts. Parses GeoJSON `location` column to `latitude`/`longitude`. `useWaterTapQuery`, `useTapSubmitMutation`, `useTapVerifyMutation` hooks. Optimistic verify: increments confirmed/denied count before server responds; rolls back on error.
- `src/features/water-taps/TapConfidenceBadge.tsx` — NEW. Pure presentational. Priority: (1) `verifiedDate IS NOT NULL` → "Community Verified" green badge; (2) `confirmedCount >= 1` → "N traveler(s) confirmed" + ML confidence for ml_batch source; (3) default → "ML Confidence: X%" + "ML Discovered" label.
- `src/features/water-taps/TapConfirmDeny.tsx` — NEW. "Still here" / "No longer here" buttons. Both `min-h-[44px]`. Uses `useTapVerifyMutation` + `useDeviceId`.
- `src/features/water-taps/TapPhotoSubmission.tsx` — NEW. File input (`accept="image/*"`, `capture="environment"`), preview via `URL.createObjectURL`, `useTapSubmitMutation` FormData POST, pending/success/below_threshold states. Submit button `min-h-[44px]`. Uses `useDeviceId` + `tapPinLocation` prop for location field.
- `src/features/water-taps/TapPinDetailSheet.tsx` — NEW. Route component for `/tap/:id`. Slide-up animation via `requestAnimationFrame` + CSS `transition: transform 300ms ease-out`. Swipe-down dismiss (>80px diff). Shows place_name, place_type, access, TapConfidenceBadge, photo gallery, mile_marker, seasonal_notes, verified_date, TapConfirmDeny, TapPhotoSubmission. role="dialog" aria-modal="true". No imports from `src/features/pin-detail/`.
- `src/types/pin.ts` — MODIFIED. Added `pinCategory?: string` to `Pin` interface.
- `src/store/uiStore.ts` — MODIFIED. Added `selectedTapPinId: string | null` + `setSelectedTapPin` action.
- `src/features/map/PinMarker.ts` — MODIFIED. Click handler now checks `pin.pinCategory === 'water_tap'` → `setSelectedTapPin(id)` else `setSelectedPin(id)`.
- `src/features/map/MapView.tsx` — MODIFIED. Added `selectedTapPinId` from UIStore + `useEffect` that navigates to `/tap/:id` when set.
- `src/App.tsx` — MODIFIED. Added lazy `TapPinDetailSheet` import + `<Route path="tap/:id" element={<TapPinDetailSheet />} />` nested under MapView.
- `TapPinDetailSheet.test.tsx` — NEW. 22 tests covering all states: loading, not-found, error, place info, mile_marker/seasonal_notes conditional rendering, verified date, all 3 TapConfidenceBadge states, sub-component presence, navigation, ARIA, photos gallery.
- `TapPhotoSubmission.test.tsx` — NEW. 15 tests covering: file input attributes, 44px touch target, disabled state, preview, pending/success/confirmed/below_threshold states, FormData payload validation.
- Total new tests: 37. Full suite: 1381/1381 passing (114 test files).

### File List

- `src/features/water-taps/waterTapsApi.ts` — NEW
- `src/features/water-taps/TapConfidenceBadge.tsx` — NEW
- `src/features/water-taps/TapConfirmDeny.tsx` — NEW
- `src/features/water-taps/TapPhotoSubmission.tsx` — NEW
- `src/features/water-taps/TapPinDetailSheet.tsx` — NEW
- `src/features/water-taps/TapPinDetailSheet.test.tsx` — NEW
- `src/features/water-taps/TapPhotoSubmission.test.tsx` — NEW
- `src/types/pin.ts` — MODIFIED (added pinCategory)
- `src/store/uiStore.ts` — MODIFIED (selectedTapPinId + setSelectedTapPin)
- `src/features/map/PinMarker.ts` — MODIFIED (pinCategory routing conditional)
- `src/features/map/MapView.tsx` — MODIFIED (selectedTapPinId navigation effect)
- `src/App.tsx` — MODIFIED (lazy TapPinDetailSheet + /tap/:id route)
- `_bmad-output/implementation-artifacts/6-4-water-taps-feature-module-and-tap-pin-detail-ui.md` — MODIFIED
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED

### Change Log

---

## Senior Developer Review (AI)

**Review Date:** 2026-04-26
**Outcome:** ✅ Approved (after fixes)
**Reviewer:** claude-sonnet-4-5 (adversarial code review)

### Summary

All 12 ACs implemented and verified. 1383 tests passing (114 test files). Code review found 1 HIGH + 2 MEDIUM + 3 LOW issues; all HIGH and MEDIUM resolved in-session.

### Action Items (all resolved)

- [x] [HIGH] `TapPinDetailSheet.tsx` — missing `setSelectedTapPin(null)` on unmount. After dismissing the sheet and tapping the same water_tap pin again, `selectedTapPinId` didn't change so `MapView.tsx` navigation effect never fired. Fixed: added unmount cleanup `useEffect(() => { return () => { useUIStore.getState().setSelectedTapPin(null) } }, [])`. Also added test "clears selectedTapPinId in uiStore on unmount". [`src/features/water-taps/TapPinDetailSheet.tsx:36-40`]
- [x] [MEDIUM] `TapPinDetailSheet.test.tsx` — no test for "Back to map" navigate in error state. Fixed: added test "calls navigate('/') when 'Back to map' is clicked in error state". [`src/features/water-taps/TapPinDetailSheet.test.tsx`]
- [x] [MEDIUM] `waterTapsApi.ts:fetchWaterTapPin` — two serial Supabase queries. Fixed: refactored to `Promise.all([...water_tap_pins..., ...tap_verification_events...])` for parallel execution. [`src/features/water-taps/waterTapsApi.ts:53-77`]
- [x] [LOW] `TapPinDetailSheet.tsx` — `key={idx}` (array index) on photo list. Fixed: changed to `key={url}`. Photo alt text also fixed from `Tap photo ${idx + 1}` to plain `Tap photo`. [`src/features/water-taps/TapPinDetailSheet.tsx:172,182`]
- [x] [LOW] `useWaterTapQuery` — queryKey `['water-tap', undefined]` when id is undefined. Fixed: guard to `['water-tap', '__none__']` when id is falsy. [`src/features/water-taps/waterTapsApi.ts:82`]
- [x] [LOW] Task 8.3 `[x]` marked complete but `setSelectedTapPin(null)` on unmount wasn't implemented (H1). Fixed by H1 fix above.
