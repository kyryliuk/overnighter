import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { AuthProvider, VISIBILITY_SYNC_INTERVAL_MS } from './AuthProvider'
import { useAuth } from './AuthContext'
import { useRigStore } from '@/store/rigStore'
import { useSpotsStore } from '@/store/spotsStore'
import { useTripPlansStore } from '@/store/tripPlansStore'

const {
  getCurrentSession,
  onAuthSessionChange,
  signInWithPassword,
  signUpWithPassword,
  signOut,
  ensureProfile,
  migrateLocalData,
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
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
  signOut: vi.fn(),
  ensureProfile: vi.fn(),
  migrateLocalData: vi.fn(),
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
  signInWithPassword,
  signUpWithPassword,
  signOut,
}))

vi.mock('@/lib/supabase/profiles', () => ({
  ensureProfile,
}))

vi.mock('@/lib/supabase/migrate', () => ({
  migrateLocalData,
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

let authStateChangeListener: ((session: { user: { id: string; email?: string } } | null) => void) | null = null

function Harness() {
  const { signIn, signUp, signOut, isLoading, isSigningIn, isSigningUp, isAuthenticated, isSyncing, syncError, session } = useAuth()
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
              await signIn('existing@example.com', 'password123')
              setResult('signed-in')
            } catch (signInError) {
              setResult('idle')
              setError(signInError instanceof Error ? signInError.message : 'Unknown sign-in error')
            }
          })()
        }}
      >
        Sign in
      </button>
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
      <button
        type="button"
        onClick={() => {
          void signOut()
        }}
      >
        Sign out
      </button>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="signing-in">{String(isSigningIn)}</span>
      <span data-testid="signing-up">{String(isSigningUp)}</span>
      <span data-testid="is-authenticated">{String(isAuthenticated)}</span>
      <span data-testid="is-syncing">{String(isSyncing)}</span>
      <span data-testid="sync-error">{syncError ?? 'none'}</span>
      <span data-testid="user-id">{session?.user.id ?? 'none'}</span>
      <span data-testid="result">{result}</span>
      <span data-testid="error">{error}</span>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    authStateChangeListener = null
    getCurrentSession.mockReset()
    getCurrentSession.mockResolvedValue(null)
    onAuthSessionChange.mockReset()
    onAuthSessionChange.mockImplementation((listener) => {
      authStateChangeListener = listener
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      }
    })
    signUpWithPassword.mockReset()
    signInWithPassword.mockReset()
    signOut.mockReset()
    ensureProfile.mockReset()
    migrateLocalData.mockReset()
    getRigProfile.mockReset()
    upsertRigProfile.mockReset()
    deleteRigProfile.mockReset()
    getSavedSpots.mockReset()
    replaceSavedSpots.mockReset()
    getTripPlans.mockReset()
    replaceTripPlans.mockReset()
  })

  it('loads the current session on mount', async () => {
    getCurrentSession.mockResolvedValue({
      user: { id: 'existing-user', email: 'existing@example.com' },
    })

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )

    expect(screen.getByTestId('loading')).toHaveTextContent('true')

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
    expect(screen.getByTestId('user-id')).toHaveTextContent('existing-user')
  })

  it('tracks auth state changes from the session subscription', async () => {
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    await act(async () => {
      authStateChangeListener?.({
        user: { id: 'session-user', email: 'session@example.com' },
      })
    })

    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
    expect(screen.getByTestId('user-id')).toHaveTextContent('session-user')

    await act(async () => {
      authStateChangeListener?.(null)
    })

    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
    expect(screen.getByTestId('user-id')).toHaveTextContent('none')
  })

  it('calls the auth helper when signing out', async () => {
    getCurrentSession.mockResolvedValue({
      user: { id: 'existing-user', email: 'existing@example.com' },
    })
    signOut.mockResolvedValue(undefined)

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
    })

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1)
    })
  })

  it('signs in without initializing the profile row', async () => {
    signInWithPassword.mockResolvedValue({
      session: { user: { id: 'existing-user', email: 'existing@example.com' } },
    })

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith('existing@example.com', 'password123')
    })
    expect(ensureProfile).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
    })
    expect(screen.getByTestId('user-id')).toHaveTextContent('existing-user')
    expect(screen.getByTestId('signing-in')).toHaveTextContent('false')
    expect(screen.getByTestId('error')).toHaveTextContent('none')
  })

  it('surfaces sign-in loading state while the request is pending', async () => {
    let resolveSignIn: ((value: { session: { user: { id: string; email: string } } }) => void) | null = null
    signInWithPassword.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve
        }),
    )

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => {
      expect(screen.getByTestId('signing-in')).toHaveTextContent('true')
    })

    resolveSignIn?.({
      session: { user: { id: 'existing-user', email: 'existing@example.com' } },
    })

    await waitFor(() => {
      expect(screen.getByTestId('signing-in')).toHaveTextContent('false')
    })
  })

  it('creates an account and initializes the profile row', async () => {
    signUpWithPassword.mockResolvedValue({
      needsEmailConfirmation: false,
      session: { user: { id: 'user-123', email: 'new@example.com' }, access_token: 'tok-123' },
    })
    ensureProfile.mockResolvedValue(undefined)
    migrateLocalData.mockResolvedValue({ migratedRigProfile: false, migratedSpotsCount: 0 })

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

  it('calls migration after successful signup and returns spot count', async () => {
    signUpWithPassword.mockResolvedValue({
      needsEmailConfirmation: false,
      session: { user: { id: 'user-123', email: 'new@example.com' }, access_token: 'tok-123' },
    })
    ensureProfile.mockResolvedValue(undefined)
    migrateLocalData.mockResolvedValue({ migratedRigProfile: true, migratedSpotsCount: 3 })

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(migrateLocalData).toHaveBeenCalledWith('tok-123', expect.objectContaining({
        savedSpots: expect.any(Array),
      }))
    })
    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
    })
    expect(screen.getByTestId('result')).toHaveTextContent('authenticated')
  })

  it('returns migration error but keeps user authenticated when migration fails', async () => {
    signUpWithPassword.mockResolvedValue({
      needsEmailConfirmation: false,
      session: { user: { id: 'user-123', email: 'new@example.com' }, access_token: 'tok-123' },
    })
    ensureProfile.mockResolvedValue(undefined)
    migrateLocalData.mockRejectedValue(new Error('Network error'))

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
    })
    expect(screen.getByTestId('result')).toHaveTextContent('authenticated')
    expect(screen.getByTestId('user-id')).toHaveTextContent('user-123')
  })

  it('sends empty-state migration payload when no local data exists', async () => {
    signUpWithPassword.mockResolvedValue({
      needsEmailConfirmation: false,
      session: { user: { id: 'user-123', email: 'new@example.com' }, access_token: 'tok-123' },
    })
    ensureProfile.mockResolvedValue(undefined)
    migrateLocalData.mockResolvedValue({ migratedRigProfile: false, migratedSpotsCount: 0 })

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(migrateLocalData).toHaveBeenCalledWith('tok-123', expect.objectContaining({
        rigProfile: expect.objectContaining({ rigType: null }),
        savedSpots: [],
      }))
    })
    expect(screen.getByTestId('result')).toHaveTextContent('authenticated')
  })

  it('rolls back auth when profile initialization fails', async () => {
    signUpWithPassword.mockResolvedValue({
      needsEmailConfirmation: false,
      session: { user: { id: 'user-123', email: 'new@example.com' }, access_token: 'tok-123' },
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

const STUB_PIN = {
  id: 'pin-1',
  name: 'Test spot',
  description: null,
  latitude: 35,
  longitude: -110,
  pinType: 'community' as const,
  sourceId: null,
  maxLengthFt: null,
  maxHeightFt: null,
  website: null,
  phone: null,
  elevationM: null,
  amenities: {
    water: false, dump: false, electric: false, shower: false,
    fuel: false, propane: false, overnight: true, toilets: false,
    pets: false, wifi: false, kitchen: false, restaurant: false,
    big_rig: false, tent: false, hiking: false, fishing: false,
    swimming: false, boating: false, biking: false, ohv: false,
    climbing: false, winter_sports: false, hunting: false,
    wildlife: false, horseback: false, hot_springs: false,
  },
  badgeState: 'green' as const,
  lastCheckInAt: null,
  recentCheckInCount: 0,
  isVerified: true,
  isFlagged: false,
  createdAt: '2026-03-23T00:00:00.000Z',
  updatedAt: '2026-03-23T00:00:00.000Z',
}

function setVisibilityState(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
}

function setupHydratedStores() {
  useRigStore.setState({
    rigProfile: { rigType: null, lengthFt: null, heightFt: null },
    onboardingDismissed: false,
    updatedAt: null,
    hasHydrated: true,
  })
  useSpotsStore.setState({ savedSpots: [], hasHydrated: true })
  useTripPlansStore.setState({ tripPlans: [], hasHydrated: true })
}

function setupCloudMocks() {
  getRigProfile.mockResolvedValue(null)
  getSavedSpots.mockResolvedValue([])
  getTripPlans.mockResolvedValue([])
  deleteRigProfile.mockResolvedValue(undefined)
  upsertRigProfile.mockResolvedValue(undefined)
  replaceSavedSpots.mockResolvedValue(undefined)
  replaceTripPlans.mockResolvedValue(undefined)
}

function resetAllMocks() {
  getCurrentSession.mockReset()
  getCurrentSession.mockResolvedValue(null)
  onAuthSessionChange.mockReset()
  onAuthSessionChange.mockImplementation(() => ({
    data: {
      subscription: {
        unsubscribe: vi.fn(),
      },
    },
  }))
  signInWithPassword.mockReset()
  signUpWithPassword.mockReset()
  signOut.mockReset()
  ensureProfile.mockReset()
  migrateLocalData.mockReset()
  getRigProfile.mockReset()
  upsertRigProfile.mockReset()
  deleteRigProfile.mockReset()
  getSavedSpots.mockReset()
  replaceSavedSpots.mockReset()
  getTripPlans.mockReset()
  replaceTripPlans.mockReset()
}

describe('visibility-triggered sync', () => {
  beforeEach(() => {
    resetAllMocks()
    setupHydratedStores()
  })

  afterEach(() => {
    setVisibilityState('visible')
  })

  it('refetches cloud data when the page becomes visible', async () => {
    setupCloudMocks()
    getCurrentSession.mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
    })

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(getRigProfile).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(screen.getByTestId('is-syncing')).toHaveTextContent('false')
    })

    getRigProfile.mockClear()
    getSavedSpots.mockClear()
    getTripPlans.mockClear()

    const dateNowSpy = vi.spyOn(Date, 'now')
    dateNowSpy.mockReturnValue(Date.now() + VISIBILITY_SYNC_INTERVAL_MS + 1000)

    setVisibilityState('visible')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => {
      expect(getRigProfile).toHaveBeenCalledTimes(1)
      expect(getSavedSpots).toHaveBeenCalledTimes(1)
      expect(getTripPlans).toHaveBeenCalledTimes(1)
    })

    dateNowSpy.mockRestore()
  })

  it('does not refetch for anonymous users', async () => {
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    setVisibilityState('visible')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(getRigProfile).not.toHaveBeenCalled()
    expect(getSavedSpots).not.toHaveBeenCalled()
    expect(getTripPlans).not.toHaveBeenCalled()
  })

  it('gates refetches within the minimum sync interval', async () => {
    setupCloudMocks()
    getCurrentSession.mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
    })

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(getRigProfile).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(screen.getByTestId('is-syncing')).toHaveTextContent('false')
    })

    getRigProfile.mockClear()

    // Trigger immediately — should be blocked (< 30s since initial sync)
    setVisibilityState('visible')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(getRigProfile).not.toHaveBeenCalled()

    // Advance past interval
    const dateNowSpy = vi.spyOn(Date, 'now')
    dateNowSpy.mockReturnValue(Date.now() + VISIBILITY_SYNC_INTERVAL_MS + 1000)

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => {
      expect(getRigProfile).toHaveBeenCalledTimes(1)
    })

    dateNowSpy.mockRestore()
  })

  it('does not refetch when page becomes hidden', async () => {
    setupCloudMocks()
    getCurrentSession.mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
    })

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(getRigProfile).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(screen.getByTestId('is-syncing')).toHaveTextContent('false')
    })

    getRigProfile.mockClear()

    const dateNowSpy = vi.spyOn(Date, 'now')
    dateNowSpy.mockReturnValue(Date.now() + VISIBILITY_SYNC_INTERVAL_MS + 1000)

    setVisibilityState('hidden')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(getRigProfile).not.toHaveBeenCalled()

    dateNowSpy.mockRestore()
  })

  it('swallows errors from visibility-triggered sync silently', async () => {
    setupCloudMocks()
    getCurrentSession.mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
    })

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(getRigProfile).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(screen.getByTestId('is-syncing')).toHaveTextContent('false')
    })

    getRigProfile.mockRejectedValue(new Error('Network error'))

    const dateNowSpy = vi.spyOn(Date, 'now')
    dateNowSpy.mockReturnValue(Date.now() + VISIBILITY_SYNC_INTERVAL_MS + 1000)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    setVisibilityState('visible')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalled()
    })

    expect(screen.getByTestId('sync-error')).toHaveTextContent('none')

    warnSpy.mockRestore()
    dateNowSpy.mockRestore()
  })
})

