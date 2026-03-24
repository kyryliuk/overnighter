# Story 5.3: Submission Status Tracking

Status: ready-for-dev

## Story

As a **user who submitted a spot**,
I want to see the status of my submissions, receive push notifications when they're approved or rejected, and see my name on approved pins,
So that I know my contribution was received, acted on, and recognized by the community.

## Acceptance Criteria

**AC1 — Status pill visibility in My Submissions**
Given a user has submitted one or more spots
When they open the `/suggest-spot` route and scroll to "My submissions"
Then each submission is shown with a colored status pill: Pending (yellow), Approved (green), Rejected (red), Changes Requested (sky blue)
And each pill uses the existing `STATUS_STYLES` map in `SuggestSpotScreen.tsx`

**AC2 — Auto-refresh submission status**
Given a user is viewing the "My submissions" section
When an admin changes the status of one of their submissions
Then the submission list auto-refreshes every 30 seconds via `refetchInterval`
And the status pill updates to reflect the new status without a manual page reload
And stale data is replaced seamlessly (no loading flash on refetch)

**AC3 — Empty state when no submissions**
Given a signed-in user with no past submissions
When they view the "My submissions" section
Then a friendly empty state message is displayed: "You haven't submitted any spots yet."
And no error state or skeleton is shown

**AC4 — Submission detail view**
Given a user taps on a submission card in the "My submissions" list
When the card expands or a detail view opens
Then all submitted data is visible: spot name, coordinates, amenities, description, website, phone, max length, max height
And the current status pill is shown
And admin feedback is displayed if present (rejection reason or change request notes)
And the submission date is shown formatted as "Mon DD, YYYY"
And if the submission is approved, a "View on map" link navigates to `/pin/{publishedPinId}`

**AC5 — Push notification on approval**
Given an admin approves a spot submission via `PATCH /api/admin/spot-submissions/:id`
When the approval is processed
Then a push notification is sent to the submitter: title = spot name, body = "Your spot was approved and is now live on the map!"
And the notification includes a deep link URL: `/pin/{publishedPinId}`

**AC6 — Push notification on rejection**
Given an admin rejects a spot submission
When the rejection is processed
Then a push notification is sent to the submitter: title = spot name, body = "Your submission was not approved." + admin notes if present
And the notification includes a deep link URL: `/suggest-spot` (to view their submissions)

**AC7 — Push notification on changes requested**
Given an admin requests changes on a spot submission
When the changes request is processed
Then a push notification is sent to the submitter: title = spot name, body = "Changes requested on your submission — check the feedback."
And the notification includes a deep link URL: `/suggest-spot`

**AC8 — Submitter attribution on approved pins**
Given an approved submission has a `published_pin_id` linking to a live pin
When any user views that pin's detail sheet
Then "Submitted by [display name or email]" is visible below the category label
And the attribution only appears for pins with `pin_type = 'community'` that have a linked submission

**AC9 — Status badge styling**
Given a submission has any valid status
When displayed in the My Submissions list or detail view
Then the status pill is color-coded:
- `pending` → yellow (`bg-yellow-500/15 text-yellow-300 border border-yellow-500/20`)
- `approved` → green (`bg-green-500/15 text-green-300 border border-green-500/20`)
- `rejected` → red (`bg-red-500/15 text-red-300 border border-red-500/20`)
- `changes_requested` → sky blue (`bg-sky-500/15 text-sky-300 border border-sky-500/20`)

## Tasks / Subtasks

- [ ] Task 1: Add auto-refresh to submissions query (AC: 2)
  - [ ] 1.1 Modify `src/features/spot-submissions/SuggestSpotScreen.tsx`:
    - Add `refetchInterval: 30_000` to the `submissionsQuery` `useQuery` options:
      ```tsx
      const submissionsQuery = useQuery({
        queryKey: ['spot-submissions', session?.user.id],
        enabled: Boolean(session?.access_token),
        refetchInterval: 30_000,
        queryFn: async () => {
          const res = await fetch('/api/spot-submissions', {
            headers: { Authorization: `Bearer ${session?.access_token}` },
          })
          if (!res.ok) throw new Error('Failed to load submissions')
          return res.json() as Promise<SpotSubmission[]>
        },
      })
      ```
    - This ensures the list auto-refreshes every 30 seconds without any loading flash — React Query replaces data in-place on successful refetch.

