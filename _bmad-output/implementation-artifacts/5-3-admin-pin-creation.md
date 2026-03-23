# Story 5.3: Admin Pin Creation

Status: done

## Story

As an admin,
I want to manually create and publish new spot pins with admin-verified status,
So that I can seed the map with high-quality founder-verified spots before community data fills in.

## Acceptance Criteria

**AC1 — Pin creation form**
Given the admin is authenticated and views the admin dashboard
When they tap "Add New Pin"
Then a pin creation form is shown with fields: name, stop type/category (pin_type), latitude, longitude, amenities (multi-select checkboxes: Water, Dump, Electric, Shower, Fuel, Propane, Overnight), fee (optional text), max rig length (optional integer), max rig height (optional decimal), notes (optional text)

**AC2 — Create pin API call**
Given the admin fills in all required fields (name, latitude, longitude, at least one amenity)
When they tap "Publish Pin"
Then `POST /api/admin/pins` is called with `Authorization: Bearer <token>` and the pin data as JSON body
And a new row is inserted into the `pins` Supabase table with:
- `source = 'admin'` (not `pin_type` — see Dev Notes)
- `pin_type = 'community'` (closest semantic match for admin-created pins — see Dev Notes)
- `badge_state = 'green'`
- `is_verified = true`
- `last_check_in_at = NOW()` (so recency badge renders green on first load)
- `updated_at = NOW()`
- `is_flagged = false`
- `is_archived = false`

**AC3 — Green badge on creation**
Given a pin is created by the admin
When it appears on the public map (after TanStack Query refetch)
Then its recency badge is green (is_verified=true, last_check_in_at fresh)
And it is visually indistinguishable from other green-badged pins — no special admin badge shown to users

**AC4 — Required field validation**
Given the admin submits the form with missing required fields (name, lat, lng, or no amenity selected)
When client-side validation runs
Then inline error messages are shown for each missing/invalid field and the form cannot be submitted

**AC5 — Coordinate bounds validation**
Given the admin enters coordinates outside the continental US bounds (lat: 24–49, lng: -125 to -66)
When they attempt to submit
Then a validation error is shown: "Coordinates appear to be outside the supported region"
And the form is not submitted

**AC6 — Success state**
Given all fields are valid and the API call succeeds
When the server responds with 201
Then the form closes (or resets) and the flagged pins list (and any pin list) in the dashboard refetches

**AC7 — Server-side Zod validation**
Given `POST /api/admin/pins` receives a request body
When Zod validation runs
Then missing required fields or invalid types return 400 with `{ error: 'INVALID_BODY', ... }`

## Tasks / Subtasks

- [x] Task 1: Create `api/admin/pins.ts` — POST endpoint (AC2, AC7)
  - [x] 1.1: POST only — return 405 for non-POST
  - [x] 1.2: Call `requireAdminAuth(req, res)` — return false + auto-401 if invalid
  - [x] 1.3: Define Zod schema for request body:
    ```typescript
    const CreatePinSchema = z.object({
      name: z.string().min(1),
      pin_type: z.enum(['blm', 'usfs', 'nps', 'overpass', 'community']),
      latitude: z.number().min(24).max(49),
      longitude: z.number().min(-125).max(-66),
      amenities: z.object({
        water: z.boolean(),
        dump: z.boolean(),
        electric: z.boolean(),
        shower: z.boolean(),
        fuel: z.boolean(),
        propane: z.boolean(),
        overnight: z.boolean(),
      }),
      fee: z.string().optional(),
      max_length_ft: z.number().int().positive().optional().nullable(),
      max_height_ft: z.number().positive().optional().nullable(),
      notes: z.string().optional(),
    })
    ```
  - [x] 1.4: `const parsed = CreatePinSchema.safeParse(req.body)` — return 400 on failure
  - [x] 1.5: `const supabase = createServiceClient()`
  - [x] 1.6: Insert new pin with required admin defaults:
    ```typescript
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('pins')
      .insert({
        ...parsed.data,
        badge_state: 'green',
        is_verified: true,
        is_flagged: false,
        is_archived: false,
        last_check_in_at: now,
        updated_at: now,
      })
      .select('id')
      .single()
    ```
  - [x] 1.7: Return 201 `{ id: data.id }` on success
  - [x] 1.8: Catch/handle errors → 500