describe('new-device cloud-first loading', () => {
  beforeEach(() => {
    resetAllMocks()
    setupHydratedStores()
  })

  it('populates stores from cloud when local stores are empty', async () => {
    const cloudRigProfile = {
      rigProfile: { rigType: 'Class B', lengthFt: 20, heightFt: 8 },
      onboardingDismissed: true,
      updatedAt: '2026-03-24T10:00:00.000Z',
    }
    const cloudSpots = [{ ...STUB_PIN, id: 'cloud-pin-1', name: 'Cloud spot' }]
    const cloudTrips = [{
      id: 'cloud-trip-1',
      title: 'Cloud trip',
      notes: '',
      destination: { id: 'dest-1', name: 'Desert', latitude: 33, longitude: -114 },
      stops: [],
      isPublic: false,
      shareToken: null,
      sourceTrip: null,
      createdAt: '2026-03-24T10:00:00.000Z',
      updatedAt: '2026-03-24T10:00:00.000Z',
    }]

    getRigProfile.mockResolvedValue(cloudRigProfile)
    getSavedSpots.mockResolvedValue(cloudSpots)
    getTripPlans.mockResolvedValue(cloudTrips)
    upsertRigProfile.mockResolvedValue(undefined)
    replaceSavedSpots.mockResolvedValue(undefined)
    replaceTripPlans.mockResolvedValue(undefined)

    getCurrentSession.mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
    })

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
    })
    await waitFor(() => {
      expect(screen.getByTestId('is-syncing')).toHaveTextContent('false')
    })

    expect(useRigStore.getState().rigProfile.rigType).toBe('Class B')
    expect(useRigStore.getState().onboardingDismissed).toBe(true)
    expect(useSpotsStore.getState().savedSpots).toHaveLength(1)
    expect(useSpotsStore.getState().savedSpots[0].id).toBe('cloud-pin-1')
    expect(useTripPlansStore.getState().tripPlans).toHaveLength(1)
    expect(useTripPlansStore.getState().tripPlans[0].id).toBe('cloud-trip-1')
  })

  it('handles empty cloud and empty local stores without error', async () => {
    getRigProfile.mockResolvedValue(null)
    getSavedSpots.mockResolvedValue([])
    getTripPlans.mockResolvedValue([])
    deleteRigProfile.mockResolvedValue(undefined)
    replaceSavedSpots.mockResolvedValue(undefined)
    replaceTripPlans.mockResolvedValue(undefined)

    getCurrentSession.mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
    })

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
    })
    await waitFor(() => {
      expect(screen.getByTestId('is-syncing')).toHaveTextContent('false')
    })

    expect(useRigStore.getState().rigProfile.rigType).toBeNull()
    expect(useSpotsStore.getState().savedSpots).toHaveLength(0)
    expect(useTripPlansStore.getState().tripPlans).toHaveLength(0)
    expect(screen.getByTestId('sync-error')).toHaveTextContent('none')
  })
})
