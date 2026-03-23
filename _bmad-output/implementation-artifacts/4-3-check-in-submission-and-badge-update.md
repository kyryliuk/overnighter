# Story 4.3: Check-In Submission & Badge Update

Status: done

## Story

As a user,
I want to submit a 3-tap check-in confirming a spot's current status with an optional note, and see the freshness badge update immediately,
So that my contribution takes effect instantly and the next traveler benefits within seconds.

## Acceptance Criteria

**AC1 — Three status chips displayed**
Given the check-in form is open
When the user views the status selector
Then three status options are displayed as tappable chips: "Still Open", "Closed", "Changed"

**AC2 — Submit sends correct payload and badge turns green immediately**
Given the user selects a status
When they tap "Submit Check-In"
Then the check-in is submitted to `POST /api/checkin` with `{ pinId, deviceId, status, note?, timestamp }`
And the pin's recency badge updates to green immediately on the user's device (optimistic update via TanStack Query)

**AC3 — Optimistic update in onMutate**
Given the check-in mutation fires
When `onMutate` executes
Then the TanStack Query `['pins']` cache is optimistically updated: the target pin's `badgeState` is set to `'green'` and `lastCheckInAt` is set to the current ISO timestamp — before the server responds (FR20)

**AC4 — Query invalidation in onSettled**
Given the server responds successfully to `POST /api/checkin`
When `onSettled` executes
Then the `['pins']` query is invalidated and refetched to confirm server truth

**AC5 — Optional note field**
Given the check-in form is open
When the user adds an optional text note (e.g., "Fee is now $12")
Then the note is included in the submission payload
And the note field is never required — the form submits without it (FR27)

**AC6 — Server sanitizes note for XSS**
Given the check-in is submitted with a note
When the server writes the `check_ins` row to Supabase
Then the note is stripped of HTML tags server-side before storage to prevent XSS injection (NFR-S4)

**AC7 — Retry 3x, toast on final failure**
Given `POST /api/checkin` fails
When the mutation retries
Then it automatically retries up to 3 times with exponential backoff (NFR-R2)
And on all 3 failures, a user-facing toast is shown: "Couldn't save check-in. Tap to retry."

**AC8 — Sentry logging on final failure**
Given all 3 retry attempts fail
When the final failure occurs
Then `Sentry.captureException(error)` is called client-side — no data is silently lost (NFR-R4)

**AC9 — 500ms to optimistic badge update**
Given the check-in submission completes (success or failure)
When measured from tap to optimistic badge update
Then the badge update appears within 500ms (NFR-P4)
(Optimistic update fires in `onMutate` synchronously — achievable without any real latency)

**AC10 — No PII in check_ins row**
Given the check-in is recorded in Supabase
When the `check_ins` row is written
Then it contains only: `pin_id`, `device_id` (anonymous UUID), `status`, `notes` (nullable), `checked_in_at` — no PII (NFR-S2)

## Tasks / Subtasks

- [x] Task 1: Add `status` column to `check_ins` table (AC10)
  - [x] 1.1: Create `supabase/migrations/006_add_status_to_check_ins.sql`:
    ```sql
    ALTER TABLE check_ins
    ADD COLUMN status TEXT NOT NULL DEFAULT 'still_open'
      CHECK (status IN ('still_open', 'closed', 'changed'));
    ```
  - [x] 1.2: Update `DbCheckIn` in `src/lib/supabase/types.ts` — add `status: string` field
  - CRITICAL: The existing `check_ins` table (migration 002) has NO `status` column. Without this migration, the API insert will fail. Apply migration to Supabase before or alongside implementing the API.

