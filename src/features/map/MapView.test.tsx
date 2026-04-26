import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useEffect } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MapView from './MapView'
import { useRigStore } from '@/store/rigStore'
import { useAmenityFilterStore } from '@/store/amenityFilterStore'
import { useUIStore } from '@/store/uiStore'
import { useCheckInPromptStore } from '@/store/checkInPromptStore'
import type { Pin } from '@/types/pin'

const mockNavigate = vi.fn()
const mockMapFitBounds = vi.fn()
const mockMapSetView = vi.fn()
const authState = vi.hoisted(() => ({
  session: null as { user: { id: string; email?: string } } | null,
  isAuthenticated: false,
}))
const { mockUseTripCorridorPreview } = vi.hoisted(() => ({
  mockUseTripCorridorPreview: vi.fn(() => ({ previewTrip: null, setPreviewTrip: vi.fn() })),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}))

vi.mock('@/features/route-planning/TripCorridorPreviewContext', () => ({
  useTripCorridorPreview: () => mockUseTripCorridorPreview(),
}))

vi.mock('@/features/route-planning/TripCorridorPreviewProvider', () => ({
  TripCorridorPreviewProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/features/route-planning/TripCorridorOverlay', () => ({
  TripCorridorOverlay: vi.fn(() => <div data-testid="trip-corridor-overlay" />),
}))

vi.mock('leaflet', () => ({
  latLngBounds: vi.fn((points: Array<[number, number]>) => ({ points })),
}))

// Avoid Leaflet DOM dependency in jsdom
vi.mock('./LeafletMap', () => ({
  default: vi.fn(({ onMapReady, onMapRemove }: { onMapReady?: (map: unknown) => void; onMapRemove?: () => void }) => {
    useEffect(() => {
      const mockMap = {
        fitBounds: mockMapFitBounds,
        setView: mockMapSetView,
        on: vi.fn(),
        off: vi.fn(),
        getCenter: () => ({
          lat: 39.5,
          lng: -98.35,
          distanceTo: () => 1000,
        }),
        getBounds: () => ({
          getNorthEast: () => ({ lat: 40, lng: -98 }),
          getNorth: () => 40,
          getSouth: () => 39,
          getEast: () => -98,
          getWest: () => -99,
        }),
      }
      onMapReady?.(mockMap)
      return () => {
        onMapRemove?.()
      }
    }, [onMapReady, onMapRemove])

    return <div data-testid="leaflet-map" />
  }),
}))

// Mock SearchBar to avoid fetch/geolocation in MapView tests
vi.mock('./SearchBar', () => ({
  default: vi.fn(() => <div data-testid="search-bar" />),
}))

// Avoid Supabase calls in tests — vi.hoisted required so the variable is in scope inside vi.mock factory
const { mockUsePinsQuery } = vi.hoisted(() => ({
  mockUsePinsQuery: vi.fn(() => ({ data: [] as Pin[], isLoading: false, error: null as null })),
}))
vi.mock('@/hooks/usePinsQuery', () => ({
  usePinsQuery: mockUsePinsQuery,
}))

// Mock useGeolocation to prevent real GPS calls in MapView
const { mockUseGeolocation } = vi.hoisted(() => ({
  mockUseGeolocation: vi.fn(() => [
    { isLoading: false, coords: null as GeolocationCoordinates | null, error: null as 'denied' | 'no-api' | 'unavailable' | null },
    vi.fn(),
  ]),
}))
vi.mock('@/hooks/useGeolocation', () => ({ useGeolocation: mockUseGeolocation }))

// Mock DeparturePrompt to isolate MapView departure-prompt integration
vi.mock('./DeparturePrompt', () => ({
  default: vi.fn(({ pinName, onSkip, onCheckIn }: { pinName: string; onSkip: () => void; onCheckIn: () => void }) => (
    <div data-testid="departure-prompt">
      <span>{pinName}</span>
      <button onClick={onSkip} aria-label="Skip check-in">Skip</button>
      <button onClick={onCheckIn} aria-label="Submit check-in">Check In</button>
    </div>
  )),
}))

