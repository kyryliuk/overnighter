import { useState, useCallback } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SpotSubmission, SpotSubmissionStatus } from '@/types/spotSubmission'
import SubmissionReviewDialog, { type ReviewAction } from './SubmissionReviewDialog'
import { formatRelativeTime } from '@/lib/formatRelativeTime'

interface SpotSubmissionListProps {
  adminToken: string
}

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

const STATUS_COPY: Record<ReviewAction, string> = {
  approve: 'Approve & Publish',
  reject: 'Reject',
  request_changes: 'Request Changes',
}

const ACTION_TO_STATUS: Record<ReviewAction, SpotSubmissionStatus> = {
  approve: 'approved',
  reject: 'rejected',
  request_changes: 'changes_requested',
}

interface PaginatedResponse {
  submissions: SpotSubmission[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

interface DialogState {
  open: boolean
  action: ReviewAction
  submissionId: string
  submissionName: string
}

export default function SpotSubmissionList({ adminToken }: SpotSubmissionListProps) {
  const queryClient = useQueryClient()
  const [notesById, setNotesById] = useState<Record<string, string>>({})
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('pending')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dialogState, setDialogState] = useState<DialogState | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)

  function handleFilterChange(filter: StatusFilter) {
    setActiveFilter(filter)
    setExpandedId(null)
  }

  const submissionsQuery = useInfiniteQuery({
    queryKey: ['admin', 'spot-submissions', adminToken, activeFilter],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ page: String(pageParam) })
      if (activeFilter !== 'all') params.set('status', activeFilter)

