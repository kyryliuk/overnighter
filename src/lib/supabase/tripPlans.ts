import type { DbTripPlan } from '@/lib/supabase/types'
import { supabase } from '@/lib/supabase/client'
import type { TripPlan } from '@/types/tripPlan'

function dbTripPlanToTripPlan(dbTripPlan: DbTripPlan): TripPlan {
  const snapshot = dbTripPlan.plan_snapshot as unknown as Partial<TripPlan>

  return {
    id: snapshot.id ?? dbTripPlan.plan_id,
    title: snapshot.title ?? 'Shared trip',
    notes: snapshot.notes ?? '',
    destination: snapshot.destination!,
    stops: snapshot.stops ?? [],
    isPublic: snapshot.isPublic ?? dbTripPlan.is_public,
    shareToken: snapshot.shareToken ?? dbTripPlan.share_token,
    sourceTrip: snapshot.sourceTrip ?? null,
    createdAt: snapshot.createdAt ?? dbTripPlan.updated_at,
    updatedAt: snapshot.updatedAt ?? dbTripPlan.updated_at,
  }
}

export async function getTripPlans(userId: string): Promise<TripPlan[]> {
  const { data, error } = await supabase
    .from('trip_plans')
    .select('user_id, plan_id, plan_snapshot, is_public, share_token, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch trip plans: ${error.message}`)
  return (data as DbTripPlan[]).map(dbTripPlanToTripPlan)
}

export async function replaceTripPlans(userId: string, tripPlans: TripPlan[]) {
  const { data, error } = await supabase
    .from('trip_plans')
    .select('plan_id')
    .eq('user_id', userId)

  if (error) throw new Error(`Failed to fetch trip plan ids: ${error.message}`)

  const existingIds = new Set((data ?? []).map((row) => row.plan_id as string))
  const nextIds = new Set(tripPlans.map((plan) => plan.id))
  const idsToDelete = Array.from(existingIds).filter((planId) => !nextIds.has(planId))

  if (tripPlans.length > 0) {
    const { error: upsertError } = await supabase.from('trip_plans').upsert(
      tripPlans.map((plan) => ({
        user_id: userId,
        plan_id: plan.id,
        plan_snapshot: plan,
        is_public: plan.isPublic,
        share_token: plan.shareToken,
        updated_at: plan.updatedAt,
      })),
      { onConflict: 'user_id,plan_id' },
    )

    if (upsertError) throw new Error(`Failed to save trip plans: ${upsertError.message}`)
  }

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('trip_plans')
      .delete()
      .eq('user_id', userId)
      .in('plan_id', idsToDelete)

    if (deleteError) throw new Error(`Failed to delete trip plans: ${deleteError.message}`)
  }
}

function createShareToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `share-${Date.now()}`
}

export async function ensureTripPlanShareToken(userId: string, tripPlan: TripPlan): Promise<string> {
  const shareToken = tripPlan.shareToken ?? createShareToken()
  const nextPlan: TripPlan = {
    ...tripPlan,
    isPublic: true,
    shareToken,
  }

  const { error } = await supabase.from('trip_plans').upsert(
    {
      user_id: userId,
      plan_id: nextPlan.id,
      plan_snapshot: nextPlan,
      is_public: true,
      share_token: shareToken,
      updated_at: nextPlan.updatedAt,
    },
    { onConflict: 'user_id,plan_id' },
  )

  if (error) throw new Error(`Failed to share trip plan: ${error.message}`)
  return shareToken
}

export async function revokeTripPlanShare(userId: string, tripPlan: TripPlan) {
  const nextPlan: TripPlan = {
    ...tripPlan,
    isPublic: false,
    shareToken: null,
  }

  const { error } = await supabase.from('trip_plans').upsert(
    {
      user_id: userId,
      plan_id: nextPlan.id,
      plan_snapshot: nextPlan,
      is_public: false,
      share_token: null,
      updated_at: nextPlan.updatedAt,
    },
    { onConflict: 'user_id,plan_id' },
  )

  if (error) throw new Error(`Failed to revoke trip sharing: ${error.message}`)
}

export async function getPublicTripPlanByToken(shareToken: string): Promise<TripPlan | null> {
  const { data, error } = await supabase
    .from('trip_plans')
    .select('user_id, plan_id, plan_snapshot, is_public, share_token, updated_at')
    .eq('share_token', shareToken)
    .eq('is_public', true)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch shared trip: ${error.message}`)
  return data ? dbTripPlanToTripPlan(data as DbTripPlan) : null
}