- [ ] Task 2: Add submission detail expandable view (AC: 4, 9)
  - [ ] 2.1 Add `expandedId` state to `SuggestSpotScreen`:
    ```tsx
    const [expandedId, setExpandedId] = useState<string | null>(null)
    ```
  - [ ] 2.2 Create a `STATUS_LABELS` map for human-readable status text:
    ```tsx
    const STATUS_LABELS: Record<SpotSubmissionStatus, string> = {
      pending: 'Pending review',
      approved: 'Approved',
      rejected: 'Rejected',
      changes_requested: 'Changes requested',
    }
    ```
  - [ ] 2.3 Create a `SubmissionDetail` inline component rendered inside each `<li>` when expanded:
    ```tsx
    function SubmissionDetail({ submission }: { submission: SpotSubmission }) {
      const navigate = useNavigate()
      const formattedDate = new Intl.DateTimeFormat('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      }).format(new Date(submission.createdAt))

      return (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Submitted</span>
              <p className="text-foreground">{formattedDate}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <p className="text-foreground">{STATUS_LABELS[submission.status]}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Coordinates</span>
              <p className="text-foreground font-mono text-xs">
                {submission.latitude.toFixed(6)}, {submission.longitude.toFixed(6)}
              </p>
            </div>
            {(submission.maxLengthFt || submission.maxHeightFt) && (
              <div>
                <span className="text-muted-foreground">Size limits</span>
                <p className="text-foreground">
                  {[
                    submission.maxLengthFt && `${submission.maxLengthFt}ft L`,
                    submission.maxHeightFt && `${submission.maxHeightFt}ft H`,
                  ].filter(Boolean).join(', ')}
                </p>
              </div>
            )}
          </div>

          {submission.description && (
            <div className="text-sm">
              <span className="text-muted-foreground">Description</span>
              <p className="text-foreground">{submission.description}</p>
            </div>
          )}

          {submission.website && (
            <div className="text-sm">
              <span className="text-muted-foreground">Website</span>
              <a href={submission.website} target="_blank" rel="noopener noreferrer"
                className="text-sky-400 underline break-all block">{submission.website}</a>
            </div>
          )}

          {submission.phone && (
            <div className="text-sm">
              <span className="text-muted-foreground">Phone</span>
              <a href={`tel:${submission.phone}`} className="text-sky-400 underline block">{submission.phone}</a>
            </div>
          )}

          {/* Amenities summary */}
          <div className="text-sm">
            <span className="text-muted-foreground">Amenities</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(submission.amenities)
                .filter(([, v]) => v)
                .map(([key]) => (
                  <span key={key} className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                    {key.replace(/_/g, ' ')}
                  </span>
                ))}
            </div>
          </div>

          {submission.adminNotes && (
            <div className="rounded-lg border border-border px-3 py-2 text-sm">
              <span className="text-muted-foreground font-medium">Admin feedback</span>
              <p className="text-foreground mt-1">{submission.adminNotes}</p>
            </div>
          )}

          {submission.status === 'approved' && submission.publishedPinId && (
            <button
              onClick={() => navigate(`/pin/${submission.publishedPinId}`)}
              className="w-full min-h-[44px] rounded-lg font-medium text-white bg-green-600 hover:bg-green-700 transition-colors"
            >
              View on map →
            </button>
          )}
        </div>
      )
    }
    ```
  - [ ] 2.4 Update the submission list `<li>` to toggle expansion on click and render `SubmissionDetail` when expanded:
    - Make the `<li>` clickable with `onClick={() => setExpandedId(expandedId === submission.id ? null : submission.id)}`
    - Add `cursor-pointer` class to the `<li>`
    - Add expand/collapse chevron indicator:
      ```tsx
      <li
        key={submission.id}
        className="rounded-xl border border-border bg-background p-4 space-y-2 cursor-pointer transition-colors hover:bg-background/80"
        onClick={() => setExpandedId(expandedId === submission.id ? null : submission.id)}
        role="button"
        aria-expanded={expandedId === submission.id}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpandedId(expandedId === submission.id ? null : submission.id)
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{submission.name}</p>
            <p className="text-xs text-muted-foreground">
              {submission.latitude.toFixed(4)}, {submission.longitude.toFixed(4)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[submission.status]}`}>
              {submission.status.replace('_', ' ')}
            </span>
            <span className="text-muted-foreground text-xs" aria-hidden="true">
              {expandedId === submission.id ? '▲' : '▼'}
            </span>
          </div>
        </div>
        {expandedId === submission.id && (
          <SubmissionDetail submission={submission} />
        )}
      </li>
      ```
    - Remove the previously separate `{submission.description && ...}` and `{submission.adminNotes && ...}` blocks from the collapsed card — these are now shown inside `SubmissionDetail` when expanded.

- [ ] Task 3: Send push notification on admin status change (AC: 5, 6, 7)
  - [ ] 3.1 Create helper function `api/_submissionNotify.ts`:
    ```typescript
    import type { SupabaseClient } from '@supabase/supabase-js'

    interface SubmissionNotifyParams {
      userId: string
      submissionName: string
      action: 'approve' | 'reject' | 'request_changes'
      adminNotes?: string | null
      publishedPinId?: string | null
    }

    export async function notifySubmissionStatusChange(
      supabase: SupabaseClient,
      params: SubmissionNotifyParams,
    ): Promise<void> {
      const { userId, submissionName, action, adminNotes, publishedPinId } = params

      // Check if user has push subscriptions
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('user_id')
        .eq('user_id', userId)
        .limit(1)

      if (!subscriptions?.length) return

      let title: string
      let body: string
      let url: string

      switch (action) {
        case 'approve':
          title = submissionName
          body = 'Your spot was approved and is now live on the map!'
          url = publishedPinId ? `/pin/${publishedPinId}` : '/suggest-spot'
          break
        case 'reject':
          title = submissionName
          body = adminNotes
            ? `Your submission was not approved. ${adminNotes}`
            : 'Your submission was not approved.'
          url = '/suggest-spot'
          break
        case 'request_changes':
          title = submissionName
          body = 'Changes requested on your submission — check the feedback.'
          url = '/suggest-spot'
          break
      }

      const sendUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}/api/push/send`
        : 'http://localhost:3000/api/push/send'
      const adminToken = process.env.PUSH_ADMIN_TOKEN

      if (!adminToken) {
        console.error('[_submissionNotify] PUSH_ADMIN_TOKEN not configured')
        return
      }

      // Fire-and-forget — don't block the admin response
      fetch(sendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ userId, title, body, url }),
      }).catch((err) => {
        console.error('[_submissionNotify] push send failed', err)
      })
    }
    ```
  - [ ] 3.2 Modify `api/admin/spot-submissions/[id].ts` to call the notification helper after status update:
    - Add import at top:
      ```typescript
      import { notifySubmissionStatusChange } from '../../_submissionNotify'
      ```
    - After the successful `supabase.from('spot_submissions').update(...)` call and before the `return res.status(200)` response, add:
      ```typescript
      // Fire-and-forget push notification to submitter
      notifySubmissionStatusChange(supabase, {
        userId: record.user_id,
        submissionName: record.name,
        action: parsed.data.action,
        adminNotes: parsed.data.admin_notes,
        publishedPinId: publishedPinId,
      })
      ```
    - This is fire-and-forget — the admin response is not delayed by push delivery.