- [x] Task 2: Implement `api/checkin.ts` (AC2, AC6, AC10)
  - [x] 2.1: Import `createServiceClient` from `./_supabase` and `z` from `zod`
  - [x] 2.2: Define Zod schema for request body:
    ```typescript
    const CheckInSchema = z.object({
      pinId: z.string().uuid(),
      deviceId: z.string().min(1),
      status: z.enum(['still_open', 'closed', 'changed']),
      note: z.string().max(500).optional(),
      timestamp: z.string().datetime(),
    })
    ```
  - [x] 2.3: Validate body — return 400 `{ error: 'INVALID_BODY', message: '...', status: 400 }` on failure
  - [x] 2.4: Sanitize note server-side (strip HTML tags) if provided:
    ```typescript
    function sanitize(text: string): string {
      return text.replace(/<[^>]*>/g, '').trim()
    }
    ```
  - [x] 2.5: Insert into `check_ins` table via `createServiceClient()`:
    ```typescript
    const { error: insertError } = await supabase.from('check_ins').insert({
      pin_id: body.pinId,
      device_id: body.deviceId,
      status: body.status,
      notes: body.note ? sanitize(body.note) : null,
      checked_in_at: body.timestamp,
    })
    ```
  - [x] 2.6: Recalculate `recent_check_in_count` (count of check_ins for this pin in the last 30 days):
    ```typescript
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('check_ins')
      .select('*', { count: 'exact', head: true })
      .eq('pin_id', body.pinId)
      .gte('checked_in_at', thirtyDaysAgo)
    ```
  - [x] 2.7: Update `pins` row — badge_state, last_check_in_at, recent_check_in_count:
    ```typescript
    await supabase.from('pins').update({
      badge_state: 'green',
      last_check_in_at: body.timestamp,
      recent_check_in_count: count ?? 0,
      updated_at: new Date().toISOString(),
    }).eq('id', body.pinId)
    ```
  - [x] 2.8: Return `res.status(200).json({ ok: true })`
  - [x] 2.9: Wrap all logic in try/catch — return 500 `{ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 }` on unhandled exception
  - CRITICAL: `api/checkin.ts` currently contains a stub with a TODO comment. Replace the TODO block entirely. Keep the method check (`req.method !== 'POST'`).
  - CRITICAL: Use `process.env` (NOT `import.meta.env`) in api/ serverless functions.

- [x] Task 3: Create `api/checkin.test.ts` (AC2, AC6, AC10)
  - [x] 3.1: Mock `createServiceClient` using `vi.mock('./_supabase', ...)`
  - [x] 3.2: Test — returns 405 for non-POST methods
  - [x] 3.3: Test — returns 400 for missing required fields (pinId, status)
  - [x] 3.4: Test — returns 400 for invalid status value (not in enum)
  - [x] 3.5: Test — inserts check_in row with correct fields (pinId, deviceId, status, sanitized note)
  - [x] 3.6: Test — sanitizes HTML tags in note field
  - [x] 3.7: Test — returns 200 `{ ok: true }` on success
  - [x] 3.8: Test — returns 500 when Supabase insert fails

- [x] Task 4: Create `src/hooks/useCheckInMutation.ts` (AC2, AC3, AC4, AC7, AC8)
  - [x] 4.1: Import `useMutation`, `useQueryClient` from `@tanstack/react-query`; `type Pin` from `@/types/pin`; `* as Sentry` from `@sentry/react`
  - [x] 4.2: Define payload type:
    ```typescript
    export type CheckInStatus = 'still_open' | 'closed' | 'changed'

    export interface CheckInPayload {
      pinId: string
      deviceId: string
      status: CheckInStatus
      note?: string
    }
    ```
  - [x] 4.3: Implement `mutationFn` — POST to `/api/checkin`:
    ```typescript
    mutationFn: async (payload: CheckInPayload) => {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, timestamp: new Date().toISOString() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? `Check-in failed: ${res.status}`)
      }
    },
    ```
  - [x] 4.4: Implement `onMutate` — optimistic update (AC3):
    ```typescript
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['pins'] })
      const snapshot = queryClient.getQueryData<Pin[]>(['pins'])
      queryClient.setQueryData<Pin[]>(['pins'], (old = []) =>
        old.map((pin) =>
          pin.id === payload.pinId
            ? { ...pin, badgeState: 'green', lastCheckInAt: new Date().toISOString() }
            : pin,
        ),
      )
      return { snapshot }
    },
    ```
  - [x] 4.5: Implement `onError` — rollback + Sentry (AC8):
    ```typescript
    onError: (error, _payload, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(['pins'], context.snapshot)
      }
      Sentry.captureException(error)
    },
    ```
  - [x] 4.6: Implement `onSettled` — invalidate (AC4):
    ```typescript
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pins'] })
    },
    ```
  - [x] 4.7: Export `export function useCheckInMutation() { return useMutation({ ... }) }`
  - CRITICAL: `App.tsx` already sets `mutations: { retry: 3 }` as the global QueryClient default. Do NOT override retry count on the mutation instance — it inherits from the global config (NFR-R2 is already covered).
  - CRITICAL: The `onError` toast (AC7) is NOT in `useCheckInMutation` — it goes in `CheckInForm` (see Task 5). Hooks should be pure data logic without UI side effects.