      const res = await fetch(`/api/admin/spot-submissions?${params}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })

      if (!res.ok) throw new Error('Failed to fetch spot submissions')
      return res.json() as Promise<PaginatedResponse>
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
  })

  const allSubmissions = submissionsQuery.data?.pages.flatMap((p) => p.submissions) ?? []

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

  const reviewMutation = useMutation({
    mutationFn: async ({
      submissionId,
      action,
      admin_notes,
    }: {
      submissionId: string
      action: ReviewAction
      admin_notes: string | null
    }) => {
      const res = await fetch(`/api/admin/spot-submissions/${submissionId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, admin_notes }),
      })

      if (!res.ok) throw new Error('Failed to review submission')
      return res.json() as Promise<{ id: string; status: string; publishedPinId: string | null }>
    },
    onMutate: async ({ submissionId, action, admin_notes }) => {
      // Cancel in-flight queries to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['admin', 'spot-submissions'] })
      await queryClient.cancelQueries({ queryKey: ['admin', 'spot-submission-counts'] })

      // Snapshot current data for rollback
      const previousSubmissions = queryClient.getQueriesData({
        queryKey: ['admin', 'spot-submissions'],
      })
      const previousCounts = queryClient.getQueryData<Record<string, number>>([
        'admin',
        'spot-submission-counts',
        adminToken,
      ])

      const newStatus = ACTION_TO_STATUS[action]
      const now = new Date().toISOString()

      // Optimistically update the submission in all matching query caches
      queryClient.setQueriesData<{ pages: PaginatedResponse[]; pageParams: number[] }>(
        { queryKey: ['admin', 'spot-submissions'] },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              submissions: page.submissions.map((s) =>
                s.id === submissionId
                  ? {
                      ...s,
                      status: newStatus,
                      adminNotes: admin_notes,
                      reviewedAt: now,
                    }
                  : s,
              ),
            })),
          }
        },
      )

      // Optimistically update counts
      if (previousCounts) {
        const submissionInCache = allSubmissions.find((s) => s.id === submissionId)
        if (submissionInCache) {
          const oldStatus = submissionInCache.status
          const updatedCounts = { ...previousCounts }
          if (oldStatus in updatedCounts) updatedCounts[oldStatus] = Math.max(0, updatedCounts[oldStatus] - 1)
          if (newStatus in updatedCounts) updatedCounts[newStatus] = (updatedCounts[newStatus] || 0) + 1
          queryClient.setQueryData(['admin', 'spot-submission-counts', adminToken], updatedCounts)
        }
      }

      setMutationError(null)
      return { previousSubmissions, previousCounts }
    },
    onError: (_err, _vars, context) => {
      // Rollback optimistic updates
      if (context?.previousSubmissions) {
        for (const [queryKey, data] of context.previousSubmissions) {
          queryClient.setQueryData(queryKey, data)
        }
      }
      if (context?.previousCounts) {
        queryClient.setQueryData(
          ['admin', 'spot-submission-counts', adminToken],
          context.previousCounts,
        )
      }
      setMutationError('Action failed — please try again')
    },
    onSuccess: (_data, { submissionId }) => {
      // Clear inline notes for this submission
      setNotesById((current) => {
        const next = { ...current }
        delete next[submissionId]
        return next
      })
      setMutationError(null)
    },
    onSettled: () => {
      // Always reconcile with server state
      queryClient.invalidateQueries({ queryKey: ['admin', 'spot-submissions'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'spot-submission-counts'] })
    },
  })

  const isReviewing = (submissionId: string) =>
    reviewMutation.isPending && reviewMutation.variables?.submissionId === submissionId

  const openDialog = useCallback(
    (action: ReviewAction, submission: SpotSubmission) => {
      setDialogState({
        open: true,
        action,
        submissionId: submission.id,
        submissionName: submission.name,
      })
    },
    [],
  )

  function handleDialogConfirm(notes: string) {
    if (!dialogState) return
    reviewMutation.mutate({
      submissionId: dialogState.submissionId,
      action: dialogState.action,
      admin_notes: notes || null,
    })
    setDialogState(null)
  }

  const canReview = (status: SpotSubmissionStatus) =>
    status === 'pending' || status === 'changes_requested'

  const filterBar = (
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
  )

  if (submissionsQuery.isLoading) {
    return (
      <>
        {filterBar}
        <p className="text-sm text-muted-foreground">Loading spot submissions...</p>
      </>
    )
  }

  if (submissionsQuery.isError && allSubmissions.length === 0) {
    return (
      <>
        {filterBar}
        <div className="rounded-lg border border-border bg-secondary px-4 py-3 space-y-2">
          <p className="text-sm text-red-400">Failed to load spot submissions.</p>
          <button
            onClick={() => submissionsQuery.refetch()}
            className="text-sm text-sky-400 underline"
          >
            Try again
          </button>
        </div>
      </>
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

  return (
    <>
      {filterBar}

      {mutationError && (
        <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {mutationError}
        </div>
      )}

      <ul className="space-y-4">
        {allSubmissions.map((submission) => (
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
                <span
                  data-testid={`status-pill-${submission.id}`}
                  className={`rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap ${STATUS_PILL_STYLES[submission.status]}`}
                >
                  {submission.status.replace('_', ' ')}
                </span>
                <span className="text-muted-foreground text-xs" aria-hidden="true">
                  {expandedId === submission.id ? '▲' : '▼'}
                </span>
              </div>
            </div>

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
                    <a href={submission.website.startsWith('http') ? submission.website : `https://${submission.website}`} target="_blank" rel="noopener noreferrer"
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

                {/* Review Result section for reviewed submissions */}
                {!canReview(submission.status) && (
                  <div className="rounded-lg border border-border bg-card/50 px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">Review Result</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL_STYLES[submission.status]}`}>
                        {submission.status.replace('_', ' ')}
                      </span>
                    </div>
                    {submission.adminNotes && (
                      <blockquote className="border-l-2 border-muted-foreground/30 pl-3 text-sm text-foreground italic">
                        {submission.adminNotes}
                      </blockquote>
                    )}
                    {submission.reviewedAt && (
                      <p className="text-xs text-muted-foreground">
                        Reviewed {formatRelativeTime(submission.reviewedAt)}
                      </p>
                    )}
                    {submission.publishedPinId && (
                      <a
                        href={`/pin/${submission.publishedPinId}`}
                        className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Pin →
                      </a>
                    )}
                  </div>
                )}

                {/* Admin notes for changes_requested status */}
                {submission.status === 'changes_requested' && submission.adminNotes && (
                  <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-3 space-y-1">
                    <span className="text-xs font-medium text-sky-300">Previous feedback</span>
                    <blockquote className="border-l-2 border-sky-500/30 pl-3 text-sm text-foreground italic">
                      {submission.adminNotes}
                    </blockquote>
                    {submission.reviewedAt && (
                      <p className="text-xs text-muted-foreground">
                        Sent {formatRelativeTime(submission.reviewedAt)}
                      </p>
                    )}
                  </div>
                )}

                {canReview(submission.status) && (
                  <>
                    <textarea
                      value={notesById[submission.id] ?? ''}
                      onChange={(event) =>
                        setNotesById((current) => ({ ...current, [submission.id]: event.target.value }))
                      }
                      onClick={(e) => e.stopPropagation()}
                      className="min-h-[88px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                      placeholder="Optional reviewer feedback for the contributor"
                    />

                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(STATUS_COPY) as ReviewAction[]).map((action) => (
                        <button
                          key={action}
                          type="button"
                          disabled={isReviewing(submission.id)}
                          onClick={(e) => {
                            e.stopPropagation()
                            openDialog(action, submission)
                          }}
                          className={`min-h-[44px] rounded-lg border px-4 text-sm font-medium transition-colors ${
                            action === 'approve'
                              ? 'border-green-500/30 text-green-400 hover:bg-green-500/10'
                              : action === 'reject'
                                ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                                : 'border-sky-500/30 text-sky-400 hover:bg-sky-500/10'
                          } disabled:opacity-50`}
                        >
                          {isReviewing(submission.id) ? 'Processing...' : STATUS_COPY[action]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {submissionsQuery.hasNextPage && (
        <div className="pt-2">
          <button
            onClick={() => submissionsQuery.fetchNextPage()}
            disabled={submissionsQuery.isFetchingNextPage}
            className="w-full min-h-[44px] rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
          >
            {submissionsQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}

      {dialogState && (
        <SubmissionReviewDialog
          open={dialogState.open}
          onOpenChange={(open) => {
            if (!open) setDialogState(null)
          }}
          action={dialogState.action}
          submissionName={dialogState.submissionName}
          initialNotes={notesById[dialogState.submissionId] ?? ''}
          onConfirm={handleDialogConfirm}
          isLoading={reviewMutation.isPending}
        />
      )}
    </>
  )
}
