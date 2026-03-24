import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AccountScreen from './AccountScreen'
import { useRigStore } from '@/store/rigStore'
import { useSpotsStore } from '@/store/spotsStore'
import { useTripPlansStore } from '@/store/tripPlansStore'

const authState = vi.hoisted(() => ({
  session: null,
  isLoading: false,
  isAuthenticated: false,
  isSigningUp: false,
  isSyncing: false,
  syncError: null,
  lastSyncedAt: null,
  signUp: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('./AuthContext', () => ({
  useAuth: () => authState,
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
    authState.isSigningUp = false
    authState.isSyncing = false
    authState.syncError = null
    authState.lastSyncedAt = null
    authState.signUp.mockReset()
    authState.signOut.mockReset()

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
})
