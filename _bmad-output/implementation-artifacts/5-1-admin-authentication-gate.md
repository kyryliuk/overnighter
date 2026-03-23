# Story 5.1: Admin Authentication Gate

Status: done

## Story

As an admin,
I want the admin dashboard to be protected by a Bearer token gate,
So that admin operations are never publicly accessible and no secrets are exposed in the client bundle.

## Acceptance Criteria

**AC1 — Admin chunk lazy-loaded (not in main bundle)**
Given the user navigates to `/admin`
When the route loads
Then the AdminDashboard component is loaded via `React.lazy()` — it is NOT included in the main JS bundle (NFR-P5)

**AC2 — Token input form shown on load**
Given the `/admin` route loads
When the admin auth gate renders
Then a token input form is shown asking for the admin secret

**AC3 — Correct token grants session access**
Given the admin enters the correct Bearer token and submits
When the token is validated against `GET /api/admin/auth`
Then access to the admin dashboard is granted for the current session
And the token is stored in `sessionStorage` under `ADMIN_TOKEN_KEY` — cleared when the tab closes

**AC4 — Incorrect token shows error**
Given the admin enters an incorrect Bearer token
When they submit
Then an error message "Invalid admin token" is shown and access is denied

**AC5 — Admin serverless functions require valid Bearer token**
Given any admin serverless function (`DELETE /api/pins/:id`, `PATCH /api/pins/:id/verify`, `POST /api/sync`)
When a request arrives without a valid `Authorization: Bearer <secret>` header
Then the function returns `{ "error": "UNAUTHORIZED", "message": "Invalid or missing Bearer token", "status": 401 }` (NFR-S5)
Note: `requireAdminAuth` in `api/_middleware.ts` already implements this — no new serverless function changes needed for AC5

**AC6 — ADMIN_SECRET is server-side only**
Given the `ADMIN_SECRET` environment variable
When it is accessed
Then it is only available server-side in Vercel environment variables
And it is never prefixed with `VITE_` and never appears in the client bundle (NFR-S6)

**AC7 — `requireAdminAuth` is shared, never duplicated**
Given the `api/_middleware.ts` Bearer token check
When it is applied to admin serverless functions
Then the same `requireAdminAuth()` function is used by all admin handlers — logic is never copy-pasted inline per function

## Tasks / Subtasks

- [x] Task 1: Create `api/admin/auth.ts` — lightweight token-validation endpoint (AC3, AC4, AC7)
  - [x] 1.1: Import `requireAdminAuth` from `../_middleware`
  - [x] 1.2: Return 405 for non-GET methods
  - [x] 1.3: Call `requireAdminAuth(req, res)` — returns false + writes 401 automatically if invalid
  - [x] 1.4: Return `{ ok: true }` on success

- [x] Task 2: Write `api/admin/auth.test.ts` (AC3, AC4, AC5)
  - [x] 2.1: Use `vi.hoisted()` for `mockRequireAdminAuth`; mock `'../_middleware'` module
  - [x] 2.2: Test 405 for non-GET (e.g., POST)
  - [x] 2.3: Test 401 when `requireAdminAuth` returns false (token missing/invalid)
  - [x] 2.4: Test 200 `{ ok: true }` when `requireAdminAuth` returns true

- [x] Task 3: Implement `src/features/admin/AdminAuth.tsx` (AC2, AC3, AC4)
  - [x] 3.1: Define and export `ADMIN_TOKEN_KEY = 'overnighter_admin_token'` constant
  - [x] 3.2: Props: `{ onAuthenticated: () => void }`
  - [x] 3.3: State: `token: string`, `isLoading: boolean`, `errorMsg: string | null`
  - [x] 3.4: Render a form with:
    - Password-type text input with `aria-label="Admin token"` and `placeholder="Enter admin token"`
    - Submit button: disabled when `!token || isLoading`; label "Sign In" or "Verifying…" when pending
    - `{errorMsg && <p role="alert">{errorMsg}</p>}` below the button
  - [x] 3.5: `handleSubmit`:
    - `e.preventDefault()`, set `isLoading=true`, clear `errorMsg`
    - `fetch('/api/admin/auth', { method: 'GET', headers: { Authorization: \`Bearer ${token}\` } })`
    - On `res.ok`: `sessionStorage.setItem(ADMIN_TOKEN_KEY, token)` → call `onAuthenticated()`
    - On `res.status === 401`: `setErrorMsg('Invalid admin token')`
    - On other/network error: `setErrorMsg("Couldn't verify token. Check connection.")`
    - Always: `setIsLoading(false)`

