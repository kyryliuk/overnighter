import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/account/AuthContext'
import { buildDirectionsUrl } from '@/lib/maps/googleMaps'
import { createTripPlanComment, deleteTripPlanComment, getTripPlanComments } from '@/lib/supabase/tripPlanComments'
import { getTripPlanReactionSummary, setTripPlanHelpfulReaction } from '@/lib/supabase/tripPlanReactions'
import { getPublicTripPlanByToken } from '@/lib/supabase/tripPlans'

export default function SharedTripPlanScreen() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { shareToken } = useParams<{ shareToken: string }>()
  const { session, isAuthenticated } = useAuth()
  const [commentAuthorLabel, setCommentAuthorLabel] = useState('')
  const [commentBody, setCommentBody] = useState('')

  const tripQuery = useQuery({
    queryKey: ['shared-trip-plan', shareToken],
    queryFn: async () => {
      if (!shareToken) throw new Error('Missing share token')
      return getPublicTripPlanByToken(shareToken)
    },
    enabled: Boolean(shareToken),
  })

  const reactionsQuery = useQuery({
    queryKey: ['shared-trip-reactions', shareToken, session?.user.id ?? null],
    queryFn: async () => {
      if (!shareToken) throw new Error('Missing share token')
      return getTripPlanReactionSummary(shareToken, session?.user.id ?? null)
    },
    enabled: Boolean(shareToken),
  })

  const commentsQuery = useQuery({
    queryKey: ['shared-trip-comments', shareToken],
    queryFn: async () => {
      if (!shareToken) throw new Error('Missing share token')
      return getTripPlanComments(shareToken, session?.user.id ?? null)
    },
    enabled: Boolean(shareToken),
  })

  const helpfulReactionMutation = useMutation({
    mutationFn: async (nextHelpfulState: boolean) => {
      if (!shareToken || !session?.user.id) throw new Error('Sign in to react to shared trips.')

      return setTripPlanHelpfulReaction(shareToken, session.user.id, nextHelpfulState)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['shared-trip-reactions', shareToken] })
    },
  })

  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!shareToken || !session?.user.id) throw new Error('Sign in to comment on shared trips.')

      const authorLabel = commentAuthorLabel.trim()
      const body = commentBody.trim()

      if (!authorLabel) throw new Error('Add the name you want to show with this comment.')
      if (!body) throw new Error('Write a comment before posting.')

      await createTripPlanComment({
        shareToken,
        userId: session.user.id,
        authorLabel,
        body,
      })
    },
    onSuccess: async () => {
      setCommentBody('')
      await queryClient.invalidateQueries({ queryKey: ['shared-trip-comments', shareToken] })
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      if (!session?.user.id) throw new Error('Sign in to manage trip comments.')
      await deleteTripPlanComment(commentId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['shared-trip-comments', shareToken] })
    },
  })

  const routeHref = useMemo(() => {
    if (!tripQuery.data) return null

    return buildDirectionsUrl({
      destination: {
        latitude: tripQuery.data.destination.latitude,
        longitude: tripQuery.data.destination.longitude,
      },
      waypoints: tripQuery.data.stops.map((stop) => ({
        latitude: stop.latitude,
        longitude: stop.longitude,
      })),
    })
  }, [tripQuery.data])

  function handleImportTrip() {
    if (!tripQuery.data) return
    navigate('/trips')
  }

  async function handleHelpfulReactionToggle() {
    const hasReacted = reactionsQuery.data?.hasReacted ?? false
    await helpfulReactionMutation.mutateAsync(!hasReacted)
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Shared trip</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Open this route in Google Maps or copy it into your own planner.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/trips')}
            className="min-h-[44px] rounded-lg border border-border px-4 text-sm text-muted-foreground"
          >
            Open planner
          </button>
        </div>

        {tripQuery.isLoading && (
          <section className="rounded-2xl border border-border bg-secondary p-5">
            <p className="text-sm text-muted-foreground">Loading shared trip…</p>
          </section>
        )}

        {tripQuery.error && (
          <section className="rounded-2xl border border-border bg-secondary p-5">
            <p role="alert" className="text-sm text-red-300">
              {tripQuery.error instanceof Error ? tripQuery.error.message : 'Failed to load shared trip'}
            </p>
          </section>
        )}

        {!tripQuery.isLoading && !tripQuery.error && !tripQuery.data && (
          <section className="rounded-2xl border border-border bg-secondary p-5">
            <p className="text-sm text-muted-foreground">This shared trip link is no longer available.</p>
          </section>
        )}

        {tripQuery.data && (
          <>
            <section className="rounded-2xl border border-border bg-secondary p-5 space-y-3">
              <div>
                <h2 className="text-lg font-semibold">{tripQuery.data.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Destination: {tripQuery.data.destination.name}
                </p>
              </div>
              {tripQuery.data.notes && (
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trip note</p>
                  <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">{tripQuery.data.notes}</p>
                </div>
              )}
              <div className="rounded-xl border border-border bg-background p-3">
                <p className="font-medium">{tripQuery.data.destination.name}</p>
                <p className="text-sm text-muted-foreground">
                  {tripQuery.data.destination.latitude.toFixed(3)}, {tripQuery.data.destination.longitude.toFixed(3)}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-secondary p-5 space-y-3">
              <h2 className="text-lg font-semibold">Waypoints</h2>
              {tripQuery.data.stops.length === 0 ? (
                <p className="text-sm text-muted-foreground">No intermediate waypoints in this shared trip.</p>
              ) : (
                <ul className="space-y-2">
                  {tripQuery.data.stops.map((stop, index) => (
                    <li key={stop.id} className="rounded-xl border border-border bg-background p-3">
                      <p className="font-medium">Stop {index + 1}: {stop.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {stop.latitude.toFixed(3)}, {stop.longitude.toFixed(3)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-secondary p-5 space-y-3">
              <div>
                <h2 className="text-lg font-semibold">Traveler feedback</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Leave a lightweight signal if this route was useful.
                </p>
              </div>
              <p className="text-sm text-foreground">
                {reactionsQuery.data?.helpfulCount ?? 0} traveler{(reactionsQuery.data?.helpfulCount ?? 0) === 1 ? '' : 's'} found this helpful.
              </p>
              <button
                type="button"
                onClick={() => void handleHelpfulReactionToggle()}
                disabled={!isAuthenticated || helpfulReactionMutation.isPending}
                className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-border bg-background font-semibold disabled:opacity-50"
              >
                {helpfulReactionMutation.isPending
                  ? 'Saving feedback…'
                  : reactionsQuery.data?.hasReacted
                    ? 'Remove helpful reaction'
                    : 'Mark as helpful'}
              </button>
              {!isAuthenticated && (
                <p className="text-sm text-muted-foreground">Sign in to leave feedback on shared trips.</p>
              )}
              {reactionsQuery.error && (
                <p role="alert" className="text-sm text-red-300">
                  {reactionsQuery.error instanceof Error
                    ? reactionsQuery.error.message
                    : 'Failed to load trip reactions'}
                </p>
              )}
              {helpfulReactionMutation.error && (
                <p role="alert" className="text-sm text-red-300">
                  {helpfulReactionMutation.error instanceof Error
                    ? helpfulReactionMutation.error.message
                    : 'Failed to save trip reaction'}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-secondary p-5 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Traveler comments</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Share route tips, timing advice, or handoff notes for the next traveler.
                </p>
              </div>

              {commentsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading comments…</p>
              ) : commentsQuery.data && commentsQuery.data.length > 0 ? (
                <ul className="space-y-3">
                  {commentsQuery.data.map((comment) => (
                    <li key={comment.id} className="rounded-xl border border-border bg-background p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{comment.authorLabel}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        {comment.canDelete && (
                          <button
                            type="button"
                            onClick={() => void deleteCommentMutation.mutateAsync(comment.id)}
                            disabled={deleteCommentMutation.isPending}
                            className="min-h-[44px] rounded-lg border border-border px-3 text-sm font-medium disabled:opacity-50"
                          >
                            {deleteCommentMutation.isPending ? 'Removing…' : 'Delete'}
                          </button>
                        )}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No comments yet. Be the first to add context.</p>
              )}

              {commentsQuery.error && (
                <p role="alert" className="text-sm text-red-300">
                  {commentsQuery.error instanceof Error
                    ? commentsQuery.error.message
                    : 'Failed to load trip comments'}
                </p>
              )}

              <div className="space-y-3 rounded-xl border border-border bg-background p-3">
                <input
                  value={commentAuthorLabel}
                  onChange={(event) => setCommentAuthorLabel(event.target.value)}
                  placeholder="Name shown with this comment"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-3 text-sm"
                  aria-label="Comment display name"
                  disabled={!isAuthenticated || commentMutation.isPending}
                />
                <textarea
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  placeholder="What should the next traveler know about this route?"
                  className="min-h-24 w-full rounded-lg border border-border bg-secondary px-3 py-3 text-sm"
                  aria-label="Comment body"
                  disabled={!isAuthenticated || commentMutation.isPending}
                />
                <button
                  type="button"
                  onClick={() => void commentMutation.mutateAsync()}
                  disabled={!isAuthenticated || commentMutation.isPending}
                  className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-border bg-background font-semibold disabled:opacity-50"
                >
                  {commentMutation.isPending ? 'Posting comment…' : 'Post comment'}
                </button>
                {!isAuthenticated && (
                  <p className="text-sm text-muted-foreground">Sign in to join the conversation on shared trips.</p>
                )}
                {commentMutation.error && (
                  <p role="alert" className="text-sm text-red-300">
                    {commentMutation.error instanceof Error
                      ? commentMutation.error.message
                      : 'Failed to save trip comment'}
                  </p>
                )}
                {deleteCommentMutation.error && (
                  <p role="alert" className="text-sm text-red-300">
                    {deleteCommentMutation.error instanceof Error
                      ? deleteCommentMutation.error.message
                      : 'Failed to remove trip comment'}
                  </p>
                )}
              </div>
            </section>

            <a
              href={routeHref ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!routeHref}
              className={`flex min-h-[44px] items-center justify-center rounded-lg font-semibold text-white ${
                routeHref ? 'bg-sky-500' : 'bg-slate-400 pointer-events-none'
              }`}
            >
              Open shared trip in Google Maps
            </a>

            <button
              type="button"
              onClick={handleImportTrip}
              className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-border bg-background font-semibold"
            >
              Save a copy to my planner
            </button>
          </>
        )}
      </div>
    </div>
  )
}