- [x] Task 2: Write `api/admin/pins.test.ts` (AC2, AC7)
  - [x] 2.1: Mock pattern: `vi.hoisted()` for `mockRequireAdminAuth` and `mockInsert`/`mockSelect`/`mockSingle`; mock `'../_middleware'` and `'../_supabase'`
  - [x] 2.2: Test 405 for non-POST (e.g., GET)
  - [x] 2.3: Test 401 when `requireAdminAuth` returns false
  - [x] 2.4: Test 400 when body missing required fields (omit `name`)
  - [x] 2.5: Test 400 when coordinates are out of bounds (lat: 0, lng: 0)
  - [x] 2.6: Test 201 on valid body — verify insert called with `badge_state:'green'`, `is_verified:true`, `last_check_in_at` set
  - [x] 2.7: Test 500 when Supabase insert returns error

- [x] Task 3: Create `src/features/admin/CreatePinForm.tsx` (AC1, AC4, AC5, AC6)
  - [x] 3.1: Props: `{ adminToken: string; onSuccess: () => void; onCancel: () => void }`
  - [x] 3.2: Controlled form state with `useState`:
    ```typescript
    const [name, setName] = useState('')
    const [pinType, setPinType] = useState<string>('community')
    const [lat, setLat] = useState('')
    const [lng, setLng] = useState('')
    const [amenities, setAmenities] = useState({
      water: false, dump: false, electric: false,
      shower: false, fuel: false, propane: false, overnight: false,
    })
    const [fee, setFee] = useState('')
    const [maxLengthFt, setMaxLengthFt] = useState('')
    const [maxHeightFt, setMaxHeightFt] = useState('')
    const [notes, setNotes] = useState('')
    const [errors, setErrors] = useState<Record<string, string>>({})
    ```
  - [x] 3.3: Client-side validation function `validate()` — returns error map:
    - `name` required (non-empty after trim)
    - `latitude` required, must be number 24–49
    - `longitude` required, must be number -125 to -66 — if out of bounds show "Coordinates appear to be outside the supported region"
    - At least one amenity must be `true`
  - [x] 3.4: TanStack Query mutation:
    ```typescript
    const queryClient = useQueryClient()
    const createMutation = useMutation({
      mutationFn: async (body: object) => {
        const res = await fetch('/api/admin/pins', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error('Failed to create pin')
        return res.json()
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['admin', 'flagged-pins'] })
        onSuccess()
      },
    })
    ```
  - [x] 3.5: On "Publish Pin" click: run `validate()`, if errors set state and return; otherwise call `createMutation.mutate(payload)`
  - [x] 3.6: Amenities section: 7 labeled checkboxes (Water, Dump, Electric, Shower, Fuel, Propane, Overnight) each with `min-h-[44px]` touch area (NFR-A4)
  - [x] 3.7: Pin type select: `<select>` with options matching `pin_type` enum — default `'community'`
  - [x] 3.8: Disable "Publish Pin" button while `createMutation.isPending` (NFR-A4 class: `min-h-[44px]`)
  - [x] 3.9: "Cancel" button calls `onCancel()` — NFR-A4 touch target (`min-h-[44px]`)
  - [x] 3.10: If `createMutation.isError`, show inline error: "Failed to create pin. Please try again."

