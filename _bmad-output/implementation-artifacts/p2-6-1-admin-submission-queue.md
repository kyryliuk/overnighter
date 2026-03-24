# Story 6.1: Admin Submission Queue

Status: ready-for-dev

## Story

As an **admin user**,
I want to see a filterable, paginated list of all spot submissions with status indicators and submission metadata,
So that I can triage and process community contributions efficiently from a single queue view.

## Acceptance Criteria

**AC1 — Admin-only submission queue page**
Given a user navigates to `/admin`
When the AdminDashboard loads and the user is authenticated with a valid admin token
Then the "Spot Submissions" section displays a queue of all submissions using `AdminReviewCard` components
And the queue is only visible to authenticated admin users (non-admin users see the `AdminAuth` login gate)

**AC2 — Status filter tabs**
Given an admin is viewing the submission queue
When they see the filter bar above the submissions list
Then filter options are displayed as horizontal pill/chip buttons: All, Pending, Approved, Rejected, Changes Requested
And "Pending" is selected by default on first load
And each filter shows a count badge with the number of submissions in that status
And clicking a filter updates the list to show only submissions with that status

**AC3 — Submission count badges**
Given there are submissions in various statuses
When the admin views the filter bar
Then each filter chip displays the count of submissions in that status (e.g., "Pending (12)")
And the "All" chip displays the total count across all statuses
And counts update after any review action (approve/reject/request changes) completes

**AC4 — Submission card display**
Given the submission list has loaded
When a submission card renders
Then it displays: spot name (bold), submitter email/name, submission date (formatted as "Mon DD, YYYY"), status pill (color-coded), and spot type/amenities summary
And the status pill uses consistent colors: Pending (yellow), Approved (green), Rejected (red), Changes Requested (sky blue)
And coordinates are shown as `lat, lng` with 4 decimal places

**AC5 — Sort by submission date**
Given the submission queue loads
When submissions are displayed
Then they are sorted by `created_at` ascending (oldest first) by default — so admins process the oldest submissions first
And the sort order is applied server-side via the API query

**AC6 — Pagination for large lists**
Given there are more than 20 submissions matching the current filter
When the admin scrolls to the bottom of the visible list
Then a "Load more" button appears to fetch the next page of 20 results
And newly loaded submissions are appended to the existing list (not replaced)
And the button disappears when all submissions have been loaded
And a loading indicator shows while the next page is being fetched

**AC7 — Click to view full submission details**
Given an admin sees a submission card in the queue
When they click/tap on the card
Then the card expands inline to reveal full submission details: description, all amenities, max length/height, website, phone, admin notes (if any), and the published pin ID (if approved)
And clicking the expanded card again collapses it
And only one card can be expanded at a time

**AC8 — Loading, error, and empty states**
Given the admin is viewing the submission queue
When submissions are loading, then a skeleton/loading indicator is shown
When the API request fails, then an error message with a retry button is shown
When no submissions match the current filter, then a contextual empty state message is shown (e.g., "No pending submissions" or "No rejected submissions")

**AC9 — Auto-refresh on mutation**
Given an admin approves, rejects, or requests changes on a submission
When the mutation completes successfully
Then the submission list re-fetches automatically
And the status counts in the filter bar update to reflect the change
And the reviewed submission's status pill updates in-place

## Tasks / Subtasks