- [ ] Task 4: Add submitter attribution on approved pins (AC: 8)
  - [ ] 4.1 Create API endpoint `api/pins/[id]/submitter.ts`:
    ```typescript
    import type { VercelRequest, VercelResponse } from '@vercel/node'
    import { createServiceClient } from '../../_supabase'

    export default async function handler(req: VercelRequest, res: VercelResponse) {
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'GET only', status: 405 })
      }

      const pinId = req.query.id
      if (typeof pinId !== 'string') {
        return res.status(400).json({ error: 'INVALID_ID', message: 'Pin id is required', status: 400 })
      }

      const supabase = createServiceClient()

      try {
        const { data, error } = await supabase
          .from('spot_submissions')
          .select('user_id')
          .eq('published_pin_id', pinId)
          .eq('status', 'approved')
          .limit(1)
          .maybeSingle()

        if (error) throw error
        if (!data) {
          return res.status(200).json({ submitter: null })
        }

        // Fetch user display name from auth.users via admin API
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(data.user_id)
        if (userError || !user) {
          return res.status(200).json({ submitter: null })
        }

        const displayName =
          user.user_metadata?.display_name ||
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          'A community member'

        return res.status(200).json({ submitter: displayName })
      } catch (error) {
        console.error('[api/pins/:id/submitter]', error)
        return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
      }
    }
    ```
  - [ ] 4.2 Create client hook `src/hooks/usePinSubmitter.ts`:
    ```typescript
    import { useQuery } from '@tanstack/react-query'

    export function usePinSubmitter(pinId: string | undefined, pinType: string | undefined) {
      return useQuery({
        queryKey: ['pin-submitter', pinId],
        enabled: Boolean(pinId) && pinType === 'community',
        staleTime: 5 * 60 * 1000, // 5 min — submitter doesn't change
        queryFn: async () => {
          const res = await fetch(`/api/pins/${pinId}/submitter`)
          if (!res.ok) return null
          const data = (await res.json()) as { submitter: string | null }
          return data.submitter
        },
      })
    }
    ```
  - [ ] 4.3 Modify `src/features/pin-detail/PinDetailSheet.tsx`:
    - Add import:
      ```typescript
      import { usePinSubmitter } from '@/hooks/usePinSubmitter'
      ```
    - Add hook call inside the component, after `const pin = pins.find(...)`:
      ```typescript
      const { data: submitterName } = usePinSubmitter(pin?.id, pin?.pinType)
      ```
    - Add attribution display below the category `<p>` tag (the `PIN_TYPE_LABELS` line):
      ```tsx
      {/* Category */}
      <p className="text-sm text-muted-foreground">
        {PIN_TYPE_LABELS[pin.pinType] ?? pin.pinType}
      </p>
      {/* Submitter attribution (community pins only) */}
      {submitterName && (
        <p className="text-xs text-muted-foreground italic">
          Submitted by {submitterName}
        </p>
      )}
      ```

