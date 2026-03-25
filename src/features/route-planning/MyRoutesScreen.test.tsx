import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { Trip } from '@/types/trip'
import MyRoutesScreen from './MyRoutesScreen'

const mockUseTripsQuery = vi.fn()
const mockUsePinsQuery = vi.fn()
const mockUseCreateTripMutation = vi.fn()

vi.mock('./useTripsQuery', () => ({
  useTripsQuery: () => mockUseTripsQuery(),
}))

vi.mock('./useCreateTripMutation', () => ({
  useCreateTripMutation: () => mockUseCreateTripMutation(),
}))

vi.mock('@/hooks/usePinsQuery', () => ({
  usePinsQuery: () => mockUsePinsQuery(),
}))

const mockUseSubscription = vi.fn()
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => mockUseSubscription(),
}))

const mockUseAuth = vi.fn()
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const EMPTY_TRIPS_RESULT = {
  data: [] as Trip[],
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
}

function renderScreen(path = '/trips') {
  function LocationProbe() {
    const location = useLocation()
    return <div data-testid="location-search">{location.search}</div>
  }

  return render(
    <MemoryRouter initialEntries={[path]}>
      <MyRoutesScreen />
      <LocationProbe />
    </MemoryRouter>,
  )
}

describe('MyRoutesScreen', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      session: { user: { id: 'user-1' }, access_token: 'token' },
      isLoading: false,
    })
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      isTrial: false,
      status: 'premium',
      isLoading: false,
    })
    mockUseTripsQuery.mockReturnValue({
      ...EMPTY_TRIPS_RESULT,
      refetch: vi.fn(),
    })
    mockUsePinsQuery.mockReturnValue({
      data: [{
        id: 'pin-dest',
        name: 'Quartzsite',
        description: null,
        latitude: 33.6639,
        longitude: -114.229,
        pinType: 'community',
        sourceId: null,
        maxLengthFt: null,
        maxHeightFt: null,
        website: null,
        phone: null,
        elevationM: null,
        amenities: {
          water: false,
          dump: false,
          electric: false,
          shower: false,
          fuel: false,
          propane: false,
          overnight: true,
          toilets: false,
          pets: true,
          wifi: false,
          kitchen: false,
          restaurant: false,
          big_rig: true,
          tent: true,
          hiking: false,
          fishing: false,
          swimming: false,
          boating: false,
          biking: false,
          ohv: false,
          climbing: false,
          winter_sports: false,
          hunting: false,
          wildlife: false,
          horseback: false,
          hot_springs: false,
        },
        badgeState: 'green',
        lastCheckInAt: null,
        recentCheckInCount: 0,
        isVerified: true,
        isFlagged: false,
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      }],
      isLoading: false,
    })
    mockUseCreateTripMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    })
  })

  it('shows PremiumGate upsell for free users', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })

    renderScreen()

    expect(screen.getByTestId('premium-gate-upsell')).toBeInTheDocument()
    expect(screen.queryByTestId('my-routes-empty-state')).not.toBeInTheDocument()
  })

  it('shows the empty-state shell for premium users with no trips', () => {
    renderScreen()

    expect(screen.getByTestId('my-routes-empty-state')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create route/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start from map/i })).toBeInTheDocument()
  })

  it('opens the route builder from the create button', async () => {
    const user = userEvent.setup()

    renderScreen()

    await user.click(screen.getByRole('button', { name: /create route/i }))

    expect(screen.getByRole('dialog', { name: /create route/i })).toBeInTheDocument()
  })

  it('shows a loading shell while trips are loading', () => {
    mockUseTripsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })

    renderScreen()

    expect(screen.getByTestId('my-routes-loading')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /create route/i })).not.toBeInTheDocument()
  })

  it('shows an error shell when trips fail to load', () => {
    const refetch = vi.fn()
    mockUseTripsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Trips failed'),
      refetch,
    })

    renderScreen()

    expect(screen.getByTestId('my-routes-error')).toBeInTheDocument()
    expect(screen.getByText('Trips failed')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(refetch).toHaveBeenCalled()
  })

  it('keeps loaded trips read-only and preserves tripId deep links', () => {
    mockUseTripsQuery.mockReturnValue({
      data: [{
        id: 'trip-123',
        title: 'Desert Loop',
        notes: 'Great overnight stops',
        status: 'draft',
        origin: null,
        destination: { id: 'dest-1', name: 'Quartzsite', latitude: 33.6, longitude: -114.2 },
        routeMode: 'corridor',
        stopCount: 2,
        revision: 1,
        isPublic: false,
        shareToken: null,
        sourceTripId: null,
        sourceShareToken: null,
        createdAt: '2026-03-24T10:00:00.000Z',
        updatedAt: '2026-03-24T11:00:00.000Z',
        stops: [],
      }] satisfies Trip[],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })

    renderScreen('/trips?tripId=trip-123')

    expect(screen.getByText('Desert Loop')).toBeInTheDocument()
    expect(screen.getByText(/selected route: desert loop/i)).toBeInTheDocument()
    expect(screen.queryByText(/resume route/i)).not.toBeInTheDocument()
  })

  it('saves a created trip and updates the tripId query param', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      id: 'trip-new',
      title: 'Quartzsite',
    })
    mockUseCreateTripMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    })

    const user = userEvent.setup()
    renderScreen()

    await user.click(screen.getByRole('button', { name: /create route/i }))
    await user.type(screen.getByLabelText(/destination/i), 'quartz')
    await user.click(screen.getByRole('button', { name: /quartzsite/i }))
    await user.click(screen.getByRole('button', { name: /save route/i }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      destination: expect.objectContaining({ id: 'pin-dest', name: 'Quartzsite' }),
    })))
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('?tripId=trip-new'))
  })
})