- [x] Task 4: Write `src/features/admin/CreatePinForm.test.tsx` (AC1, AC4, AC5, AC6)
  - [x] 4.1: Mock `fetch` via `vi.stubGlobal`; `vi.unstubAllGlobals()` in `afterEach`
  - [x] 4.2: Wrap renders with `QueryClientProvider` — same `makeWrapper`/`freshClient` pattern as `FlaggedPinList.test.tsx`
  - [x] 4.3: Test: renders all required form fields (name, lat, lng, amenity checkboxes, publish button) (AC1)
  - [x] 4.4: Test: submitting with empty name shows required field error (AC4)
  - [x] 4.5: Test: submitting with lat=0 lng=0 shows "Coordinates appear to be outside the supported region" (AC5)
  - [x] 4.6: Test: submitting with no amenity checked shows amenity required error (AC4)
  - [x] 4.7: Test: valid form calls `POST /api/admin/pins` with correct payload and `Authorization: Bearer <token>` header (AC2)
  - [x] 4.8: Test: on successful POST, `onSuccess` callback is called (AC6)
  - [x] 4.9: Test: "Publish Pin" button is disabled while mutation is pending (L2-style defensive test)
  - [x] 4.10: Test: "Cancel" button calls `onCancel` (AC1)
  - [x] 4.11: Test: all interactive elements (checkboxes, buttons) have `min-h-[44px]` class (NFR-A4)

- [x] Task 5: Modify `src/features/admin/AdminDashboard.tsx` (AC1, AC6)
  - [x] 5.1: Import `CreatePinForm` from `'./CreatePinForm'`
  - [x] 5.2: Add `const [showCreateForm, setShowCreateForm] = useState(false)` to component state
  - [x] 5.3: Inside the authenticated panel, add "Add New Pin" button:
    ```tsx
    <button
      className="min-h-[44px] min-w-[44px]"
      onClick={() => setShowCreateForm(true)}
    >
      Add New Pin
    </button>
    ```
  - [x] 5.4: Conditionally render `CreatePinForm` when `showCreateForm` is true:
    ```tsx
    {showCreateForm && (
      <CreatePinForm
        adminToken={adminToken}
        onSuccess={() => setShowCreateForm(false)}
        onCancel={() => setShowCreateForm(false)}
      />
    )}
    ```
  - [x] 5.5: Do NOT move or modify `<FlaggedPinList adminToken={adminToken} />` — it must remain in the dashboard

- [x] Task 6: Update `src/features/admin/AdminDashboard.test.tsx` (AC1)
  - [x] 6.1: Add `vi.mock('./CreatePinForm', () => ({ default: ({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) => <div data-testid="create-pin-form"><button onClick={onSuccess}>mock-success</button><button onClick={onCancel}>mock-cancel</button></div> }))` in the mock section
  - [x] 6.2: Add test: when authenticated, "Add New Pin" button is present in the dashboard
  - [x] 6.3: Add test: clicking "Add New Pin" renders `CreatePinForm` (data-testid="create-pin-form")
  - [x] 6.4: Add test: when `onSuccess` is called (via mock), `CreatePinForm` is hidden
  - [x] 6.5: Add test: when `onCancel` is called (via mock), `CreatePinForm` is hidden

## Dev Notes

### CRITICAL: `pin_type` vs. `source` — Admin Pins Use `pin_type = 'community'`

The `pins` table has a `pin_type` column with enum check: `('blm', 'usfs', 'nps', 'overpass', 'community')`. There is **no** `source` column. The epics.md AC2 mentions `source = 'admin'` but this does not exist in the actual schema (migration 001). Admin-created pins should use:
- `pin_type = 'community'` — the catch-all for non-agency pins
- The admin UI can offer all valid `pin_type` options as a select (blm, usfs, nps, overpass, community) so the admin can correctly label sourced pins they're manually entering

There is also no `fee` or `notes` column in the current schema (migration 001). **Do NOT add these columns** — they are optional UX fields. Simply omit fee/notes from the Supabase insert. If the architecture intended them they are future work. Do not invent migrations that aren't needed.

