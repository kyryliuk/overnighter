# Story 6.2 — Approve and Reject Submissions

## Story

**As an** admin user,
**I want to** approve or reject pending spot submissions with confirmation dialogs and required feedback,
**So that** the community map contains only accurate and appropriate spots, and submitters receive clear communication about the outcome of their submission.

## Status

- **Epic:** 6 — Admin Moderation UI
- **Depends on:** Story 6.1 (Admin Submission Queue) — ✅ complete
- **Blocked by:** None
- **Status:** Ready for Dev

---

## Acceptance Criteria

### AC1 — Approve Button with Confirmation Dialog

- **Given** the admin has expanded a `pending` or `changes_requested` submission card
- **When** they tap the "Approve & Publish" button
- **Then** a confirmation dialog appears with:
  - Title: "Approve Submission?"
  - Body: "This will create a new pin from **{submission.name}** and make it visible on the public map."
  - Optional admin notes textarea (pre-filled if notes were entered before opening dialog)
  - "Cancel" and "Confirm Approval" buttons
- **And** the dialog uses `<dialog>` with `aria-modal="true"` and focus trap (Radix UI Dialog)

### AC2 — Pin Creation on Approval

- **Given** the admin confirms the approval dialog
- **When** `PATCH /api/admin/spot-submissions/:id` is called with `{ action: 'approve', admin_notes: '...' }`
- **Then** a new `pins` record is created with `pin_type: 'community'`, `is_verified: false`, `badge_state: 'grey'`
- **And** the submission's `published_pin_id` is set to the new pin's ID
- **And** the submission status updates to `approved` with `reviewed_at` timestamp
- **And** the submitter receives a push notification: "Your spot was approved and is now live on the map!"
- **And** the card's status pill updates to Approved (green) inline

### AC3 — Reject Button with Required Reason

- **Given** the admin taps the "Reject" button on an expanded submission card
- **When** the reject dialog opens
- **Then** it shows:
  - Title: "Reject Submission?"
  - Body: "Provide a reason — the submitter will be notified."
  - **Required** admin notes textarea (min 10 characters) with character count indicator
  - "Cancel" and "Confirm Rejection" buttons (Confirm disabled until 10+ chars entered)
- **And** on confirmation, `PATCH /api/admin/spot-submissions/:id` is called with `{ action: 'reject', admin_notes: reason }`
- **And** the card's status pill updates to Rejected (red) inline
- **And** the submitter receives a push notification with the rejection reason

### AC4 — Request Changes Action with Notes

- **Given** the admin taps "Request Changes" on an expanded submission card
- **When** the dialog opens
- **Then** it shows:
  - Title: "Request Changes"
  - Body: "Describe what needs to change — the submitter will be notified."
  - **Required** admin notes textarea (min 10 characters) with character count indicator
  - "Cancel" and "Send Feedback" buttons (Send disabled until 10+ chars entered)
- **And** on confirmation, `PATCH /api/admin/spot-submissions/:id` is called with `{ action: 'request_changes', admin_notes: feedback }`
- **And** the card's status pill updates to Changes Requested (sky blue) inline

### AC5 — Admin Notes Displayed After Action

- **Given** a submission has been reviewed (approved, rejected, or changes requested)
- **When** the admin views or re-expands the submission card
- **Then** the admin notes are displayed in a styled callout block below the submission details
- **And** the `reviewed_at` timestamp is shown (formatted relative, e.g., "2 hours ago")
- **And** if approved, the `published_pin_id` is shown as a clickable link to `/pin/{id}`

### AC6 — Optimistic UI Update After Action

- **Given** the admin confirms an approval, rejection, or request-changes action
- **When** the PATCH request is in-flight
- **Then** the dialog closes immediately
- **And** the status pill updates optimistically to the new status
- **And** the action buttons are hidden (replaced by the reviewed state)
- **And** query caches for submissions list and status counts are invalidated
- **And** if the current filter tab would exclude the updated submission, it remains visible until the next filter change (no jarring disappearance)

### AC7 — Error Handling and Rollback

- **Given** the PATCH request fails (network error, server error)
- **When** the error response is received
- **Then** the optimistic status pill reverts to the previous status
- **And** the action buttons reappear
- **And** an error toast displays: "Action failed — please try again"
- **And** the admin notes input retains the text they had entered

### AC8 — Batch Actions (Stretch / Optional)

- **Given** the admin has multiple pending submissions visible
- **When** they select multiple cards via checkboxes (optional future enhancement)
- **Then** batch "Approve All" and "Reject All" actions appear in a floating toolbar
- **Note:** This is a stretch goal — implement only if time permits. Core single-item flow is the priority.

---

## Tasks / Subtasks

### Task 1 — Create Confirmation Dialog Component

**File:** `src/features/admin/SubmissionReviewDialog.tsx` (new)

