# Story 5.2: Flagged Pin Review Queue

Status: done

## Story

As an admin,
I want to see a list of pins auto-flagged by the system and be able to archive or override their badge status,
So that data quality issues surface automatically and I can resolve them without manually scanning the entire map.

## Acceptance Criteria

**AC1 — Auto-flag trigger (server-side)**
Given a pin receives ≥3 issue reports within a 48-hour period
When the server processes an incoming report
Then the pin's `is_flagged` field in Supabase is set to `true`
And the flag is set atomically within the same `submit_issue_report` Postgres function (no extra API call)

**AC2 — Flagged pins list**
Given the admin is authenticated and the admin dashboard renders
When the flagged pins section loads
Then all pins with `is_flagged = true` AND `is_archived = false` are displayed in a list with: pin name, coordinates (lat/lng), flag count, most recent report type, and current badge state

**AC3 — Archive Pin**
Given the admin reviews a flagged pin
When they tap "Archive Pin"
Then `DELETE /api/pins/:id` is called with `Authorization: Bearer <token>`
And the pin's `is_archived` is set to `true` and `is_flagged` to `false` in Supabase (soft delete — not hard-deleted)
And the pin disappears from the flagged list
And the pin no longer appears on the public map (`getAllPins()` filters `is_archived = false`)

**AC4 — Override Badge — Mark Verified**
Given the admin reviews a flagged pin
When they tap "Override Badge — Mark Verified"
Then `PATCH /api/pins/:id/verify` is called with body `{ "action": "verify" }` and Bearer token
And `is_verified = true`, `is_flagged = false`, `badge_state = 'green'`, `last_check_in_at = NOW()`, `updated_at = NOW()` in Supabase
And the pin disappears from the flagged list

**AC5 — Dismiss Flag**
Given the admin reviews a flagged pin
When they tap "Dismiss Flag"
Then `PATCH /api/pins/:id/verify` is called with body `{ "action": "dismiss" }` and Bearer token
And `is_flagged = false`, `updated_at = NOW()` in Supabase (badge state unchanged)
And the pin disappears from the flagged list

**AC6 — Empty state**
Given there are no flagged pins
When the admin views the flag queue
Then the message "No flagged pins — map data is healthy" is displayed

## Tasks / Subtasks

- [x] Task 1: DB migration — add `is_archived` to `pins` (AC3)
  - [x] 1.1: Create `supabase/migrations/009_add_is_archived_to_pins.sql`
    - `ALTER TABLE pins ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false;`
    - `CREATE INDEX idx_pins_is_flagged ON pins (is_flagged) WHERE is_flagged = true;`
    - `CREATE INDEX idx_pins_is_archived ON pins (is_archived) WHERE is_archived = false;`

- [x] Task 2: DB migration — extend `submit_issue_report` for auto-flag (AC1)
  - [x] 2.1: Create `supabase/migrations/010_extend_submit_issue_report_autoflag.sql`
  - [x] 2.2: `CREATE OR REPLACE FUNCTION submit_issue_report(...)` — same signature as migration 008
  - [x] 2.3: After the existing INSERT + UPDATE, add:
    ```sql
    DECLARE
      v_report_count INTEGER;
    BEGIN
      -- (existing) insert report
      -- (existing) update badge_state = 'red'
      SELECT COUNT(*) INTO v_report_count
      FROM issue_reports
      WHERE pin_id = p_pin_id
        AND created_at >= NOW() - INTERVAL '48 hours';
      IF v_report_count >= 3 THEN
        UPDATE pins SET is_flagged = true, updated_at = NOW() WHERE id = p_pin_id;
      END IF;
    END;
    ```

- [x] Task 3: DB migration — create `get_flagged_pins()` RPC (AC2)
  - [x] 3.1: Create `supabase/migrations/011_add_get_flagged_pins_fn.sql`
  - [x] 3.2: Function returns TABLE(id, name, latitude, longitude, badge_state, flag_count, latest_report_type):
    ```sql
    CREATE OR REPLACE FUNCTION get_flagged_pins()
    RETURNS TABLE(
      id UUID, name TEXT, latitude DOUBLE PRECISION, longitude DOUBLE PRECISION,
      badge_state TEXT, flag_count BIGINT, latest_report_type TEXT
    )
    LANGUAGE sql SECURITY DEFINER AS $$
      SELECT
        p.id, p.name, p.latitude, p.longitude, p.badge_state,
        COUNT(ir.id) AS flag_count,
        (SELECT report_type FROM issue_reports
         WHERE pin_id = p.id ORDER BY created_at DESC LIMIT 1) AS latest_report_type
      FROM pins p
      LEFT JOIN issue_reports ir ON ir.pin_id = p.id
      WHERE p.is_flagged = true AND p.is_archived = false
      GROUP BY p.id;
    $$;
    ```