// Mock BadgeTooltip to isolate MapView integration concerns
vi.mock('./BadgeTooltip', () => ({
  default: vi.fn(({ onDismiss }: { onDismiss: () => void }) => (
    <div data-testid="badge-tooltip">
      <button onClick={onDismiss}>dismiss</button>
    </div>
  )),
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

function WrapperAtPath(path: string) {
  return function({ children }: { children: React.ReactNode }) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }
}

describe('MapView redirect guard', () => {
  beforeEach(() => {
    localStorage.clear()
    useRigStore.getState().clearRigProfile()
    useRigStore.setState({ onboardingDismissed: false })
    useAmenityFilterStore.setState({ activeFilters: [] })
    useUIStore.setState({ selectedPinId: null })
    authState.session = null
    authState.isAuthenticated = false
    mockNavigate.mockClear()
    mockMapFitBounds.mockClear()
    mockMapSetView.mockClear()
    mockUseTripCorridorPreview.mockReturnValue({ previewTrip: null, setPreviewTrip: vi.fn() })
  })

  it('redirects to /onboarding when no rig profile and onboarding not dismissed', () => {
    render(<MapView />, { wrapper: Wrapper })
    expect(mockNavigate).toHaveBeenCalledWith('/onboarding', { replace: true })
  })

  it('does not redirect when rig profile is set', () => {
    useRigStore.getState().setRigProfile({ rigType: 'Class A', lengthFt: 35, heightFt: 12.5 })
    render(<MapView />, { wrapper: Wrapper })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('does not redirect when onboardingDismissed is true (skip path)', () => {
    useRigStore.setState({ onboardingDismissed: true })
    render(<MapView />, { wrapper: Wrapper })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  // M2: deep-link fix — new user should not be redirected when on /pin/:id
  it('does not redirect to /onboarding when new user lands on deep-linked /pin/:id route', () => {
    // no rig profile, onboarding not dismissed — but URL is /pin/:id
    render(<MapView />, { wrapper: WrapperAtPath('/pin/some-shared-pin') })
    expect(mockNavigate).not.toHaveBeenCalledWith('/onboarding', { replace: true })
  })
})

describe('MapView rig context indicator', () => {
  beforeEach(() => {
    localStorage.clear()
    useRigStore.getState().clearRigProfile()
    useRigStore.setState({ onboardingDismissed: false })
    useAmenityFilterStore.setState({ activeFilters: [] })
    useUIStore.setState({ selectedPinId: null })
    mockNavigate.mockClear()
  })

  it('shows "Filtering for" indicator when rig profile is saved', () => {
    useRigStore.getState().setRigProfile({ rigType: 'Class A', lengthFt: 35, heightFt: 12.5 })
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.getByRole('button', { name: /filtering for/i })).toBeInTheDocument()
  })

  it('rig context indicator text contains rig class and length', () => {
    useRigStore.getState().setRigProfile({ rigType: 'Class A', lengthFt: 35, heightFt: 12.5 })
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.getByRole('button', { name: /filtering for/i })).toHaveTextContent(
      'Filtering for: Class A, 35ft',
    )
  })

  it('shows "No rig profile" indicator when no profile and onboarding dismissed', () => {
    useRigStore.setState({ onboardingDismissed: true })
    render(<MapView />, { wrapper: Wrapper })
    expect(
      screen.getByRole('button', { name: /no rig profile/i }),
    ).toBeInTheDocument()
  })

  it('does not show "Filtering for" indicator when no rig profile', () => {
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.queryByRole('button', { name: /filtering for/i })).not.toBeInTheDocument()
  })

  it('rig context indicator navigates to /rig-edit on click', () => {
    useRigStore.getState().setRigProfile({ rigType: 'Travel Trailer', lengthFt: 25, heightFt: 10.0 })
    render(<MapView />, { wrapper: Wrapper })
    fireEvent.click(screen.getByRole('button', { name: /filtering for/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/rig-edit')
  })

  it('"No rig profile" indicator navigates to /onboarding on click', () => {
    useRigStore.setState({ onboardingDismissed: true })
    render(<MapView />, { wrapper: Wrapper })
    fireEvent.click(screen.getByRole('button', { name: /no rig profile/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/onboarding')
  })

  it('renders LeafletMap when rig profile is set', () => {
    useRigStore.getState().setRigProfile({ rigType: 'Class C', lengthFt: 28, heightFt: 11 })
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.getByTestId('leaflet-map')).toBeInTheDocument()
  })

  it('renders SearchBar in the overlay stack', () => {
    useRigStore.getState().setRigProfile({ rigType: 'Class A', lengthFt: 35, heightFt: 12.5 })
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.getByTestId('search-bar')).toBeInTheDocument()
  })
})

const STUB_PIN: Pin = {
  id: 'p1', name: 'Test Spot', description: null, latitude: 0, longitude: 0,
  pinType: 'community', sourceId: null, maxLengthFt: null, maxHeightFt: null,
  badgeState: 'green', lastCheckInAt: new Date().toISOString(),
  recentCheckInCount: 1, isVerified: false, isFlagged: false,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  amenities: { overnight: true, dump: false, water: false, fuel: false, propane: false, electric: false, shower: false },
}

describe('MapView BadgeTooltip integration', () => {
  beforeEach(() => {
    localStorage.clear()
    useRigStore.setState({ onboardingDismissed: true })
    useAmenityFilterStore.setState({ activeFilters: [] })
    useUIStore.setState({ selectedPinId: null })
    mockNavigate.mockClear()
    mockUsePinsQuery.mockReturnValue({ data: [STUB_PIN], isLoading: false, error: null })
  })

  afterEach(() => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: false, error: null })
  })

  it('shows BadgeTooltip when pins are loaded and badge_tooltip_seen is not set', () => {
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.getByTestId('badge-tooltip')).toBeInTheDocument()
  })

  it('does not show BadgeTooltip when badge_tooltip_seen is already set', () => {
    localStorage.setItem('badge_tooltip_seen', '1')
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.queryByTestId('badge-tooltip')).not.toBeInTheDocument()
  })

  it('does not show BadgeTooltip while pins are loading', () => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: true, error: null })
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.queryByTestId('badge-tooltip')).not.toBeInTheDocument()
  })

  it('does not show BadgeTooltip when pins array is empty', () => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: false, error: null })
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.queryByTestId('badge-tooltip')).not.toBeInTheDocument()
  })

  it('dismissing BadgeTooltip hides it and writes badge_tooltip_seen to localStorage', () => {
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.getByTestId('badge-tooltip')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'dismiss' }))
    expect(screen.queryByTestId('badge-tooltip')).not.toBeInTheDocument()
    expect(localStorage.getItem('badge_tooltip_seen')).toBe('1')
  })
})

