# Story 6.3: Pin Management — Flag, Badge Override & Archive

## Story

As an **admin user**,
I want to manage live pins by handling flags, correcting badge status, and archiving bad data,
so that the map stays accurate and free of inappropriate content.

## Status

**Ready for Dev**

## Context

Phase 1 (Epic 5) built the admin foundation: authentication gate (5.1), flagged pin review queue (5.2), pin creation (5.3), and pin editing (5.4). Story 4.4 added issue reporting with automatic badge degradation (→ red) and auto-flagging (≥ 3 reports in 48 h sets `is_flagged = true`).

Phase 2 Stories 6.1 and 6.2 added the spot submission queue with filtering, pagination, and approve/reject workflows using the `SubmissionReviewDialog` dialog pattern.

This story enhances the existing `FlaggedPinList` with **richer flag detail**, adds **badge override** (admin forces a badge color regardless of check-in recency), and completes the **archive / unarchive** lifecycle. It also introduces a lightweight **audit log** so admin actions are traceable.

### What already exists

| Layer | File | What it does |
|-------|------|--------------|
| Migration | `009_add_is_archived_to_pins.sql` | `is_archived BOOLEAN DEFAULT false` on `pins` |
| Migration | `010_extend_submit_issue_report_autoflag.sql` | `submit_issue_report()` RPC — inserts issue, degrades badge to red, auto-flags at ≥ 3 |
| Migration | `011_add_get_flagged_pins_fn.sql` | `get_flagged_pins()` RPC — returns flagged pins with `flag_count` and `latest_report_type` |
| API | `api/admin/flagged-pins.ts` | `GET` — calls `get_flagged_pins()` RPC |
| API | `api/pins/[id].ts` | `DELETE` (soft archive) + `PATCH` (edit fields) |
| API | `api/pins/[id]/verify.ts` | `PATCH { action: 'verify' | 'dismiss' }` — clears `is_flagged`, optionally sets verified + green badge |
| UI | `FlaggedPinList.tsx` | Renders flagged pins with Archive / Mark Verified / Dismiss buttons |
| UI | `AdminPinList.tsx` | Table of all pins with Edit button |
| UI | `AdminDashboard.tsx` | Sections: Spot Submissions → Flagged Pins → All Pins |
| DB | `issue_reports` table | Columns: `status` (open/closed), `resolved_at` — **no** `resolved_by` column yet |

---

## Acceptance Criteria

### AC 1 — Admin Pin List with Search & Filter

**Given** an admin navigates to the admin dashboard
**When** the Flagged Pins section loads
**Then** a search input allows filtering pins by name (client-side)
**And** filter chips allow filtering by flag reason (`dump_closed`, `water_unavailable`, `no_overnight`, `access_blocked`, `other`)
**And** an "Archived" toggle shows/hides archived pins (hidden by default)

### AC 2 — View Flagged Pins with Full Detail

**Given** flagged pins are loaded
**When** the admin taps a flagged pin card
**Then** an expanded detail area shows:
- All open issue reports for that pin (report type, device ID prefix, timestamp)
- Total flag count and most recent flag reason
- Current badge state and whether a badge override is active (lock icon)
- Archive status

### AC 3 — Dismiss Flags (Mark as Reviewed)

**Given** the admin reviews a flagged pin and finds it valid
**When** they tap "Clear Flags" and confirm in a dialog
**Then** `PATCH /api/pins/:id/verify` is called with `{ action: 'dismiss' }`
**And** all open `issue_reports` for that pin are set to `status = 'closed'` and `resolved_at = NOW()`
**And** `is_flagged` is set to `false` on the pin
**And** the flag count badge disappears from the card
**And** the action is logged to the `admin_audit_log` table

### AC 4 — Badge Override

**Given** the admin finds a pin with an incorrect recency badge
**When** they tap "Override Badge" and select a new badge (`green`, `yellow`, `red`, `grey`)
**Then** `PATCH /api/admin/pins/:id` is called with `{ badge_override: '<color>' }`
**And** the pin's `badge_override` column is set to the chosen color
**And** the pin card shows the overridden badge with a small 🔒 icon
**And** a "Remove Override" option clears `badge_override` back to `null`
**And** the action is logged to the `admin_audit_log` table