- [x] Task 4: Update `src/lib/supabase/types.ts` (AC3)
  - [x] 4.1: Add `is_archived: boolean` to `DbPin` interface

- [x] Task 5: Update `src/lib/supabase/pins.ts` (AC3)
  - [x] 5.1: Add `.eq('is_archived', false)` filter to `getAllPins()` query so archived pins never appear on the public map

- [x] Task 6: Create `api/admin/flagged-pins.ts` (AC2)
  - [x] 6.1: GET only — return 405 for non-GET
  - [x] 6.2: Call `requireAdminAuth(req, res)` — return false + auto-401 if invalid
  - [x] 6.3: `const supabase = createServiceClient()`
  - [x] 6.4: `const { data, error } = await supabase.rpc('get_flagged_pins')`
  - [x] 6.5: Return 200 with `data` (array of FlaggedPin objects)
  - [x] 6.6: Catch/handle error → 500

- [x] Task 7: Write `api/admin/flagged-pins.test.ts` (AC2, AC6)
  - [x] 7.1: Mock pattern: `vi.hoisted()` for `mockRequireAdminAuth` and `mockRpc`; mock `'../_middleware'` and `'./_supabase'`
  - [x] 7.2: Test 405 for non-GET
  - [x] 7.3: Test 401 when `requireAdminAuth` returns false
  - [x] 7.4: Test 200 with flagged pins data array from `mockRpc`
  - [x] 7.5: Test 500 when `mockRpc` returns error

- [x] Task 8: Create `api/pins/[id].ts` (AC3)
  - [x] 8.1: DELETE only — return 405 for non-DELETE
  - [x] 8.2: Call `requireAdminAuth(req, res)`
  - [x] 8.3: Extract `pinId = req.query.id` (string)
  - [x] 8.4: `supabase.from('pins').update({ is_archived: true, is_flagged: false, updated_at: new Date().toISOString() }).eq('id', pinId)`
  - [x] 8.5: Return 200 `{ ok: true }`

- [x] Task 9: Write `api/pins/[id].test.ts` (AC3)
  - [x] 9.1: `vi.hoisted()` for `mockRequireAdminAuth`, `mockUpdate`, `mockEq`; mock `'../_middleware'` and `'./_supabase'`
  - [x] 9.2: Test 405 for non-DELETE
  - [x] 9.3: Test 401 when unauthorized
  - [x] 9.4: Test 200 `{ ok: true }` on success — verify `.update()` called with `{ is_archived: true, is_flagged: false, ... }` and `.eq('id', pinId)`
  - [x] 9.5: Test 500 on Supabase error

- [x] Task 10: Create `api/pins/[id]/verify.ts` (AC4, AC5)
  - [x] 10.1: PATCH only — return 405 for non-PATCH
  - [x] 10.2: Call `requireAdminAuth(req, res)`
  - [x] 10.3: Extract `pinId = req.query.id`
  - [x] 10.4: Validate body: `z.object({ action: z.enum(['verify', 'dismiss']) })`; return 400 on invalid
  - [x] 10.5: If `action === 'verify'`:
    - `update({ is_verified: true, is_flagged: false, badge_state: 'green', last_check_in_at: new Date().toISOString(), updated_at: new Date().toISOString() })`
  - [x] 10.6: If `action === 'dismiss'`:
    - `update({ is_flagged: false, updated_at: new Date().toISOString() })`
  - [x] 10.7: Return 200 `{ ok: true }`

- [x] Task 11: Write `api/pins/[id]/verify.test.ts` (AC4, AC5)
  - [x] 11.1: Mock setup same pattern as Task 9
  - [x] 11.2: Test 405 for non-PATCH
  - [x] 11.3: Test 401 when unauthorized
  - [x] 11.4: Test 400 for invalid body (missing action, wrong action value)
  - [x] 11.5: Test 200 for `{ action: 'verify' }` — verify update includes `is_verified: true, badge_state: 'green', is_flagged: false`
  - [x] 11.6: Test 200 for `{ action: 'dismiss' }` — verify update only sets `is_flagged: false` (no badge change)
  - [x] 11.7: Test 500 on Supabase error

