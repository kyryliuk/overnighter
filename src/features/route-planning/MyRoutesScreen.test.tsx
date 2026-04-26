import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { useUIStore } from '@/store/uiStore'
import { useTripDraftStore, INITIAL_TRIP_DRAFT_STATE } from '@/store/tripDraftStore'
import {
  appendPendingTripMutation,
  clearPendingTripMutations,
} from '@/lib/offline/pendingTripMutations'
import type { Trip } from '@/types/trip'
import MyRoutesScreen from './MyRoutesScreen'

const mockUseTripsQuery = vi.fn()
const mockUseTripQuery = vi.fn()
const mockUsePinsQuery = vi.fn()
const mockUseCreateTripMutation = vi.fn()
const mockUseUpdateTripMutation = vi.fn()
const mockUseTripStatusMutation = vi.fn()
const mockUseDeleteTripMutation = vi.fn()

vi.mock('./useTripsQuery', () => ({
  useTripsQuery: (...args: unknown[]) => mockUseTripsQuery(...args),
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

vi.mock('./useTripStatusMutation', () => ({
  useTripStatusMutation: () => mockUseTripStatusMutation(),
}))

vi.mock('./useDeleteTripMutation', () => ({
  useDeleteTripMutation: () => mockUseDeleteTripMutation(),
}))

vi.mock('./useOfflineTripQueue', () => ({
  useOfflineTripQueue: () => ({ isFlushing: false, triggerFlush: vi.fn() }),
}))

const mockTripPlansState = vi.hoisted(() => ({
  tripPlans: [] as { id: string; title: string }[],
  hasHydrated: true,
}))
vi.mock('@/store/tripPlansStore', () => ({
  useTripPlansStore: (selector: (state: typeof mockTripPlansState) => unknown) =>
    selector(mockTripPlansState),
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
  isSuccess: true,
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
    mockTripPlansState.tripPlans = []
    mockTripPlansState.hasHydrated = true
    useUIStore.setState({ activeTripId: null })
    useTripDraftStore.setState({ ...INITIAL_TRIP_DRAFT_STATE })
    clearPendingTripMutations()
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
    mockUseTripStatusMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    })
    mockUseDeleteTripMutation.mockReturnValue({
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

  it('shows legacy plans notice when trips are empty but legacy plans exist (AC3)', () => {
    mockTripPlansState.tripPlans = [{ id: 'plan-1', title: 'Old road trip' }, { id: 'plan-2', title: 'Another trip' }] as never[]

    renderScreen()

    expect(screen.getByTestId('legacy-plans-notice')).toBeInTheDocument()
    expect(screen.getByText(/you have 2 trip plans from your earlier session/i)).toBeInTheDocument()
  })

  it('does not show legacy plans notice when normalized trips exist (AC3)', () => {
    mockTripPlansState.tripPlans = [{ id: 'plan-1', title: 'Old road trip' }] as never[]
    mockUseTripsQuery.mockReturnValue({
      data: [{
        id: 'trip-1', title: 'My Trip', stops: [], stopCount: 0, status: 'draft',
        isPublic: false, shareToken: null, sourceTripId: null, sourceShareToken: null,
        revision: 1, routeMode: 'corridor', notes: '',
        origin: { id: 'o1', name: 'Phoenix', latitude: 33.4484, longitude: -112.074 },
        destination: { id: 'd1', name: 'Tucson', latitude: 32.2226, longitude: -110.9747 },
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      }],
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })

    renderScreen()

    expect(screen.queryByTestId('legacy-plans-notice')).not.toBeInTheDocument()
  })

  it('does not show legacy plans notice when legacy plans store is empty (AC3)', () => {
    mockTripPlansState.tripPlans = []

    renderScreen()

    expect(screen.queryByTestId('legacy-plans-notice')).not.toBeInTheDocument()
  })

  it('does not show legacy plans notice before the legacy store has hydrated (AC3)', () => {
    mockTripPlansState.tripPlans = [{ id: 'plan-1', title: 'Old road trip' }] as never[]
    mockTripPlansState.hasHydrated = false

    renderScreen()

    expect(screen.queryByTestId('legacy-plans-notice')).not.toBeInTheDocument()
  })

  it('does not show legacy plans notice when user has only archived trips (AC3 edge case)', () => {
    mockTripPlansState.tripPlans = [{ id: 'plan-1', title: 'Old road trip' }] as never[]
    const archivedTrip = {
      id: 'archived-1', title: 'Old Trip', stops: [], stopCount: 0, status: 'archived' as const,
      isPublic: false, shareToken: null, sourceTripId: null, sourceShareToken: null,
      revision: 1, routeMode: 'corridor' as const, notes: '',
      origin: { id: 'o1', name: 'Phoenix', latitude: 33.4484, longitude: -112.074 },
      destination: { id: 'd1', name: 'Tucson', latitude: 32.2226, longitude: -110.9747 },
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    }
    // Default view returns no trips (archived filter off), but total including archived returns 1
    mockUseTripsQuery.mockImplementation(({ includeArchived } = {}) => ({
      data: includeArchived ? [archivedTrip] : [],
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }))

    renderScreen()

    expect(screen.queryByTestId('legacy-plans-notice')).not.toBeInTheDocument()
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

  it('adds corridor suggestions through the normalized update flow with suggested source metadata', async () => {    const mutateAsync = vi.fn().mockResolvedValue({
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

  it('shows the Open in Google Maps link in the active planner for an authenticated premium user', async () => {
    mockUseTripQuery.mockReturnValue({
      ...DEFAULT_TRIP_QUERY_RESULT,
      data: SAMPLE_TRIP,
      refetch: vi.fn(),
    })

    renderScreen('/trips?tripId=trip-123')

    await waitFor(() => expect(screen.getByRole('dialog', { name: /resume route/i })).toBeInTheDocument())
    const link = screen.getByRole('link', { name: /open in google maps/i })
    const href = link.getAttribute('href') ?? ''
    expect(href).toContain('destination=33.6%2C-114.2')
    expect(href).toContain('origin=35.1983%2C-111.6513')
    expect(href).toContain('waypoints=34.4839%2C-114.3225')
  })

  it('does not show the Google Maps link when the planner is in create mode (no trip loaded)', async () => {
    const user = userEvent.setup()

    renderScreen()

    await user.click(screen.getByRole('button', { name: /create route/i }))
    expect(screen.getByRole('dialog', { name: /create route/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /open in google maps/i })).not.toBeInTheDocument()
  })

  describe('Route cards (Story 3.1)', () => {
    const ARCHIVED_TRIP: Trip = {
      ...SAMPLE_TRIP,
      id: 'trip-archived',
      title: 'Old Desert Run',
      status: 'archived',
      updatedAt: '2026-01-10T08:00:00.000Z',
    }

    const NEWER_TRIP: Trip = {
      ...SAMPLE_TRIP,
      id: 'trip-newer',
      title: 'Coastal Cruise',
      updatedAt: '2026-04-01T12:00:00.000Z',
      destination: { id: 'dest-2', name: 'San Diego', latitude: 32.7, longitude: -117.1 },
      stopCount: 5,
    }

    it('renders title, destination, stop count, timestamp, status badge, and sync indicator for each trip', () => {
      mockUseTripsQuery.mockReturnValue({
        data: [SAMPLE_TRIP],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      })

      renderScreen()

      expect(screen.getByText('Desert Loop')).toBeInTheDocument()
      expect(screen.getByText(/quartzsite/i)).toBeInTheDocument()
      expect(screen.getByText(/2 stops/i)).toBeInTheDocument()
      expect(screen.getByText(/updated/i)).toBeInTheDocument()
      expect(screen.getByTestId('trip-status-badge')).toHaveTextContent('Draft')
      expect(screen.getByTestId('trip-sync-indicator')).toHaveTextContent('Synced')
    })

    it('shows "Local draft" badge when trip is in dirtyTripIds', () => {
      mockUseTripsQuery.mockReturnValue({
        data: [SAMPLE_TRIP],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      })
      useTripDraftStore.setState({ dirtyTripIds: [SAMPLE_TRIP.id] })

      renderScreen()

      expect(screen.getByTestId('trip-sync-indicator')).toHaveTextContent('Local draft')
    })

    it('shows "Sync pending" badge when trip is dirty and has a pending queue item', () => {
      mockUseTripsQuery.mockReturnValue({
        data: [SAMPLE_TRIP],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      })
      useTripDraftStore.setState({ dirtyTripIds: [SAMPLE_TRIP.id] })
      appendPendingTripMutation({
        id: 'mut-test-1',
        kind: 'update',
        tripId: SAMPLE_TRIP.id,
        queuedAt: '2026-04-01T10:00:00Z',
      })

      renderScreen()

      expect(screen.getByTestId('trip-sync-indicator')).toHaveTextContent('Sync pending')
    })

    it('badge updates to "Sync pending" when queue event fires after render', () => {
      mockUseTripsQuery.mockReturnValue({
        data: [SAMPLE_TRIP],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      })
      useTripDraftStore.setState({ dirtyTripIds: [SAMPLE_TRIP.id] })

      renderScreen()

      expect(screen.getByTestId('trip-sync-indicator')).toHaveTextContent('Local draft')

      act(() => {
        appendPendingTripMutation({
          id: 'mut-test-2',
          kind: 'update',
          tripId: SAMPLE_TRIP.id,
          queuedAt: '2026-04-02T10:00:00Z',
        })
      })

      expect(screen.getByTestId('trip-sync-indicator')).toHaveTextContent('Sync pending')
    })

    it('badge shows "Sync error" when trip is conflicted', () => {
      mockUseTripsQuery.mockReturnValue({
        data: [SAMPLE_TRIP],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      })
      useTripDraftStore.setState({
        dirtyTripIds: [SAMPLE_TRIP.id],
        conflictedTripIds: [SAMPLE_TRIP.id],
      })

      renderScreen()

      expect(screen.getByTestId('trip-sync-indicator')).toHaveTextContent('Sync error')
    })

    it('excludes archived trips from the default view', () => {
      mockUseTripsQuery.mockReturnValue({
        data: [SAMPLE_TRIP],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      })

      renderScreen()

      expect(screen.getByText('Desert Loop')).toBeInTheDocument()
      expect(screen.queryByText('Old Desert Run')).not.toBeInTheDocument()
      expect(mockUseTripsQuery).toHaveBeenCalledWith(expect.objectContaining({ includeArchived: false }))
    })

    it('toggles the archive filter and shows archived trips with distinct treatment', async () => {
      const user = userEvent.setup()

      mockUseTripsQuery.mockImplementation((opts?: { includeArchived?: boolean }) => {
        const includeArchived = opts?.includeArchived ?? false
        return {
          data: includeArchived ? [SAMPLE_TRIP, ARCHIVED_TRIP] : [SAMPLE_TRIP],
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        }
      })

      renderScreen()

      expect(screen.queryByText('Old Desert Run')).not.toBeInTheDocument()
      const toggle = screen.getByTestId('archive-filter-toggle')
      expect(toggle).toHaveTextContent('Show archived')

      await user.click(toggle)

      await waitFor(() => expect(screen.getByText('Old Desert Run')).toBeInTheDocument())
      expect(screen.getByTestId('archive-filter-toggle')).toHaveTextContent('Hide archived')

      const badges = screen.getAllByTestId('trip-status-badge')
      expect(badges).toHaveLength(2)
      expect(badges[1]).toHaveTextContent('Archived')
    })

    it('sort toggle reverses trip order from most-recent to oldest-first', async () => {
      const user = userEvent.setup()

      mockUseTripsQuery.mockReturnValue({
        data: [NEWER_TRIP, SAMPLE_TRIP],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      })

      renderScreen()

      const sortControl = screen.getByTestId('sort-control')
      expect(sortControl).toHaveTextContent('Most recent')

      const titles = screen.getAllByRole('heading', { level: 2 })
      expect(titles[0]).toHaveTextContent('Coastal Cruise')
      expect(titles[1]).toHaveTextContent('Desert Loop')

      await user.click(sortControl)

      expect(screen.getByTestId('sort-control')).toHaveTextContent('Oldest first')
      const sortedTitles = screen.getAllByRole('heading', { level: 2 })
      expect(sortedTitles[0]).toHaveTextContent('Desert Loop')
      expect(sortedTitles[1]).toHaveTextContent('Coastal Cruise')
    })

    it('selected trip card has active highlight treatment with aria-pressed', async () => {
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

      await waitFor(() => {
        const reopenBtn = screen.getByRole('button', { name: /reopen route/i })
        expect(reopenBtn).toHaveAttribute('aria-pressed', 'true')
      })
      expect(screen.getByText('Open in planner')).toBeInTheDocument()
    })

    it('closing the builder clears the tripId param and returns to library state', async () => {
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

      renderScreen('/trips?tripId=trip-123')

      expect(screen.getByRole('dialog', { name: /resume route/i })).toBeInTheDocument()
      expect(screen.getByTestId('location-search')).toHaveTextContent('?tripId=trip-123')

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent(''))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('Duplicate trip (Story 3.2)', () => {
    const ARCHIVED_TRIP: Trip = {
      ...SAMPLE_TRIP,
      id: 'trip-archived',
      title: 'Old Desert Run',
      status: 'archived',
      updatedAt: '2026-01-10T08:00:00.000Z',
    }

    it('shows a Duplicate button on draft trip cards', () => {
      mockUseTripsQuery.mockReturnValue({
        data: [SAMPLE_TRIP],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      })

      renderScreen()

      expect(screen.getByTestId('duplicate-trip-button')).toBeInTheDocument()
      expect(screen.getByTestId('duplicate-trip-button')).toHaveTextContent('Duplicate')
    })

    it('does NOT show a Duplicate button on archived trip cards', async () => {
      const user = userEvent.setup()

      mockUseTripsQuery.mockImplementation((opts?: { includeArchived?: boolean }) => {
        const includeArchived = opts?.includeArchived ?? false
        return {
          data: includeArchived ? [SAMPLE_TRIP, ARCHIVED_TRIP] : [SAMPLE_TRIP],
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        }
      })

      renderScreen()

      await user.click(screen.getByTestId('archive-filter-toggle'))

      await waitFor(() => expect(screen.getByText('Old Desert Run')).toBeInTheDocument())

      const duplicateButtons = screen.getAllByTestId('duplicate-trip-button')
      // Only one duplicate button — for the draft trip, not the archived one
      expect(duplicateButtons).toHaveLength(1)
    })

    it('clicking Duplicate calls createTripMutation with the expected payload shape', async () => {
      const mutateAsync = vi.fn().mockResolvedValue({
        id: 'trip-copy',
        title: 'Desert Loop (copy)',
      })
      mockUseCreateTripMutation.mockReturnValue({
        mutateAsync,
        isPending: false,
        error: null,
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
        refetch: vi.fn(),
      })

      const user = userEvent.setup()
      renderScreen()

      await user.click(screen.getByTestId('duplicate-trip-button'))

      await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Desert Loop (copy)',
        destination: SAMPLE_TRIP.destination,
        sourceTripId: 'trip-123',
        notes: 'Great overnight stops',
        origin: SAMPLE_TRIP.origin,
        routeMode: 'corridor',
        stops: [
          expect.objectContaining({
            stopOrder: 0,
            source: 'saved',
            place: expect.objectContaining({ id: 'saved-1' }),
          }),
        ],
      })))
    })

    it('after successful duplication, the new trip opens in the builder (tripId search param updates)', async () => {
      const mutateAsync = vi.fn().mockResolvedValue({
        id: 'trip-copy',
        title: 'Desert Loop (copy)',
      })
      mockUseCreateTripMutation.mockReturnValue({
        mutateAsync,
        isPending: false,
        error: null,
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
        refetch: vi.fn(),
      })

      const user = userEvent.setup()
      renderScreen()

      await user.click(screen.getByTestId('duplicate-trip-button'))

      await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('?tripId=trip-copy'))
    })

    it('Duplicate button shows disabled/loading state while mutation is pending', async () => {
      let resolveMutate: (value: unknown) => void = () => {}
      const mutateAsync = vi.fn().mockImplementation(() => new Promise((resolve) => { resolveMutate = resolve }))
      mockUseCreateTripMutation.mockReturnValue({
        mutateAsync,
        isPending: false,
        error: null,
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
        refetch: vi.fn(),
      })

      const user = userEvent.setup()
      renderScreen()

      await user.click(screen.getByTestId('duplicate-trip-button'))

      await waitFor(() => {
        const btn = screen.getByTestId('duplicate-trip-button')
        expect(btn).toBeDisabled()
        expect(btn).toHaveTextContent('Duplicating…')
      })

      // Resolve to clean up
      resolveMutate({ id: 'trip-copy', title: 'Desert Loop (copy)' })
    })
  })

  describe('Archive, Unarchive, and Delete (Story 3.3)', () => {
    const ARCHIVED_TRIP: Trip = {
      ...SAMPLE_TRIP,
      id: 'trip-archived',
      title: 'Old Desert Run',
      status: 'archived',
      updatedAt: '2026-01-10T08:00:00.000Z',
    }

    it('shows Archive button on draft trip cards, NOT on archived trip cards', async () => {
      const user = userEvent.setup()

      mockUseTripsQuery.mockImplementation((opts?: { includeArchived?: boolean }) => {
        const includeArchived = opts?.includeArchived ?? false
        return {
          data: includeArchived ? [SAMPLE_TRIP, ARCHIVED_TRIP] : [SAMPLE_TRIP],
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        }
      })

      renderScreen()

      // Draft card has Archive button
      expect(screen.getByTestId('archive-trip-button')).toBeInTheDocument()

      // Show archived trips
      await user.click(screen.getByTestId('archive-filter-toggle'))
      await waitFor(() => expect(screen.getByText('Old Desert Run')).toBeInTheDocument())

      // Only one Archive button (for the draft trip)
      const archiveButtons = screen.getAllByTestId('archive-trip-button')
      expect(archiveButtons).toHaveLength(1)
    })

    it('clicking Archive calls tripStatusMutation.mutateAsync with correct args', async () => {
      const mutateAsync = vi.fn().mockResolvedValue({ ...SAMPLE_TRIP, status: 'archived' })
      mockUseTripStatusMutation.mockReturnValue({
        mutateAsync,
        isPending: false,
        error: null,
      })
      mockUseTripsQuery.mockReturnValue({
        data: [SAMPLE_TRIP],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      })

      const user = userEvent.setup()
      renderScreen()

      await user.click(screen.getByTestId('archive-trip-button'))

      await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ tripId: 'trip-123', status: 'archived' }))
    })

    it('Archive button shows loading state while mutation is pending', async () => {
      let resolveMutate: (value: unknown) => void = () => {}
      const mutateAsync = vi.fn().mockImplementation(() => new Promise((resolve) => { resolveMutate = resolve }))
      mockUseTripStatusMutation.mockReturnValue({
        mutateAsync,
        isPending: false,
        error: null,
      })
      mockUseTripsQuery.mockReturnValue({
        data: [SAMPLE_TRIP],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      })

      const user = userEvent.setup()
      renderScreen()

      await user.click(screen.getByTestId('archive-trip-button'))

      await waitFor(() => {
        const btn = screen.getByTestId('archive-trip-button')
        expect(btn).toBeDisabled()
        expect(btn).toHaveTextContent('Archiving…')
      })

      resolveMutate({ ...SAMPLE_TRIP, status: 'archived' })
    })

    it('shows Unarchive button on archived trip cards, NOT on draft cards', async () => {
      const user = userEvent.setup()

      mockUseTripsQuery.mockImplementation((opts?: { includeArchived?: boolean }) => {
        const includeArchived = opts?.includeArchived ?? false
        return {
          data: includeArchived ? [SAMPLE_TRIP, ARCHIVED_TRIP] : [SAMPLE_TRIP],
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        }
      })

      renderScreen()

      // No unarchive button on draft cards
      expect(screen.queryByTestId('unarchive-trip-button')).not.toBeInTheDocument()

      // Show archived trips
      await user.click(screen.getByTestId('archive-filter-toggle'))
      await waitFor(() => expect(screen.getByText('Old Desert Run')).toBeInTheDocument())

      // Unarchive button appears for archived trip
      const unarchiveButtons = screen.getAllByTestId('unarchive-trip-button')
      expect(unarchiveButtons).toHaveLength(1)
    })

    it('clicking Unarchive calls tripStatusMutation.mutateAsync with correct args', async () => {
      const mutateAsync = vi.fn().mockResolvedValue({ ...ARCHIVED_TRIP, status: 'draft' })
      mockUseTripStatusMutation.mockReturnValue({
        mutateAsync,
        isPending: false,
        error: null,
      })
      mockUseTripsQuery.mockImplementation((opts?: { includeArchived?: boolean }) => {
        const includeArchived = opts?.includeArchived ?? false
        return {
          data: includeArchived ? [SAMPLE_TRIP, ARCHIVED_TRIP] : [SAMPLE_TRIP],
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        }
      })

      const user = userEvent.setup()
      renderScreen()

      await user.click(screen.getByTestId('archive-filter-toggle'))
      await waitFor(() => expect(screen.getByText('Old Desert Run')).toBeInTheDocument())

      await user.click(screen.getByTestId('unarchive-trip-button'))

      await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ tripId: 'trip-archived', status: 'draft' }))
    })

    it('shows Delete permanently button on archived trip cards only', async () => {
      const user = userEvent.setup()

      mockUseTripsQuery.mockImplementation((opts?: { includeArchived?: boolean }) => {
        const includeArchived = opts?.includeArchived ?? false
        return {
          data: includeArchived ? [SAMPLE_TRIP, ARCHIVED_TRIP] : [SAMPLE_TRIP],
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        }
      })

      renderScreen()

      // No delete button on draft cards
      expect(screen.queryByTestId('delete-trip-button')).not.toBeInTheDocument()

      // Show archived trips
      await user.click(screen.getByTestId('archive-filter-toggle'))
      await waitFor(() => expect(screen.getByText('Old Desert Run')).toBeInTheDocument())

      // Delete button appears for archived trip
      const deleteButtons = screen.getAllByTestId('delete-trip-button')
      expect(deleteButtons).toHaveLength(1)
    })

    it('clicking Delete permanently opens confirmation dialog with trip title', async () => {
      const user = userEvent.setup()

      mockUseTripsQuery.mockImplementation((opts?: { includeArchived?: boolean }) => {
        const includeArchived = opts?.includeArchived ?? false
        return {
          data: includeArchived ? [SAMPLE_TRIP, ARCHIVED_TRIP] : [SAMPLE_TRIP],
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        }
      })

      renderScreen()

      await user.click(screen.getByTestId('archive-filter-toggle'))
      await waitFor(() => expect(screen.getByText('Old Desert Run')).toBeInTheDocument())

      await user.click(screen.getByTestId('delete-trip-button'))

      await waitFor(() => {
        const dialog = screen.getByTestId('delete-confirm-dialog')
        expect(dialog).toBeInTheDocument()
        expect(screen.getByText('Delete permanently?')).toBeInTheDocument()
        // Trip title appears in the dialog text
        expect(dialog.textContent).toContain('Old Desert Run')
      })
    })

    it('clicking Cancel in delete dialog closes it without calling the mutation', async () => {
      const deleteMutateAsync = vi.fn()
      mockUseDeleteTripMutation.mockReturnValue({
        mutateAsync: deleteMutateAsync,
        isPending: false,
        error: null,
      })
      const user = userEvent.setup()

      mockUseTripsQuery.mockImplementation((opts?: { includeArchived?: boolean }) => {
        const includeArchived = opts?.includeArchived ?? false
        return {
          data: includeArchived ? [SAMPLE_TRIP, ARCHIVED_TRIP] : [SAMPLE_TRIP],
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        }
      })

      renderScreen()

      await user.click(screen.getByTestId('archive-filter-toggle'))
      await waitFor(() => expect(screen.getByText('Old Desert Run')).toBeInTheDocument())

      await user.click(screen.getByTestId('delete-trip-button'))
      await waitFor(() => expect(screen.getByTestId('delete-confirm-dialog')).toBeInTheDocument())

      await user.click(screen.getByTestId('delete-cancel-button'))

      await waitFor(() => expect(screen.queryByTestId('delete-confirm-dialog')).not.toBeInTheDocument())
      expect(deleteMutateAsync).not.toHaveBeenCalled()
    })

    it('clicking Delete permanently in the dialog calls deleteTripMutation.mutateAsync', async () => {
      const deleteMutateAsync = vi.fn().mockResolvedValue(undefined)
      mockUseDeleteTripMutation.mockReturnValue({
        mutateAsync: deleteMutateAsync,
        isPending: false,
        error: null,
      })
      const user = userEvent.setup()

      mockUseTripsQuery.mockImplementation((opts?: { includeArchived?: boolean }) => {
        const includeArchived = opts?.includeArchived ?? false
        return {
          data: includeArchived ? [SAMPLE_TRIP, ARCHIVED_TRIP] : [SAMPLE_TRIP],
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        }
      })

      renderScreen()

      await user.click(screen.getByTestId('archive-filter-toggle'))
      await waitFor(() => expect(screen.getByText('Old Desert Run')).toBeInTheDocument())

      await user.click(screen.getByTestId('delete-trip-button'))
      await waitFor(() => expect(screen.getByTestId('delete-confirm-dialog')).toBeInTheDocument())

      await user.click(screen.getByTestId('delete-confirm-button'))

      await waitFor(() => expect(deleteMutateAsync).toHaveBeenCalledWith('trip-archived'))
    })

    it('pressing Escape closes the delete confirmation dialog', async () => {
      const user = userEvent.setup()

      mockUseTripsQuery.mockImplementation((opts?: { includeArchived?: boolean }) => {
        const includeArchived = opts?.includeArchived ?? false
        return {
          data: includeArchived ? [SAMPLE_TRIP, ARCHIVED_TRIP] : [SAMPLE_TRIP],
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        }
      })

      renderScreen()

      await user.click(screen.getByTestId('archive-filter-toggle'))
      await waitFor(() => expect(screen.getByText('Old Desert Run')).toBeInTheDocument())

      await user.click(screen.getByTestId('delete-trip-button'))
      await waitFor(() => expect(screen.getByTestId('delete-confirm-dialog')).toBeInTheDocument())

      await user.keyboard('{Escape}')

      await waitFor(() => expect(screen.queryByTestId('delete-confirm-dialog')).not.toBeInTheDocument())
    })

    it('archiving the currently active trip closes the builder', async () => {
      const mutateAsync = vi.fn().mockResolvedValue({ ...SAMPLE_TRIP, status: 'archived' })
      mockUseTripStatusMutation.mockReturnValue({
        mutateAsync,
        isPending: false,
        error: null,
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

      const user = userEvent.setup()
      renderScreen('/trips?tripId=trip-123')

      // Verify trip is active
      await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('?tripId=trip-123'))

      await user.click(screen.getByTestId('archive-trip-button'))

      await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ tripId: 'trip-123', status: 'archived' }))
      await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent(''))
    })

    it('deleting the currently active trip closes the builder', async () => {
      const deleteMutateAsync = vi.fn().mockResolvedValue(undefined)
      mockUseDeleteTripMutation.mockReturnValue({
        mutateAsync: deleteMutateAsync,
        isPending: false,
        error: null,
      })
      mockUseTripsQuery.mockImplementation((opts?: { includeArchived?: boolean }) => {
        const includeArchived = opts?.includeArchived ?? false
        return {
          data: includeArchived ? [SAMPLE_TRIP, ARCHIVED_TRIP] : [SAMPLE_TRIP],
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        }
      })
      mockUseTripQuery.mockReturnValue({
        ...DEFAULT_TRIP_QUERY_RESULT,
        data: ARCHIVED_TRIP,
        refetch: vi.fn(),
      })

      const user = userEvent.setup()
      renderScreen('/trips?tripId=trip-archived')

      // Verify trip is active
      await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('?tripId=trip-archived'))

      // Show archived, then delete
      await user.click(screen.getByTestId('archive-filter-toggle'))
      await waitFor(() => expect(screen.getAllByText('Old Desert Run').length).toBeGreaterThanOrEqual(1))

      await user.click(screen.getByTestId('delete-trip-button'))
      await waitFor(() => expect(screen.getByTestId('delete-confirm-dialog')).toBeInTheDocument())

      await user.click(screen.getByTestId('delete-confirm-button'))

      await waitFor(() => expect(deleteMutateAsync).toHaveBeenCalledWith('trip-archived'))
      await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent(''))
    })
  })
})