- [ ] Task 5: Create tests for status tracking features (AC: 1–9)
  - [ ] 5.1 Update `src/features/spot-submissions/SuggestSpotScreen.test.tsx`:
    - Test: Submissions list renders with correct status pills (pending/approved/rejected/changes_requested)
    - Test: Empty state shows "You haven't submitted any spots yet." when no submissions
    - Test: Clicking a submission card expands it to show full detail
    - Test: Expanded detail shows all submission data (name, coordinates, amenities, description, etc.)
    - Test: Expanded detail shows admin feedback when `adminNotes` is present
    - Test: "View on map" button appears for approved submissions with `publishedPinId`
    - Test: "View on map" button navigates to `/pin/{publishedPinId}`
    - Test: Clicking an expanded submission collapses it
    - Test: Submissions query uses `refetchInterval: 30000`
    - Test: Status pills use correct CSS classes from `STATUS_STYLES`
    - Follow existing test patterns: mock `useAuth`, mock `fetch`, use `@testing-library/react`
  - [ ] 5.2 Create `src/hooks/usePinSubmitter.test.ts`:
    - Test: Returns null when pinType is not 'community'
    - Test: Returns submitter name when API responds with valid name
    - Test: Returns null when API responds with `{ submitter: null }`
    - Test: Query is not enabled when pinId is undefined
    - Use `@tanstack/react-query` test utilities with `QueryClientProvider` wrapper
  - [ ] 5.3 Create `api/_submissionNotify.test.ts`:
    - Test: Calls push/send API with correct title/body/url for approve action
    - Test: Calls push/send API with correct title/body/url for reject action (with admin notes)
    - Test: Calls push/send API with correct title/body/url for request_changes action
    - Test: Does not call push/send if user has no push subscriptions
    - Test: Does not throw if push/send API call fails (fire-and-forget)
    - Mock `fetch` and Supabase client
  - [ ] 5.4 Create `api/pins/[id]/submitter.test.ts`:
    - Test: Returns submitter display name for approved submission linked to pin
    - Test: Returns `{ submitter: null }` when no submission links to pin
    - Test: Returns `{ submitter: null }` when submission exists but user lookup fails
    - Test: Returns 405 for non-GET methods
    - Mock Supabase `from().select()` and `auth.admin.getUserById()`