### AC 5 — Archive Pin

**Given** the admin determines a pin should be removed from the map
**When** they tap "Archive" and confirm via a confirmation dialog
**Then** `DELETE /api/pins/:id` is called (existing endpoint — sets `is_archived = true`)
**And** the pin no longer appears in any user-facing map query
**And** the pin card in the admin list shows an "Archived" pill
**And** the action is logged to the `admin_audit_log` table

### AC 6 — Unarchive Pin

**Given** the admin views an archived pin (via the "Show Archived" toggle)
**When** they tap "Unarchive" and confirm
**Then** `PATCH /api/admin/pins/:id` is called with `{ is_archived: false }`
**And** the pin reappears on the public map
**And** the "Archived" pill is removed from the admin card
**And** the action is logged to the `admin_audit_log` table

### AC 7 — Audit Trail

**Given** any admin action (dismiss flags, override badge, archive, unarchive)
**When** the action completes on the server
**Then** a row is inserted into `admin_audit_log` with:
- `action` (e.g. `'dismiss_flags'`, `'badge_override'`, `'archive'`, `'unarchive'`)
- `pin_id`
- `details` (JSONB — e.g. `{ badge_override: 'green' }` or `{ flags_cleared: 5 }`)
- `created_at`

---

## Tasks / Subtasks

### Task 1 — Database Migration: `badge_override`, audit log, issue report updates

**File:** `supabase/migrations/025_admin_pin_management.sql`

Create a single migration that:

1. **Add `badge_override` column to `pins`**

   ```sql
   ALTER TABLE pins ADD COLUMN badge_override TEXT
     CHECK (badge_override IN ('green', 'yellow', 'red', 'grey'));
   ```

2. **Create `admin_audit_log` table**

   ```sql
   CREATE TABLE admin_audit_log (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     action TEXT NOT NULL,
     pin_id UUID REFERENCES pins(id) ON DELETE SET NULL,
     details JSONB DEFAULT '{}',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   CREATE INDEX idx_audit_log_pin_id ON admin_audit_log (pin_id);
   CREATE INDEX idx_audit_log_action ON admin_audit_log (action);
   CREATE INDEX idx_audit_log_created_at ON admin_audit_log (created_at DESC);
   ```

3. **Update `get_flagged_pins()` to include `badge_override` and `is_archived`**

   ```sql
   CREATE OR REPLACE FUNCTION get_flagged_pins()
   RETURNS TABLE(
     id UUID,
     name TEXT,
     latitude DOUBLE PRECISION,
     longitude DOUBLE PRECISION,
     badge_state TEXT,
     badge_override TEXT,
     is_archived BOOLEAN,
     flag_count BIGINT,
     latest_report_type TEXT
   )
   LANGUAGE sql SECURITY DEFINER
   AS $$
     SELECT p.id, p.name, p.latitude, p.longitude,
            p.badge_state, p.badge_override, p.is_archived,
            COUNT(ir.id) AS flag_count,
            (SELECT report_type FROM issue_reports
             WHERE pin_id = p.id ORDER BY created_at DESC LIMIT 1
            ) AS latest_report_type
     FROM pins p
     LEFT JOIN issue_reports ir ON ir.pin_id = p.id
     WHERE p.is_flagged = true
     GROUP BY p.id;
   $$;
   ```

   > Note: Remove the `AND p.is_archived = false` filter so admins can see archived flagged pins too. The frontend "Show Archived" toggle controls visibility.

**Acceptance Criteria:** AC 3, AC 4, AC 6, AC 7

---

### Task 2 — API: `PATCH /api/admin/pins/:id` (badge override, unarchive, clear flags)

**File:** `api/admin/pins/[id].ts` (new file)

Create a dedicated admin pin management endpoint separate from the existing `api/pins/[id].ts` (which handles general editing and soft-delete).

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { requireAdminAuth } from '../../_middleware'
import { createServiceClient } from '../../_supabase'

