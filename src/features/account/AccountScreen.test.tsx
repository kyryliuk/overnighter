import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AccountScreen from './AccountScreen'
import { useRigStore } from '@/store/rigStore'
import { useSpotsStore } from '@/store/spotsStore'
import { useTripPlansStore } from '@/store/tripPlansStore'

const mockNavigate = vi.fn()
const mockUseLocation = vi.fn(() => ({
  pathname: '/account',
  search: '',
  hash: '',
  state: null,
  key: 'account',
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockUseLocation(),
  }
})

const pushState = vi.hoisted(() => ({
  isSubscribed: false,
  isLoading: false,
  permissionState: 'granted' as NotificationPermission | 'unsupported',
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('@/hooks/usePushSubscription', () => ({
  usePushSubscription: () => pushState,
}))

const authState = vi.hoisted(() => ({
  session: null as { user: { id: string; email: string }; access_token: string } | null,
  isLoading: false,
  isAuthenticated: false,
  isSigningIn: false,
  isSigningUp: false,
  isSyncing: false,
  syncError: null,
  lastSyncedAt: null,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('./AuthContext', () => ({
  useAuth: () => authState,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}))

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    isPremium: authState.isAuthenticated,
    isTrial: false,
    status: authState.isAuthenticated ? 'premium' : 'free',
    isLoading: false,
  }),
}))

function renderScreen() {
  return render(
    <MemoryRouter>
      <AccountScreen />
    </MemoryRouter>,
  )
}

describe('AccountScreen', () => {
  beforeEach(() => {
    authState.session = null
    authState.isLoading = false
    authState.isAuthenticated = false
    authState.isSigningIn = false
    authState.isSigningUp = false
    authState.isSyncing = false
    authState.syncError = null
    authState.lastSyncedAt = null
    authState.signIn.mockReset()
    authState.signUp.mockReset()
    authState.signOut.mockReset()
    mockNavigate.mockReset()
    mockUseLocation.mockReturnValue({
      pathname: '/account',
      search: '',
      hash: '',
      state: null,
      key: 'account',
    })

    pushState.isSubscribed = false
    pushState.isLoading = false
    pushState.permissionState = 'granted'
    pushState.subscribe.mockReset()
    pushState.unsubscribe.mockReset().mockResolvedValue(undefined)

    useRigStore.setState({
      rigProfile: { rigType: 'Class B', lengthFt: 22, heightFt: 10.5 },
      onboardingDismissed: true,
      updatedAt: '2026-03-24T10:00:00.000Z',
      hasHydrated: true,
    })
    useSpotsStore.setState({
      savedSpots: [
        { id: 'pin-1', name: 'Stop 1' },
        { id: 'pin-2', name: 'Stop 2' },
      ] as never,
      hasHydrated: true,
    })
    useTripPlansStore.setState({
      tripPlans: [
        {
          id: 'trip-1',
          title: 'Trip 1',
          notes: '',
          destination: { id: 'dest-1', name: 'Quartzsite', latitude: 33.6, longitude: -114.2 },
          stops: [],
          isPublic: false,
          shareToken: null,
          sourceTrip: null,
          createdAt: '2026-03-24T10:00:00.000Z',
          updatedAt: '2026-03-24T10:00:00.000Z',
        },
      ],
      hasHydrated: true,
    })
  })

  it('renders the registration form and local data summary for anonymous users', () => {
    renderScreen()

    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account and back up/i })).toBeInTheDocument()
    expect(screen.getByText('Class B, 22ft, 10.5ft tall')).toBeInTheDocument()
    expect(screen.getByText('2 spots')).toBeInTheDocument()
    expect(screen.getByText('1 draft')).toBeInTheDocument()
  })

  it('shows a confirmation message when email verification is required', async () => {
    authState.signUp.mockResolvedValue({
      status: 'email-confirmation-required',
      email: 'user@example.com',
    })

    renderScreen()

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } })
    fireEvent.submit(screen.getByRole('button', { name: /create account and back up/i }).closest('form')!)

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Account created. Check user@example.com to confirm your email, then come back to back up your data.',
    )
    expect(screen.getByLabelText(/^email$/i)).toHaveValue('user@example.com')
    expect(screen.getByLabelText(/^password$/i)).toHaveValue('')
  })

  it('shows the backup preview copy with rig class and spot count', () => {
    renderScreen()

    expect(screen.getByText('Your Class B profile and 2 saved spots will be backed up')).toBeInTheDocument()
  })

  it('shows migration success count after account creation', async () => {
    authState.signUp.mockResolvedValue({
      status: 'authenticated',
      migrationResult: { spotsCount: 2 },
    })

    renderScreen()

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } })
    fireEvent.submit(screen.getByRole('button', { name: /create account and back up/i }).closest('form')!)

    expect(await screen.findByRole('status')).toHaveTextContent('2 spots backed up')
  })

  it('shows failure copy when migration fails but account is created', async () => {
    authState.signUp.mockResolvedValue({
      status: 'authenticated',
      migrationError: 'Account created. Data sync failed — will retry on next sign-in.',
    })

    renderScreen()

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } })
    fireEvent.submit(screen.getByRole('button', { name: /create account and back up/i }).closest('form')!)

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Account created. Data sync failed — will retry on next sign-in.',
    )
  })

  it('shows inline duplicate-email errors without clearing the form', async () => {
    authState.signUp.mockRejectedValue(new Error('An account with this email already exists'))

    renderScreen()

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } })
    fireEvent.submit(screen.getByRole('button', { name: /create account and back up/i }).closest('form')!)

    await waitFor(() => {
      expect(authState.signUp).toHaveBeenCalledWith('user@example.com', 'password123')
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('An account with this email already exists')
    expect(screen.getByLabelText(/^email$/i)).toHaveValue('user@example.com')
    expect(screen.getByLabelText(/^password$/i)).toHaveValue('password123')
  })

  it('switches to sign-in mode and shows the returning-user copy', () => {
    renderScreen()

    fireEvent.click(screen.getByRole('tab', { name: /^sign in$/i }))

    expect(screen.getByRole('heading', { name: /sign in to your account/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
  })

  it('shows inline incorrect-credential errors without clearing the email in sign-in mode', async () => {
    authState.signIn.mockRejectedValue(new Error('Incorrect email or password'))

    renderScreen()

    fireEvent.click(screen.getByRole('tab', { name: /^sign in$/i }))
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'wrongpass' } })
    fireEvent.submit(screen.getByRole('button', { name: /^sign in$/i }).closest('form')!)

    await waitFor(() => {
      expect(authState.signIn).toHaveBeenCalledWith('user@example.com', 'wrongpass')
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password')
    expect(screen.getByLabelText(/^email$/i)).toHaveValue('user@example.com')
    expect(screen.getByLabelText(/^password$/i)).toHaveValue('wrongpass')
  })

  it('returns to router state destination after a successful sign-in', async () => {
    authState.signIn.mockResolvedValue(undefined)
    mockUseLocation.mockReturnValue({
      pathname: '/account',
      search: '',
      hash: '',
      state: { from: '/trips?tripId=trip-123#sheet' },
      key: 'account',
    })

    renderScreen()

    fireEvent.click(screen.getByRole('tab', { name: /^sign in$/i }))
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } })
    fireEvent.submit(screen.getByRole('button', { name: /^sign in$/i }).closest('form')!)

    await waitFor(() => {
      expect(authState.signIn).toHaveBeenCalledWith('user@example.com', 'password123')
    })
    expect(mockNavigate).toHaveBeenCalledWith('/trips?tripId=trip-123#sheet', { replace: true })
  })

  it('prefers query returnTo when present after a successful sign-in', async () => {
    authState.signIn.mockResolvedValue(undefined)
    mockUseLocation.mockReturnValue({
      pathname: '/account',
      search: '?returnTo=%2Ftrips%3FtripId%3Dtrip-456',
      hash: '',
      state: { from: '/suggest-spot' },
      key: 'account',
    })

    renderScreen()

    fireEvent.click(screen.getByRole('tab', { name: /^sign in$/i }))
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } })
    fireEvent.submit(screen.getByRole('button', { name: /^sign in$/i }).closest('form')!)

    await waitFor(() => {
      expect(authState.signIn).toHaveBeenCalledWith('user@example.com', 'password123')
    })
    expect(mockNavigate).toHaveBeenCalledWith('/trips?tripId=trip-456', { replace: true })
  })

  it('redirects to returnTo after successful account creation', async () => {
    authState.signUp.mockResolvedValue({ status: 'authenticated', migrationResult: { spotsCount: 0 } })
    mockUseLocation.mockReturnValue({
      pathname: '/account',
      search: '?returnTo=%2Ftrips',
      hash: '',
      state: null,
      key: 'account',
    })

    renderScreen()

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } })
    fireEvent.submit(screen.getByRole('button', { name: /create account and back up/i }).closest('form')!)

    await waitFor(() => {
      expect(authState.signUp).toHaveBeenCalledWith('user@example.com', 'password123')
    })
    expect(mockNavigate).toHaveBeenCalledWith('/trips', { replace: true })
  })

  it('renders authenticated account actions when a session exists', () => {
    authState.isAuthenticated = true
    authState.session = { user: { id: 'user-1', email: 'user@example.com' }, access_token: 'token' }

    renderScreen()

    expect(screen.getByRole('heading', { name: /account actions/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
    expect(screen.getByText(/signed in as user@example.com/i)).toBeInTheDocument()
  })

  it('renders SubscriptionStatusCard for authenticated users', () => {
    authState.isAuthenticated = true
    authState.session = { user: { id: 'user-1', email: 'user@example.com' }, access_token: 'token' }

    renderScreen()

    expect(screen.getByTestId('subscription-status-card')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /subscription/i })).toBeInTheDocument()
  })

  it('does not render SubscriptionStatusCard for unauthenticated users', () => {
    authState.isAuthenticated = false
    authState.session = null

    renderScreen()

    expect(screen.queryByTestId('subscription-status-card')).not.toBeInTheDocument()
  })

  it('shows "Disable notifications" button when subscribed and authenticated', () => {
    authState.isAuthenticated = true
    authState.session = { user: { id: 'user-1', email: 'user@example.com' }, access_token: 'token' }
    pushState.isSubscribed = true

    renderScreen()

    expect(screen.getByRole('button', { name: /disable notifications/i })).toBeInTheDocument()
  })

  it('calls unsubscribe when "Disable notifications" is clicked', async () => {
    authState.isAuthenticated = true
    authState.session = { user: { id: 'user-1', email: 'user@example.com' }, access_token: 'token' }
    pushState.isSubscribed = true

    renderScreen()

    fireEvent.click(screen.getByRole('button', { name: /disable notifications/i }))

    await waitFor(() => {
      expect(pushState.unsubscribe).toHaveBeenCalled()
    })
  })

  it('shows "Notifications disabled" label when not subscribed', () => {
    authState.isAuthenticated = true
    authState.session = { user: { id: 'user-1', email: 'user@example.com' }, access_token: 'token' }
    pushState.isSubscribed = false

    renderScreen()

    expect(screen.getByText(/notifications disabled/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /disable notifications/i })).not.toBeInTheDocument()
  })

  it('does not render notification UI when push is unsupported', () => {
    authState.isAuthenticated = true
    authState.session = { user: { id: 'user-1', email: 'user@example.com' }, access_token: 'token' }
    pushState.permissionState = 'unsupported'
    pushState.isSubscribed = false

    renderScreen()

    expect(screen.queryByText(/notifications disabled/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /disable notifications/i })).not.toBeInTheDocument()
  })

  it('shows "Disabling..." while isPushLoading is true', () => {
    authState.isAuthenticated = true
    authState.session = { user: { id: 'user-1', email: 'user@example.com' }, access_token: 'token' }
    pushState.isSubscribed = true
    pushState.isLoading = true

    renderScreen()

    expect(screen.getByRole('button', { name: /disabling\.\.\./i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /disabling\.\.\./i })).toBeDisabled()
  })

  it('shows error message when unsubscribe fails', async () => {
    authState.isAuthenticated = true
    authState.session = { user: { id: 'user-1', email: 'user@example.com' }, access_token: 'token' }
    pushState.isSubscribed = true
    pushState.unsubscribe.mockRejectedValue(new Error('Unsubscribe failed'))

    renderScreen()

    fireEvent.click(screen.getByRole('button', { name: /disable notifications/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to disable notifications')
  })

  it('"My Routes" button navigates to /trips (AC4)', () => {
    authState.isAuthenticated = true
    authState.session = { user: { id: 'user-1', email: 'user@example.com' }, access_token: 'token' }

    renderScreen()

    fireEvent.click(screen.getByRole('button', { name: /my routes/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/trips')
  })})