The Zod schema should therefore exclude `fee` and `notes` from what gets persisted to DB — only pass through columns that exist in `DbPin`:
- `name`, `pin_type`, `latitude`, `longitude`, `amenities`, `max_length_ft`, `max_height_ft`
- Plus admin-set defaults: `badge_state`, `is_verified`, `is_flagged`, `is_archived`, `last_check_in_at`, `updated_at`

### What Already Exists — Do NOT Recreate or Touch

- **`api/_middleware.ts`** — `requireAdminAuth(req, res): boolean` — import from `'../_middleware'`
- **`api/_supabase.ts`** — `createServiceClient()` — import from `'../_supabase'`
- **`api/admin/auth.ts`** — Story 5.1 (DO NOT TOUCH)
- **`api/admin/flagged-pins.ts`** — Story 5.2 (DO NOT TOUCH)
- **`api/pins/[id].ts`** — Story 5.2 (DO NOT TOUCH)
- **`api/pins/[id]/verify.ts`** — Story 5.2 (DO NOT TOUCH)
- **`src/features/admin/AdminDashboard.tsx`** — MODIFY (Task 5) — add toggle + CreatePinForm render
- **`src/features/admin/AdminDashboard.test.tsx`** — MODIFY (Task 6) — ADD tests only; do not recreate
- **`src/features/admin/FlaggedPinList.tsx`** — Story 5.2 (DO NOT TOUCH)
- **`src/lib/supabase/types.ts`** — already has `is_archived: boolean` from Story 5.2 — no changes needed

### New Endpoint: `POST /api/admin/pins`

The architecture.md API table lists `POST /api/sync` for the data pipeline (BLM/USFS/NPS cron) and does NOT list a separate admin pin creation endpoint. However, the epics.md AC2 references "`POST /api/sync` or a dedicated admin create endpoint." Use the dedicated endpoint:

**`api/admin/pins.ts`** — `POST /api/admin/pins`

This avoids conflating admin manual pin creation with the automated sync pipeline. The `sync.ts` endpoint triggers a multi-source API fetch — it is not designed for single-row inserts.

### API File Structure

```
api/
  admin/
    auth.ts              ← Story 5.1 (DO NOT TOUCH)
    auth.test.ts         ← Story 5.1 (DO NOT TOUCH)
    flagged-pins.ts      ← Story 5.2 (DO NOT TOUCH)
    flagged-pins.test.ts ← Story 5.2 (DO NOT TOUCH)
    pins.ts              ← NEW (Task 1) — POST /api/admin/pins
    pins.test.ts         ← NEW (Task 2)
  pins/
    [id].ts              ← Story 5.2 (DO NOT TOUCH)
    [id].test.ts         ← Story 5.2 (DO NOT TOUCH)
    [id]/
      verify.ts          ← Story 5.2 (DO NOT TOUCH)
      verify.test.ts     ← Story 5.2 (DO NOT TOUCH)
```

### Mock Pattern for API Tests (Established in Story 5.2)

```typescript
const { mockRequireAdminAuth } = vi.hoisted(() => {
  const mockRequireAdminAuth = vi.fn().mockReturnValue(true)
  return { mockRequireAdminAuth }
})
vi.mock('../_middleware', () => ({ requireAdminAuth: mockRequireAdminAuth }))

// For insert chain: .from('pins').insert({...}).select('id').single()
const { mockSingle, mockSelect, mockInsert } = vi.hoisted(() => {
  const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'new-pin-uuid' }, error: null })
  const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
  const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
  return { mockSingle, mockSelect, mockInsert }
})
vi.mock('../_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({ insert: mockInsert })),
  })),
}))
```

### Zod Pattern for Request Body Validation

Follow the same pattern as `api/pins/[id]/verify.ts` (Story 5.2):