const AdminPinUpdateSchema = z.object({
  badge_override: z.enum(['green', 'yellow', 'red', 'grey']).nullable().optional(),
  is_archived: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
})
```

**Implementation details:**

- `PATCH` only; return 405 for other methods.
- Validate `req.query.id` is a string.
- Parse body with `AdminPinUpdateSchema`.
- For `badge_override`:
  - Update `pins.badge_override` to the given value (or `null` to remove).
  - Log audit: `{ action: 'badge_override', pin_id, details: { badge_override } }`.
- For `is_archived: false` (unarchive):
  - Update `pins.is_archived = false`.
  - Log audit: `{ action: 'unarchive', pin_id, details: {} }`.
- Always set `updated_at` to `new Date().toISOString()`.
- Insert audit log row in same try/catch block (non-blocking — audit insert failure should not fail the main operation; log error and continue).
- Return `{ ok: true }`.

**Acceptance Criteria:** AC 4, AC 6, AC 7

---

### Task 3 — API: Extend `PATCH /api/pins/:id/verify` for flag resolution

**File:** `api/pins/[id]/verify.ts` (modify existing)

When `action === 'dismiss'`:

1. Keep existing behavior: set `is_flagged = false` on the pin.
2. **Add:** Close all open issue reports for that pin:
   ```sql
   UPDATE issue_reports
   SET status = 'closed', resolved_at = NOW()
   WHERE pin_id = :pinId AND status = 'open'
   ```
3. **Add:** Insert audit log entry:
   ```sql
   INSERT INTO admin_audit_log (action, pin_id, details)
   VALUES ('dismiss_flags', :pinId, '{"flags_cleared": <count>}')
   ```
   - To get `flags_cleared` count, query before the update or use the Supabase update response.

When `action === 'verify'`:

1. Keep existing behavior: set `is_verified = true`, `is_flagged = false`, `badge_state = 'green'`, `last_check_in_at = now`.
2. **Add:** Close all open issue reports (same as dismiss).
3. **Add:** Insert audit log entry with `action: 'verify'`.

**Acceptance Criteria:** AC 3, AC 7

---

### Task 4 — API: Extend `DELETE /api/pins/:id` for archive audit logging

**File:** `api/pins/[id].ts` (modify existing)

After the existing archive update (`is_archived: true`), add:

```typescript
await supabase.from('admin_audit_log').insert({
  action: 'archive',
  pin_id: pinId,
  details: {},
})
```

Non-blocking: catch and log audit insert errors but still return 200.

**Acceptance Criteria:** AC 5, AC 7

---

### Task 5 — API Tests for New/Modified Endpoints

**Files:**
- `api/admin/pins/[id].test.ts` (new — 8 tests)
- `api/pins/[id]/verify.test.ts` (modify existing — add 4 tests)
- `api/pins/[id].test.ts` (modify existing — add 2 tests)

**Test cases for `api/admin/pins/[id].test.ts`:**

1. Returns 405 for non-PATCH methods
2. Returns 401 without valid Bearer token
3. Returns 400 for empty body
4. Sets `badge_override` to `'green'` and inserts audit log
5. Clears `badge_override` (sets to `null`) and inserts audit log
6. Returns 400 for invalid `badge_override` value (e.g. `'purple'`)
7. Unarchives pin (`is_archived: false`) and inserts audit log
8. Handles Supabase error gracefully (returns 500)

**Additional test cases for `verify.test.ts`:**

9. Dismiss action closes all open issue reports
10. Dismiss action inserts audit log with `flags_cleared` count
11. Verify action closes all open issue reports
12. Verify action inserts audit log with `action: 'verify'`

**Additional test cases for `[id].test.ts`:**

13. DELETE (archive) inserts audit log entry
14. Audit log insert failure does not cause 500 response

**Mock pattern:** Use `vi.hoisted()` for middleware and supabase mocks. Mock `createServiceClient` to return a chainable mock with `.from().update().eq()`, `.from().insert()`, `.rpc()`.

**Acceptance Criteria:** AC 3, AC 4, AC 5, AC 6, AC 7

---

### Task 6 — UI: Enhance `FlaggedPinList.tsx` with Search, Filters, Expanded Detail

**File:** `src/features/admin/FlaggedPinList.tsx` (modify existing)

**6a — Update `FlaggedPin` interface:**

```typescript
interface FlaggedPin {
  id: string
  name: string
  latitude: number
  longitude: number
  badge_state: string
  badge_override: string | null
  is_archived: boolean
  flag_count: number
  latest_report_type: string | null
}
```

**6b — Add search & filter state:**

```typescript
const [searchQuery, setSearchQuery] = useState('')
const [reasonFilter, setReasonFilter] = useState<string | null>(null)
const [showArchived, setShowArchived] = useState(false)
```

- Filter pins client-side: `pin.name.toLowerCase().includes(searchQuery.toLowerCase())`
- Reason filter: match `pin.latest_report_type === reasonFilter`
- Archive toggle: show/hide `pin.is_archived === true` entries

**6c — Add search input above the list:**

```tsx
<input
  type="text"
  placeholder="Search pins by name…"
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm ..."
  aria-label="Search pins"
