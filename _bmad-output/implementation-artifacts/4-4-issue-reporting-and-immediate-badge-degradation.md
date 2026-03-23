# Story 4.4: Issue Reporting & Immediate Badge Degradation

Status: done

## Story

As a user,
I want to report an issue on a spot directly from its pin detail view and see the badge immediately degrade to red,
So that other travelers are warned before driving to a problematic location.

## Acceptance Criteria

**AC1 — Issue report sheet opens with issue type options**
Given the pin detail sheet is open
When the user taps "Report an Issue"
Then an issue report sheet slides up with issue type options: "Dump station closed", "Water unavailable", "Overnight parking prohibited", "Access blocked", "Other"

**AC2 — Submit sends payload and badge degrades to red immediately**
Given the user selects an issue type and taps "Submit Report"
When the report is submitted to `POST /api/report`
Then the pin's recency badge immediately degrades to red on the user's device (optimistic update) (FR24)

**AC3 — Optimistic update in onMutate**
Given the issue report mutation fires
When `onMutate` executes
Then the TanStack Query `['pins']` cache is optimistically updated: the target pin's `badgeState` is set to `'red'` before the server responds

**AC4 — Query invalidation in onSettled**
Given the server responds to `POST /api/report`
When `onSettled` executes
Then the `['pins']` query is invalidated and refetched to confirm server badge state

**AC5 — No PII; free-text sanitized server-side**
Given the issue report is submitted
When the server writes the `issue_reports` row to Supabase
Then the row contains only: `pin_id`, `device_id`, `report_type`, `notes` (nullable), `created_at` — no PII (NFR-S2)
And any free-text note is sanitized server-side (HTML tags stripped) before storage (NFR-S4)

**AC6 — Retry 3x; actionable error on final failure + Sentry**
Given `POST /api/report` fails
When the mutation retries
Then it automatically retries up to 3 times (NFR-R2) — global QueryClient already sets `retry: 3`, do NOT override
And on final failure, an actionable inline error is shown and `Sentry.captureException(error)` is called (NFR-R4)

**AC7 — badge_state updated to 'red' on server**
Given the server processes the report
When `POST /api/report` succeeds
Then the pin's `badge_state` is set to `'red'` in Supabase and `updated_at` is refreshed (FR29)

**AC8 — 44×44px minimum touch targets**
Given the issue report sheet
When it renders on a mobile device
Then all issue type options and action buttons meet the 44×44px minimum touch target (NFR-A4)

## Tasks / Subtasks

- [x] Task 1: Update `issue_reports` report_type enum to match UI (AC5)
  - [x] 1.1: Create `supabase/migrations/007_update_issue_report_types.sql`:
    ```sql
    -- Drop existing check constraint and replace with UI-aligned enum values
    ALTER TABLE issue_reports DROP CONSTRAINT issue_reports_report_type_check;
    ALTER TABLE issue_reports ADD CONSTRAINT issue_reports_report_type_check
      CHECK (report_type IN ('dump_closed', 'water_unavailable', 'no_overnight', 'access_blocked', 'other'));
    ```
  - CRITICAL: Migration 003 defined `report_type IN ('closed', 'damaged', 'inaccurate', 'other')`.
    Without this migration update the API insert will fail with a constraint violation.
    Apply to Supabase before or alongside implementing the API.

- [x] Task 2: Implement `api/report.ts` (AC5, AC7)
  - [x] 2.1: Import `createServiceClient` from `./_supabase` and `z` from `zod`
  - [x] 2.2: Define Zod schema:
    ```typescript
    const ReportSchema = z.object({
      pinId: z.string().uuid(),
      deviceId: z.string().min(1),
      type: z.enum(['dump_closed', 'water_unavailable', 'no_overnight', 'access_blocked', 'other']),
      note: z.string().max(500).optional(),
      timestamp: z.string().datetime(),
    })
    ```
  - [x] 2.3: Return 405 for non-POST; return 400 with `INVALID_BODY` on Zod failure
  - [x] 2.4: Write sanitize function — same as checkin.ts: `text.replace(/<[^>]*>/g, '').trim()`
  - [x] 2.5: Insert into `issue_reports` table
  - [x] 2.6: Update `pins` table — set `badge_state = 'red'`, `updated_at = new Date().toISOString()` where `id = body.pinId`
  - [x] 2.7: Return `{ ok: true }` on success; catch all errors → 500 INTERNAL_ERROR

