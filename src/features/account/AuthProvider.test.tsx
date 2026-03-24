import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './AuthContext'

const {
  getCurrentSession,
  onAuthSessionChange,
  signUpWithPassword,
  signOut,
  ensureProfile,
  getRigProfile,
  upsertRigProfile,
  deleteRigProfile,
  getSavedSpots,
  replaceSavedSpots,
  getTripPlans,
  replaceTripPlans,
} = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  onAuthSessionChange: vi.fn(),
  signUpWithPassword: vi.fn(),
  signOut: vi.fn(),
  ensureProfile: vi.fn(),
  getRigProfile: vi.fn(),
  upsertRigProfile: vi.fn(),
  deleteRigProfile: vi.fn(),
  getSavedSpots: vi.fn(),
  replaceSavedSpots: vi.fn(),
  getTripPlans: vi.fn(),
  replaceTripPlans: vi.fn(),
}))

vi.mock('@/lib/supabase/auth', () => ({
  getCurrentSession,
  onAuthSessionChange,
  signUpWithPassword,
  signOut,
}))

vi.mock('@/lib/supabase/profiles', () => ({
  ensureProfile,
}))

vi.mock('@/lib/supabase/rigProfiles', () => ({
  getRigProfile,
  upsertRigProfile,
  deleteRigProfile,
}))

vi.mock('@/lib/supabase/savedSpots', () => ({
  getSavedSpots,
  replaceSavedSpots,
}))

vi.mock('@/lib/supabase/tripPlans', () => ({
  getTripPlans,
  replaceTripPlans,
}))

function Harness() {
  const { signUp, isSigningUp, isAuthenticated, session } = useAuth()
  const [result, setResult] = useState('idle')
  const [error, setError] = useState('none')

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void (async () => {
            setError('none')

            try {
              const nextResult = await signUp('new@example.com', 'password123')
              setResult(nextResult.status)
            } catch (signUpError) {
              setResult('idle')
              setError(signUpError instanceof Error ? signUpError.message : 'Unknown sign-up error')
            }
          })()
        }}
      >
        Create account
      </button>
      <span data-testid="signing-up">{String(isSigningUp)}</span>
      <span data-testid="is-authenticated">{String(isAuthenticated)}</span>
      <span data-testid="user-id">{session?.user.id ?? 'none'}</span>
      <span data-testid="result">{result}</span>
      <span data-testid="error">{error}</span>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    getCurrentSession.mockReset()
    getCurrentSession.mockResolvedValue(null)
    onAuthSessionChange.mockReset()
    onAuthSessionChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    })
    signUpWithPassword.mockReset()
    signOut.mockReset()
    ensureProfile.mockReset()
    getRigProfile.mockReset()
    upsertRigProfile.mockReset()
    deleteRigProfile.mockReset()
    getSavedSpots.mockReset()
    replaceSavedSpots.mockReset()
    getTripPlans.mockReset()
    replaceTripPlans.mockReset()
  })

  it('creates an account and initializes the profile row', async () => {
    signUpWithPassword.mockResolvedValue({
      needsEmailConfirmation: false,
      session: { user: { id: 'user-123', email: 'new@example.com' } },
    })
    ensureProfile.mockResolvedValue(undefined)

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(signUpWithPassword).toHaveBeenCalledWith('new@example.com', 'password123')
    })
    await waitFor(() => {
      expect(ensureProfile).toHaveBeenCalledWith('user-123')
    })
    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
    })
    expect(screen.getByTestId('user-id')).toHaveTextContent('user-123')
    expect(screen.getByTestId('signing-up')).toHaveTextContent('false')
    expect(screen.getByTestId('result')).toHaveTextContent('authenticated')
    expect(screen.getByTestId('error')).toHaveTextContent('none')
  })

  it('rolls back auth when profile initialization fails', async () => {
    signUpWithPassword.mockResolvedValue({
      needsEmailConfirmation: false,
      session: { user: { id: 'user-123', email: 'new@example.com' } },
    })
    ensureProfile.mockRejectedValue(new Error('Failed to initialize profile: insert blocked'))
    signOut.mockResolvedValue(undefined)

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Failed to initialize profile: insert blocked')
    })
    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
    expect(screen.getByTestId('user-id')).toHaveTextContent('none')
  })
})
