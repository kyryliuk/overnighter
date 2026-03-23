# Story 5.4: Admin Pin Editing

Status: done

## Story

As an admin,
I want to edit any existing pin's data including amenities, restrictions, coordinates, and fee,
So that I can correct inaccurate information immediately without waiting for a data pipeline re-run.

## Acceptance Criteria

**AC1 — Edit form pre-populated with current pin data**
Given the admin is authenticated and views the admin dashboard
When they search for or select an existing pin
Then an edit form is shown pre-populated with all current pin data: name, category (pin_type), coordinates (lat/lng), amenities (checkboxes), fee (display-only, not persisted), max rig length, max rig height, notes (display-only, not persisted)

**AC2 — Save changes via PATCH**
Given the admin modifies one or more fields and taps "Save Changes"
When the update is submitted
Then `PATCH /api/pins/:id` is called with `Authorization: Bearer <token>` and the updated fields as JSON body
And the `pins` row in Supabase is updated immediately

**AC3 — Amenity display updates on public map**
Given the admin updates a pin's amenities
When the change is saved
Then the pin's amenity display updates on the public map within the next TanStack Query refetch cycle (stale-while-revalidate)

**AC4 — Cancel discards changes**
Given the admin edits a pin and taps "Cancel"
When the action completes
Then no changes are written to Supabase and the pin data is unchanged
And the dashboard returns to the pin list view

**AC5 — Server-side Zod validation**
Given `PATCH /api/pins/:id` receives a request body
When Zod validation runs
Then invalid field values (e.g. out-of-bounds coordinates, invalid pin_type) are rejected with a `400` error response and `{ error: 'INVALID_BODY', ... }`

**AC6 — Success feedback**
Given the admin saves changes to a pin
When the update completes successfully
Then the server returns 200 `{ ok: true }`
And the admin dashboard shows a confirmation message: "Pin updated successfully"
And the dashboard returns to the pin list view

## Tasks / Subtasks

- [x] Task 1: Modify `api/pins/[id].ts` to handle `PATCH` for general pin editing (AC2, AC5)
  - [x] 1.1: Update method guard to allow both `DELETE` and `PATCH`: if method is neither → return 405
  - [x] 1.2: Route by method — existing DELETE logic unchanged; add PATCH branch
  - [x] 1.3: Define Zod schema for PATCH body (UpdatePinSchema — all fields optional)
  - [x] 1.4: In PATCH branch: validate body with `UpdatePinSchema.safeParse(req.body)` → 400 on failure
  - [x] 1.5: Extract `pinId` using the array guard
  - [x] 1.6: Build update payload by spreading `parsed.data` + `updated_at: new Date().toISOString()`
  - [x] 1.7: `supabase.from('pins').update(payload).eq('id', pinId)` — return 200 `{ ok: true }` on success
  - [x] 1.8: Catch errors → return 500

- [x] Task 2: Add PATCH tests to `api/pins/[id].test.ts` (AC2, AC5)
  - [x] 2.1: Add a second `describe` block for `PATCH /api/pins/:id` in the existing test file
  - [x] 2.2: Reuse existing mock structure (both DELETE and PATCH use `.from().update().eq()` chain)
  - [x] 2.3: Test 405 for POST (neither DELETE nor PATCH)
  - [x] 2.4: Test 401 for PATCH when `requireAdminAuth` returns false
  - [x] 2.5: Test 400 for PATCH with invalid body (latitude: 0 — out of bounds)
  - [x] 2.6: Test 400 for invalid `pin_type` in PATCH body
  - [x] 2.7: Test 200 for valid PATCH — verify `.update()` called with body fields + `updated_at` set
  - [x] 2.8: Test 500 for PATCH when Supabase returns error
  - [x] 2.9: Existing DELETE describe block unchanged

- [x] Task 3: Create `src/features/admin/AdminPinList.tsx` — pin selection list (AC1)
  - [x] 3.1: Props: `{ onSelect: (pin: Pin) => void }`
  - [x] 3.2: Import `getAllPins` from `'@/lib/supabase/pins'` and `Pin` from `'@/types/pin'`
  - [x] 3.3: TanStack Query fetch with `queryKey: ['admin', 'all-pins']`
  - [x] 3.4: Loading state: `<p>Loading pins...</p>`
  - [x] 3.5: Error state: `<p>Failed to load pins.</p>`
  - [x] 3.6: Empty state: `<p>No pins found.</p>`
  - [x] 3.7: For each pin: name, coordinates, pinType, and Edit button with `aria-label` and `min-h-[44px]`