- [ ] 1.1 Create a reusable `SubmissionReviewDialog` component using Radix UI `Dialog` primitive
  - Props: `open`, `onOpenChange`, `action: 'approve' | 'reject' | 'request_changes'`, `submissionName: string`, `initialNotes?: string`, `onConfirm: (notes: string) => void`, `isLoading: boolean`
  - Renders title, body text, and optional/required notes textarea based on `action`
- [ ] 1.2 For `reject` and `request_changes`: textarea is required with min 10 chars validation; "Confirm" button disabled until valid
- [ ] 1.3 For `approve`: textarea is optional (admin can add notes but not required)
- [ ] 1.4 Show character count below textarea: `{length}/1000` with color indicator when approaching limit
- [ ] 1.5 Add `aria-modal="true"`, `role="dialog"`, focus trap, and ESC-to-close
- [ ] 1.6 Style dialog with dark theme consistent with existing admin panel (bg-card border rounded-lg shadow-lg)

### Task 2 — Refactor Review Mutation for Optimistic Updates

**File:** `src/features/admin/SpotSubmissionList.tsx` (modify)

- [ ] 2.1 Refactor `reviewMutation` to use React Query's `onMutate` for optimistic cache updates:
  - Snapshot current query data in `onMutate`
  - Update the target submission's `status` and `admin_notes` in the cache
  - Update status counts cache (decrement old status, increment new status)
- [ ] 2.2 Add `onError` rollback: restore the snapshot from `onMutate` context
- [ ] 2.3 Add `onSettled`: always invalidate both `['admin', 'spot-submissions']` and `['admin', 'spot-submission-counts']` queries to reconcile with server state
- [ ] 2.4 On mutation error, show an error toast using the app's toast system (or a simple inline alert if no toast system exists)
- [ ] 2.5 Track `reviewingId` state to show loading spinner on the specific card being reviewed

### Task 3 — Wire Dialog into Submission Card Actions

**File:** `src/features/admin/SpotSubmissionList.tsx` (modify)

- [ ] 3.1 Add state for dialog: `dialogState: { open: boolean, action: ActionType, submissionId: string, submissionName: string } | null`
- [ ] 3.2 Replace direct `reviewMutation.mutate()` calls on button clicks with `setDialogState(...)` to open the confirmation dialog
- [ ] 3.3 Render `<SubmissionReviewDialog>` at the bottom of the component, driven by `dialogState`
- [ ] 3.4 On dialog confirm: call `reviewMutation.mutate(...)` with the dialog's action and notes, then close dialog
- [ ] 3.5 Pre-fill dialog notes textarea with any text already entered in the card's inline notes input (`notesById[id]`)
- [ ] 3.6 Clear inline notes state for the submission after successful mutation

### Task 4 — Enhanced Post-Review Display

**File:** `src/features/admin/SpotSubmissionList.tsx` (modify)

- [ ] 4.1 In the expanded card view, when `submission.status !== 'pending'`, show a styled "Review Result" section:
  - Status pill (already exists — verify it renders correctly for all statuses)
  - Admin notes in a callout/blockquote style with a subtle background
  - `reviewed_at` displayed as relative time (e.g., "Reviewed 2 hours ago")
  - If `published_pin_id` exists, show "View Pin →" link to `/pin/{published_pin_id}`
- [ ] 4.2 Hide the review action buttons and inline notes textarea for submissions that are `approved` or `rejected` (only show for `pending` and `changes_requested`)
- [ ] 4.3 For `changes_requested` status, continue showing action buttons so admin can approve or reject after the submitter updates

### Task 5 — Add Relative Time Utility

**File:** `src/lib/formatRelativeTime.ts` (new, if not already existing)

- [ ] 5.1 Check if a relative time formatter already exists in the codebase
- [ ] 5.2 If not, create a lightweight `formatRelativeTime(dateString: string): string` function using `Intl.RelativeTimeFormat` or manual logic
- [ ] 5.3 Handle edge cases: "just now" (< 1 min), minutes, hours, days, "on {date}" (> 7 days)

### Task 6 — Testing

- [ ] 6.1 **Unit test** `SubmissionReviewDialog` component:
  - Renders correct title/body for each action type
  - Textarea required validation for reject/request_changes
  - Textarea optional for approve
  - Confirm button disabled when textarea invalid (reject/request_changes with < 10 chars)
  - onConfirm called with correct notes text
  - Dialog closes on cancel

- [ ] 6.2 **Integration test** review mutation flow:
  - Mock PATCH endpoint, verify optimistic update applies
  - Verify rollback on PATCH failure
  - Verify query invalidation on success
  - Verify inline notes cleared after success

- [ ] 6.3 **E2E test** (Playwright — `e2e/admin-review.spec.ts`):
  - Admin navigates to submission queue
  - Expands a pending submission
  - Clicks "Approve & Publish" → confirm dialog → confirms → status pill turns green
  - Clicks "Reject" → enters reason (< 10 chars → confirm disabled) → enters valid reason → confirms → status pill turns red
  - Clicks "Request Changes" → enters feedback → confirms → status pill turns sky blue
  - Error scenario: mock server error → verify toast and rollback