- [x] Task 12: Create `src/features/admin/FlaggedPinList.tsx` (AC2–AC6)
  - [x] 12.1: Props: `{ adminToken: string }`
  - [x] 12.2: Define local `FlaggedPin` interface:
    ```typescript
    interface FlaggedPin {
      id: string; name: string; latitude: number; longitude: number
      badge_state: string; flag_count: number; latest_report_type: string | null
    }
    ```
  - [x] 12.3: TanStack Query fetch:
    ```typescript
    const queryClient = useQueryClient()
    const { data: pins = [], isLoading } = useQuery({
      queryKey: ['admin', 'flagged-pins'],
      queryFn: async () => {
        const res = await fetch('/api/admin/flagged-pins', {
          headers: { Authorization: `Bearer ${adminToken}` }
        })
        if (!res.ok) throw new Error('Failed to fetch flagged pins')
        return res.json() as Promise<FlaggedPin[]>
      }
    })
    ```
  - [x] 12.4: Archive mutation (invalidates `['admin', 'flagged-pins']` on success)
  - [x] 12.5: Verify mutation (invalidates on success)
  - [x] 12.6: Dismiss mutation (invalidates on success)
  - [x] 12.7: Loading state: show "Loading flagged pins..."
  - [x] 12.8: Empty state: `<p>No flagged pins — map data is healthy</p>`
  - [x] 12.9: For each pin: show name, lat/lng, badge_state, flag_count, latest_report_type
  - [x] 12.10: Three action buttons per pin with `aria-label` and `min-h-[44px] min-w-[44px]` (NFR-A4):
    - "Archive Pin" → calls archive mutation
    - "Override Badge — Mark Verified" → calls verify mutation
    - "Dismiss Flag" → calls dismiss mutation
  - [x] 12.11: Disable action buttons while mutation is pending for that pin

- [x] Task 13: Write `src/features/admin/FlaggedPinList.test.tsx` (AC2–AC6)
  - [x] 13.1: Mock `fetch` via `vi.stubGlobal` per test; `vi.unstubAllGlobals()` in `afterEach`
  - [x] 13.2: Wrap renders in `QueryClientProvider` (same wrapper pattern as `useReportMutation.test.ts`)
  - [x] 13.3: Test: shows "Loading flagged pins..." while query is pending
  - [x] 13.4: Test: shows "No flagged pins — map data is healthy" when fetch returns `[]`
  - [x] 13.5: Test: renders pin name, badge state, flag count, and latest report type for each flagged pin
  - [x] 13.6: Test: clicking "Archive Pin" calls `DELETE /api/pins/:id` with correct Bearer header
  - [x] 13.7: Test: clicking "Override Badge — Mark Verified" calls `PATCH /api/pins/:id/verify` with `{ action: 'verify' }`
  - [x] 13.8: Test: clicking "Dismiss Flag" calls `PATCH /api/pins/:id/verify` with `{ action: 'dismiss' }`
  - [x] 13.9: Test: action buttons have `min-h-[44px]` (NFR-A4)