- [x] Task 4: Write `src/features/admin/AdminPinList.test.tsx` (AC1)
  - [x] 4.1: Mock `getAllPins` via `vi.mock` with `vi.hoisted()`
  - [x] 4.2: Wrap renders with `QueryClientProvider` — `makeWrapper`/`freshClient` pattern
  - [x] 4.3: Test: shows "Loading pins..." while query pending
  - [x] 4.4: Test: shows "Failed to load pins." on rejection
  - [x] 4.5: Test: shows "No pins found." when empty
  - [x] 4.6: Test: renders pin name and "Edit" button
  - [x] 4.7: Test: clicking "Edit" calls `onSelect` with correct pin
  - [x] 4.8: Test: Edit buttons have `min-h-[44px]` class

- [x] Task 5: Create `src/features/admin/EditPinForm.tsx` — pre-populated edit form (AC1, AC2, AC4, AC6)
  - [x] 5.1: Props: `{ pin: Pin; adminToken: string; onSuccess: () => void; onCancel: () => void }`
  - [x] 5.2: Initialize form state from `pin` prop (name, pinType, lat, lng, amenities, maxLengthFt, maxHeightFt)
  - [x] 5.3: Local `AmenitiesState` type and `AMENITY_LABELS` constants
  - [x] 5.4: Client-side `validate()` — same rules as CreatePinForm
  - [x] 5.5: TanStack Query mutation — PATCH `/api/pins/${pin.id}` with Bearer auth
  - [x] 5.6: On "Save Changes" click: run validate(), set errors or mutate
  - [x] 5.7: Payload only includes persisted fields (no fee/notes)
  - [x] 5.8: fee/notes omitted entirely (no DB columns)
  - [x] 5.9: All interactive elements: `min-h-[44px]`
  - [x] 5.10: Both "Save Changes" and "Cancel" disabled while pending
  - [x] 5.11: Error alert: "Failed to update pin. Please try again."

- [x] Task 6: Write `src/features/admin/EditPinForm.test.tsx` (AC1, AC2, AC4, AC5, AC6)
  - [x] 6.1: Mock fetch via `vi.stubGlobal`; `vi.unstubAllGlobals()` in `afterEach`
  - [x] 6.2: Wrap renders with `QueryClientProvider`
  - [x] 6.3: STUB_PIN fixture matching Pin type
  - [x] 6.4: Form fields pre-populated from pin prop
  - [x] 6.5: Empty name shows required error
  - [x] 6.6: Out-of-bounds coords shows region error
  - [x] 6.7: Valid submit calls PATCH with correct payload and Authorization header
  - [x] 6.8: pin.id used in PATCH URL
  - [x] 6.9: onSuccess called when PATCH returns ok
  - [x] 6.10: onCancel called on Cancel; no fetch
  - [x] 6.11: Both buttons disabled while pending
  - [x] 6.12: Error message shown on PATCH failure
  - [x] 6.13: Buttons have `min-h-[44px]` class

- [x] Task 7: Modify `src/features/admin/AdminDashboard.tsx` (AC1, AC6)
  - [x] 7.1: Import `AdminPinList` and `EditPinForm`
  - [x] 7.2: Import `Pin` from `'@/types/pin'`
  - [x] 7.3: Add `selectedPin` and `editSuccessMessage` state
  - [x] 7.4: Conditional EditPinForm/AdminPinList toggle with success message
  - [x] 7.5: `FlaggedPinList` stays at bottom

- [x] Task 8: Update `src/features/admin/AdminDashboard.test.tsx` (AC1, AC6)
  - [x] 8.1: Add mock for `AdminPinList`
  - [x] 8.2: Add mock for `EditPinForm`
  - [x] 8.3: Test: AdminPinList rendered in authenticated dashboard (17.2)
  - [x] 8.4: Test: clicking mock select renders EditPinForm (17.3)
  - [x] 8.5: Test: EditPinForm hidden and AdminPinList shown after onCancel (17.4)
  - [x] 8.6: Test: success message visible after onSuccess (17.5)
  - [x] 8.7: Test: AdminPinList hidden when EditPinForm shown (17.6)

## Dev Notes

### CRITICAL: `api/pins/[id].ts` Is Shared — DELETE Logic Must Stay Intact

`api/pins/[id].ts` was implemented in Story 5.2 and handles `DELETE`. Story 5.4 adds `PATCH` support to the **same file**. The key change:

