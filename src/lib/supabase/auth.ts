import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

const DEFAULT_SITE_URL = 'https://overnighter.vercel.app'

export type SignUpWithPasswordResult =
  | {
      needsEmailConfirmation: false
      session: Session
    }
  | {
      needsEmailConfirmation: true
      session: null
    }

export interface SignInWithPasswordResult {
  session: Session
}

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

function isDuplicateEmailError(message: string) {
  return /already (registered|exists|in use)/i.test(message)
}

function isInvalidCredentialError(message: string) {
  return /invalid (login )?credentials/i.test(message)
}

function normalizeAuthErrorMessage(message: string, fallbackPrefix: string) {
  if (isDuplicateEmailError(message)) {
    return 'An account with this email already exists'
  }

  return `${fallbackPrefix}: ${message}`
}

function normalizeSignInErrorMessage(message: string) {
  if (isInvalidCredentialError(message)) {
    return 'Incorrect email or password'
  }

  return `Failed to sign in: ${message}`
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

export async function signUpWithPassword(email: string, password: string): Promise<SignUpWithPasswordResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    throw new Error(normalizeAuthErrorMessage(error.message, 'Failed to create account'))
  }

  if (data.session) {
    return {
      needsEmailConfirmation: false,
      session: data.session,
    }
  }

  if (data.user) {
    return {
      needsEmailConfirmation: true,
      session: null,
    }
  }

  throw new Error('Account could not be created')
}

export async function signInWithPassword(email: string, password: string): Promise<SignInWithPasswordResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw new Error(normalizeSignInErrorMessage(error.message))
  }

  if (!data.session) {
    throw new Error('Sign-in did not return an authenticated session')
  }

  return {
    session: data.session,
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(`Failed to sign out: ${error.message}`)
}