- [ ] Task 1: Add status filter query parameter to admin submissions API (AC: 2, 3, 5, 6)
  - [ ] 1.1 Modify `api/admin/spot-submissions.ts`:
    - Accept optional `status` query parameter to filter by submission status:
      ```typescript
      import type { VercelRequest, VercelResponse } from '@vercel/node'
      import { requireAdminAuth } from '../_middleware'
      import { createServiceClient } from '../_supabase'
      import { mapSpotSubmission, type ApiDbSpotSubmission } from '../_spot-submissions'

      const VALID_STATUSES = ['pending', 'approved', 'rejected', 'changes_requested'] as const

      export default async function handler(req: VercelRequest, res: VercelResponse) {
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'GET only', status: 405 })
        }

        if (!requireAdminAuth(req, res)) return

        const supabase = createServiceClient()
        const statusFilter = req.query.status as string | undefined
        const page = Math.max(1, parseInt(req.query.page as string, 10) || 1)
        const limit = 20
        const offset = (page - 1) * limit

        try {
          let query = supabase
            .from('spot_submissions')
            .select('*', { count: 'exact' })

          if (statusFilter && VALID_STATUSES.includes(statusFilter as typeof VALID_STATUSES[number])) {
            query = query.eq('status', statusFilter)
          }

          query = query
            .order('created_at', { ascending: true })
            .range(offset, offset + limit - 1)

          const { data, error, count } = await query

          if (error) throw error

          return res.status(200).json({
            submissions: (data as ApiDbSpotSubmission[]).map(mapSpotSubmission),
            total: count ?? 0,
            page,
            pageSize: limit,
            hasMore: (count ?? 0) > offset + limit,
          })
        } catch (error) {
          console.error('[api/admin/spot-submissions]', error)
          return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
        }
      }
      ```
    - **Breaking change note:** The response shape changes from a flat array to `{ submissions, total, page, pageSize, hasMore }`. The existing `SpotSubmissionList.tsx` must be updated to consume the new shape (Task 3).

  - [ ] 1.2 Add a new count endpoint `api/admin/spot-submissions/counts.ts`:
    - Returns per-status counts for the filter bar badges:
      ```typescript
      import type { VercelRequest, VercelResponse } from '@vercel/node'
      import { requireAdminAuth } from '../../_middleware'
      import { createServiceClient } from '../../_supabase'

      export default async function handler(req: VercelRequest, res: VercelResponse) {
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'GET only', status: 405 })
        }

        if (!requireAdminAuth(req, res)) return

        const supabase = createServiceClient()

        try {
          const { data, error } = await supabase
            .from('spot_submissions')
            .select('status')

          if (error) throw error

          const counts: Record<string, number> = {
            all: 0,
            pending: 0,
            approved: 0,
            rejected: 0,
            changes_requested: 0,
          }

          for (const row of data ?? []) {
            counts[row.status] = (counts[row.status] ?? 0) + 1
            counts.all += 1
          }

          return res.status(200).json(counts)
        } catch (error) {
          console.error('[api/admin/spot-submissions/counts]', error)
          return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
        }
      }
      ```

- [ ] Task 2: Add `user_id` to `mapSpotSubmission` response (AC: 4)
  - [ ] 2.1 Modify `api/_spot-submissions.ts`:
    - The current `mapSpotSubmission` drops `user_id` from the response. The admin queue needs it to display the submitter. Add `userId` to the mapped output:
      ```typescript
      export function mapSpotSubmission(record: ApiDbSpotSubmission) {
        return {
          id: record.id,
          userId: record.user_id,       // ← ADD THIS
          name: record.name,
          description: record.description,
          latitude: record.latitude,
          longitude: record.longitude,
          amenities: record.amenities,
          maxLengthFt: record.max_length_ft,
          maxHeightFt: record.max_height_ft,
          website: record.website,
          phone: record.phone,
          status: record.status,
          adminNotes: record.admin_notes,
          reviewedAt: record.reviewed_at,
          publishedPinId: record.published_pin_id,
          createdAt: record.created_at,
          updatedAt: record.updated_at,
        }
      }
      ```
    - **Note:** This is safe for the user-facing `GET /api/spot-submissions` endpoint because RLS already restricts users to their own submissions — they'd see their own `userId` which is not a leak.
  - [ ] 2.2 Update `src/types/spotSubmission.ts` to add the `userId` field:
    ```typescript
    export interface SpotSubmission {
      id: string
      userId: string              // ← ADD THIS
      name: string
      // ...rest unchanged
    }
    ```

