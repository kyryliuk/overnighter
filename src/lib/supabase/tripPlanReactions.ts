import { supabase } from '@/lib/supabase/client'

export interface TripPlanReactionSummary {
  helpfulCount: number
  hasReacted: boolean
}

export async function getTripPlanHelpfulCounts(shareTokens: string[]): Promise<Record<string, number>> {
  const summaries = await Promise.all(
    shareTokens.map(async (shareToken) => {
      const summary = await getTripPlanReactionSummary(shareToken, null)
      return [shareToken, summary.helpfulCount] as const
    }),
  )

  return Object.fromEntries(summaries)
}

export async function getTripPlanReactionSummary(
  shareToken: string,
  userId?: string | null,
): Promise<TripPlanReactionSummary> {
  const { data, error } = await supabase.rpc('get_trip_plan_reaction_summary', {
    target_share_token: shareToken,
    current_user_id: userId ?? null,
  })

  if (error) throw new Error(`Failed to load trip reactions: ${error.message}`)

  const summary = Array.isArray(data) ? data[0] : data
  return {
    helpfulCount: Number(summary?.helpful_count ?? 0),
    hasReacted: Boolean(summary?.has_reacted),
  }
}

export async function setTripPlanHelpfulReaction(
  shareToken: string,
  userId: string,
  isHelpful: boolean,
) {
  if (isHelpful) {
    const { error } = await supabase.from('trip_plan_reactions').upsert(
      {
        share_token: shareToken,
        user_id: userId,
        reaction: 'helpful',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'share_token,user_id' },
    )

    if (error) throw new Error(`Failed to save trip reaction: ${error.message}`)
    return
  }

  const { error } = await supabase
    .from('trip_plan_reactions')
    .delete()
    .eq('share_token', shareToken)
    .eq('user_id', userId)

  if (error) throw new Error(`Failed to remove trip reaction: ${error.message}`)
}