- [x] Task 4: Write `src/features/admin/AdminAuth.test.tsx` (AC2, AC3, AC4)
  - [x] 4.1: Mock `fetch` via `vi.stubGlobal` in each test
  - [x] 4.2: Test: renders password input and submit button
  - [x] 4.3: Test: submit button is disabled when input is empty
  - [x] 4.4: Test: submit button is enabled after typing a token
  - [x] 4.5: Test: on successful `fetch` (status 200) → sessionStorage has `ADMIN_TOKEN_KEY` set
  - [x] 4.6: Test: on successful `fetch` → `onAuthenticated` callback is called
  - [x] 4.7: Test: on 401 response → shows `role="alert"` with "Invalid admin token"
  - [x] 4.8: Test: on network error → shows `role="alert"` with connection error message
  - [x] 4.9: Test: submit button shows "Verifying…" while `isLoading` is true (use unresolved fetch promise)

- [x] Task 5: Replace `AdminDashboard.tsx` stub with auth-gated shell (AC1, AC2, AC3)
  - [x] 5.1: Check `sessionStorage.getItem(ADMIN_TOKEN_KEY)` on component mount
  - [x] 5.2: State: `adminToken: string | null` (initialized from sessionStorage)
  - [x] 5.3: Render `<AdminAuth onAuthenticated={handleAuthenticated} />` when `adminToken` is null
  - [x] 5.4: Render admin panel shell (heading + "Sign Out" button) when `adminToken` is present
  - [x] 5.5: `handleAuthenticated`: reads fresh token from sessionStorage, sets `adminToken` state
  - [x] 5.6: "Sign Out" button: calls `sessionStorage.removeItem(ADMIN_TOKEN_KEY)`, sets `adminToken(null)`
  - [x] 5.7: Pass `adminToken` as prop (or store it) — Stories 5.2/5.3/5.4 will pass it as `Authorization` header in their API calls

- [x] Task 6: Write `src/features/admin/AdminDashboard.test.tsx` (AC1, AC2, AC3)
  - [x] 6.1: Mock `AdminAuth` with `vi.mock` returning `<div data-testid="admin-auth-form" />`
  - [x] 6.2: Test: renders `AdminAuth` when sessionStorage has no token
  - [x] 6.3: Test: renders admin panel (not auth form) when sessionStorage has a token
  - [x] 6.4: Test: clicking "Sign Out" removes token from sessionStorage and shows auth form again
  - [x] 6.5: Test: `handleAuthenticated` callback reads token from sessionStorage and updates state

## Dev Notes

### Critical: What's Already Implemented — Do NOT Recreate

- **`api/_middleware.ts`** — `requireAdminAuth(req, res): boolean` is fully implemented and tested (6 tests passing). It reads `Authorization` header, validates `Bearer <token>` scheme, compares against `process.env.ADMIN_SECRET`, and writes 401 on failure. IMPORT this, never inline the logic.
- **`src/App.tsx`** — `AdminDashboard` is already lazy-imported (`const AdminDashboard = lazy(() => import('@/features/admin/AdminDashboard'))`) and wired to `<Route path="/admin" element={<AdminDashboard />} />`. Do NOT modify `App.tsx` or `App.test.tsx` for this story.
- **`api/_middleware.test.ts`** — `requireAdminAuth` is already tested. Do not re-test middleware behavior in `api/admin/auth.test.ts` — only test the handler behavior.

### New File: `api/admin/auth.ts`

This endpoint exists ONLY to let the client validate a token before storing it in sessionStorage. It is not in the architecture endpoint table (which documents business-logic endpoints), but it is architecturally correct since it follows the same `requireAdminAuth` middleware pattern.

```typescript
// api/admin/auth.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdminAuth } from '../_middleware'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'GET only', status: 405 })
  }
  if (!requireAdminAuth(req, res)) return
  return res.status(200).json({ ok: true })
}
```

### Token Storage: sessionStorage vs localStorage

- **MUST use `sessionStorage`** — the AC explicitly requires token to clear when the tab closes (session-scoped)
- `localStorage` would persist indefinitely — this is wrong and a security issue
- Key: `ADMIN_TOKEN_KEY = 'overnighter_admin_token'` — define this as a named export from `AdminAuth.tsx` so `AdminDashboard.tsx` can import and use it for sessionStorage reads

### AdminAuth.tsx Testing — `vi.stubGlobal('fetch', ...)` Pattern

This component makes a raw `fetch` call (no TanStack Query mutation). Mock fetch globally per test:

```typescript
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
// 401 response:
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
// network error:
vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failure')))
```

Always call `vi.unstubAllGlobals()` in `afterEach`.

Use `act()` from `@testing-library/react` when testing state updates triggered by async fetch resolution:
```typescript
await act(async () => {
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
})
```

### AdminDashboard.tsx — sessionStorage in Tests