- [x] Task 5: Create `src/hooks/useCheckInMutation.test.ts` (AC3, AC4, AC7, AC8)
  - [x] 5.1: Wrap each test in `QueryClientProvider` with a fresh `QueryClient`
  - [x] 5.2: Mock `fetch` with `vi.stubGlobal('fetch', vi.fn())`; restore in `afterEach`
  - [x] 5.3: Mock `@sentry/react` with `vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))`
  - [x] 5.4: Test — `onMutate` sets target pin's `badgeState` to `'green'` in cache before fetch resolves
  - [x] 5.5: Test — `onError` rolls back the cache to the snapshot when fetch rejects
  - [x] 5.6: Test — `onError` calls `Sentry.captureException` with the error
  - [x] 5.7: Test — `onSettled` invalidates `['pins']` query after success
  - [x] 5.8: Test — `onSettled` invalidates `['pins']` query after failure

- [x] Task 6: Create `src/features/check-in/CheckInForm.tsx` (AC1, AC2, AC5, AC7)
  - [x] 6.1: Component props:
    ```typescript
    interface CheckInFormProps {
      pinId: string
      onClose: () => void
    }
    ```
  - [x] 6.2: Read pin name from TanStack Query cache (no new network request):
    ```typescript
    const { data: pins = [] } = usePinsQuery({ enabled: false })
    const pin = pins.find((p) => p.id === pinId)
    ```
  - [x] 6.3: State: `status: CheckInStatus | null` (null = nothing selected yet), `note: string`, `errorMsg: string | null`
  - [x] 6.4: Get `deviceId` from `useDeviceId()`
  - [x] 6.5: Wire up `useCheckInMutation`; on submit: call `mutate({ pinId, deviceId, status, note: note || undefined })`
  - [x] 6.6: On `onSuccess` callback (in `mutate(payload, { onSuccess })` call): call `onClose()`
  - [x] 6.7: On `onError` callback: set `errorMsg` to "Couldn't save check-in. Tap to retry." (AC7)
  - [x] 6.8: Render — three status chips (AC1):
    ```tsx
    const STATUS_OPTIONS: Array<{ value: CheckInStatus; label: string }> = [
      { value: 'still_open', label: 'Still Open' },
      { value: 'closed', label: 'Closed' },
      { value: 'changed', label: 'Changed' },
    ]
    ```
    Each chip: `<button type="button" ... aria-pressed={status === opt.value}>` with distinct active/inactive styles
  - [x] 6.9: Render — optional note textarea (AC5): `<textarea ... value={note} onChange={...} placeholder="Optional note (e.g. fee change)" maxLength={500} />`
  - [x] 6.10: Render — submit button disabled if `status === null` or `mutation.isPending`
  - [x] 6.11: Render — error message below submit button when `errorMsg` is set:
    ```tsx
    {errorMsg && <p role="alert" className="text-sm text-red-500 text-center">{errorMsg}</p>}
    ```
  - [x] 6.12: Render structure — same overlay pattern as DeparturePrompt:
    - Backdrop: `<div className="fixed inset-0 bg-black/50 z-40" aria-hidden="true" />`
    - Card: `role="dialog"` `aria-modal="true"` `aria-label="Check-in form"` `className="fixed bottom-0 left-0 right-0 z-50 ..."`
    - Close button top-right: `aria-label="Close check-in form"` calls `onClose()`
  - CRITICAL: `onClose` is called by the CheckInForm on success (see 6.6) AND on close button click. The PARENT (App.tsx) clears `pendingCheckIn` from UIStore. Do NOT call `setPendingCheckIn` inside `CheckInForm` — pass it as a prop via `onClose`.
  - CRITICAL: All interactive elements must meet 44×44px touch target (NFR-A4): chips, submit, close, textarea.