- [x] Task 3: Write `api/report.test.ts` (covers all AC5 + AC7 paths)
  - [x] 3.1: Set up `vi.hoisted()` — `mockInsert`, `mockUpdateEq`, `mockUpdate` exported; internal chain helpers stay inside
  - [x] 3.2: Mock `./_supabase` with `createServiceClient` returning `from()` by table name
  - [x] 3.3: Test 405 for GET method
  - [x] 3.4: Test 400 for missing required fields (missing `pinId`, missing `type`)
  - [x] 3.5: Test 400 for invalid `type` value not in enum
  - [x] 3.6: Test correct insert call — assert `mockInsert` called with `{ pin_id, device_id, report_type, created_at }`
  - [x] 3.7: Test HTML sanitization in note: `<b>Access blocked</b>` → `'Access blocked'`
  - [x] 3.8: Test 200 `{ ok: true }` on success
  - [x] 3.9: Test 500 when Supabase insert fails
  - [x] 3.10: Test 500 when pins.update fails

- [x] Task 4: Implement `src/hooks/useReportMutation.ts` (AC2, AC3, AC4, AC6)
  - [x] 4.1: Mirror `useCheckInMutation.ts` structure exactly — same imports, same optimistic pattern
  - [x] 4.2: Define `IssueReportType` and `ReportPayload`
  - [x] 4.3: `mutationFn`: POST to `/api/report` with timestamp; throw on non-ok
  - [x] 4.4: `onMutate`: cancel queries, snapshot, optimistically set `badgeState: 'red'`
  - [x] 4.5: `onError`: roll back to snapshot; `Sentry.captureException(error)`
  - [x] 4.6: `onSettled`: invalidate `['pins']`

- [x] Task 5: Write `src/hooks/useReportMutation.test.ts`
  - [x] 5.1: `QueryClientProvider` wrapper + `renderHook`
  - [x] 5.2: Mock `@sentry/react`
  - [x] 5.3: Mock `fetch` via `vi.stubGlobal`
  - [x] 5.4: Test optimistic badge → `'red'` captured inside fetch mock
  - [x] 5.5: Test rollback on fetch failure
  - [x] 5.6: Test Sentry called on failure
  - [x] 5.7: Test `invalidateQueries` called after success
  - [x] 5.8: Test `invalidateQueries` called after failure

- [x] Task 6: Implement `src/features/issue-report/IssueReportSheet.tsx` (AC1, AC2, AC6, AC8)
  - [x] 6.1: Props `{ pinId: string; onClose: () => void }`
  - [x] 6.2: `usePinsQuery({ enabled: false })` for pin name from cache
  - [x] 6.3: `useDeviceId` from `@/hooks/useDeviceId`
  - [x] 6.4: `useReportMutation` from `@/hooks/useReportMutation`
  - [x] 6.5: `ISSUE_OPTIONS` array with 5 types
  - [x] 6.6: `role="dialog"` `aria-modal="true"` wrapper with backdrop (z-40) and card (z-50)
  - [x] 6.7: Issue type chips with `aria-pressed` and `min-h-[44px]`
  - [x] 6.8: Submit button — disabled until type selected; spinner on `isPending`
  - [x] 6.9: Close button with `aria-label="Close issue report form"` and `min-h-[44px]`
  - [x] 6.10: On submit: `mutate` with `onSuccess: () => onClose()`, `onError: () => setErrorMsg(...)`
  - [x] 6.11: Optional note textarea with `aria-label="Optional note"` (max 500 chars)
  - [x] 6.12: `{errorMsg && <p role="alert">{errorMsg}</p>}`

- [x] Task 7: Write `src/features/issue-report/IssueReportSheet.test.tsx`
  - [x] 7.1: `vi.hoisted()` for `mockMutate` + `getCallbacks()` closure
  - [x] 7.2: Mock `@/hooks/useReportMutation`, `@/hooks/usePinsQuery`, `@/hooks/useDeviceId`
  - [x] 7.3: Test renders all 5 issue type chips (8.1)
  - [x] 7.4: Test submit button disabled when no type selected (8.2)
  - [x] 7.5: Test submit button enabled after selecting a type (8.3)
  - [x] 7.6: Test `aria-pressed` toggles correctly on chip click (8.4)
  - [x] 7.7: Test optional note textarea accepts input (8.5)
  - [x] 7.8: Test submit calls mutate with correct `{ pinId, deviceId, type }` (8.6)
  - [x] 7.9: Test `role="alert"` error message shown when `onError` fires — wrapped in `act()` (8.7)
  - [x] 7.10: Test `onClose` called when `onSuccess` fires — wrapped in `act()` (8.8)
  - [x] 7.11: Test close button calls `onClose` (8.9)
  - [x] 7.12: Test `role="dialog"` with `aria-modal="true"` (8.10)

- [x] Task 8: Add "Report an Issue" button to `PinDetailSheet.tsx` and wire to `uiStore` (AC1)
  - [x] 8.1: Add `pendingReport` + `setPendingReport` to `uiStore.ts`
  - [x] 8.2: Add "Report an Issue" button to `PinDetailSheet.tsx` — calls `useUIStore.getState().setPendingReport({ pinId: pin.id })`
  - [x] 8.3: Add 2 tests to `PinDetailSheet.test.tsx` — renders button; clicking sets `pendingReport` in uiStore

