import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MapView from './MapView'
import { useRigStore } from '@/store/rigStore'
import type { Pin } from '@/types/pin'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Avoid Leaflet DOM dependency in jsdom
vi.mock('./LeafletMap', () => ({
  default: vi.fn(() => <div data-testid="leaflet-map" />),
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

describe('MapView redirect guard', () => {
  beforeEach(() => {
    localStorage.clear()
    useRigStore.getState().clearRigProfile()
    useRigStore.setState({ onboardingDismissed: false })
    mockNavigate.mockClear()
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
})

describe('MapView rig context indicator', () => {
  beforeEach(() => {
    localStorage.clear()
    useRigStore.getState().clearRigProfile()
    useRigStore.setState({ onboardingDismissed: false })
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