```typescript
// Before (Story 5.2):
if (req.method !== 'DELETE') {
  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'DELETE only', status: 405 })
}
// ... DELETE logic only

// After (Story 5.4):
if (req.method !== 'DELETE' && req.method !== 'PATCH') {
  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'DELETE or PATCH only', status: 405 })
}
if (req.method === 'DELETE') {
  // ... existing delete logic (unchanged)
}
if (req.method === 'PATCH') {
  // ... new edit logic
}
```

The existing `api/pins/[id].test.ts` test `returns 405 for non-DELETE methods (9.2)` uses method `GET` and checks `error: 'METHOD_NOT_ALLOWED'` — it does NOT check `message`, so changing the message from "DELETE only" to "DELETE or PATCH only" does NOT break that test.

### What Already Exists — Do NOT Recreate or Touch

- **`api/_middleware.ts`** — `requireAdminAuth(req, res): boolean` — import from `'../_middleware'`
- **`api/_supabase.ts`** — `createServiceClient()` — import from `'./_supabase'`
- **`api/admin/auth.ts`** — Story 5.1 (DO NOT TOUCH)
- **`api/admin/flagged-pins.ts`** — Story 5.2 (DO NOT TOUCH)
- **`api/admin/pins.ts`** — Story 5.3, POST-only (DO NOT TOUCH)
- **`api/pins/[id].ts`** — MODIFY (Task 1) — add PATCH method
- **`api/pins/[id].test.ts`** — MODIFY (Task 2) — ADD new describe block; do NOT rewrite the file
- **`api/pins/[id]/verify.ts`** — Story 5.2 (DO NOT TOUCH)
- **`src/features/admin/AdminDashboard.tsx`** — MODIFY (Task 7)
- **`src/features/admin/AdminDashboard.test.tsx`** — MODIFY (Task 8) — ADD tests + mocks
- **`src/features/admin/FlaggedPinList.tsx`** — Story 5.2 (DO NOT TOUCH)
- **`src/features/admin/CreatePinForm.tsx`** — Story 5.3 (DO NOT TOUCH)
- **`src/lib/supabase/pins.ts`** — `getAllPins()` and `dbPinToPin()` — USE in `AdminPinList`, do NOT modify

### File Structure

```
api/pins/
  [id].ts           ← MODIFY — add PATCH branch (keep DELETE intact)
  [id].test.ts      ← MODIFY — add new PATCH describe block

src/features/admin/
  AdminPinList.tsx       ← NEW (Task 3)
  AdminPinList.test.tsx  ← NEW (Task 4)
  EditPinForm.tsx        ← NEW (Task 5)
  EditPinForm.test.tsx   ← NEW (Task 6)
  AdminDashboard.tsx     ← MODIFY (Task 7)
  AdminDashboard.test.tsx ← MODIFY (Task 8)
```

### `Pin` Type (camelCase) — Used in `EditPinForm` and `AdminPinList`

The `Pin` type from `@/types/pin` is the **camelCase public interface** — do NOT use `DbPin` (snake_case) in components. `getAllPins()` returns `Pin[]`.

Key `Pin` fields relevant to editing:
- `id: string`
- `name: string`
- `latitude: number`
- `longitude: number`
- `pinType: string` (maps to `pin_type` in DB; use as-is for the payload)
- `amenities: PinAmenities` (object with boolean values, same shape as DB)
- `maxLengthFt: number | null`
- `maxHeightFt: number | null`

**fee and notes**: Do NOT exist in `Pin` type (not mapped from `DbPin`). Do NOT add them to the `EditPinForm` — unlike AC1's mention of them (which mirrors the Story 5.3 trade-off: no DB column, omitted from form entirely).

### `AmenitiesState` Type in `EditPinForm`

Define locally in `EditPinForm.tsx` (same shape as in `CreatePinForm.tsx`):
```typescript
type AmenitiesState = {
  water: boolean; dump: boolean; electric: boolean;
  shower: boolean; fuel: boolean; propane: boolean; overnight: boolean;
}
```
Do NOT import this from `CreatePinForm.tsx`.

### Mock Pattern for `AdminPinList` Tests — `vi.mock('@/lib/supabase/pins')`

```typescript
const { mockGetAllPins } = vi.hoisted(() => {
  const mockGetAllPins = vi.fn()
  return { mockGetAllPins }
})

vi.mock('@/lib/supabase/pins', () => ({
  getAllPins: mockGetAllPins,
}))
```