/>
```

**6d — Add filter chips row:**

Render a row of reason-filter chips (`dump_closed`, `water_unavailable`, `no_overnight`, `access_blocked`, `other`, `All`) using the existing `REPORT_TYPE_LABELS` map. Active chip gets `bg-primary text-primary-foreground`.

**6e — Add "Show Archived" toggle:**

```tsx
<label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
  <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
  Show Archived
</label>
```

**6f — Expandable card detail:**

Add `expandedPinId` state. Clicking a card toggles expansion. Expanded view shows:
- List of open issue reports fetched via `GET /api/admin/pins/:id/reports` (new — see Task 8) or inline from a separate query
- Badge override indicator (🔒 icon next to badge pill when `badge_override` is non-null)
- Archive status pill

> For simplicity in this story: show the flag count, latest report type, badge override status, and archive status inline. The full issue report list (per-report detail) is a stretch goal — skip if time-constrained.

**6g — Render badge override indicator:**

If `pin.badge_override` is non-null, the badge pill shows the override color and a 🔒 suffix:

```tsx
<span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_STYLES[pin.badge_override ?? pin.badge_state]}`}>
  {pin.badge_override ?? pin.badge_state}
  {pin.badge_override && ' 🔒'}
</span>
```

**6h — Render "Archived" pill:**

If `pin.is_archived`, show a muted pill:

```tsx
{pin.is_archived && (
  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">
    Archived
  </span>
)}
```

**6i — Update action buttons per pin state:**

- If `pin.is_archived`: show "Unarchive" button instead of "Archive".
- Always show "Clear Flags" (triggers dismiss), "Override Badge" (opens dialog), and archive/unarchive.
- "Override Badge" button opens `BadgeOverrideDialog` (Task 7).

**Acceptance Criteria:** AC 1, AC 2, AC 4, AC 5, AC 6

---

### Task 7 — UI: Create `BadgeOverrideDialog.tsx`

**File:** `src/features/admin/BadgeOverrideDialog.tsx` (new)

Follow the `SubmissionReviewDialog` pattern exactly (native `<dialog>` with `showModal()`, backdrop click, ESC close, focus trap).

**Props:**

```typescript
interface BadgeOverrideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pinName: string
  currentOverride: string | null
  onConfirm: (badge: string | null) => void
  isLoading: boolean
}
```

**Body:**

- Title: "Override Badge Status"
- Description: `Set the badge for "${pinName}" to a fixed color regardless of check-in recency.`
- Four selectable badge options: green, yellow, red, grey — rendered as clickable pills with radio-button semantics (`role="radiogroup"`).
- Pre-select `currentOverride` if non-null; otherwise no selection.
- "Remove Override" secondary button (visible only if `currentOverride` is non-null) — calls `onConfirm(null)`.
- "Apply Override" primary button — calls `onConfirm(selectedBadge)`.
- Cancel button — closes dialog.
- All interactive elements: `min-h-[44px]`.

**Acceptance Criteria:** AC 4

---

### Task 8 — UI: Wire Mutations into FlaggedPinList

**File:** `src/features/admin/FlaggedPinList.tsx` (modify)

**8a — Badge override mutation:**

