import { beforeEach, describe, expect, it, vi } from 'vitest'

const { signInWithOtp, signUp } = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  signUp: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithOtp,
      signUp,
      signOut: vi.fn(),
    },
  },
}))

import { getEmailRedirectUrl, requestMagicLink, signUpWithPassword } from './auth'

describe('supabase auth redirects', () => {
  beforeEach(() => {
    signInWithOtp.mockReset()
    signInWithOtp.mockResolvedValue({ error: null })
    signUp.mockReset()
  })

  it('prefers the configured site URL for email redirects', () => {
    expect(
      getEmailRedirectUrl('https://overnighter-git-main-branch.vercel.app', 'https://overnighter.vercel.app'),
    ).toBe(
      'https://overnighter.vercel.app/',
    )
  })

  it('falls back to the current origin when no site URL is configured', () => {
    expect(getEmailRedirectUrl('http://localhost:5173')).toBe('http://localhost:5173/')
  })

  it('defaults to the canonical production domain outside localhost', () => {
    expect(getEmailRedirectUrl('https://overnighter-git-main-branch.vercel.app')).toBe(
      'https://overnighter.vercel.app/',
    )
  })

  it('passes the resolved redirect URL to Supabase', async () => {
    await requestMagicLink('user@example.com')

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    })
  })

  it('throws when the configured site URL is invalid', () => {
    expect(() => getEmailRedirectUrl('https://overnighter-git-main-branch.vercel.app', 'not-a-url')).toThrow(
      'Invalid VITE_SITE_URL: not-a-url',
    )
  })

  it('returns the session created by email/password sign-up', async () => {
    const session = { user: { id: 'user-1', email: 'user@example.com' } }
    signUp.mockResolvedValue({
      data: { session },
      error: null,
    })

    await expect(signUpWithPassword('user@example.com', 'password123')).resolves.toEqual({
      needsEmailConfirmation: false,
      session,
    })
    expect(signUp).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
    })
  })

  it('returns an email-confirmation result when sign-up creates a user without a session', async () => {
    signUp.mockResolvedValue({
      data: {
        session: null,
        user: { id: 'user-2', email: 'user@example.com' },
      },
      error: null,
    })

    await expect(signUpWithPassword('user@example.com', 'password123')).resolves.toEqual({
      needsEmailConfirmation: true,
      session: null,
    })
  })

  it('maps duplicate email errors to a friendly message', async () => {
    signUp.mockResolvedValue({
      data: { session: null },
      error: { message: 'User already registered' },
    })

    await expect(signUpWithPassword('user@example.com', 'password123')).rejects.toThrow(
      'An account with this email already exists',
    )
  })
})