// ---------------------------------------------------------------------------
// MapView AmenityFilterBar integration — Story 2.5
// ---------------------------------------------------------------------------

const WATER_PIN: Pin = {
  ...STUB_PIN,
  id: 'water-pin',
  amenities: { overnight: false, dump: false, water: true, fuel: false, propane: false, electric: false, shower: false },
}
const NO_WATER_PIN: Pin = {
  ...STUB_PIN,
  id: 'no-water-pin',
  amenities: { overnight: true, dump: false, water: false, fuel: false, propane: false, electric: false, shower: false },
}

describe('MapView AmenityFilterBar integration', () => {
  beforeEach(() => {
    localStorage.clear()
    useRigStore.setState({ onboardingDismissed: true })
    useAmenityFilterStore.setState({ activeFilters: [] })
    useUIStore.setState({ selectedPinId: null })
    mockNavigate.mockClear()
  })

  afterEach(() => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: false, error: null })
    useAmenityFilterStore.setState({ activeFilters: [] })
  })

  it('renders AmenityFilterBar filter button and shows chips after clicking it', () => {
    render(<MapView />, { wrapper: Wrapper })
    const filterBtn = screen.getByRole('button', { name: /filters/i })
    expect(filterBtn).toBeInTheDocument()
    fireEvent.click(filterBtn)
    expect(screen.getByRole('button', { name: /water/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dump/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /overnight/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /fuel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /propane/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /electric/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /shower/i })).toBeInTheDocument()
  })

  it('empty state message not shown when no filters active', () => {
    mockUsePinsQuery.mockReturnValue({ data: [STUB_PIN], isLoading: false, error: null })
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.queryByText(/no matching spots/i)).not.toBeInTheDocument()
  })

  it('empty state message appears when active filters match no pins', () => {
    mockUsePinsQuery.mockReturnValue({ data: [NO_WATER_PIN], isLoading: false, error: null })
    useAmenityFilterStore.setState({ activeFilters: ['water'] })
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.getByText(/no matching spots in this area/i)).toBeInTheDocument()
  })

  it('empty state not shown when pins data is loading', () => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: true, error: null })
    useAmenityFilterStore.setState({ activeFilters: ['water'] })
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.queryByText(/no matching spots/i)).not.toBeInTheDocument()
  })

  it('empty state not shown when at least one pin matches the active filter', () => {
    mockUsePinsQuery.mockReturnValue({ data: [WATER_PIN, NO_WATER_PIN], isLoading: false, error: null })
    useAmenityFilterStore.setState({ activeFilters: ['water'] })
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.queryByText(/no matching spots/i)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// MapView pin selection navigation — Story 3.1
// ---------------------------------------------------------------------------

describe('MapView pin selection navigation', () => {
  beforeEach(() => {
    localStorage.clear()
    useRigStore.setState({ onboardingDismissed: true })
    useAmenityFilterStore.setState({ activeFilters: [] })
    useUIStore.setState({ selectedPinId: null })
    mockNavigate.mockClear()
  })

  afterEach(() => {
    useUIStore.setState({ selectedPinId: null })
  })

  it('navigates to /pin/:id when selectedPinId is set in UIStore', () => {
    useUIStore.setState({ selectedPinId: 'abc-123' })
    render(<MapView />, { wrapper: Wrapper })
    expect(mockNavigate).toHaveBeenCalledWith('/pin/abc-123')
  })

  it('does not navigate to /pin/:id when selectedPinId is null', () => {
    render(<MapView />, { wrapper: Wrapper })
    // Only the onboarding redirect may fire (but dismissed=true so it won't)
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('/pin/'))
  })
})

// ---------------------------------------------------------------------------
// MapView Near Me FAB — moved from SearchBar in UX update
// ---------------------------------------------------------------------------

describe('MapView Near Me FAB', () => {
  beforeEach(() => {
    localStorage.clear()
    useRigStore.setState({ onboardingDismissed: true })
    useAmenityFilterStore.setState({ activeFilters: [] })
    useUIStore.setState({ selectedPinId: null })
    mockNavigate.mockClear()
    mockUseGeolocation.mockReturnValue([
      { isLoading: false, coords: null as GeolocationCoordinates | null, error: null as 'denied' | 'no-api' | 'unavailable' | null },
      vi.fn(),
    ])
  })

  it('renders Near Me button at all times', () => {
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.getByLabelText('Use my current location')).toBeInTheDocument()
  })

  it('Near Me button shows loading state when GPS is loading', () => {
    mockUseGeolocation.mockReturnValue([
      { isLoading: true, coords: null as GeolocationCoordinates | null, error: null as 'denied' | 'no-api' | 'unavailable' | null },
      vi.fn(),
    ])
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.getByLabelText('Getting location...')).toBeDisabled()
  })

  it('clicking Near Me button calls requestGeo', () => {
    const mockRequestGeo = vi.fn()
    mockUseGeolocation.mockReturnValue([
      { isLoading: false, coords: null as GeolocationCoordinates | null, error: null as 'denied' | 'no-api' | 'unavailable' | null },
      mockRequestGeo,
    ])
    render(<MapView />, { wrapper: Wrapper })
    fireEvent.click(screen.getByLabelText('Use my current location'))
    expect(mockRequestGeo).toHaveBeenCalledOnce()
  })

  it('shows geo error alert when geolocation is denied', () => {
    mockUseGeolocation.mockReturnValue([
      { isLoading: false, coords: null as GeolocationCoordinates | null, error: 'denied' as const },
      vi.fn(),
    ])
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.getByRole('alert')).toHaveTextContent('Location access denied')
  })
})