- [x] Task 7: Create `src/features/check-in/CheckInForm.test.tsx` (AC1, AC5, AC7)
  - [x] 7.1: Mock `useCheckInMutation` with `vi.mock('@/hooks/useCheckInMutation', ...)`
  - [x] 7.2: Mock `usePinsQuery` to return a stub pin with a known name
  - [x] 7.3: Mock `useDeviceId` to return a stub UUID
  - [x] 7.4: Test — renders all three status chips: "Still Open", "Closed", "Changed"
  - [x] 7.5: Test — submit button is disabled when no status selected
  - [x] 7.6: Test — submit button is enabled after selecting a status
  - [x] 7.7: Test — clicking a chip sets `aria-pressed="true"` on that chip
  - [x] 7.8: Test — optional note textarea is present and accepts input
  - [x] 7.9: Test — submitting calls `mutate` with correct `{ pinId, deviceId, status }`
  - [x] 7.10: Test — submitting with note includes note in payload
  - [x] 7.11: Test — error message shown with `role="alert"` when mutation fails (simulate `onError` callback)
  - [x] 7.12: Test — `onClose` prop is called when close button is clicked
  - [x] 7.13: Test — `role="dialog"` with `aria-modal="true"`

- [x] Task 8: Mount `CheckInForm` in `src/App.tsx` and clear `pendingCheckIn` on close (AC2)
  - [x] 8.1: Read `pendingCheckIn` and `setPendingCheckIn` from `useUIStore`:
    ```typescript
    const pendingCheckIn = useUIStore((state) => state.pendingCheckIn)
    const setPendingCheckIn = useUIStore((state) => state.setPendingCheckIn)
    ```
  - [x] 8.2: Import `CheckInForm` (lazy-load to keep main bundle lean):
    ```typescript
    const CheckInForm = lazy(() => import('@/features/check-in/CheckInForm'))
    ```
  - [x] 8.3: Render in `App()` return — outside the `<Routes>` block but inside `<QueryClientProvider>`:
    ```tsx
    {pendingCheckIn && (
      <Suspense fallback={null}>
        <CheckInForm
          pinId={pendingCheckIn.pinId}
          onClose={() => setPendingCheckIn(null)}
        />
      </Suspense>
    )}
    ```
  - CRITICAL: `CheckInForm` is in `src/features/check-in/` — a different feature from `src/features/map/`. Mounting it in `App.tsx` avoids any cross-feature import. `App.tsx` is the application root (not a feature module), so it is permitted to import from any feature.
  - CRITICAL: `useUIStore` must be called inside `export default function App()` — not at module level.
  - CRITICAL: Read `App.tsx` fully before editing. Current structure:
    - `queryClient` defined at module level
    - `App()` calls `useDeviceId()`
    - Returns `<QueryClientProvider>` wrapping `<BrowserRouter>` and `<ReactQueryDevtools />`

- [x] Task 9: Update `src/App.test.tsx` to verify `CheckInForm` integration (AC2)
  - [x] 9.1: Mock `@/features/check-in/CheckInForm` with `vi.mock(...)`
  - [x] 9.2: Test — `CheckInForm` is NOT rendered when `pendingCheckIn` is null
  - [x] 9.3: Test — `CheckInForm` IS rendered when `pendingCheckIn` is `{ pinId: 'p1' }`
  - [x] 9.4: Test — `CheckInForm` receives correct `pinId` prop

## Dev Notes

### Critical: Architecture pattern — cross-feature import prohibition

Features must NOT import from other features. `MapView` is in `features/map/` — it cannot import `CheckInForm` from `features/check-in/`. The solution is to mount `CheckInForm` in `App.tsx` (the application root), which is allowed to import from any feature. `CheckInForm` reads `pendingCheckIn` indirectly (via props from `App.tsx`, not by subscribing to UIStore itself — though UIStore subscription inside `CheckInForm` would also be acceptable since UIStore is in `src/store/`, not another feature).

### Critical: `pendingCheckIn` trigger from Story 4.2

`pendingCheckIn: { pinId: string } | null` in `useUIStore` is set by `handleDepartureCheckIn` in `MapView.tsx` (Story 4.2 work). This field is the ONLY mechanism Story 4.3 uses to detect that the form should open. When set, `App.tsx` renders `CheckInForm`. When `onClose` is called (success or user close), `setPendingCheckIn(null)` clears the trigger.