In `beforeEach`:
```typescript
beforeEach(() => {
  vi.clearAllMocks()
  mockGetAllPins.mockResolvedValue([])
})
```

For loading state test: `mockGetAllPins.mockReturnValue(new Promise(() => {}))` (never resolves)

### Mock Pattern for PATCH Tests in `api/pins/[id].test.ts`

The existing mock structure already covers the PATCH chain:
```typescript
const { mockUpdate, mockEq } = vi.hoisted(() => {
  const mockEq = vi.fn().mockResolvedValue({ error: null })
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
  return { mockUpdate, mockEq }
})
vi.mock('../_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({ update: mockUpdate })),
  })),
}))
```

Both DELETE and PATCH use `.from('pins').update({...}).eq('id', pinId)` — the same mock chain. Add a new `describe('PATCH /api/pins/:id', () => { ... })` block without changing the existing mock setup.

### TanStack Query Invalidation in `EditPinForm`

On successful PATCH, invalidate both:
- `['admin', 'all-pins']` — the admin pin list (so it shows the updated data)
- `['admin', 'flagged-pins']` — since editing a pin might change its badge/flag state

The public map query `['pins', viewport]` will naturally stale-while-revalidate without explicit invalidation (AC3).

### "Confirmation Toast" = Inline Success Message on AdminDashboard

There is no toast system in the codebase. Implement AC6 as an `editSuccessMessage` state string on `AdminDashboard`. When `EditPinForm.onSuccess()` fires:
1. Set `editSuccessMessage('Pin updated successfully')`
2. Set `selectedPin(null)` (hides EditPinForm, shows AdminPinList)
3. Display the message as `<p role="status">{editSuccessMessage}</p>` in the dashboard
4. Clear it when the user clicks to select another pin for editing

### `AdminDashboard.tsx` Layout After Story 5.4

Current layout (after Story 5.3):
```tsx
<h1>Admin Dashboard</h1>
<button>Sign Out</button>
<button>Add New Pin</button>
{showCreateForm && <CreatePinForm ... />}
<FlaggedPinList adminToken={adminToken} />
```

After Story 5.4 (add the pin edit section between CreatePinForm and FlaggedPinList):
```tsx
<h1>Admin Dashboard</h1>
<button>Sign Out</button>
<button>Add New Pin</button>
{showCreateForm && <CreatePinForm ... />}
{editSuccessMessage && <p role="status">{editSuccessMessage}</p>}
{selectedPin ? (
  <EditPinForm pin={selectedPin} adminToken={adminToken} ... />
) : (
  <AdminPinList onSelect={(pin) => { setEditSuccessMessage(''); setSelectedPin(pin) }} />
)}
<FlaggedPinList adminToken={adminToken} />
```

### Touch Targets (NFR-A4)

All interactive elements in `AdminPinList.tsx` and `EditPinForm.tsx` must have `min-h-[44px] min-w-[44px]`. In particular: Edit buttons in `AdminPinList`, Save Changes and Cancel in `EditPinForm`.

### `QueryClientProvider` in `AdminPinList.test.tsx`

`AdminPinList` uses `useQuery`, so all test renders must be wrapped in `QueryClientProvider`. Use the same `makeWrapper`/`freshClient` pattern from `FlaggedPinList.test.tsx` and `CreatePinForm.test.tsx`.

### Architecture: No Cross-Feature Imports

`AdminPinList.tsx` and `EditPinForm.tsx` live in `src/features/admin/`. They may import from `src/lib/supabase/` and `src/types/`. They must NOT import from other feature directories.

### References

- Pins table schema: `overnighter/supabase/migrations/001_create_pins.sql` — column definitions and constraints
- `Pin` type (camelCase): `overnighter/src/types/pin.ts` (check file exists; based on `dbPinToPin` in `src/lib/supabase/pins.ts`)
- `DbPin` interface: `overnighter/src/lib/supabase/types.ts`
- `getAllPins()`: `overnighter/src/lib/supabase/pins.ts` — used in `AdminPinList`
- `api/pins/[id].ts` (to modify): current DELETE handler — Story 5.2
- `api/pins/[id].test.ts` (to modify): existing DELETE tests — Story 5.2
- Zod pattern: `overnighter/api/pins/[id]/verify.ts` (Story 5.2) and `overnighter/api/admin/pins.ts` (Story 5.3)
- Previous story learnings: `_bmad-output/implementation-artifacts/5-3-admin-pin-creation.md` — CreatePinForm patterns, mock structures, AC1 fee/notes trade-off
- `AdminDashboard.tsx` current state: `overnighter/src/features/admin/AdminDashboard.tsx` (post Story 5.3)
- `AdminDashboard.test.tsx` to modify: `overnighter/src/features/admin/AdminDashboard.test.tsx`
- Touch target NFR: NFR-A4 — all interactive elements 44×44px minimum
- Story 5.3 (dependency): `_bmad-output/implementation-artifacts/5-3-admin-pin-creation.md`
- Story 5.2 (dependency): `_bmad-output/implementation-artifacts/5-2-flagged-pin-review-queue.md`