// ---------------------------------------------------------------------------
// MapView departure check-in prompt integration — Story 4.2
// ---------------------------------------------------------------------------

const FAR_COORDS = {
  latitude: 38.0, longitude: -122.0,
  accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null,
} as GeolocationCoordinates

const NEAR_COORDS = {
  latitude: 37.001, longitude: -122.0,
  accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null,
} as GeolocationCoordinates

const VISIT_RECORD = {
  pinId: 'p1', pinName: 'Desert Springs',
  latitude: 37.0, longitude: -122.0,
  visitKey: 'p1:2026-03-19',
}

describe('MapView departure check-in prompt (Story 4.2)', () => {
  beforeEach(() => {
    localStorage.clear()
    useRigStore.setState({ onboardingDismissed: true })
    useRigStore.getState().setRigProfile({ rigType: 'Class A', lengthFt: 35, heightFt: 12.5 })
    useAmenityFilterStore.setState({ activeFilters: [] })
    useUIStore.setState({ selectedPinId: null, pendingCheckIn: null })
    useCheckInPromptStore.setState({ visitRecords: [], dismissedKeys: [] })
    mockNavigate.mockClear()
    mockUseGeolocation.mockReturnValue([
      { isLoading: false, coords: null as GeolocationCoordinates | null, error: null as null },
      vi.fn(),
    ])
  })

  it('shows DeparturePrompt when GPS coords place user >0.5 miles from a visited spot (AC1)', () => {
    useCheckInPromptStore.setState({ visitRecords: [VISIT_RECORD], dismissedKeys: [] })
    mockUseGeolocation.mockReturnValue([
      { isLoading: false, coords: FAR_COORDS, error: null as null },
      vi.fn(),
    ])
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.getByTestId('departure-prompt')).toBeInTheDocument()
    expect(screen.getByText('Desert Springs')).toBeInTheDocument()
  })

  it('does not show DeparturePrompt when user is within 0.5 miles of visited spot (AC2)', () => {
    useCheckInPromptStore.setState({ visitRecords: [VISIT_RECORD], dismissedKeys: [] })
    mockUseGeolocation.mockReturnValue([
      { isLoading: false, coords: NEAR_COORDS, error: null as null },
      vi.fn(),
    ])
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.queryByTestId('departure-prompt')).not.toBeInTheDocument()
  })

  it('does not show DeparturePrompt when no visit records exist', () => {
    mockUseGeolocation.mockReturnValue([
      { isLoading: false, coords: FAR_COORDS, error: null as null },
      vi.fn(),
    ])
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.queryByTestId('departure-prompt')).not.toBeInTheDocument()
  })

  it('does not show DeparturePrompt when visit is already dismissed (AC3)', () => {
    useCheckInPromptStore.setState({ visitRecords: [VISIT_RECORD], dismissedKeys: [VISIT_RECORD.visitKey] })
    mockUseGeolocation.mockReturnValue([
      { isLoading: false, coords: FAR_COORDS, error: null as null },
      vi.fn(),
    ])
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.queryByTestId('departure-prompt')).not.toBeInTheDocument()
  })

  it('does not show DeparturePrompt when GPS coords are null — GPS denied or unavailable (AC4)', () => {
    useCheckInPromptStore.setState({ visitRecords: [VISIT_RECORD], dismissedKeys: [] })
    // coords remain null (default beforeEach) — simulates GPS denied / unavailable
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.queryByTestId('departure-prompt')).not.toBeInTheDocument()
  })

  it('Skip button dismisses the visit and hides the prompt (AC5)', () => {
    useCheckInPromptStore.setState({ visitRecords: [VISIT_RECORD], dismissedKeys: [] })
    mockUseGeolocation.mockReturnValue([
      { isLoading: false, coords: FAR_COORDS, error: null as null },
      vi.fn(),
    ])
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.getByTestId('departure-prompt')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Skip check-in'))
    expect(screen.queryByTestId('departure-prompt')).not.toBeInTheDocument()
    expect(useCheckInPromptStore.getState().isDismissed(VISIT_RECORD.visitKey)).toBe(true)
  })

  it('Check In button dismisses visit, sets pendingCheckIn, and hides prompt (AC6)', () => {
    useCheckInPromptStore.setState({ visitRecords: [VISIT_RECORD], dismissedKeys: [] })
    mockUseGeolocation.mockReturnValue([
      { isLoading: false, coords: FAR_COORDS, error: null as null },
      vi.fn(),
    ])
    render(<MapView />, { wrapper: Wrapper })
    fireEvent.click(screen.getByLabelText('Submit check-in'))
    expect(screen.queryByTestId('departure-prompt')).not.toBeInTheDocument()
    expect(useCheckInPromptStore.getState().isDismissed(VISIT_RECORD.visitKey)).toBe(true)
    expect(useUIStore.getState().pendingCheckIn).toEqual({ pinId: VISIT_RECORD.pinId })
  })
})