### Critical: `check_ins` table schema gap — migration required

The current `check_ins` schema (migration 002) has NO `status` column:
```sql
-- Current (insufficient):
CREATE TABLE check_ins (
  id UUID, pin_id UUID, device_id TEXT, checked_in_at TIMESTAMPTZ, notes TEXT
)
```

Migration 006 adds the required `status` column. This migration MUST be applied to Supabase before the API can accept check-ins. Apply via Supabase dashboard SQL editor or `supabase db push`.

`DbCheckIn` in `src/lib/supabase/types.ts` must also be updated — add `status: string`.

### Critical: Optimistic update targets `['pins']` query key

The TanStack Query key for all pins is `['pins']` (see `usePinsQuery.ts`). The optimistic update in `onMutate` must use this exact key:
```typescript
queryClient.getQueryData<Pin[]>(['pins'])
queryClient.setQueryData<Pin[]>(['pins'], ...)
queryClient.invalidateQueries({ queryKey: ['pins'] })
```

### Critical: Global retry = 3 already set in App.tsx

`App.tsx` configures the QueryClient with `mutations: { retry: 3 }` globally. Do NOT add `retry: 3` to the `useMutation` call — it would be redundant and could create confusion.

### Critical: Sentry is already initialized in main.tsx

`@sentry/react` is initialized in `src/main.tsx` with `Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, enabled: import.meta.env.PROD })`. In dev mode (`PROD = false`), Sentry is a no-op. Use `Sentry.captureException(error)` directly in `onError` — no need to check `import.meta.env.PROD` manually.

### Critical: No toast library installed — use inline error in form

No `sonner` or other toast library is in `package.json`. Do NOT install a new package for the error notification. Implement AC7's "toast" as an inline error message within `CheckInForm` using a `role="alert"` paragraph (same pattern as the geo error in `MapView.tsx`). The epic says "user-facing toast" — an inline alert meets this intent without new dependencies.

### Critical: API uses `process.env`, client uses `import.meta.env`

In `api/checkin.ts` (Vercel serverless function): use `process.env.VITE_SUPABASE_URL` etc.
In `src/` client code: use `import.meta.env.VITE_SUPABASE_URL` etc.
Never mix. See `api/_supabase.ts` for the correct server-side pattern.

### Critical: Status values — UI labels vs DB values

| UI Label | DB/API value |
|---|---|
| "Still Open" | `'still_open'` |
| "Closed" | `'closed'` |
| "Changed" | `'changed'` |

The `CheckInStatus` TypeScript type, the Zod enum in `api/checkin.ts`, and the SQL `CHECK` constraint must all agree on these three values.

### Critical: `usePinsQuery({ enabled: false })` in CheckInForm

`CheckInForm` reads the pin name from the TanStack Query cache without triggering a network request. `enabled: false` prevents a new fetch but still allows reading cached data via `queryClient.getQueryData` pattern. Since `usePinsQuery` is already called in `MapView.tsx` with `enabled: true`, the cache should be populated. If cache is empty (e.g., deep-link scenario), `pin` will be `undefined` — render "this spot" as a fallback name.

### Critical: `CheckInForm` isolation — no UIStore subscription inside the component

The `CheckInForm` component receives `pinId` and `onClose` as props. It does NOT subscribe to `useUIStore` or `useCheckInPromptStore`. Dependency injection via props keeps it testable without mocking stores.

### z-index layering (reference)

- Map overlay controls: `z-10`
- PinDetailSheet backdrop: `z-20`, card: `z-30`
- DeparturePrompt backdrop: `z-40`, card: `z-50`
- CheckInForm backdrop: `z-40`, card: `z-50` (same level — only one overlay shows at a time)

### CheckInForm rendering in App.tsx — placement

The `CheckInForm` renders inside `<QueryClientProvider>` and inside `<Suspense>`. The Suspense fallback is `null` (no spinner for the lazy-loaded check-in form) — it renders instantly from cache after first load.

```tsx
// App.tsx return — add AFTER the <BrowserRouter>...</BrowserRouter> block:
{pendingCheckIn && (
  <Suspense fallback={null}>
    <CheckInForm
      pinId={pendingCheckIn.pinId}
      onClose={() => setPendingCheckIn(null)}
    />
  </Suspense>
)}
```

