import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import SavedSpotsScreen from './SavedSpotsScreen'
import { useSpotsStore } from '@/store/spotsStore'
import { useUIStore } from '@/store/uiStore'
import type { Pin } from '@/types/pin'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const { mockUseGeolocation } = vi.hoisted(() => ({
  mockUseGeolocation: vi.fn(() => [
    { isLoading: false, coords: null as GeolocationCoordinates | null, error: null as 'denied' | 'no-api' | 'unavailable' | null },
    vi.fn(),
  ]),
}))
vi.mock('@/hooks/useGeolocation', () => ({ useGeolocation: mockUseGeolocation }))

const STUB_PIN: Pin = {
  id: 'pin-1',
  name: 'Test Spot',
  description: 'A great spot',
  latitude: 40,
  longitude: -104,
  pinType: 'community',
  sourceId: null,
  maxLengthFt: 40,
  maxHeightFt: 13,
  badgeState: 'green',
  lastCheckInAt: '2026-03-15T00:00:00Z',
  recentCheckInCount: 3,
  isVerified: true,
  isFlagged: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-03-15T00:00:00Z',
  amenities: {
    overnight: true,
    dump: false,
    water: true,
    fuel: false,
    propane: false,
    electric: false,
    shower: false,
  },
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/saved']}>
      <Routes>
        <Route path="/saved" element={<SavedSpotsScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SavedSpotsScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    useSpotsStore.setState({ savedSpots: [] })
    useUIStore.setState({ selectedPinId: null, pendingMapCenter: null })
    mockUseGeolocation.mockReturnValue([
      { isLoading: false, coords: null, error: null },
      vi.fn(),
    ])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders heading "Saved Spots"', () => {
    renderScreen()
    expect(screen.getByRole('heading', { name: /saved spots/i })).toBeInTheDocument()
  })

  it('renders empty state when no saved spots', () => {
    renderScreen()
    expect(screen.getByText(/no saved spots yet/i)).toBeInTheDocument()
  })

  it('empty state message mentions "bookmark icon"', () => {
    renderScreen()
    expect(screen.getByText(/bookmark icon/i)).toBeInTheDocument()
  })

  it('renders list of saved spot names when spots exist', () => {
    useSpotsStore.setState({ savedSpots: [STUB_PIN] })
    renderScreen()
    expect(screen.getByText('Test Spot')).toBeInTheDocument()
  })

  it('renders category label for each spot', () => {
    useSpotsStore.setState({ savedSpots: [STUB_PIN] })
    renderScreen()
    expect(screen.getByText('Community Stop')).toBeInTheDocument()
  })

  it('renders RecencyBadge for each spot', () => {
    useSpotsStore.setState({ savedSpots: [STUB_PIN] })
    renderScreen()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Verified')
  })

  it('shows distance in miles when GPS coords are available', () => {
    useSpotsStore.setState({ savedSpots: [STUB_PIN] })
    mockUseGeolocation.mockReturnValue([
      {
        isLoading: false,
        coords: { latitude: 39.9, longitude: -104.1 } as GeolocationCoordinates,
        error: null,
      },
      vi.fn(),
    ])
    renderScreen()
    expect(screen.getByText(/\d+\.\d+ mi/)).toBeInTheDocument()
  })

  it('does NOT show distance when GPS not available', () => {
    useSpotsStore.setState({ savedSpots: [STUB_PIN] })
    renderScreen()
    expect(screen.queryByText(/mi$/)).not.toBeInTheDocument()
  })

  it('clicking a spot navigates to /pin/:id', () => {
    useSpotsStore.setState({ savedSpots: [STUB_PIN] })
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /view test spot/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/pin/pin-1')
  })

  it('clicking a spot calls setSelectedPin with the pin id', () => {
    useSpotsStore.setState({ savedSpots: [STUB_PIN] })
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /view test spot/i }))
    expect(useUIStore.getState().selectedPinId).toBe('pin-1')
  })

  it('clicking a spot calls setPendingMapCenter with pin lat/lng', () => {
    useSpotsStore.setState({ savedSpots: [STUB_PIN] })
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /view test spot/i }))
    expect(useUIStore.getState().pendingMapCenter).toEqual({ lat: 40, lng: -104 })
  })

  it('clicking "Back to map" navigates to /', () => {
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /back to map/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})
