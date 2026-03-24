import { supabase } from '@/lib/supabase/client'

export async function ensureProfile(userId: string) {
  const { error } = await supabase.from('profiles').upsert(
    { id: userId },
    { onConflict: 'id' },
  )

  if (error) {
    throw new Error(`Failed to initialize profile: ${error.message}`)
  }
}