- [x] Task 9: Mount `IssueReportSheet` lazily in `App.tsx` (AC1, AC2)
  - [x] 9.1: `lazy(() => import('@/features/issue-report/IssueReportSheet'))` + conditional `{pendingReport && <Suspense>...}`
  - [x] 9.2: Add 3 tests to `App.test.tsx` — not rendered when null; rendered when set; correct pinId prop

## Dev Notes

### Architecture Constraints (MUST FOLLOW)

- **No cross-feature imports**: `PinDetailSheet.tsx` (features/pin-detail) MUST NOT import `IssueReportSheet.tsx` (features/issue-report). Coordination goes through `uiStore.pendingReport`.
- **uiStore pattern**: This is identical to how `pendingCheckIn` works for `CheckInForm`. Copy that exact pattern.
- **Retry**: Global `mutations: { retry: 3 }` already configured in QueryClient (`src/main.tsx` or `App.tsx`). Do NOT add `retry` to `useReportMutation`.
- **Sentry**: Already initialized in `main.tsx`. Import as `import * as Sentry from '@sentry/react'`.
- **No toast library**: No `sonner` or similar in `package.json`. Use inline `role="alert"` paragraph — same as `CheckInForm`.
- **Process.env for serverless**: Serverless functions use `process.env.SUPABASE_SERVICE_ROLE_KEY` not `import.meta.env`.

### report_type Enum Mismatch (CRITICAL)

Migration 003 defined `report_type IN ('closed', 'damaged', 'inaccurate', 'other')`. This **does not match** the epic's UI options. Migration 007 MUST be applied before testing the API.

DB enum values (post-007):
```
'dump_closed' | 'water_unavailable' | 'no_overnight' | 'access_blocked' | 'other'
```

Zod schema and TypeScript type must use these same values.

### Supabase columns — issue_reports table (from migration 003)

```
id UUID PK
pin_id UUID FK → pins(id) ON DELETE CASCADE
device_id TEXT NOT NULL  -- anonymous UUID only
report_type TEXT NOT NULL  -- constrained by enum (007 migration)
notes TEXT  -- nullable; sanitize if present
status TEXT DEFAULT 'open'  -- 'open' | 'closed'; admin-managed
created_at TIMESTAMPTZ DEFAULT NOW()
resolved_at TIMESTAMPTZ  -- nullable; set by admin
```

API should write: `pin_id`, `device_id`, `report_type`, `notes`, `created_at` only.
`status` defaults to `'open'`. `resolved_at` is null. `id` is auto-generated.

### Supabase columns — pins table (badge update)

Update these two columns:
- `badge_state = 'red'`
- `updated_at = new Date().toISOString()`

### api/report.ts Structure (mirror api/checkin.ts exactly)

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { createServiceClient } from './_supabase'

const ReportSchema = z.object({
  pinId: z.string().uuid(),
  deviceId: z.string().min(1),
  type: z.enum(['dump_closed', 'water_unavailable', 'no_overnight', 'access_blocked', 'other']),
  note: z.string().max(500).optional(),
  timestamp: z.string().datetime(),
})