`sessionStorage` is available in jsdom. Set it directly before rendering:
```typescript
beforeEach(() => {
  sessionStorage.clear()
})
// To simulate authenticated state:
sessionStorage.setItem(ADMIN_TOKEN_KEY, 'test-token-abc')
renderDashboard()
```

### `api/admin/auth.test.ts` — Mock `requireAdminAuth` Pattern

Since `requireAdminAuth` already has its own test file, mock the entire `_middleware` module in `auth.test.ts`:

```typescript
const { mockRequireAdminAuth } = vi.hoisted(() => {
  const mockRequireAdminAuth = vi.fn().mockReturnValue(true)
  return { mockRequireAdminAuth }
})

vi.mock('../_middleware', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}))
```

In the "401" test, set `mockRequireAdminAuth.mockImplementation((req, res) => { res.status(401).json({ error: 'UNAUTHORIZED', status: 401 }); return false })`.

### Touch Target Requirements (NFR-A4)

All interactive elements in `AdminAuth.tsx` must have `min-h-[44px]` and `min-w-[44px]` per touch-target rule. This applies to:
- Token input field
- Submit button

### Architecture: No Cross-Feature Imports

`AdminDashboard.tsx` and `AdminAuth.tsx` live in `src/features/admin/`. They may import from:
- `src/hooks/` — if needed
- `src/store/` — if needed (but no uiStore changes are required for this story)

`AdminAuth.tsx` should NOT import from any other feature directory.

### Environment Variable Rules

- `ADMIN_SECRET` — server-only, accessed via `process.env.ADMIN_SECRET` in `api/` functions
- Never `import.meta.env.ADMIN_SECRET` — this is a Vite pattern for client bundles, would expose the secret
- The `.env.example` already documents `ADMIN_SECRET=` without `VITE_` prefix

### File Structure

New files this story creates:
```
api/admin/
  auth.ts           → GET /api/admin/auth (Bearer token ping)
  auth.test.ts      → excluded from Vercel deployment by .vercelignore

src/features/admin/
  AdminAuth.tsx         → token gate form (new)
  AdminAuth.test.tsx    → (new)
  AdminDashboard.tsx    → replace stub (existing, modify)
  AdminDashboard.test.tsx → (new, replaces implicit stub behavior)
```

### Project Structure Notes

- `api/admin/` directory must be created — it does not exist yet
- `.vercelignore` already handles `api/**/*.test.ts` — `api/admin/auth.test.ts` is covered
- No changes to `App.tsx`, `App.test.tsx`, `uiStore.ts`, or any other existing file

### References

- Architecture admin auth: `_bmad-output/planning-artifacts/architecture.md` — Authentication & Security section
- Architecture admin project structure: `_bmad-output/planning-artifacts/architecture.md` — src/features/admin/ section
- Epic 5 Story 5.1 ACs: `_bmad-output/planning-artifacts/epics.md` — Story 5.1
- Existing middleware implementation: `overnighter/api/_middleware.ts`
- Existing middleware tests: `overnighter/api/_middleware.test.ts`
- Token check pattern (Story 4.1 analog): `overnighter/src/hooks/useDeviceId.ts` — same sessionStorage/localStorage pattern

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 6 tasks implemented and tested; 449 tests passing (16 new tests, 0 regressions)
- Code review fixes: `cache: 'no-store'` added to auth fetch (M1); else-branch test added (M2); `vi` import added to auth.test.ts (L1); `autoComplete="off"` on password input (L2); synchronous `act()` replaced with awaited form (L3)
- `api/admin/auth.ts`: GET-only handler using `requireAdminAuth` from `_middleware` — no logic duplication (AC7)
- `AdminAuth.tsx`: exports `ADMIN_TOKEN_KEY` constant; uses `sessionStorage` (not localStorage) per AC3; error states for 401 and network failures
- `AdminDashboard.tsx`: lazy-init state from sessionStorage; renders `<AdminAuth>` or admin shell based on token presence; `adminToken` stored in component state ready for Stories 5.2–5.4 to consume as prop
- Mock pattern: `vi.hoisted()` for API tests; `vi.stubGlobal('fetch', ...)` for component tests; `vi.mock('./AdminAuth', ...)` preserving named exports for dashboard tests

### File List

- `overnighter/api/admin/auth.ts` (new)
- `overnighter/api/admin/auth.test.ts` (new)
- `overnighter/src/features/admin/AdminAuth.tsx` (new)
- `overnighter/src/features/admin/AdminAuth.test.tsx` (new)
- `overnighter/src/features/admin/AdminDashboard.tsx` (modified — replaced stub)
- `overnighter/src/features/admin/AdminDashboard.test.tsx` (new)