- [ ] Task 6: Final validation (all ACs)
  - [ ] 6.1 Run `npm run lint` — no new lint errors
  - [ ] 6.2 Run `npm run test -- --reporter=verbose` — all existing + new tests pass
  - [ ] 6.3 Run `npm run build` — build succeeds
  - [ ] 6.4 Manual verification:
    - Navigate to `/suggest-spot` → verify "My submissions" section shows past submissions
    - Verify each submission shows correct status pill color
    - Tap a submission → verify detail view expands with all data
    - Tap again → verify it collapses
    - Verify approved submission with `publishedPinId` shows "View on map" button
    - Navigate to an approved community pin → verify "Submitted by [name]" attribution
    - Verify empty state displays correctly for users with no submissions
    - Wait 30 seconds → verify list auto-refreshes (check Network tab)

## Dev Notes

### Context Summary

This story adds real-time submission status tracking, push notifications on admin review actions, and submitter attribution on approved community pins. The "My submissions" list and status pills already exist from Story 5.2 — this story enhances them with auto-refresh, expandable detail view, push notifications, and pin attribution.

### Current Repository Reality

**What already exists and works (from Stories 5.1 & 5.2):**
- `src/features/spot-submissions/SuggestSpotScreen.tsx` — Multi-step wizard (3 steps) with "My submissions" section showing status pills. Status pill styling is already implemented via `STATUS_STYLES` constant. Admin feedback display already exists for the collapsed view.
- `api/spot-submissions.ts` — GET (list user submissions) and POST (create) endpoints with Zod validation and `requireUserAuth`.
- `api/admin/spot-submissions/[id].ts` — PATCH endpoint for admin approve/reject/request_changes. Creates pin on approval. **Does NOT send push notifications yet — Story 5.3 adds this.**
- `api/_spot-submissions.ts` — `mapSpotSubmission` helper (snake_case → camelCase mapping).
- `api/_pushNotify.ts` — Push notification helper for check-in status changes (existing pattern to follow for submission notifications).
- `api/push/send.ts` — Generic push send endpoint accepting `{ userId, title, body, url }` with PUSH_ADMIN_TOKEN auth.
- `api/push/subscribe.ts` — Push subscription management (POST/DELETE).
- `src/hooks/usePushSubscription.ts` — Client-side push subscription hook.
- `src/features/pin-detail/PinDetailSheet.tsx` — Pin detail sheet showing all pin info. Currently does NOT show submitter attribution.
- `supabase/migrations/016_create_spot_submissions.sql` — `spot_submissions` table with `status`, `admin_notes`, `reviewed_at`, `published_pin_id` columns. RLS policies allow users to read their own submissions.
- `src/types/spotSubmission.ts` — `SpotSubmission` interface with all fields including `publishedPinId`, `adminNotes`, `reviewedAt`.

**Existing patterns to follow:**
- `api/_pushNotify.ts` — Pattern for push notification helpers: check subscriptions → build message → fire-and-forget fetch to `/api/push/send`.
- `SuggestSpotScreen.tsx` — Pattern for submission list rendering, status pill styling, `useQuery` with auth token.
- `PinDetailSheet.tsx` — Pattern for pin detail queries (e.g., `usePinPhotos` hook).

### Architecture Guardrails

1. **Submissions never bypass moderation.** Status is server-authoritative. Clients read status from database via `GET /api/spot-submissions` — never derive or set status locally.
2. **Auth is required for submission queries.** The `spot_submissions` table has RLS: `USING (auth.uid() = user_id)`. API calls `requireUserAuth`. Do NOT expose other users' submissions.
3. **Push is fire-and-forget.** The admin endpoint must NOT wait for push delivery. Call `notifySubmissionStatusChange()` without `await` — don't block the admin response.
4. **Admin notes are always included.** When rejecting or requesting changes, `admin_notes` from the admin UI are included in the push notification body. This is critical for user trust.
5. **Submitter attribution uses service-role lookup.** The `api/pins/[id]/submitter.ts` endpoint uses `supabase.auth.admin.getUserById()` which requires the service role key. This is a read-only endpoint — no auth required for the request itself (public pin data).
6. **No new migrations needed.** All required columns (`status`, `admin_notes`, `published_pin_id`, `user_id`) already exist in the `spot_submissions` table. The `push_subscriptions` table already supports per-user lookups.

### Implementation Notes

**Auto-refresh approach:** Use React Query's `refetchInterval: 30_000` on the submissions query. This is the simplest polling approach and avoids WebSocket complexity. React Query handles data replacement seamlessly — no loading flash on refetch. The interval only runs while the component is mounted and the query is enabled.