function sanitize(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim()
}
```

### Optimistic Update Pattern (must match useCheckInMutation exactly)

```typescript
onMutate: async (payload) => {
  await queryClient.cancelQueries({ queryKey: ['pins'] })
  const snapshot = queryClient.getQueryData<Pin[]>(['pins'])
  queryClient.setQueryData<Pin[]>(['pins'], (old = []) =>
    old.map((pin) =>
      pin.id === payload.pinId ? { ...pin, badgeState: 'red' } : pin,
    ),
  )
  return { snapshot }
},
onError: (error, _payload, context) => {
  if (context?.snapshot) queryClient.setQueryData(['pins'], context.snapshot)
  Sentry.captureException(error)
},
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ['pins'] })
},
```

### IssueReportSheet Component Pattern (mirror CheckInForm.tsx exactly)

```tsx
// Wrap in role="dialog" aria-modal="true" z-50 card + z-40 backdrop
// Close button: aria-label="Close issue report form" min-h-[44px]
// Each chip: <button aria-pressed={selected === value} className="min-h-[44px]">
// Submit: disabled when !selectedType || isPending
// Error: {errorMsg && <p role="alert">{errorMsg}</p>}
// No toast library — only inline role="alert"
```

### Test Patterns from Story 4.3 (apply to ALL tests here)

1. **`vi.hoisted()`**: All mocks that must be defined before module imports go in `vi.hoisted()`. Only export mocks you assert on — keep internal chain helpers (like `mockTypeEq`) inside the block.
2. **`act()` for callbacks**: Any state update triggered by `onSuccess`/`onError` callbacks MUST be wrapped: `act(() => { onSuccess?.() })` — else React state won't update and assertions fail.
3. **`useCheckInMutation.test.ts` pattern for `renderHook`**: Use a custom `wrapper` with `QueryClientProvider` and a `new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })` — set retry: false in test client to prevent infinite retries.

### Existing Files to Modify

| File | Change |
|---|---|
| `src/store/uiStore.ts` | Add `pendingReport` + `setPendingReport` |
| `src/features/pin-detail/PinDetailSheet.tsx` | Add "Report an Issue" button |
| `src/features/pin-detail/PinDetailSheet.test.tsx` | Add test for "Report an Issue" button |
| `src/App.tsx` | Add `IssueReportSheet` lazy import + conditional mount |
| `src/App.test.tsx` | Add 3 mount verification tests |

### New Files to Create

| File | Purpose |
|---|---|
| `supabase/migrations/007_update_issue_report_types.sql` | Fix report_type enum |
| `api/report.ts` | Full serverless implementation (replaces stub) |
| `api/report.test.ts` | 10 tests for API endpoint |
| `src/hooks/useReportMutation.ts` | TanStack Query mutation hook |
| `src/hooks/useReportMutation.test.ts` | 5 tests |
| `src/features/issue-report/IssueReportSheet.tsx` | Bottom sheet component |
| `src/features/issue-report/IssueReportSheet.test.tsx` | 10 tests |

### Project Structure Notes

- `src/features/issue-report/` directory already exists (empty) — write files there
- `api/report.ts` already exists as a stub — replace its implementation entirely
- `src/lib/supabase/types.ts` already has `DbIssueReport` — no change needed
- Test files co-located with source files (never `__tests__/` subdirectory)

### References

- `useCheckInMutation.ts` — exact pattern to mirror for `useReportMutation.ts`
- `CheckInForm.tsx` — exact pattern to mirror for `IssueReportSheet.tsx`
- `CheckInForm.test.tsx` — exact pattern to mirror for `IssueReportSheet.test.tsx`
- `api/checkin.ts` — exact pattern to mirror for `api/report.ts`
- `api/checkin.test.ts` — exact pattern to mirror for `api/report.test.ts`
- `src/store/uiStore.ts` — `pendingCheckIn` pattern to replicate as `pendingReport`
- `src/App.tsx` — `CheckInForm` lazy mount pattern to replicate for `IssueReportSheet`
- Migration 003 (`supabase/migrations/003_create_issue_reports.sql`) — original table; migration 007 fixes enum
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Component Boundaries]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.4]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Implemented migration 007 to fix report_type enum mismatch from migration 003 (critical blocker identified in create-story)
- Implemented api/report.ts — full Zod validation, sanitize(), insert issue_reports, update pins badge_state to 'red'
- 10 API tests in api/report.test.ts — all paths covered including insert failure and pins.update failure
- useReportMutation.ts mirrors useCheckInMutation.ts exactly — optimistic 'red' degradation, rollback on error, Sentry, invalidation
- 5 hook tests in useReportMutation.test.ts — optimistic update, rollback, Sentry, invalidation (both success and failure paths)
- IssueReportSheet.tsx mirrors CheckInForm.tsx — 5 issue type chips, role="dialog" aria-modal, min-h-[44px] touch targets, inline role="alert" error
- 10 component tests in IssueReportSheet.test.tsx — vi.hoisted() + act() patterns from 4.3
- uiStore.ts extended with pendingReport/setPendingReport fields
- PinDetailSheet.tsx: "Report an Issue" button added; sets pendingReport via useUIStore.getState() (no cross-feature import)
- PinDetailSheet.test.tsx: 2 new tests for Report an Issue button
- App.tsx: IssueReportSheet lazy-loaded, mounted when pendingReport set — mirrors CheckInForm pattern
- App.test.tsx: 3 new IssueReportSheet mount tests
- Final: 428 tests passing, 0 regressions (was 398 before story 4.4; +30 new tests)

### File List

- `supabase/migrations/007_update_issue_report_types.sql` (new)
- `api/report.ts` (modified — full implementation replaces stub)
- `api/report.test.ts` (new)
- `src/hooks/useReportMutation.ts` (new)
- `src/hooks/useReportMutation.test.ts` (new)
- `src/features/issue-report/IssueReportSheet.tsx` (new)
- `src/features/issue-report/IssueReportSheet.test.tsx` (new)
- `src/features/pin-detail/PinDetailSheet.tsx` (modified)
- `src/features/pin-detail/PinDetailSheet.test.tsx` (modified)
- `src/store/uiStore.ts` (modified)
- `src/App.tsx` (modified)
- `src/App.test.tsx` (modified)
- `_bmad-output/implementation-artifacts/4-4-issue-reporting-and-immediate-badge-degradation.md` (this file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