describe('MapView account affordance', () => {
  beforeEach(() => {
    localStorage.clear()
    useRigStore.setState({ onboardingDismissed: true })
    useAmenityFilterStore.setState({ activeFilters: [] })
    useUIStore.setState({ selectedPinId: null })
    authState.session = null
    authState.isAuthenticated = false
    mockNavigate.mockClear()
  })

  it('shows the anonymous account label when signed out', () => {
    render(<MapView />, { wrapper: Wrapper })

    expect(screen.getByRole('button', { name: /open account/i })).toHaveTextContent('Account')
  })

  it('shows the signed-in user initial when authenticated', () => {
    authState.isAuthenticated = true
    authState.session = { user: { id: 'user-1', email: 'camper@example.com' } }

    render(<MapView />, { wrapper: Wrapper })

    expect(screen.getByRole('button', { name: /open profile for camper@example.com/i })).toHaveTextContent('C')
  })
})

describe('MapView My Routes entry point', () => {
  beforeEach(() => {
    localStorage.clear()
    useRigStore.setState({ onboardingDismissed: true })
    useAmenityFilterStore.setState({ activeFilters: [] })
    useUIStore.setState({ selectedPinId: null })
    mockNavigate.mockClear()
  })

  it('renders the My Routes floating action button', () => {
    render(<MapView />, { wrapper: Wrapper })

    expect(screen.getByRole('button', { name: /open my routes/i })).toHaveTextContent('My Routes')
  })

  it('navigates to /trips when the My Routes button is clicked', () => {
    render(<MapView />, { wrapper: Wrapper })

    fireEvent.click(screen.getByRole('button', { name: /open my routes/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/trips')
  })
})

describe('MapView trip corridor integration', () => {
  beforeEach(() => {
    localStorage.clear()
    useRigStore.setState({ onboardingDismissed: true })
    useAmenityFilterStore.setState({ activeFilters: [] })
    useUIStore.setState({ selectedPinId: null, pendingMapCenter: null })
    mockNavigate.mockClear()
    mockMapFitBounds.mockClear()
    mockMapSetView.mockClear()
  })

  it('fits the active route into view when a corridor preview is available', async () => {
    mockUseTripCorridorPreview.mockReturnValue({
      previewTrip: {
        id: 'trip-123',
        title: 'Desert Loop',
        notes: '',
        status: 'draft',
        origin: { id: 'origin-1', name: 'Flagstaff', latitude: 35.1983, longitude: -111.6513 },
        destination: { id: 'dest-1', name: 'Quartzsite', latitude: 33.6, longitude: -114.2 },
        routeMode: 'corridor',
        stopCount: 3,
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
            notes: '',
            createdAt: '2026-03-24T10:00:00.000Z',
            updatedAt: '2026-03-24T11:00:00.000Z',
          },
          {
            id: 'stop-2',
            stopOrder: 1,
            stopKind: 'waypoint',
            source: 'manual',
            pinId: 'pin-waypoint',
            place: { id: 'pin-waypoint', name: 'Kingman Fuel', latitude: 35.1894, longitude: -114.053 },
            notes: '',
            createdAt: '2026-03-24T10:00:00.000Z',
            updatedAt: '2026-03-24T11:00:00.000Z',
          },
          {
            id: 'stop-3',
            stopOrder: 2,
            stopKind: 'destination',
            source: 'manual',
            pinId: null,
            place: { id: 'dest-1', name: 'Quartzsite', latitude: 33.6, longitude: -114.2 },
            notes: '',
            createdAt: '2026-03-24T10:00:00.000Z',
            updatedAt: '2026-03-24T11:00:00.000Z',
          },
        ],
      },
      setPreviewTrip: vi.fn(),
    })

    render(<MapView />, { wrapper: Wrapper })

    expect(await screen.findByTestId('trip-corridor-overlay')).toBeInTheDocument()
    expect(mockMapFitBounds).toHaveBeenCalledTimes(1)
  })

  it('preserves pending map center behavior without immediately overriding it', async () => {
    useUIStore.setState({ pendingMapCenter: { lat: 40, lng: -104 } })
    mockUseTripCorridorPreview.mockReturnValue({
      previewTrip: {
        id: 'trip-456',
        title: 'Focused pin trip',
        notes: '',
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
        stops: [
          {
            id: 'stop-1',
            stopOrder: 0,
            stopKind: 'waypoint',
            source: 'manual',
            pinId: 'pin-waypoint',
            place: { id: 'pin-waypoint', name: 'Kingman Fuel', latitude: 35.1894, longitude: -114.053 },
            notes: '',
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
      },
      setPreviewTrip: vi.fn(),
    })

    render(<MapView />, { wrapper: Wrapper })

    expect(mockMapSetView).toHaveBeenCalledWith([40, -104], 14)
    expect(mockMapFitBounds).not.toHaveBeenCalled()
  })
})
