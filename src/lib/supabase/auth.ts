import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

const DEFAULT_SITE_URL = 'https://overnighter.vercel.app'

function normalizeRedirectUrl(url: string, source: string) {
  try {
    return new URL('/', url).toString()
  } catch {
    throw new Error(`Invalid ${source}: ${url}`)
  }
}

function isLocalOrigin(origin: string) {
  const { hostname } = new URL(origin)
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

export function getEmailRedirectUrl(
  currentOrigin = window.location.origin,
  configuredSiteUrl = import.meta.env.VITE_SITE_URL,
) {
  const normalizedCurrentOrigin = normalizeRedirectUrl(currentOrigin, 'window.location.origin')

  if (isLocalOrigin(currentOrigin)) {
    return normalizedCurrentOrigin
  }

  if (configuredSiteUrl && configuredSiteUrl.trim().length > 0) {
    return normalizeRedirectUrl(configuredSiteUrl.trim(), 'VITE_SITE_URL')
  }

  return normalizeRedirectUrl(DEFAULT_SITE_URL, 'default site URL')
}

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
      emailRedirectTo: getEmailRedirectUrl(),
    },
  })

  if (error) throw new Error(`Failed to send magic link: ${error.message}`)
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(`Failed to sign out: ${error.message}`)
}