**Expandable detail view:** Use local state (`expandedId`) to toggle detail visibility per submission. Only one submission can be expanded at a time (clicking another collapses the previous). The `SubmissionDetail` component renders inline within the `<li>` — no separate route or modal. This keeps the implementation simple and consistent with the existing card layout.

**Push notification pattern:** Follow the existing `_pushNotify.ts` pattern. Create a parallel helper `_submissionNotify.ts` rather than modifying the existing file (different notification types, different payloads). The admin PATCH endpoint calls the helper after updating the database — fire-and-forget via unawaited promise.

**Submitter attribution flow:** Create a dedicated API endpoint rather than embedding submitter info in the pin query. This is cleaner separation of concerns — pin data comes from `pins` table, submitter info comes from `spot_submissions` + `auth.users` join. The client hook `usePinSubmitter` only fires for `community` pin type, with a 5-minute stale time since submitter doesn't change.

**User display name resolution:** The submitter endpoint uses `supabase.auth.admin.getUserById()` to get user metadata. Display name fallback chain: `user_metadata.display_name` → `user_metadata.full_name` → email prefix → "A community member". This matches how Supabase stores user profile data.

### Database Schema Reference

```sql
-- spot_submissions table (migration 016 — already exists)
CREATE TABLE spot_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  amenities JSONB NOT NULL,
  max_length_ft INTEGER,
  max_height_ft DOUBLE PRECISION,
  website TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  admin_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  published_pin_id UUID REFERENCES pins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- push_subscriptions table (already exists from Epic 4)
-- Columns: user_id, endpoint, p256dh, auth
```

### API Reference

```
# Existing endpoints (no changes needed)
GET  /api/spot-submissions          → List user's own submissions (auth required)
POST /api/spot-submissions          → Create new submission (auth required)
POST /api/push/send                 → Send push notification (PUSH_ADMIN_TOKEN required)

# Existing endpoint (modified in Task 3)
PATCH /api/admin/spot-submissions/:id → Approve/reject (admin required) — add push notification call

# New endpoint (Task 4)
GET  /api/pins/:id/submitter        → Get submitter display name for community pin (public)
```

### Key Files to Modify

| File | Change |
|---|---|
| `src/features/spot-submissions/SuggestSpotScreen.tsx` | Add `refetchInterval`, expandable detail view, `SubmissionDetail` component |
| `api/admin/spot-submissions/[id].ts` | Add push notification call after status update |
| `src/features/pin-detail/PinDetailSheet.tsx` | Add submitter attribution for community pins |

### Key Files to Create

| File | Purpose |
|---|---|
| `api/_submissionNotify.ts` | Push notification helper for submission status changes |
| `api/pins/[id]/submitter.ts` | API endpoint to get submitter name for a pin |
| `src/hooks/usePinSubmitter.ts` | Client hook for fetching submitter attribution |

### Key Files to Reference (read-only)

| File | Purpose |
|---|---|
| `api/_pushNotify.ts` | Existing push notification pattern (check-in notifications) |
| `api/push/send.ts` | Push send endpoint (accepts userId, title, body, url) |
| `api/_spot-submissions.ts` | DB→client mapping helper |
| `src/types/spotSubmission.ts` | `SpotSubmission`, `SpotSubmissionStatus` types |
| `src/features/spots/spotFormConfig.ts` | `SPOT_AMENITY_LABELS` for amenity display |
| `src/hooks/usePinPhotos.ts` | Pattern for pin-specific data hooks |
| `supabase/migrations/016_create_spot_submissions.sql` | Table schema reference |

### Testing Requirements

- Unit tests for `notifySubmissionStatusChange` helper (all 3 actions, no-subscription case, error resilience)
- Unit tests for `GET /api/pins/:id/submitter` endpoint (happy path, no submission, user lookup failure)
- Component tests for expandable submission detail view (expand, collapse, data display)
- Component tests for auto-refresh configuration (verify `refetchInterval` is set)
- Component tests for "View on map" button (navigation to `/pin/{publishedPinId}`)
- Component tests for empty state display
- Hook tests for `usePinSubmitter` (enabled/disabled conditions, return values)
- All existing tests must continue to pass — no regressions
- Mock `useAuth`, `fetch`, and Supabase client per existing test patterns
