import { supabase } from '@/lib/supabase/client'

export interface TripPlanComment {
  id: string
  authorLabel: string
  body: string
  createdAt: string
  canDelete: boolean
}

export interface TripPlanCommentSummary {
  count: number
  latestComment: Pick<TripPlanComment, 'authorLabel' | 'body' | 'createdAt'> | null
}

export async function getTripPlanCommentCounts(shareTokens: string[]): Promise<Record<string, number>> {
  const summaries = await Promise.all(
    shareTokens.map(async (shareToken) => {
      const comments = await getTripPlanComments(shareToken, null)
      return [shareToken, comments.length] as const
    }),
  )

  return Object.fromEntries(summaries)
}

export async function getTripPlanCommentSummaries(
  shareTokens: string[],
): Promise<Record<string, TripPlanCommentSummary>> {
  const summaries = await Promise.all(
    shareTokens.map(async (shareToken) => {
      const comments = await getTripPlanComments(shareToken, null)
      const latestComment = comments[0]

      return [
        shareToken,
        {
          count: comments.length,
          latestComment: latestComment
            ? {
              authorLabel: latestComment.authorLabel,
              body: latestComment.body,
              createdAt: latestComment.createdAt,
            }
            : null,
        },
      ] as const
    }),
  )

  return Object.fromEntries(summaries)
}

export async function getTripPlanComments(
  shareToken: string,
  currentUserId?: string | null,
): Promise<TripPlanComment[]> {
  const { data, error } = await supabase.rpc('get_trip_plan_comments', {
    target_share_token: shareToken,
    current_user_id: currentUserId ?? null,
  })

  if (error) throw new Error(`Failed to load trip comments: ${error.message}`)

  return (Array.isArray(data) ? data : []).map((comment) => ({
    id: String(comment.id),
    authorLabel: String(comment.author_label),
    body: String(comment.body),
    createdAt: String(comment.created_at),
    canDelete: Boolean(comment.can_delete),
  }))
}

export async function createTripPlanComment(input: {
  shareToken: string
  userId: string
  authorLabel: string
  body: string
}) {
  const { error } = await supabase.from('trip_plan_comments').insert({
    share_token: input.shareToken,
    user_id: input.userId,
    author_label: input.authorLabel,
    body: input.body,
  })

  if (error) throw new Error(`Failed to save trip comment: ${error.message}`)
}

export async function deleteTripPlanComment(commentId: string) {
  const { error } = await supabase
    .from('trip_plan_comments')
    .delete()
    .eq('id', commentId)

  if (error) throw new Error(`Failed to remove trip comment: ${error.message}`)
}