```typescript
const badgeOverrideMutation = useMutation({
  mutationFn: async ({ pinId, badge_override }: { pinId: string; badge_override: string | null }) => {
    const res = await fetch(`/api/admin/pins/${pinId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ badge_override }),
    })
    if (!res.ok) throw new Error('Badge override failed')
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'flagged-pins'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'all-pins'] })
  },
})
```

**8b — Unarchive mutation:**

```typescript
const unarchiveMutation = useMutation({
  mutationFn: async (pinId: string) => {
    const res = await fetch(`/api/admin/pins/${pinId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_archived: false }),
    })
    if (!res.ok) throw new Error('Unarchive failed')
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'flagged-pins'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'all-pins'] })
  },
})
```

**8c — Connect `BadgeOverrideDialog`:**

Add state `overrideTarget: { pinId: string; pinName: string; currentOverride: string | null } | null`.

- Clicking "Override Badge" sets `overrideTarget`.
- Dialog's `onConfirm` calls `badgeOverrideMutation.mutate(...)` and clears `overrideTarget`.

**8d — Connect archive/unarchive toggle:**

- If `pin.is_archived` → show "Unarchive" button calling `unarchiveMutation.mutate(pin.id)`.
- If `!pin.is_archived` → keep existing "Archive" button calling `archiveMutation.mutate(pin.id)`.

**8e — Update `isPending` helper:**

Add `badgeOverrideMutation` and `unarchiveMutation` to the pending check.

**Acceptance Criteria:** AC 3, AC 4, AC 5, AC 6

---

### Task 9 — UI Tests

**Files:**
- `src/features/admin/FlaggedPinList.test.tsx` (modify existing — add tests)
- `src/features/admin/BadgeOverrideDialog.test.tsx` (new)

**FlaggedPinList tests to add (10 tests):**

1. Renders search input; filtering by name hides non-matching pins
2. Renders reason filter chips; clicking a chip filters by that reason
3. "Show Archived" toggle controls archived pin visibility
4. Badge override indicator (🔒) renders when `badge_override` is non-null
5. "Archived" pill renders for archived pins
6. "Unarchive" button renders for archived pins (not "Archive")
7. Clicking "Override Badge" opens `BadgeOverrideDialog`
8. Badge override mutation fires on dialog confirm
9. Unarchive mutation fires and invalidates queries
10. All action buttons have `min-h-[44px]` touch target

**BadgeOverrideDialog tests (8 tests):**

1. Renders dialog with title and pin name
2. Renders four badge color options
3. Pre-selects `currentOverride` if non-null
4. "Apply Override" button calls `onConfirm` with selected badge
5. "Remove Override" button visible only when `currentOverride` is non-null
6. "Remove Override" calls `onConfirm(null)`
7. Cancel button calls `onOpenChange(false)`
8. Confirm button disabled when no badge is selected and no current override

**Mock pattern:**
- Wrap in `QueryClientProvider` with `retry: false` test client.
- Use `vi.hoisted()` for `fetch` mock.
- Use `act()` for state-updating callbacks.

**Acceptance Criteria:** AC 1, AC 2, AC 3, AC 4, AC 5, AC 6

---

### Task 10 — Final Validation

1. Run `npx vitest run` — all tests pass (existing + new).
2. Run `npx tsc --noEmit` — no type errors.
3. Run `npm run lint` — no new lint warnings.
4. Run `npm run build` — production build succeeds.
5. Manual QA: log in to `/admin`, verify flagged pin list with search/filters, override badge, archive/unarchive, and check audit log entries in Supabase dashboard.

---

## Dev Notes

### Architecture Guardrails

- **No cross-feature imports.** All admin components live in `src/features/admin/`. Do not import from `src/features/pin-detail/` or other feature folders.
- **Admin auth pattern:** All admin API routes use `requireAdminAuth(req, res)` from `api/_middleware.ts`. It checks `Bearer <ADMIN_SECRET>`. Frontend passes `adminToken` from `sessionStorage`.
- **Service role client:** All admin API routes use `createServiceClient()` from `api/_supabase.ts` which creates a Supabase client with `SUPABASE_SERVICE_ROLE_KEY` — this bypasses RLS.
- **Existing endpoint reuse:** The `DELETE /api/pins/:id` endpoint already handles soft-archive. The `PATCH /api/pins/:id/verify` endpoint already handles dismiss/verify. Extend these rather than duplicating logic.
- **New admin endpoint:** `api/admin/pins/[id].ts` is a **new file** for admin-specific operations (badge override, unarchive) that don't belong on the general pin endpoint.

### Database Schema Notes

- **`badge_override`** is `TEXT` nullable. `NULL` = no override (badge computed from check-in recency). Non-null = forced badge color. The public map query and `PinDetailSheet` must respect this: `COALESCE(badge_override, badge_state)`.
- **`admin_audit_log`** is append-only. No UPDATE/DELETE needed. No RLS — only accessible via service role from admin endpoints.
- **`issue_reports.status`** already has `'open'` / `'closed'` values. The dismiss action closes all open reports for a pin. `resolved_at` is set on close. There is no `resolved_by` column (would require user-level admin identity; out of scope since admin uses a shared secret).
- **`get_flagged_pins()` update:** Remove the `is_archived = false` filter so archived flagged pins appear when the admin toggles "Show Archived". Add `badge_override` and `is_archived` to the return columns.

### Frontend Patterns

- **TanStack Query v5 mutations** — use `useMutation` with `onSuccess` for query invalidation. Optimistic updates are optional for this story since admin actions are low-frequency; simple invalidation on success is sufficient.
- **Dialog pattern** — follow `SubmissionReviewDialog.tsx` exactly: native `<dialog>` element with `showModal()`, `close` event listener for ESC, backdrop click detection, `aria-modal="true"`.
- **Touch targets** — all buttons and interactive elements: `min-h-[44px]` (NFR-A4).
- **No toast library** — use `role="alert"` inline elements for error feedback. Success feedback via query invalidation (card disappears or updates).
- **Error rollback** — if a mutation fails, show inline error via `mutation.isError` state on the card. No optimistic cache manipulation needed.

### Query Key Conventions

| Query Key | Used By |
|-----------|---------|
| `['admin', 'flagged-pins', adminToken]` | `FlaggedPinList` — flagged pin list |
| `['admin', 'all-pins']` | `AdminPinList` — all pins table |

Both should be invalidated on badge override, archive, unarchive, dismiss, and verify actions.

### Testing Strategy

- **Unit tests:** Components rendered in isolation with mocked `fetch` and `QueryClientProvider`. Use `vi.hoisted()` + `vi.stubGlobal('fetch', ...)`.
- **API tests:** Mock `requireAdminAuth` and `createServiceClient` with `vi.mock()`. Verify correct Supabase method calls, response status codes, and audit log inserts.
- **No E2E tests** for this story — admin panel is behind a secret token, not user-facing. Unit + integration coverage is sufficient.

### File Inventory

| Action | File |
|--------|------|
| **New** | `supabase/migrations/025_admin_pin_management.sql` |
| **New** | `api/admin/pins/[id].ts` |
| **New** | `api/admin/pins/[id].test.ts` |
| **New** | `src/features/admin/BadgeOverrideDialog.tsx` |
| **New** | `src/features/admin/BadgeOverrideDialog.test.tsx` |
| **Modify** | `api/pins/[id]/verify.ts` |
| **Modify** | `api/pins/[id]/verify.test.ts` |
| **Modify** | `api/pins/[id].ts` |
| **Modify** | `api/pins/[id].test.ts` |
| **Modify** | `src/features/admin/FlaggedPinList.tsx` |
| **Modify** | `src/features/admin/FlaggedPinList.test.tsx` |

### Implementation Order

1. Task 1 (migration) — schema must exist before API work
2. Tasks 2–4 (API endpoints) — can be done in parallel
3. Task 5 (API tests) — after API implementation
4. Tasks 6–8 (UI) — after API is testable
5. Task 9 (UI tests) — after UI implementation
6. Task 10 (validation) — final gate

### Out of Scope

- Per-report detail view (expanding individual issue reports with full notes) — stretch goal
- Admin user identity tracking (would require per-user admin auth, not shared secret)
- Bulk actions (batch archive/dismiss) — future enhancement
- Push notifications to users when their reported pin is reviewed