### Testing: `useCheckInMutation` mutation context type

TanStack Query v5 `useMutation` context type requires generic annotation to get typed context in `onError`:
```typescript
useMutation<void, Error, CheckInPayload, { snapshot: Pin[] | undefined }>({...})
```

### Testing: Simulating mutation callbacks in CheckInForm tests

The mock for `useCheckInMutation` should return a mock `mutate` function that captures the `onSuccess`/`onError` callbacks:
```typescript
let capturedOnError: ((e: Error) => void) | undefined
const mockMutate = vi.fn((_, opts) => { capturedOnError = opts?.onError })

vi.mock('@/hooks/useCheckInMutation', () => ({
  useCheckInMutation: () => ({ mutate: mockMutate, isPending: false }),
}))

// In test: trigger error
capturedOnError?.(new Error('network'))
expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save check-in")
```

### Previous story learnings (4.1, 4.2)

- `vi.stubGlobal` + `vi.unstubAllGlobals()` in afterEach for browser global mocks
- `useState` lazy initializer: `useState<T>(fn)` not `useState<T>(fn())`
- Use `.getState()` for imperative side effects in stores, not reactive subscriptions
- `// eslint-disable-line react-hooks/exhaustive-deps` required on effects with intentional omitted deps
- `vi.hoisted` needed when mock variables are referenced inside `vi.mock` factory
- All chips/buttons must use `type="button"` to prevent accidental form submission
- `aria-pressed` on toggle chips to communicate state to screen readers (WCAG)
- `act(async () => { render(<App />) })` in App.test.tsx for lazy route resolution

### Project Structure Notes

**Files to create:**
- `supabase/migrations/006_add_status_to_check_ins.sql` — ADD status column to check_ins
- `api/checkin.test.ts` — API handler tests
- `src/hooks/useCheckInMutation.ts` — TanStack Query mutation hook
- `src/hooks/useCheckInMutation.test.ts` — mutation hook tests
- `src/features/check-in/CheckInForm.tsx` — 3-tap check-in form overlay
- `src/features/check-in/CheckInForm.test.tsx` — form component tests

**Files to modify:**
- `api/checkin.ts` — implement stub (replace TODO block entirely)
- `src/lib/supabase/types.ts` — add `status: string` to `DbCheckIn`
- `src/App.tsx` — add `CheckInForm` rendering + `useUIStore` pendingCheckIn subscription
- `src/App.test.tsx` — add CheckInForm mount tests

**No changes to:**
- `src/store/uiStore.ts` — `pendingCheckIn` already added in Story 4.2 ✅
- `src/store/checkInPromptStore.ts` — not involved in submission logic
- `src/features/map/MapView.tsx` — Story 4.2 already sets `pendingCheckIn`; no changes needed
- `src/features/pin-detail/PinDetailSheet.tsx` — no check-in button in this story (future story)
- `src/hooks/useDeviceId.ts` — already implemented in Story 4.1 ✅

### References

- Story requirements: [epics.md — Epic 4, Story 4.3](_bmad-output/planning-artifacts/epics.md)
- FR20, FR26, FR27, FR28, FR29 coverage
- Architecture: [architecture.md](_bmad-output/planning-artifacts/architecture.md) — check-in flow, optimistic update pattern, feature boundaries
- `api/_supabase.ts` — `createServiceClient()` for serverless functions
- `api/checkin.ts` — current stub to replace
- `supabase/migrations/002_create_check_ins.sql` — current check_ins schema (missing status column)
- `src/lib/supabase/types.ts` — `DbCheckIn` interface to update
- `src/lib/badge/badgeState.ts` — `computeBadgeState` function (client-side badge logic, reference for optimistic update direction)
- `src/hooks/usePinsQuery.ts` — query key `['pins']` to invalidate
- `src/hooks/useDeviceId.ts` — `useDeviceId()` hook for anonymous device ID
- `src/store/uiStore.ts` — `pendingCheckIn: { pinId: string } | null` + `setPendingCheckIn` (added Story 4.2)
- `src/App.tsx` — QueryClient configuration (`mutations: { retry: 3 }`), Suspense wrapper pattern
- `src/features/map/DeparturePrompt.tsx` — overlay UI pattern to replicate for CheckInForm z-index/backdrop
- Architecture check-in data flow: `POST /api/checkin → check_ins insert → pins badge_state update → TanStack Query invalidation`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_None — clean implementation, no blocking issues encountered._

