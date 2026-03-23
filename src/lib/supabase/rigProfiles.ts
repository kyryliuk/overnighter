import type { DbRigProfile } from '@/lib/supabase/types'
import { supabase } from '@/lib/supabase/client'
import type { RigProfile } from '@/types/rigProfile'
import type { CloudRigProfileState } from '@/lib/sync/mergeCloudState'

function dbRigProfileToCloudRigProfile(dbRigProfile: DbRigProfile): CloudRigProfileState {
  return {
    rigProfile: {
      rigType: dbRigProfile.rig_type as RigProfile['rigType'],
      lengthFt: dbRigProfile.length_ft,
      heightFt: dbRigProfile.height_ft,
    },
    onboardingDismissed: dbRigProfile.onboarding_dismissed,
    updatedAt: dbRigProfile.updated_at,
  }
}

export async function getRigProfile(userId: string): Promise<CloudRigProfileState | null> {
  const { data, error } = await supabase
    .from('rig_profiles')
    .select('user_id, rig_type, length_ft, height_ft, onboarding_dismissed, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch rig profile: ${error.message}`)
  return data ? dbRigProfileToCloudRigProfile(data as DbRigProfile) : null
}

export async function upsertRigProfile(
  userId: string,
  state: CloudRigProfileState,
) {
  const { error } = await supabase.from('rig_profiles').upsert(
    {
      user_id: userId,
      rig_type: state.rigProfile.rigType,
      length_ft: state.rigProfile.lengthFt,
      height_ft: state.rigProfile.heightFt,
      onboarding_dismissed: state.onboardingDismissed,
      updated_at: state.updatedAt ?? new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) throw new Error(`Failed to save rig profile: ${error.message}`)
}

export async function deleteRigProfile(userId: string) {
  const { error } = await supabase.from('rig_profiles').delete().eq('user_id', userId)
  if (error) throw new Error(`Failed to delete rig profile: ${error.message}`)
}