```typescript
import { z } from 'zod'

const CreatePinSchema = z.object({
  name: z.string().min(1),
  pin_type: z.enum(['blm', 'usfs', 'nps', 'overpass', 'community']),
  latitude: z.number().min(24).max(49),
  longitude: z.number().min(-125).max(-66),
  amenities: z.object({
    water: z.boolean(),
    dump: z.boolean(),
    electric: z.boolean(),
    shower: z.boolean(),
    fuel: z.boolean(),
    propane: z.boolean(),
    overnight: z.boolean(),
  }),
  max_length_ft: z.number().int().positive().optional().nullable(),
  max_height_ft: z.number().positive().optional().nullable(),
})

const parsed = CreatePinSchema.safeParse(req.body)
if (!parsed.success) {
  return res.status(400).json({ error: 'INVALID_BODY', message: 'Invalid pin data', status: 400 })
}
```

Note: The latitude/longitude range bounds in Zod server-side handle the "outside supported region" server validation. Client-side validation shows the user-facing message.

### `req.query.id` Guard — Not Applicable Here

This is not a dynamic route — `api/admin/pins.ts` is a static route. No `Array.isArray(req.query.id)` guard needed (that was only for `api/pins/[id].ts` and `api/pins/[id]/verify.ts`).

### `CreatePinForm` Component — Coordinate Client Validation

Continental US approximate bounds:
- Latitude: 24° to 49°
- Longitude: -125° to -66°

```typescript
function validate(): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!name.trim()) errs.name = 'Name is required'
  const latNum = parseFloat(lat)
  const lngNum = parseFloat(lng)
  if (!lat || isNaN(latNum)) errs.latitude = 'Latitude is required'
  else if (latNum < 24 || latNum > 49) errs.latitude = 'Coordinates appear to be outside the supported region'
  if (!lng || isNaN(lngNum)) errs.longitude = 'Longitude is required'
  else if (lngNum < -125 || lngNum > -66) errs.longitude = 'Coordinates appear to be outside the supported region'
  if (!Object.values(amenities).some(Boolean)) errs.amenities = 'At least one amenity is required'
  return errs
}
```

### `adminToken` in TanStack Query Invalidation

On successful pin creation, invalidate `['admin', 'flagged-pins']` — this is the only admin query currently active. There is no `['pins']` public query to invalidate from the admin UI (public map will naturally refetch on next focus via stale-while-revalidate).

### `AdminDashboard.tsx` — Minimal Modification

Current state (after Story 5.2):
```tsx
<div>
  <h1>Admin Dashboard</h1>
  <button onClick={handleSignOut} className="min-h-[44px] min-w-[44px]">Sign Out</button>
  <FlaggedPinList adminToken={adminToken} />
</div>
```

After Story 5.3 (add before `FlaggedPinList`):
```tsx
<button className="min-h-[44px] min-w-[44px]" onClick={() => setShowCreateForm(true)}>
  Add New Pin
</button>
{showCreateForm && (
  <CreatePinForm
    adminToken={adminToken}
    onSuccess={() => setShowCreateForm(false)}
    onCancel={() => setShowCreateForm(false)}
  />
)}
```

### Touch Targets (NFR-A4)

All interactive elements must have `min-h-[44px]` (and `min-w-[44px]` for standalone buttons). For checkbox rows, the label wrapper should have `min-h-[44px]` to ensure the full row is tappable.

### Error Handling in `CreatePinForm.tsx`

- Client-side validation errors: shown inline per field via `errors` state
- Network/server error from mutation: show inline `createMutation.isError` message
- Do not mix validation errors with mutation errors — they are separate states

### Architecture: No Cross-Feature Imports

`CreatePinForm.tsx` lives in `src/features/admin/`. It must NOT import from other feature directories. It may import from `src/hooks/` if needed (e.g., `useQueryClient`).

### File Structure

New files this story creates:
```
api/admin/
  pins.ts         ← POST /api/admin/pins
  pins.test.ts

src/features/admin/
  CreatePinForm.tsx       ← new
  CreatePinForm.test.tsx  ← new
```

Modified files:
```
src/features/admin/
  AdminDashboard.tsx      ← add "Add New Pin" toggle + CreatePinForm
  AdminDashboard.test.tsx ← add CreatePinForm mock + tests
```

