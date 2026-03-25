import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { useUIStore } from '@/store/uiStore'
import type { Trip } from '@/types/trip'
import MyRoutesScreen from './MyRoutesScreen'

const mockUseTripsQuery = vi.fn()
const mockUseTripQuery = vi.fn()
const mockUsePinsQuery = vi.fn()
const mockUseCreateTripMutation = vi.fn()
const mockUseUpdateTripMutation = vi.fn()

vi.mock('./useTripsQuery', () => ({
  useTripsQuery: () => mockUseTripsQuery(),
}))

vi.mock('./useTripQuery', () => ({
  useTripQuery: (...args: unknown[]) => mockUseTripQuery(...args),
}))

vi.mock('./useCreateTripMutation', () => ({
  useCreateTripMutation: () => mockUseCreateTripMutation(),
}))

vi.mock('./useUpdateTripMutation', () => ({
  useUpdateTripMutation: () => mockUseUpdateTripMutation(),
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

const SAMPLE_TRIP: Trip = {
  id: 'trip-123',
  title: 'Desert Loop',
  notes: 'Great overnight stops',
  status: 'draft',
  origin: { id: 'origin-1', name: 'Flagstaff', latitude: 35.1983, longitude: -111.6513 },
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
  stops: [
    {
      id: 'stop-1',
      stopOrder: 0,
      stopKind: 'waypoint',
      source: 'saved',
      pinId: 'saved-1',
      place: { id: 'saved-1', name: 'Lake Havasu', latitude: 34.4839, longitude: -114.3225 },
      notes: 'Top off fuel',
      createdAt: '2026-03-24T10:00:00.000Z',
      updatedAt: '2026-03-24T11:00:00.000Z',
    },
    {
      id: 'stop-2',
      stopOrder: 1,
      stopKind: 'destination',
      source: 'manual',
      pinId: null,
      place: { id: 'dest-1', name: 'Quartzsite', latitude: 33.6, longitude: -114.2 },
      notes: '',
      createdAt: '2026-03-24T10:00:00.000Z',
      updatedAt: '2026-03-24T11:00:00.000Z',
    },
  ],
}

const SAMPLE_MULTI_STOP_TRIP: Trip = {
  ...SAMPLE_TRIP,
  stopCount: 3,
  stops: [
    SAMPLE_TRIP.stops[0],
    {
      id: 'stop-3',
      stopOrder: 1,
      stopKind: 'waypoint',
      source: 'manual',
      pinId: 'pin-waypoint',
      place: { id: 'pin-waypoint', name: 'Kingman Fuel', latitude: 35.1894, longitude: -114.053 },
      notes: 'Stretch break',
      createdAt: '2026-03-24T10:00:00.000Z',
      updatedAt: '2026-03-24T11:00:00.000Z',
    },
    {
      ...SAMPLE_TRIP.stops[1],
      stopOrder: 2,
    },
  ],
}

const EMPTY_TRIPS_RESULT = {
  data: [] as Trip[],
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
}

const DEFAULT_TRIP_QUERY_RESULT = {
  data: null,
  isError: false,
  isFetching: false,
  error: null,
  refetch: vi.fn(),
}

function expectRestoreBanner(tripTitle: string) {
  expect(screen.getByText((_, element) => element?.textContent === `Restoring ${tripTitle} in the planner.`)).toBeInTheDocument()
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
    useUIStore.setState({ activeTripId: null })
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
    mockUseTripQuery.mockReturnValue({
      ...DEFAULT_TRIP_QUERY_RESULT,
      refetch: vi.fn(),
    })
    mockUsePinsQuery.mockReturnValue({
      data: [
        {
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
        },
        {
          id: 'pin-waypoint',
          name: 'Kingman Fuel',
          description: null,
          latitude: 35.1894,
          longitude: -114.053,
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
            fuel: true,
            propane: false,
            overnight: false,
            toilets: false,
            pets: true,
            wifi: false,
            kitchen: false,
            restaurant: false,
            big_rig: true,
            tent: false,
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
        },
        {
          id: 'pin-suggested',
          name: 'Desert Oasis',
          description: null,
          latitude: 34.95,
          longitude: -113.65,
          pinType: 'community',
          sourceId: null,
          maxLengthFt: null,
          maxHeightFt: null,
          website: null,
          phone: null,
          elevationM: null,
          amenities: {
            water: true,
            dump: false,
            electric: false,
            shower: false,
            fuel: true,
            propane: false,
            overnight: true,
            toilets: true,
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
          badgeState: 'yellow',
          lastCheckInAt: null,
          recentCheckInCount: 0,
          isVerified: true,
          isFlagged: false,
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z',
        },
      ],
      isLoading: false,
    })
    mockUseCreateTripMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    })
    mockUseUpdateTripMutation.mockReturnValue({
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
    expect(screen.getByTestId('location-search')).toHaveTextContent('')
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

  it('opens a saved trip in the planner and syncs the tripId query param', async () => {
    const user = userEvent.setup()
    mockUseTripsQuery.mockReturnValue({
      data: [SAMPLE_TRIP],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseTripQuery.mockReturnValue({
      ...DEFAULT_TRIP_QUERY_RESULT,
      data: SAMPLE_TRIP,
      refetch: vi.fn(),
    })

    renderScreen('/trips')

    await user.click(screen.getByRole('button', { name: /resume route/i }))

    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('?tripId=trip-123'))
    expect(screen.getByRole('dialog', { name: /resume route/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/title/i)).toHaveValue('Desert Loop')
    expectRestoreBanner('Desert Loop')
    expect(screen.getByRole('button', { name: /reopen route/i })).toHaveAttribute('aria-pressed', 'true')
    expect(useUIStore.getState().activeTripId).toBe('trip-123')
  })

  it('restores a deep-linked trip from the single-trip query after refresh', async () => {
    mockUseTripsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseTripQuery.mockReturnValue({
      ...DEFAULT_TRIP_QUERY_RESULT,
      data: SAMPLE_TRIP,
      refetch: vi.fn(),
    })

    renderScreen('/trips?tripId=trip-123')

    expect(screen.getByRole('dialog', { name: /resume route/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/notes/i)).toHaveValue('Great overnight stops')
    expectRestoreBanner('Desert Loop')
    expect(screen.getByTestId('location-search')).toHaveTextContent('?tripId=trip-123')
  })

  it('shows a recoverable error when the requested trip cannot be reopened', async () => {
    const refetch = vi.fn()
    const user = userEvent.setup()
    mockUseTripsQuery.mockReturnValue({
      data: [SAMPLE_TRIP],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseTripQuery.mockReturnValue({
      data: null,
      isError: true,
      isFetching: false,
      error: new Error('Trip not found'),
      refetch,
    })

    renderScreen('/trips?tripId=trip-missing')

    expect(screen.getByText(/we couldn't reopen that saved route/i)).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /resume route/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /retry route/i }))
    expect(refetch).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /clear selection/i }))
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent(''))
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
      stops: [],
    })))
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('?tripId=trip-new'))
  })

  it('applies pending add-stop intents in the active builder and clears the extra query params', async () => {
    mockUseTripsQuery.mockReturnValue({
      data: [SAMPLE_TRIP],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseTripQuery.mockReturnValue({
      ...DEFAULT_TRIP_QUERY_RESULT,
      data: SAMPLE_TRIP,
      refetch: vi.fn(),
    })

    renderScreen('/trips?tripId=trip-123&addStopPinId=pin-waypoint&addStopSource=manual')

    await waitFor(() => expect(screen.getByText(/stop 2: kingman fuel/i)).toBeInTheDocument())
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('?tripId=trip-123'))
  })

  it('updates an existing trip through the normalized patch flow', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      ...SAMPLE_TRIP,
      revision: 2,
    })
    mockUseTripsQuery.mockReturnValue({
      data: [SAMPLE_TRIP],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseTripQuery.mockReturnValue({
      ...DEFAULT_TRIP_QUERY_RESULT,
      data: SAMPLE_TRIP,
      refetch: vi.fn(),
    })
    mockUseUpdateTripMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    })

    const user = userEvent.setup()
    renderScreen('/trips?tripId=trip-123')

    await user.type(screen.getByLabelText(/add a stop/i), 'kingman')
    await user.click(screen.getByRole('button', { name: /kingman fuel/i }))
    await user.click(screen.getByRole('button', { name: /update route/i }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({
      tripId: 'trip-123',
      payload: expect.objectContaining({
        title: 'Desert Loop',
        destination: SAMPLE_TRIP.destination,
        stops: [
          expect.objectContaining({ place: expect.objectContaining({ id: 'saved-1' }), stopOrder: 0 }),
          expect.objectContaining({ place: expect.objectContaining({ id: 'pin-waypoint' }), stopOrder: 1 }),
        ],
      }),
    }))
  })

  it('persists reordered stops through the existing patch flow for reopened trips', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      ...SAMPLE_MULTI_STOP_TRIP,
      revision: 2,
    })
    mockUseTripsQuery.mockReturnValue({
      data: [SAMPLE_MULTI_STOP_TRIP],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseTripQuery.mockReturnValue({
      ...DEFAULT_TRIP_QUERY_RESULT,
      data: SAMPLE_MULTI_STOP_TRIP,
      refetch: vi.fn(),
    })
    mockUseUpdateTripMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    })

    const user = userEvent.setup()
    renderScreen('/trips?tripId=trip-123')

    await user.click(screen.getByRole('button', { name: /move stop 2 up/i }))
    await user.click(screen.getByRole('button', { name: /update route/i }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({
      tripId: 'trip-123',
      payload: expect.objectContaining({
        destination: SAMPLE_MULTI_STOP_TRIP.destination,
        stops: [
          expect.objectContaining({ stopOrder: 0, place: expect.objectContaining({ id: 'pin-waypoint' }) }),
          expect.objectContaining({ stopOrder: 1, place: expect.objectContaining({ id: 'saved-1' }) }),
        ],
      }),
    }))
  })

  it('adds corridor suggestions through the normalized update flow with suggested source metadata', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      ...SAMPLE_TRIP,
      revision: 2,
    })
    mockUseTripsQuery.mockReturnValue({
      data: [SAMPLE_TRIP],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseTripQuery.mockReturnValue({
      ...DEFAULT_TRIP_QUERY_RESULT,
      data: SAMPLE_TRIP,
      refetch: vi.fn(),
    })
    mockUseUpdateTripMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    })

    const user = userEvent.setup()
    renderScreen('/trips?tripId=trip-123')

    await user.click(screen.getByRole('button', { name: /add desert oasis as a suggested stop/i }))
    await user.click(screen.getByRole('button', { name: /update route/i }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({
      tripId: 'trip-123',
      payload: expect.objectContaining({
        destination: SAMPLE_TRIP.destination,
        stops: [
          expect.objectContaining({ place: expect.objectContaining({ id: 'saved-1' }), stopOrder: 0, source: 'saved' }),
          expect.objectContaining({ place: expect.objectContaining({ id: 'pin-suggested' }), stopOrder: 1, source: 'suggested' }),
        ],
      }),
    }))
  })
})