### Completion Notes List

- Migration 006 adds `status TEXT NOT NULL DEFAULT 'still_open' CHECK (status IN ('still_open', 'closed', 'changed'))` to `check_ins`.
- `api/checkin.ts` stub replaced entirely: Zod validation → HTML sanitization → insert → count → badge update → 200.
- `useCheckInMutation` uses TanStack Query v5 generic annotation `useMutation<void, Error, CheckInPayload, { snapshot: Pin[] | undefined }>` for typed context in `onError`.
- `CheckInForm` uses `usePinsQuery({ enabled: false })` to read pin name from cache without triggering a fetch.
- Test 7.11 fix: `onError` callback updates React state so must be called inside `act()`.
- Test 3.6 fix: sanitize strips tags only (not inner content), so `<b>Fee</b> is $12` → `Fee is $12`.
- All 394 tests pass, 0 regressions.

### File List

- `supabase/migrations/006_add_status_to_check_ins.sql` — new: adds status column to check_ins
- `api/checkin.ts` — modified: replaced stub with full implementation
- `api/checkin.test.ts` — new: 10 tests covering validation, sanitization, DB insert, error handling, count error, pins.update error
- `src/lib/supabase/types.ts` — modified: added `status: string` to `DbCheckIn`
- `src/hooks/useCheckInMutation.ts` — new: TanStack Query mutation with optimistic update, rollback, Sentry
- `src/hooks/useCheckInMutation.test.ts` — new: 5 tests covering onMutate, onError rollback, onError Sentry, onSettled invalidation
- `src/features/check-in/CheckInForm.tsx` — new: 3-tap check-in overlay component
- `src/features/check-in/CheckInForm.test.tsx` — new: 11 tests covering chips, submit, note, error, onSuccess→onClose, accessibility
- `src/App.tsx` — modified: lazy CheckInForm + useUIStore pendingCheckIn rendering
- `src/App.test.tsx` — modified: added 3 CheckInForm mount tests

## Senior Developer Review (AI)

**Review Date:** 2026-03-19
**Outcome:** Changes Requested → All Fixed (Approve)
**Reviewer:** claude-sonnet-4-6

### Action Items

- [x] **[HIGH] H1** — `pins.update()` error silently swallowed in `api/checkin.ts:53-61`. Returns 200 even when badge_state write fails. Fixed: destructure `updateError` and throw. (`api/checkin.ts`)
- [x] **[MEDIUM] M1** — Missing test: `onSuccess` callback never invoked to verify `onClose()` is called. Fixed: added test in `CheckInForm.test.tsx`. (`src/features/check-in/CheckInForm.test.tsx`)
- [x] **[MEDIUM] M2** — Supabase count query error not checked — silent `count=0` overwrites real value. Fixed: destructure `countError` and throw. (`api/checkin.ts`)
- [x] **[MEDIUM] M3** — Test 3.3 only covers missing `pinId`/`status`, not missing `deviceId`. Fixed: added explicit `deviceId` missing test. (`api/checkin.test.ts`)

**LOW items (not fixed — acceptable):**
- L1: `deviceId` not UUID-validated in Zod (any string accepted). Low risk — client always sends UUID via `useDeviceId()`.
- L2: No `isPending` state test in CheckInForm. Visual regression risk is low given small component surface.
- L3: Submit button lacks `aria-label` — context lost when text changes to "Saving…". Cosmetic accessibility gap.

**Final:** 4 issues fixed, 398 tests passing, 0 regressions.

## Change Log

- 2026-03-19: Implemented Story 4.3 — check-in submission, optimistic badge update, server-side validation, XSS sanitization, Sentry on final failure. 10 new/modified files, 394 tests passing.
- 2026-03-19: Code review — fixed H1 (pins.update error silently ignored), M2 (count query error silently ignored), M1 (missing onSuccess→onClose test), M3 (missing deviceId validation test). 398 tests passing.