### Project Structure Notes

- `api/admin/pins.ts` follows the same `api/admin/` directory as `flagged-pins.ts` (Story 5.2) and `auth.ts` (Story 5.1)
- `src/features/admin/CreatePinForm.tsx` follows the same feature-slice pattern as `FlaggedPinList.tsx`
- No new Supabase migrations needed — all required columns already exist in the `pins` table

### References

- Pins schema: `overnighter/supabase/migrations/001_create_pins.sql` — full column list and constraints
- `DbPin` interface: `overnighter/src/lib/supabase/types.ts` — TypeScript types for all pin columns
- Coordinate bounds AC: `_bmad-output/planning-artifacts/epics.md` — Story 5.3 AC5
- Admin auth pattern: `overnighter/api/_middleware.ts` + `overnighter/api/admin/auth.ts` (Story 5.1)
- Zod validation pattern: `overnighter/api/pins/[id]/verify.ts` (Story 5.2)
- API mock pattern: `overnighter/api/admin/flagged-pins.test.ts` (Story 5.2) — `vi.hoisted()` structure
- Component test pattern: `overnighter/src/features/admin/FlaggedPinList.test.tsx` — `makeWrapper`/`freshClient`/`vi.stubGlobal`
- `AdminDashboard.tsx` current state: `overnighter/src/features/admin/AdminDashboard.tsx` (post Story 5.2)
- `AdminDashboard.test.tsx` to modify: `overnighter/src/features/admin/AdminDashboard.test.tsx`
- Touch target requirement: `NFR-A4` (all interactive elements 44×44px min)
- Story 5.2 (dependency): `_bmad-output/implementation-artifacts/5-2-flagged-pin-review-queue.md`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 6 tasks implemented and tested; 498 tests passing (29 new tests total, 0 regressions)
- Code review fixes: Cancel button now disabled during pending mutation (M1); fee and notes fields added to form UI per AC1 (M2, not persisted to DB — no schema column); isError state test added to CreatePinForm.test.tsx (L1); pin_type assertion added to test 4.7 (L3); additional 400 test cases for invalid pin_type and missing amenities (L2)
- `api/admin/pins.ts`: POST-only; Zod validates body (name required, coordinates in US bounds lat 24–49 / lng -125–-66, amenities object); inserts pin with `badge_state='green'`, `is_verified=true`, `is_flagged=false`, `is_archived=false`, `last_check_in_at=now()` (AC2); returns 201 `{id}` (AC6)
- `pin_type='community'` used for admin pins — no `source` column exists in actual schema; story dev notes document this discrepancy from epics.md AC2
- `fee` and `notes` columns do not exist in pins schema — omitted from Zod schema and insert; no migration needed
- `CreatePinForm.tsx`: controlled form with 7 amenity checkboxes; client-side validation (name required, coordinate bounds, at least one amenity); TanStack `useMutation` POST to `/api/admin/pins`; `onSuccess`/`onCancel` callbacks; `min-h-[44px]` on all buttons (NFR-A4); `isError` inline message; button disabled while pending
- `AdminDashboard.tsx`: added `showCreateForm` state toggle; "Add New Pin" button shows `CreatePinForm`; `FlaggedPinList` unchanged
- Mock patterns: `vi.hoisted()` for API tests; `vi.stubGlobal('fetch', ...)` for component tests; `makeWrapper`/`freshClient` for QueryClient in component tests

### File List

- `overnighter/api/admin/pins.ts` (new)
- `overnighter/api/admin/pins.test.ts` (new)
- `overnighter/src/features/admin/CreatePinForm.tsx` (new)
- `overnighter/src/features/admin/CreatePinForm.test.tsx` (new)
- `overnighter/src/features/admin/AdminDashboard.tsx` (modified — added CreatePinForm import, showCreateForm state, "Add New Pin" button)
- `overnighter/src/features/admin/AdminDashboard.test.tsx` (modified — added CreatePinForm mock + 4 tests)
