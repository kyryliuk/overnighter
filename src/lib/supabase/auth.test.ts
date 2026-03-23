import { beforeEach, describe, expect, it, vi } from 'vitest'

const { signInWithOtp } = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithOtp,
      signOut: vi.fn(),
    },
  },
}))

import { getEmailRedirectUrl, requestMagicLink } from './auth'

describe('supabase auth redirects', () => {
  beforeEach(() => {
    signInWithOtp.mockReset()
    signInWithOtp.mockResolvedValue({ error: null })
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
})