- [ ] Task 3: Refactor `SpotSubmissionList` into queue with filters (AC: 1, 2, 3, 4, 5, 6, 7, 8, 9)
  - [ ] 3.1 Add status filter state and filter bar UI to `src/features/admin/SpotSubmissionList.tsx`:
    - Add imports and constants at the top:
      ```tsx
      import type { SpotSubmission, SpotSubmissionStatus } from '@/types/spotSubmission'

      type StatusFilter = SpotSubmissionStatus | 'all'

      const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
        { value: 'all', label: 'All' },
        { value: 'pending', label: 'Pending' },
        { value: 'approved', label: 'Approved' },
        { value: 'rejected', label: 'Rejected' },
        { value: 'changes_requested', label: 'Changes Requested' },
      ]

      const STATUS_PILL_STYLES: Record<SpotSubmissionStatus, string> = {
        pending: 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/20',
        approved: 'bg-green-500/15 text-green-300 border border-green-500/20',
        rejected: 'bg-red-500/15 text-red-300 border border-red-500/20',
        changes_requested: 'bg-sky-500/15 text-sky-300 border border-sky-500/20',
      }
      ```
    - Add state for `activeFilter`, `page`, and `expandedId`:
      ```tsx
      const [activeFilter, setActiveFilter] = useState<StatusFilter>('pending')
      const [page, setPage] = useState(1)
      const [expandedId, setExpandedId] = useState<string | null>(null)
      const [allSubmissions, setAllSubmissions] = useState<SpotSubmission[]>([])
      ```
    - Reset `page` to 1 and clear `allSubmissions` when `activeFilter` changes:
      ```tsx
      function handleFilterChange(filter: StatusFilter) {
        setActiveFilter(filter)
        setPage(1)
        setAllSubmissions([])
        setExpandedId(null)
      }
      ```

  - [ ] 3.2 Update the submissions query to use the new paginated API:
    ```tsx
    interface PaginatedResponse {
      submissions: SpotSubmission[]
      total: number
      page: number
      pageSize: number
      hasMore: boolean
    }

    const submissionsQuery = useQuery({
      queryKey: ['admin', 'spot-submissions', adminToken, activeFilter, page],
      queryFn: async () => {
        const params = new URLSearchParams({ page: String(page) })
        if (activeFilter !== 'all') params.set('status', activeFilter)

        const res = await fetch(`/api/admin/spot-submissions?${params}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })

        if (!res.ok) throw new Error('Failed to fetch spot submissions')
        return res.json() as Promise<PaginatedResponse>
      },
    })

    // Accumulate pages for "Load more" behavior
    useEffect(() => {
      if (submissionsQuery.data) {
        setAllSubmissions((prev) =>
          page === 1
            ? submissionsQuery.data!.submissions
            : [...prev, ...submissionsQuery.data!.submissions],
        )
      }
    }, [submissionsQuery.data, page])
    ```

  - [ ] 3.3 Add the status counts query for filter badges:
    ```tsx
    const countsQuery = useQuery({
      queryKey: ['admin', 'spot-submission-counts', adminToken],
      queryFn: async () => {
        const res = await fetch('/api/admin/spot-submissions/counts', {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
        if (!res.ok) throw new Error('Failed to fetch counts')
        return res.json() as Promise<Record<string, number>>
      },
    })
    ```

  - [ ] 3.4 Build the filter bar component inline:
    ```tsx
    <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Filter submissions by status">
      {STATUS_FILTERS.map((filter) => {
        const count = countsQuery.data?.[filter.value] ?? 0
        const isActive = activeFilter === filter.value
        return (
          <button
            key={filter.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => handleFilterChange(filter.value)}
            className={`min-h-[36px] rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {filter.label}
            <span className="ml-1.5 text-xs opacity-70">({count})</span>
          </button>
        )
      })}
    </div>
    ```

  - [ ] 3.5 Update each submission card to show the required metadata (AC4):
    ```tsx
    <li
      key={submission.id}
      className="rounded-xl border border-border bg-secondary p-4 space-y-2 cursor-pointer transition-colors hover:bg-secondary/80"
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
        <div className="space-y-1">
          <p className="font-semibold text-foreground">{submission.name}</p>
          <p className="text-xs text-muted-foreground">
            {submission.latitude.toFixed(4)}, {submission.longitude.toFixed(4)}
          </p>
          <p className="text-xs text-muted-foreground">
            Submitted {new Intl.DateTimeFormat('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            }).format(new Date(submission.createdAt))}
            {submission.userId && ` · ${submission.userId}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap ${STATUS_PILL_STYLES[submission.status as SpotSubmissionStatus]}`}>
            {submission.status.replace('_', ' ')}
          </span>
          <span className="text-muted-foreground text-xs" aria-hidden="true">
            {expandedId === submission.id ? '▲' : '▼'}
          </span>
        </div>
      </div>
    </li>
    ```
    - **Submitter display:** Initially use `submission.userId` (UUID) for display. A future enhancement could resolve this to a display name via a lookup, but for Story 6.1 the UUID is sufficient for identification. Alternatively, extend the API to join `auth.users` and return a display name — see Dev Notes for details.

  - [ ] 3.6 Add expanded detail view inside each card (AC7):
    - When `expandedId === submission.id`, render full details below the header:
      ```tsx
      {expandedId === submission.id && (
        <div className="mt-3 space-y-3 border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
          {submission.description && (
            <div className="text-sm">
              <span className="text-muted-foreground">Description</span>
              <p className="text-foreground">{submission.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-sm">
            {submission.maxLengthFt && (
              <div>
                <span className="text-muted-foreground">Max length</span>
                <p className="text-foreground">{submission.maxLengthFt} ft</p>
              </div>
            )}
            {submission.maxHeightFt && (
              <div>
                <span className="text-muted-foreground">Max height</span>
                <p className="text-foreground">{submission.maxHeightFt} ft</p>
              </div>
            )}
          </div>

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
              <span className="text-muted-foreground font-medium">Admin notes</span>
              <p className="text-foreground mt-1">{submission.adminNotes}</p>
            </div>
          )}

          {submission.publishedPinId && (
            <p className="text-xs text-muted-foreground">
              Published pin: <code className="text-foreground">{submission.publishedPinId}</code>
            </p>
          )}

          {/* Review controls — only for pending/changes_requested submissions */}
          {(submission.status === 'pending' || submission.status === 'changes_requested') && (
            <>
              <textarea
                value={notesById[submission.id] ?? ''}
                onChange={(event) =>
                  setNotesById((current) => ({ ...current, [submission.id]: event.target.value }))
                }
                onClick={(e) => e.stopPropagation()}
                className="min-h-[88px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Optional reviewer feedback for the contributor"
              />

              {reviewMutation.isError && isPending(submission.id) && (
                <p role="alert" className="text-sm text-red-400">Failed to update this submission.</p>
              )}

              <div className="flex flex-wrap gap-2">
                {(Object.keys(STATUS_COPY) as Array<keyof typeof STATUS_COPY>).map((action) => (
                  <button
                    key={action}
                    type="button"
                    disabled={isPending(submission.id)}
                    onClick={(e) => {
                      e.stopPropagation()
                      reviewMutation.mutate({ submissionId: submission.id, action })
                    }}
                    className="min-h-[44px] rounded-lg border border-border px-4 text-sm"
                  >
                    {STATUS_COPY[action]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      ```

  - [ ] 3.7 Add "Load more" pagination button (AC6):
    ```tsx
    {submissionsQuery.data?.hasMore && (
      <div className="pt-2">
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={submissionsQuery.isFetching}
          className="w-full min-h-[44px] rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
        >
          {submissionsQuery.isFetching ? 'Loading...' : 'Load more'}
        </button>
      </div>
    )}
    ```

  - [ ] 3.8 Add loading, error, and empty states (AC8):
    - Loading: Show skeleton text while initial fetch is in progress
    - Error: Show error message with retry button calling `submissionsQuery.refetch()`
    - Empty: Show contextual message based on active filter
      ```tsx
      if (submissionsQuery.isLoading && page === 1) {
        return <p className="text-sm text-muted-foreground">Loading spot submissions...</p>
      }

      if (submissionsQuery.isError && allSubmissions.length === 0) {
        return (
          <div className="rounded-lg border border-border bg-secondary px-4 py-3 space-y-2">
            <p className="text-sm text-red-400">Failed to load spot submissions.</p>
            <button
              onClick={() => submissionsQuery.refetch()}
              className="text-sm text-sky-400 underline"
            >
              Try again
            </button>
          </div>
        )
      }

      if (allSubmissions.length === 0 && !submissionsQuery.isFetching) {
        const emptyMessages: Record<StatusFilter, string> = {
          all: 'No spot submissions yet.',
          pending: 'No pending submissions — queue is clear! 🎉',
          approved: 'No approved submissions.',
          rejected: 'No rejected submissions.',
          changes_requested: 'No submissions awaiting changes.',
        }
        return (
          <>
            {filterBar}
            <p className="rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-muted-foreground">
              {emptyMessages[activeFilter]}
            </p>
          </>
        )
      }
      ```

  - [ ] 3.9 Invalidate counts query on review mutation success (AC9):
    - Update the `reviewMutation.onSuccess` callback to also invalidate counts:
      ```tsx
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['admin', 'spot-submissions'] })
        queryClient.invalidateQueries({ queryKey: ['admin', 'spot-submission-counts'] })
      },
      ```

- [ ] Task 4: Create tests for admin submission queue (AC: 1–9)
  - [ ] 4.1 Create or update `src/features/admin/SpotSubmissionList.test.tsx`:
    - Test: Filter bar renders all 5 status filter buttons (All, Pending, Approved, Rejected, Changes Requested)
    - Test: "Pending" filter is selected by default
    - Test: Clicking a filter button calls the API with the correct `status` query parameter
    - Test: Clicking a filter resets to page 1
    - Test: Status count badges render for each filter when counts API responds
    - Test: Submission card shows spot name, coordinates, submission date, and status pill
    - Test: Status pill uses correct CSS classes from `STATUS_PILL_STYLES`
    - Test: Clicking a submission card expands it to show full details
    - Test: Clicking an expanded card collapses it
    - Test: Expanded card shows description, amenities, size limits, website, phone, admin notes
    - Test: Review controls (approve/reject/request changes) appear only for pending or changes_requested submissions
    - Test: "Load more" button appears when `hasMore` is true
    - Test: "Load more" button is hidden when all submissions are loaded
    - Test: Loading state shows loading text
    - Test: Error state shows error message with retry button
    - Test: Empty state shows contextual message for current filter
    - Test: Mutation success invalidates both submissions and counts queries
    - Follow existing test patterns: mock `fetch`, use `@testing-library/react`, wrap in `QueryClientProvider`
  - [ ] 4.2 Create `api/admin/spot-submissions.test.ts` (update existing if present):
    - Test: Returns paginated response with `submissions`, `total`, `page`, `pageSize`, `hasMore`
    - Test: Filters by status when `status` query param is provided
    - Test: Returns all statuses when no `status` query param
    - Test: Returns 401 when no admin token provided
    - Test: Returns 405 for non-GET methods
    - Test: Defaults to page 1 with 20 results per page
    - Mock Supabase `from().select()` chain
  - [ ] 4.3 Create `api/admin/spot-submissions/counts.test.ts`:
    - Test: Returns correct per-status counts
    - Test: Returns 401 when no admin token provided
    - Test: Returns 405 for non-GET methods
    - Test: Returns zero counts when no submissions exist
    - Mock Supabase `from().select()` chain

- [ ] Task 5: Final validation (all ACs)
  - [ ] 5.1 Run `npm run lint` — no new lint errors
  - [ ] 5.2 Run `npm run test -- --reporter=verbose` — all existing + new tests pass
  - [ ] 5.3 Run `npm run build` — build succeeds
  - [ ] 5.4 Manual verification:
    - Navigate to `/admin` → sign in with admin token → verify "Spot Submissions" section loads
    - Verify filter bar shows all 5 status options with count badges
    - Click each filter → verify list updates to show only matching submissions
    - Verify each submission card shows: name, coordinates, date, status pill, submitter ID
    - Click a submission card → verify detail view expands with full data
    - Click again → verify it collapses
    - If >20 submissions in a filter → verify "Load more" button appears and works
    - Verify "Load more" disappears when all results are loaded
    - Approve a submission → verify list refreshes and counts update
    - Navigate to `/admin` as non-admin → verify auth gate blocks access

## Dev Notes

### Context Summary

This story enhances the existing admin Spot Submissions section (`SpotSubmissionList.tsx`) from a simple pending-only flat list into a full submission queue with status filtering, count badges, pagination, expandable detail cards, and improved card metadata display. The existing review mutation (approve/reject/request changes) is preserved — this story wraps it in a more powerful queue UI.

### Current Repository Reality

**What already exists and works (from Phase 1 Epic 5 + Phase 2 Epic 5):**
- `src/features/admin/AdminDashboard.tsx` — Main admin entry point with token-gated auth, "Spot Submissions" section rendering `SpotSubmissionList`, "Flagged Pins" section, "All Pins" section with create/edit forms.
- `src/features/admin/AdminAuth.tsx` — Token-based login form using `ADMIN_SECRET` via Bearer token. Stores token in `sessionStorage`.
- `src/features/admin/SpotSubmissionList.tsx` — Fetches only `pending` submissions (hardcoded). Renders flat list with review controls (Approve & Publish / Reject / Request Changes). Uses `useQuery` + `useMutation` from TanStack Query. **This component is the primary target for refactoring.**
- `api/admin/spot-submissions.ts` — `GET` endpoint returning all pending submissions. Uses `requireAdminAuth` + `createServiceClient()`. Currently hardcoded to `status = 'pending'` and returns a flat array. **Must be updated to support filtering + pagination.**
- `api/admin/spot-submissions/[id].ts` — `PATCH` endpoint for approve/reject/request_changes. Creates pin on approval, sends push notification. **No changes needed — works as-is.**
- `api/_middleware.ts` — `requireAdminAuth()` validates `Authorization: Bearer {ADMIN_SECRET}`. Returns 401 on failure.
- `api/_spot-submissions.ts` — `mapSpotSubmission()` helper mapping snake_case DB columns to camelCase. `ApiDbSpotSubmission` interface. **Currently drops `user_id` — must be extended.**
- `src/types/spotSubmission.ts` — `SpotSubmission` interface + `SpotSubmissionStatus` type. **Must add `userId` field.**
- `supabase/migrations/016_create_spot_submissions.sql` — Table schema with `status` enum, `created_at`, `admin_notes`, `published_pin_id`. Index on `(status, created_at ASC)`.

**Existing patterns to follow:**
- `SpotSubmissionList.tsx` — TanStack Query pattern: `useQuery` with `queryKey` array, `useMutation` with `onSuccess` invalidation.
- `FlaggedPinList.tsx` — Similar admin list component with token-based fetching. Good reference for list structure.
- `SuggestSpotScreen.tsx` (Story 5.3) — Expandable card pattern with `expandedId` state, status pill styling using `STATUS_STYLES`, inline `SubmissionDetail` component.

### Architecture Guardrails

1. **Admin auth is Bearer token, not JWT role.** The admin uses a shared `ADMIN_SECRET` via `requireAdminAuth()`. This is NOT a per-user JWT claim — it's a single admin token stored in env vars. The `adminToken` is passed as a prop from `AdminDashboard` to child components.
2. **API response shape change is breaking.** Changing `/api/admin/spot-submissions` from a flat array to `{ submissions, total, page, pageSize, hasMore }` will break `SpotSubmissionList.tsx` if not updated simultaneously. Both API and UI changes must ship together.
3. **Status counts should be a separate query.** Use a dedicated `counts` endpoint rather than deriving counts from the paginated list. This ensures counts are accurate regardless of which page is loaded and allows independent cache invalidation.
4. **Oldest-first sorting is intentional.** The queue sorts by `created_at ASC` so admins process the oldest submissions first (FIFO). This matches the existing API behavior and the UX spec's "oldest pending first" principle.
5. **No new auth mechanism needed.** The existing `requireAdminAuth` + Bearer token pattern covers this story. No JWT claim, no Supabase RLS for admin — it's a simple token check.
6. **Keep review controls inside the expanded card.** The approve/reject/request changes buttons and admin notes textarea should only appear when a card is expanded AND the submission status is `pending` or `changes_requested`. Don't show review controls for already-approved or already-rejected submissions.

### Implementation Notes

**Pagination strategy:** Use cursor-free "Load more" pattern (page-based). The API accepts `page` as a query parameter and returns `hasMore` boolean. On the client, accumulated submissions are stored in state (`allSubmissions`) and appended on each page load. Changing the filter resets to page 1 and clears the accumulated list.

**Submitter display:** The `user_id` UUID is added to the API response via `mapSpotSubmission`. For the initial implementation, display the raw UUID as the submitter identifier. In a future story, this could be enhanced to resolve display names via a batch lookup (joining `auth.users`). Alternatively, the admin API could be extended to join user metadata in the query — but that adds complexity and should be deferred unless explicitly required.

**Filter bar as tab-like buttons:** Use `role="tablist"` and `role="tab"` for accessibility. The active filter gets `bg-primary text-primary-foreground` styling. Each tab shows a count badge in parentheses. Counts come from the separate `/counts` endpoint to avoid deriving them from paginated data.

**Expanded card interaction:** `e.stopPropagation()` is critical on interactive elements inside the expanded card (textarea, action buttons, links) to prevent the click from collapsing the card.

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

CREATE INDEX idx_spot_submissions_status ON spot_submissions (status, created_at ASC);
```

### API Reference

```
# Modified endpoints
GET  /api/admin/spot-submissions              → List submissions with optional ?status=&page= (admin required)
                                                Response: { submissions, total, page, pageSize, hasMore }

# New endpoints
GET  /api/admin/spot-submissions/counts       → Per-status submission counts (admin required)
                                                Response: { all, pending, approved, rejected, changes_requested }

# Existing endpoints (no changes)
PATCH /api/admin/spot-submissions/:id         → Approve/reject/request changes (admin required)
GET   /api/spot-submissions                   → List user's own submissions (user auth required)
POST  /api/spot-submissions                   → Create new submission (user auth required)
```

### Key Files to Modify

| File | Change |
|---|---|
| `api/admin/spot-submissions.ts` | Add `status` filter, `page` param, paginated response shape |
| `api/_spot-submissions.ts` | Add `userId` to `mapSpotSubmission` output |
| `src/types/spotSubmission.ts` | Add `userId` field to `SpotSubmission` interface |
| `src/features/admin/SpotSubmissionList.tsx` | Full refactor: add filter bar, count badges, pagination, expandable cards, status pills |

### Key Files to Create

| File | Purpose |
|---|---|
| `api/admin/spot-submissions/counts.ts` | Per-status count endpoint for filter bar badges |

### Key Files to Reference (read-only)

| File | Purpose |
|---|---|
| `src/features/admin/AdminDashboard.tsx` | Parent component — passes `adminToken` prop |
| `src/features/admin/AdminAuth.tsx` | Auth gate pattern and `ADMIN_TOKEN_KEY` constant |
| `src/features/admin/FlaggedPinList.tsx` | Sibling admin list component pattern |
| `api/admin/spot-submissions/[id].ts` | PATCH endpoint (unchanged, but used by review mutation) |
| `api/_middleware.ts` | `requireAdminAuth` function signature |
| `src/features/spot-submissions/SuggestSpotScreen.tsx` | Expandable card pattern from Story 5.3 |

### Testing Requirements

- Component tests for filter bar rendering, active state, click behavior
- Component tests for submission card metadata display (name, date, status pill, coordinates)
- Component tests for expandable detail view (expand, collapse, full data, stopPropagation)
- Component tests for "Load more" pagination (visible when hasMore, hidden when not, fetches next page)
- Component tests for loading, error, and empty states
- Component tests for mutation → query invalidation (submissions + counts)
- API tests for paginated listing (filter, page, response shape)
- API tests for counts endpoint (all statuses, empty table, auth enforcement)
- All existing tests must continue to pass — no regressions
- Mock `fetch` and wrap components in `QueryClientProvider` per existing patterns