---

## Dev Notes

### Codebase Context

| Artifact | Path | Relevance |
|---|---|---|
| Admin PATCH endpoint | `api/admin/spot-submissions/[id].ts` | **Already complete** — handles approve/reject/request_changes, creates pin on approval, triggers push notification. No backend changes needed. |
| Admin GET endpoint | `api/admin/spot-submissions.ts` | Returns submissions with filters + pagination. Used by the list query. |
| Submission queue UI | `src/features/admin/SpotSubmissionList.tsx` | **Primary file to modify** — add dialog integration, optimistic updates, and enhanced post-review display. |
| Push notification helper | `api/_submissionNotify.ts` | Fire-and-forget push on status change. Already wired into PATCH endpoint. No changes needed. |
| Submissions table | `supabase/migrations/016_create_spot_submissions.sql` | Schema reference — `status`, `admin_notes`, `reviewed_at`, `published_pin_id` columns. |
| Type definitions | `src/types/spotSubmission.ts` | `SpotSubmission` interface and `SpotSubmissionStatus` type. |
| UI components | `src/components/ui/` | Radix-based primitives — check for existing `Dialog`, `Button`, `Textarea` components. |
| Pin endpoints | `api/pins/[id].ts` | Reference for pin schema — pin creation is handled inside the PATCH endpoint, not here. |

### Architecture Guardrails

1. **No direct pin insertion from frontend.** Pin creation happens server-side inside the PATCH endpoint. The frontend only calls `PATCH /api/admin/spot-submissions/:id`.
2. **Admin auth uses Bearer token** (`ADMIN_SECRET`), not per-user JWT. The `requireAdminAuth()` helper handles this.
3. **RLS on `spot_submissions`**: admin API uses service role key to bypass RLS. Frontend admin calls go through the Vercel API routes which use the service role.
4. **Push notifications are fire-and-forget.** The admin action succeeds even if push delivery fails. Do not add error handling around push in the frontend.
5. **Status transitions**: `pending` → `approved | rejected | changes_requested`. Additionally, `changes_requested` → `approved | rejected | changes_requested` (admin can re-review).
6. **Community pins** created from submissions always get `pin_type: 'community'`, `is_verified: false`, `badge_state: 'grey'`.

### Admin Notes Validation

| Action | Notes Required | Min Length | Max Length |
|---|---|---|---|
| `approve` | No (optional) | — | 1000 |
| `reject` | **Yes** | 10 chars | 1000 |
| `request_changes` | **Yes** | 10 chars | 1000 |

The backend schema validates `admin_notes` as `z.string().trim().max(1000).optional().nullable()`. The min-length requirement is a **frontend-only** validation to ensure meaningful feedback.

### Optimistic Update Strategy

```
User clicks action button
  → Dialog opens (pre-filled with inline notes if any)
  → User confirms
  → Dialog closes immediately
  → onMutate:
      • Snapshot current cache
      • Update submission status + admin_notes in cache
      • Update counts cache
  → PATCH request fires
  → onSuccess: invalidate queries (reconcile)
  → onError: restore snapshot, show error toast
  → onSettled: always invalidate for safety
```

### Testing Requirements

- **Unit tests**: Use Vitest + React Testing Library for `SubmissionReviewDialog` component
- **Integration tests**: Mock `fetch` to test mutation lifecycle (optimistic update → success/error)
- **E2E tests**: Playwright tests in `e2e/` directory, following existing patterns
- Run existing test suite after changes to verify no regressions: `npm run test` and `npx playwright test`

### UI/UX Constraints

- **Speed target**: Admin should complete approve/reject in under 10 seconds per submission
- **Dialog not drawer**: Use `Dialog` (modal overlay) not `Sheet` (side drawer) for confirmation — keeps context visible behind
- **Dark theme**: All new components must respect the dark theme classes used across the admin panel
- **Mobile-friendly**: Dialog must be usable on mobile viewports (min-width 320px)
- **Keyboard accessible**: Dialog must trap focus, close on ESC, confirm on Enter (when valid)

### Dependencies

- Radix UI Dialog (`@radix-ui/react-dialog`) — check if already installed, otherwise use the existing `Dialog` component from `src/components/ui/dialog.tsx`
- React Query (`@tanstack/react-query`) — already in use for data fetching
- No new packages should be needed

### What NOT to Build

- ❌ Batch actions (AC8) — stretch goal, skip for now
- ❌ Photo display in dialog — photos are shown in the expanded card, not duplicated in the confirm dialog
- ❌ Undo after confirm — once confirmed, the action is final (push notification fires immediately)
- ❌ Admin audit log — out of scope for this story
- ❌ Re-approval flow (approve an already-approved submission) — not a valid state transition
