import type { DbSavedSpot } from '@/lib/supabase/types'
import { supabase } from '@/lib/supabase/client'
import type { Pin } from '@/types/pin'

function dbSavedSpotToPin(dbSavedSpot: DbSavedSpot): Pin {
  return dbSavedSpot.pin_snapshot as unknown as Pin
}

export async function getSavedSpots(userId: string): Promise<Pin[]> {
  const { data, error } = await supabase
    .from('saved_spots')
    .select('user_id, pin_id, pin_snapshot, updated_at')
    .eq('user_id', userId)

  if (error) throw new Error(`Failed to fetch saved spots: ${error.message}`)
  return (data as DbSavedSpot[]).map(dbSavedSpotToPin)
}

export async function replaceSavedSpots(userId: string, spots: Pin[]) {
  const { data, error } = await supabase
    .from('saved_spots')
    .select('pin_id')
    .eq('user_id', userId)

  if (error) throw new Error(`Failed to fetch saved spot ids: ${error.message}`)

  const existingIds = new Set((data ?? []).map((row) => row.pin_id as string))
  const nextIds = new Set(spots.map((spot) => spot.id))
  const idsToDelete = Array.from(existingIds).filter((pinId) => !nextIds.has(pinId))

  if (spots.length > 0) {
    const updatedAt = new Date().toISOString()
    const { error: upsertError } = await supabase.from('saved_spots').upsert(
      spots.map((spot) => ({
        user_id: userId,
        pin_id: spot.id,
        pin_snapshot: spot,
        updated_at: updatedAt,
      })),
      { onConflict: 'user_id,pin_id' },
    )

    if (upsertError) throw new Error(`Failed to save saved spots: ${upsertError.message}`)
  }

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('saved_spots')
      .delete()
      .eq('user_id', userId)
      .in('pin_id', idsToDelete)

    if (deleteError) throw new Error(`Failed to delete saved spots: ${deleteError.message}`)
  }
}