## Senior Developer Review (AI)

**Review Date:** 2026-03-19
**Outcome:** Changes Requested (all resolved in same session)

### Action Items

- [x] [MEDIUM] AC1 partially unmet — `fee` and `notes` fields absent from `EditPinForm` [EditPinForm.tsx]
- [x] [MEDIUM] `CreatePinForm` and `AdminPinList`/`EditPinForm` visible simultaneously — no dismiss gate [AdminDashboard.tsx]
- [x] [LOW] Stale test description in `[id].test.ts` line 55 — "non-DELETE methods" now misleading [api/pins/[id].test.ts:55]
- [x] [LOW] No test for non-null `maxLengthFt`/`maxHeightFt` pre-population in `EditPinForm` [EditPinForm.test.tsx]
- [x] [LOW] Empty PATCH body `{}` passes Zod and silently writes only `updated_at` to DB [api/pins/[id].ts]

### Review Follow-ups (AI)

- [x] [AI-Review][MEDIUM] Add fee/notes as disabled display-only inputs to EditPinForm + test [EditPinForm.tsx]
- [x] [AI-Review][MEDIUM] Set `setShowCreateForm(false)` on pin select in AdminDashboard + test [AdminDashboard.tsx]
- [x] [AI-Review][LOW] Update test 9.2 description to reflect DELETE+PATCH dual-method guard [[id].test.ts:55]
- [x] [AI-Review][LOW] Add STUB_PIN with maxLengthFt:40/maxHeightFt:13.5 pre-population test [EditPinForm.test.tsx]
- [x] [AI-Review][LOW] Reject empty `{}` PATCH body with 400 INVALID_BODY + test [[id].ts, [id].test.ts]

## Change Log

- 2026-03-19: Story 5.4 implemented — PATCH endpoint, AdminPinList, EditPinForm, AdminDashboard integration. 27 new tests (525 total).
- 2026-03-19: Code review — 2 MEDIUM + 3 LOW resolved: fee/notes display-only in EditPinForm, CreatePinForm dismiss on pin select, stale test description, rig constraint pre-population test, empty PATCH body rejection. +4 tests (529 total). Status: done.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- Implemented `PATCH /api/pins/:id` in the shared `api/pins/[id].ts` file alongside existing DELETE logic. Reused existing `vi.hoisted()` mock structure (same `.update().eq()` chain) for the new PATCH test describe block — no mock changes needed.
- `AdminPinList` fetches all pins via `getAllPins()` from `@/lib/supabase/pins`. Uses `queryKey: ['admin', 'all-pins']`.
- `EditPinForm` initializes all form state from the `pin` prop (camelCase `Pin` type). PATCH payload uses snake_case field names matching DB schema. On success, invalidates both `['admin', 'all-pins']` and `['admin', 'flagged-pins']`.
- fee/notes omitted from EditPinForm entirely (no DB columns, same trade-off as Story 5.3).
- `AdminDashboard` uses `editSuccessMessage` string state + `selectedPin: Pin | null` toggle pattern for the inline success toast.
- 525 tests passing across 44 test files. +27 new tests.

### File List

- `overnighter/api/pins/[id].ts` — modified (added PATCH branch + UpdatePinSchema)
- `overnighter/api/pins/[id].test.ts` — modified (added PATCH describe block with 6 tests)
- `overnighter/src/features/admin/AdminPinList.tsx` — new
- `overnighter/src/features/admin/AdminPinList.test.tsx` — new (6 tests)
- `overnighter/src/features/admin/EditPinForm.tsx` — new
- `overnighter/src/features/admin/EditPinForm.test.tsx` — new (10 tests)
- `overnighter/src/features/admin/AdminDashboard.tsx` — modified (selectedPin + editSuccessMessage state, EditPinForm/AdminPinList toggle)
- `overnighter/src/features/admin/AdminDashboard.test.tsx` — modified (added AdminPinList + EditPinForm mocks + 5 tests 17.2–17.6)
