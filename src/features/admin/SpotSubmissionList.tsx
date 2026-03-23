import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SpotSubmission } from '@/types/spotSubmission'

interface SpotSubmissionListProps {
  adminToken: string
}

const STATUS_COPY = {
  approve: 'Approve & Publish',
  reject: 'Reject',
  request_changes: 'Request Changes',
} as const

export default function SpotSubmissionList({ adminToken }: SpotSubmissionListProps) {
  const queryClient = useQueryClient()
  const [notesById, setNotesById] = useState<Record<string, string>>({})

  const submissionsQuery = useQuery({
    queryKey: ['admin', 'spot-submissions', adminToken],
    queryFn: async () => {
      const res = await fetch('/api/admin/spot-submissions', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })

      if (!res.ok) throw new Error('Failed to fetch spot submissions')
      return res.json() as Promise<SpotSubmission[]>
    },
  })

  const reviewMutation = useMutation({
    mutationFn: async ({ submissionId, action }: { submissionId: string; action: keyof typeof STATUS_COPY }) => {
      const res = await fetch(`/api/admin/spot-submissions/${submissionId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          admin_notes: notesById[submissionId]?.trim() || null,
        }),
      })

      if (!res.ok) throw new Error('Failed to review submission')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'spot-submissions'] })
    },
  })

  if (submissionsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading spot submissions...</p>
  }

  if (submissionsQuery.isError) {
    return <p className="text-sm text-red-400">Failed to load spot submissions. Check your connection.</p>
  }

  if ((submissionsQuery.data?.length ?? 0) === 0) {
    return (
      <p className="rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-muted-foreground">
        No pending spot submissions right now.
      </p>
    )
  }

  const isPending = (submissionId: string) =>
    reviewMutation.isPending && reviewMutation.variables?.submissionId === submissionId

  return (
    <ul className="space-y-4">
      {(submissionsQuery.data ?? []).map((submission) => (
        <li key={submission.id} className="rounded-xl border border-border bg-secondary p-4 space-y-4">
          <div className="space-y-1">
            <p className="font-semibold text-foreground">{submission.name}</p>
            <p className="text-xs text-muted-foreground">
              {submission.latitude.toFixed(4)}, {submission.longitude.toFixed(4)}
            </p>
            {submission.description && (
              <p className="text-sm text-muted-foreground">{submission.description}</p>
            )}
          </div>

          <textarea
            value={notesById[submission.id] ?? ''}
            onChange={(event) =>
              setNotesById((current) => ({ ...current, [submission.id]: event.target.value }))
            }
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
                onClick={() => reviewMutation.mutate({ submissionId: submission.id, action })}
                className="min-h-[44px] rounded-lg border border-border px-4 text-sm"
              >
                {STATUS_COPY[action]}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}