- [x] Task 14: Modify `src/features/admin/AdminDashboard.tsx` (AC2)
  - [x] 14.1: Import `FlaggedPinList` from `./FlaggedPinList`
  - [x] 14.2: Inside the authenticated admin panel (when `adminToken` is present), render `<FlaggedPinList adminToken={adminToken} />`
  - [x] 14.3: Ensure `adminToken` prop passed is the current session token (from sessionStorage via Story 5.1's state)

- [x] Task 15: Update `src/features/admin/AdminDashboard.test.tsx` (AC2)
  - [x] 15.1: Mock `FlaggedPinList` with `vi.mock('./FlaggedPinList', () => ({ default: () => <div data-testid="flagged-pin-list" /> }))`
  - [x] 15.2: Add test: when authenticated (sessionStorage has token), renders `<FlaggedPinList />`
  - [x] 15.3: Add test: `FlaggedPinList` receives `adminToken` prop equal to the stored session token

## Dev Notes

### CRITICAL: Story 5.1 Must Be Complete First

This story MODIFIES `AdminDashboard.tsx` that Story 5.1 creates. Before implementing Story 5.2, read `_bmad-output/implementation-artifacts/5-1-admin-authentication-gate.md` to understand:
- `AdminDashboard.tsx` structure: has `adminToken: string | null` state (from sessionStorage) — render `<FlaggedPinList adminToken={adminToken} />` inside the panel only when `adminToken !== null`
- `ADMIN_TOKEN_KEY` constant is a named export from `AdminAuth.tsx` — import it if needed in tests
- `AdminDashboard.test.tsx` already exists from Story 5.1 — ADD tests, do NOT recreate the file

### What Already Exists — Do NOT Recreate

- **`api/_middleware.ts`** — `requireAdminAuth(req, res): boolean` — import from `'../_middleware'`
- **`api/_supabase.ts`** — `createServiceClient()` — import from `'./_supabase'`
- **`api/admin/auth.ts`** — already exists (Story 5.1) — do NOT overwrite
- **`src/lib/supabase/client.ts`** — anon key browser client (not used in API handlers)
- **`src/lib/supabase/types.ts`** — `DbPin` interface — add `is_archived: boolean` to it
- **`src/lib/supabase/pins.ts`** — `getAllPins()` and `dbPinToPin()` — MODIFY `getAllPins()`, do NOT rewrite the file

### API File Structure (Vercel Dynamic Routes)

```
api/
  admin/
    auth.ts              ← Story 5.1 (DO NOT TOUCH)
    auth.test.ts         ← Story 5.1 (DO NOT TOUCH)
    flagged-pins.ts      ← NEW (Task 6)
    flagged-pins.test.ts ← NEW (Task 7)
  pins/
    [id].ts              ← NEW (Task 8) — DELETE /api/pins/:id
    [id].test.ts         ← NEW (Task 9)
    [id]/
      verify.ts          ← NEW (Task 10) — PATCH /api/pins/:id/verify
      verify.test.ts     ← NEW (Task 11)
```

In Vercel Node.js runtime: `req.query.id` gives the dynamic pin ID segment for both `[id].ts` and `[id]/verify.ts`.

### Mock Pattern for API Tests

All API tests follow the `vi.hoisted()` mock structure established in `api/admin/auth.test.ts` (Story 5.1) and `api/report.test.ts`:

```typescript
const { mockRequireAdminAuth } = vi.hoisted(() => {
  const mockRequireAdminAuth = vi.fn().mockReturnValue(true)
  return { mockRequireAdminAuth }
})
vi.mock('../_middleware', () => ({ requireAdminAuth: mockRequireAdminAuth }))

// For Supabase mocks — chain structure:
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

// For flagged-pins endpoint mock RPC:
const { mockRpc } = vi.hoisted(() => {
  const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null })
  return { mockRpc }
})
vi.mock('../_supabase', () => ({
  createServiceClient: vi.fn(() => ({ rpc: mockRpc })),
}))
```

### `FlaggedPinList.tsx` — TanStack Query + Mutation Pattern

- Query key: `['admin', 'flagged-pins']` — distinct from `['pins']` used by the public map
- Invalidate `['admin', 'flagged-pins']` (not `['pins']`) after each admin action — no need to invalidate the public map cache from the admin UI
- Wrap test renders with `QueryClientProvider` (see `useReportMutation.test.ts` for the `makeWrapper` + `freshClient` pattern)
- Mock `fetch` globally per test with `vi.stubGlobal`; call `vi.unstubAllGlobals()` in `afterEach`
- Use `act()` from `@testing-library/react` for async state updates triggered by mutation resolves

### Zod Validation in `api/pins/[id]/verify.ts`

Use the same Zod pattern as `api/report.ts`:
```typescript
import { z } from 'zod'
const ActionSchema = z.object({ action: z.enum(['verify', 'dismiss']) })
const parsed = ActionSchema.safeParse(req.body)
if (!parsed.success) return res.status(400).json({ error: 'INVALID_BODY', ... })
```

### `getAllPins()` Filter Change

Update the Supabase query in `src/lib/supabase/pins.ts`:
```typescript
// Before:
const { data, error } = await supabase.from('pins').select('*')
// After:
const { data, error } = await supabase.from('pins').select('*').eq('is_archived', false)
```
This ensures archived pins never appear on the public map. No change to `dbPinToPin()` needed — `is_archived` from DbPin does not need to be mapped to the `Pin` type (public-facing users never see archived status).

### Touch Target Rule (NFR-A4)

All interactive elements in `FlaggedPinList.tsx` must have `min-h-[44px]` and `min-w-[44px]`. The three action buttons per row must include these classes.

### Error Handling in `FlaggedPinList.tsx`

If the query fails (network error or 401), show an error message inline. Do not crash. Pattern:
```typescript
const { data: pins = [], isLoading, isError } = useQuery({ ... })
if (isError) return <p>Failed to load flagged pins. Check your connection.</p>
```

### Architecture: No Cross-Feature Imports

`FlaggedPinList.tsx` lives in `src/features/admin/`. It may import from `src/hooks/` if needed. It must NOT import from other feature directories (`map/`, `check-in/`, etc.).

### File Structure

New files this story creates:
```
supabase/migrations/
  009_add_is_archived_to_pins.sql
  010_extend_submit_issue_report_autoflag.sql
  011_add_get_flagged_pins_fn.sql

api/admin/
  flagged-pins.ts
  flagged-pins.test.ts

api/pins/
  [id].ts
  [id].test.ts
  [id]/
    verify.ts
    verify.test.ts

src/features/admin/
  FlaggedPinList.tsx      ← new
  FlaggedPinList.test.tsx ← new
  AdminDashboard.tsx      ← modify (add FlaggedPinList import + render)
  AdminDashboard.test.tsx ← modify (add FlaggedPinList tests)
```

Modified files:
```
src/lib/supabase/types.ts   ← add is_archived to DbPin
src/lib/supabase/pins.ts    ← filter is_archived=false in getAllPins()
```

### References

- Auto-flag threshold spec: `_bmad-output/planning-artifacts/epics.md` — Story 5.2 AC
- Admin API endpoints: `_bmad-output/planning-artifacts/architecture.md` — API Endpoints table
- Existing RPC pattern: `overnighter/supabase/migrations/008_add_submit_issue_report_fn.sql`
- `requireAdminAuth` usage pattern: `overnighter/api/_middleware.ts` + Story 5.1 `api/admin/auth.ts`
- TanStack Query mutation pattern: `overnighter/src/hooks/useReportMutation.ts`
- TanStack Query test wrapper: `overnighter/src/hooks/useReportMutation.test.ts` (`makeWrapper`, `freshClient`)
- API mock structure: `overnighter/api/report.test.ts` (`vi.hoisted` pattern)
- Story 5.1 (dependency): `_bmad-output/implementation-artifacts/5-1-admin-authentication-gate.md`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 15 tasks implemented and tested; 475 tests passing (26 new tests total, 0 regressions)
- Code review fixes: `req.query.id` array guard added to `[id].ts` and `verify.ts` (M1); `adminToken` added to `queryKey` in `FlaggedPinList.tsx` (M2); `isError` state test added (L1); button disabled-pending test added (L2); migration 010 count window anchored to `p_created_at` instead of `NOW()` (L3)
- `api/pins/[id].ts` and `api/pins/[id]/verify.ts` were stubs from prior story planning — replaced with full implementation
- `api/admin/flagged-pins.ts`: GET-only; calls `get_flagged_pins()` RPC via service client (AC2)
- `api/pins/[id].ts`: DELETE-only; soft-archives pin (`is_archived=true, is_flagged=false`) — no hard delete (AC3)
- `api/pins/[id]/verify.ts`: PATCH-only; Zod validates `{ action: 'verify'|'dismiss' }`; verify sets badge green+verified, dismiss only clears flag (AC4, AC5)
- `FlaggedPinList.tsx`: TanStack Query for data; 3 mutations (archive/verify/dismiss) each invalidate `['admin', 'flagged-pins']`; loading/error/empty states; NFR-A4 touch targets
- `AdminDashboard.tsx`: added `FlaggedPinList` import and render inside authenticated panel; `adminToken` passed as prop
- `AdminDashboard.test.tsx`: added `FlaggedPinList` mock (captures `adminToken` prop via `data-token`); 2 new tests (15.2, 15.3)
- Mock patterns: `vi.hoisted()` for all API tests; `vi.stubGlobal('fetch', ...)` for component tests; `makeWrapper`/`freshClient` for QueryClient

### File List

- `overnighter/supabase/migrations/009_add_is_archived_to_pins.sql` (new)
- `overnighter/supabase/migrations/010_extend_submit_issue_report_autoflag.sql` (new)
- `overnighter/supabase/migrations/011_add_get_flagged_pins_fn.sql` (new)
- `overnighter/src/lib/supabase/types.ts` (modified — added is_archived to DbPin)
- `overnighter/src/lib/supabase/pins.ts` (modified — .eq('is_archived', false) in getAllPins)
- `overnighter/api/admin/flagged-pins.ts` (new)
- `overnighter/api/admin/flagged-pins.test.ts` (new)
- `overnighter/api/pins/[id].ts` (modified — replaced stub with full archive implementation)
- `overnighter/api/pins/[id].test.ts` (new)
- `overnighter/api/pins/[id]/verify.ts` (modified — replaced stub with full verify/dismiss implementation)
- `overnighter/api/pins/[id]/verify.test.ts` (new)
- `overnighter/src/features/admin/FlaggedPinList.tsx` (new)
- `overnighter/src/features/admin/FlaggedPinList.test.tsx` (new)
- `overnighter/src/features/admin/AdminDashboard.tsx` (modified — added FlaggedPinList)
- `overnighter/src/features/admin/AdminDashboard.test.tsx` (modified — added FlaggedPinList mock + 2 tests)
