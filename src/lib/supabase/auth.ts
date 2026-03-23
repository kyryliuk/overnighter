import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error(`Failed to read auth session: ${error.message}`)
  return data.session
}

export function onAuthSessionChange(callback: (session: Session | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
}

export async function requestMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    },
  })

  if (error) throw new Error(`Failed to send magic link: ${error.message}`)
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(`Failed to sign out: ${error.message}`)
}
