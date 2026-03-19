import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PinDetailSheet, { buildMapsUrl } from './PinDetailSheet'
import { useRigStore } from '@/store/rigStore'
import { useUIStore } from '@/store/uiStore'
import { useSpotsStore } from '@/store/spotsStore'
import { useCheckInPromptStore } from '@/store/checkInPromptStore'
import type { Pin } from '@/types/pin'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const { mockUsePinsQuery } = vi.hoisted(() => ({
  mockUsePinsQuery: vi.fn(() => ({ data: [] as Pin[], isLoading: false, error: null as Error | null })),
}))
vi.mock('@/hooks/usePinsQuery', () => ({
  usePinsQuery: mockUsePinsQuery,
}))

const STUB_PIN: Pin = {
  id: 'pin-1',
  name: 'Test Spot',
  description: 'Great camping spot',
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
    dump: true,
    water: true,
    fuel: false,
    propane: false,
    electric: false,
    shower: false,
  },
}

function renderSheet(pinId: string = 'pin-1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/pin/${pinId}`]}>
        <Routes>
          <Route path="/pin/:id" element={<PinDetailSheet />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PinDetailSheet', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    useRigStore.getState().clearRigProfile()
    useUIStore.setState({ selectedPinId: null })
    useSpotsStore.setState({ savedSpots: [] })
    useCheckInPromptStore.setState({ visitRecords: [], dismissedKeys: [] })
    mockUsePinsQuery.mockReturnValue({ data: [STUB_PIN], isLoading: false, error: null })
  })

  afterEach(() => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: false, error: null })
  })

  it('renders loading skeleton when isLoading is true', () => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: true, error: null })
    renderSheet()
    expect(screen.getByLabelText(/loading pin details/i)).toBeInTheDocument()
  })

  it('renders "Spot not found" when pin id not in data', () => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: false, error: null })
    renderSheet('nonexistent-id')
    expect(screen.getByText(/spot not found/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to map/i })).toBeInTheDocument()
  })

  it('renders pin name when pin is found', () => {
    renderSheet('pin-1')
    expect(screen.getByText('Test Spot')).toBeInTheDocument()
  })

  it('renders pin category label', () => {
    renderSheet('pin-1')
    expect(screen.getByText('Community Stop')).toBeInTheDocument()
  })

  it('renders only active amenities as pills', () => {
    renderSheet('pin-1')
    // STUB_PIN: overnight, dump, water = true; fuel, propane, electric, shower = false
    expect(screen.getByText('Overnight')).toBeInTheDocument()
    expect(screen.getByText('Dump')).toBeInTheDocument()
    expect(screen.getByText('Water')).toBeInTheDocument()
    expect(screen.queryByText('Fuel')).not.toBeInTheDocument()
    expect(screen.queryByText('Propane')).not.toBeInTheDocument()
    expect(screen.queryByText('Electric')).not.toBeInTheDocument()
    expect(screen.queryByText('Shower')).not.toBeInTheDocument()
  })

  it('renders rig restrictions when maxLengthFt and maxHeightFt are set', () => {
    renderSheet('pin-1')
    expect(screen.getByText(/max length: 40ft/i)).toBeInTheDocument()
    expect(screen.getByText(/max height: 13ft/i)).toBeInTheDocument()
  })

  it('renders "No size restrictions" when both maxLengthFt and maxHeightFt are null', () => {
    const noLimitPin: Pin = { ...STUB_PIN, id: 'no-limit', maxLengthFt: null, maxHeightFt: null }
    mockUsePinsQuery.mockReturnValue({ data: [noLimitPin], isLoading: false, error: null })
    renderSheet('no-limit')
    expect(screen.getByText('No size restrictions')).toBeInTheDocument()
  })

  it('renders rig fit notice when rig exceeds restrictions', () => {
    useRigStore.getState().setRigProfile({ rigType: 'Class A', lengthFt: 45, heightFt: 13 })
    // STUB_PIN maxLengthFt=40, rig lengthFt=45 → does not fit
    renderSheet('pin-1')
    expect(screen.getByText(/this spot may not fit your class a, 45ft rig/i)).toBeInTheDocument()
  })

  it('does not render rig fit notice when pin fits rig', () => {
    useRigStore.getState().setRigProfile({ rigType: 'Class C', lengthFt: 28, heightFt: 11 })
    // STUB_PIN maxLengthFt=40, rig lengthFt=28 → fits
    renderSheet('pin-1')
    expect(screen.queryByText(/this spot may not fit/i)).not.toBeInTheDocument()
  })

  it('does not render rig fit notice when no rig profile set', () => {
    // rigType is null from clearRigProfile()
    renderSheet('pin-1')
    expect(screen.queryByText(/this spot may not fit/i)).not.toBeInTheDocument()
  })

  it('calls navigate("/") and setSelectedPin(null) when close button clicked', () => {
    renderSheet('pin-1')
    fireEvent.click(screen.getByRole('button', { name: /close pin details/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/')
    expect(useUIStore.getState().selectedPinId).toBeNull()
  })

  it('calls navigate("/") and setSelectedPin(null) when backdrop clicked', () => {
    renderSheet('pin-1')
    fireEvent.click(screen.getByTestId('pin-detail-backdrop'))
    expect(mockNavigate).toHaveBeenCalledWith('/')
    expect(useUIStore.getState().selectedPinId).toBeNull()
  })

  it('has role="dialog" with aria-labelledby pointing to name heading', () => {
    renderSheet('pin-1')
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-labelledby', 'pin-detail-name')
    expect(document.getElementById('pin-detail-name')).toHaveTextContent('Test Spot')
  })

  it('renders description when not null', () => {
    renderSheet('pin-1')
    expect(screen.getByText('Great camping spot')).toBeInTheDocument()
    expect(screen.getByText(/community notes/i)).toBeInTheDocument()
  })

  it('calls navigate("/") when "Back to map" button clicked in not-found state', () => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: false, error: null })
    renderSheet('nonexistent-id')
    fireEvent.click(screen.getByRole('button', { name: /back to map/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  // M3: error state
  it('renders error message when usePinsQuery returns an error', () => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: false, error: new Error('Network error') })
    renderSheet('pin-1')
    expect(screen.getByText(/couldn't load spot details/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to map/i })).toBeInTheDocument()
  })

  it('does not render error message when query is loading', () => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: true, error: null })
    renderSheet('pin-1')
    expect(screen.queryByText(/couldn't load spot details/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/loading pin details/i)).toBeInTheDocument()
  })

  // M1: unmount cleanup
  it('clears selectedPinId in UIStore when component unmounts (browser back fix)', () => {
    useUIStore.setState({ selectedPinId: 'pin-1' })
    const { unmount } = renderSheet('pin-1')
    expect(useUIStore.getState().selectedPinId).toBe('pin-1')
    unmount()
    expect(useUIStore.getState().selectedPinId).toBeNull()
  })

  // L3: RecencyBadge renders with correct badgeState
  it('renders RecencyBadge with the correct content for the pin badgeState', () => {
    // STUB_PIN has badgeState: 'green'
    renderSheet('pin-1')
    const badge = screen.getByRole('status')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('Verified recently')
  })
})

// ---------------------------------------------------------------------------
// buildMapsUrl unit tests — Story 3.2
// ---------------------------------------------------------------------------

describe('buildMapsUrl', () => {
  it('returns a Google Maps URL with coordinates embedded', () => {
    const url = buildMapsUrl(40, -104, 'Test Spot')
    expect(url).toBe('https://maps.google.com/?q=40,-104')
  })

  it('embeds coordinates correctly', () => {
    const url = buildMapsUrl(37.7749, -122.4194, 'SF')
    expect(url).toContain('37.7749')
    expect(url).toContain('-122.4194')
  })
})

// ---------------------------------------------------------------------------
// Get Directions button integration tests — Story 3.2
// ---------------------------------------------------------------------------

describe('PinDetailSheet Get Directions button', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    useRigStore.getState().clearRigProfile()
    useUIStore.setState({ selectedPinId: null })
    useSpotsStore.setState({ savedSpots: [] })
    useCheckInPromptStore.setState({ visitRecords: [], dismissedKeys: [] })
    mockUsePinsQuery.mockReturnValue({ data: [STUB_PIN], isLoading: false, error: null })
  })

  afterEach(() => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: false, error: null })
    vi.restoreAllMocks()
  })

  it('renders "Get Directions" button when pin is found', () => {
    renderSheet('pin-1')
    expect(screen.getByRole('link', { name: /get directions/i })).toBeInTheDocument()
  })

  it('does not render "Get Directions" button when loading', () => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: true, error: null })
    renderSheet('pin-1')
    expect(screen.queryByRole('link', { name: /get directions/i })).not.toBeInTheDocument()
  })

  it('does not render "Get Directions" button when pin not found', () => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: false, error: null })
    renderSheet('nonexistent-id')
    expect(screen.queryByRole('link', { name: /get directions/i })).not.toBeInTheDocument()
  })

  it('does not render "Get Directions" button when error state', () => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: false, error: new Error('Network error') })
    renderSheet('pin-1')
    expect(screen.queryByRole('link', { name: /get directions/i })).not.toBeInTheDocument()
  })

  it('"Get Directions" link has href with Google Maps URL containing pin coordinates', () => {
    renderSheet('pin-1')
    const link = screen.getByRole('link', { name: /get directions/i })
    const href = link.getAttribute('href') ?? ''
    // STUB_PIN has latitude: 40, longitude: -104
    expect(href).toContain('maps.google.com')
    expect(href).toContain('40')
    expect(href).toContain('-104')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('"Get Directions" button renders even when badge is stale (red) — warn never block', () => {
    const stalePin: Pin = { ...STUB_PIN, id: 'stale', badgeState: 'red' }
    mockUsePinsQuery.mockReturnValue({ data: [stalePin], isLoading: false, error: null })
    renderSheet('stale')
    expect(screen.getByRole('link', { name: /get directions/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Bookmark button tests — Story 3.3
// ---------------------------------------------------------------------------

describe('PinDetailSheet bookmark button', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    useRigStore.getState().clearRigProfile()
    useUIStore.setState({ selectedPinId: null })
    useSpotsStore.setState({ savedSpots: [] })
    useCheckInPromptStore.setState({ visitRecords: [], dismissedKeys: [] })
    mockUsePinsQuery.mockReturnValue({ data: [STUB_PIN], isLoading: false, error: null })
  })

  afterEach(() => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: false, error: null })
    vi.restoreAllMocks()
  })

  it('renders bookmark button when pin is found', () => {
    renderSheet('pin-1')
    expect(screen.getByRole('button', { name: /save spot/i })).toBeInTheDocument()
  })

  it('does not render bookmark button when loading', () => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: true, error: null })
    renderSheet('pin-1')
    expect(screen.queryByRole('button', { name: /save spot|remove saved spot/i })).not.toBeInTheDocument()
  })

  it('does not render bookmark button when pin not found', () => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: false, error: null })
    renderSheet('nonexistent-id')
    expect(screen.queryByRole('button', { name: /save spot|remove saved spot/i })).not.toBeInTheDocument()
  })

  it('does not render bookmark button when error state', () => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: false, error: new Error('Network error') })
    renderSheet('pin-1')
    expect(screen.queryByRole('button', { name: /save spot|remove saved spot/i })).not.toBeInTheDocument()
  })

  it('bookmark button has aria-pressed="false" when pin is not saved', () => {
    renderSheet('pin-1')
    expect(screen.getByRole('button', { name: /save spot/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('bookmark button has aria-pressed="true" when pin is already saved', () => {
    useSpotsStore.setState({ savedSpots: [STUB_PIN] })
    renderSheet('pin-1')
    expect(screen.getByRole('button', { name: /remove saved spot/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('clicking bookmark button saves the pin', () => {
    renderSheet('pin-1')
    fireEvent.click(screen.getByRole('button', { name: /save spot/i }))
    expect(useSpotsStore.getState().isSaved('pin-1')).toBe(true)
  })

  it('clicking active bookmark button removes the pin', () => {
    useSpotsStore.setState({ savedSpots: [STUB_PIN] })
    renderSheet('pin-1')
    fireEvent.click(screen.getByRole('button', { name: /remove saved spot/i }))
    expect(useSpotsStore.getState().isSaved('pin-1')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Report an Issue button tests — Story 4.4
// ---------------------------------------------------------------------------

describe('PinDetailSheet Report an Issue button', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    useRigStore.getState().clearRigProfile()
    useUIStore.setState({ selectedPinId: null, pendingReport: null })
    useSpotsStore.setState({ savedSpots: [] })
    useCheckInPromptStore.setState({ visitRecords: [], dismissedKeys: [] })
    mockUsePinsQuery.mockReturnValue({ data: [STUB_PIN], isLoading: false, error: null })
  })

  afterEach(() => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: false, error: null })
    vi.restoreAllMocks()
  })

  it('renders "Report an Issue" button when pin is found', () => {
    renderSheet('pin-1')
    expect(screen.getByRole('button', { name: /report an issue/i })).toBeInTheDocument()
  })

  it('clicking "Report an Issue" sets pendingReport in uiStore with correct pinId', () => {
    renderSheet('pin-1')
    fireEvent.click(screen.getByRole('button', { name: /report an issue/i }))
    expect(useUIStore.getState().pendingReport).toEqual({ pinId: 'pin-1' })
  })
})

// ---------------------------------------------------------------------------
// Visit recording tests — Story 4.2
// ---------------------------------------------------------------------------

describe('PinDetailSheet visit recording', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    useRigStore.getState().clearRigProfile()
    useUIStore.setState({ selectedPinId: null })
    useSpotsStore.setState({ savedSpots: [] })
    useCheckInPromptStore.setState({ visitRecords: [], dismissedKeys: [] })
  })

  afterEach(() => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: false, error: null })
  })

  it('records a visit in checkInPromptStore when pin is found', () => {
    mockUsePinsQuery.mockReturnValue({ data: [STUB_PIN], isLoading: false, error: null })
    renderSheet('pin-1')
    expect(useCheckInPromptStore.getState().visitRecords).toHaveLength(1)
  })

  it('recorded visit has correct pinId, pinName, latitude, longitude', () => {
    mockUsePinsQuery.mockReturnValue({ data: [STUB_PIN], isLoading: false, error: null })
    renderSheet('pin-1')
    const record = useCheckInPromptStore.getState().visitRecords[0]
    expect(record.pinId).toBe('pin-1')
    expect(record.pinName).toBe('Test Spot')
    expect(record.latitude).toBe(40)
    expect(record.longitude).toBe(-104)
  })

  it('does not record a visit when in loading state', () => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: true, error: null })
    renderSheet('pin-1')
    expect(useCheckInPromptStore.getState().visitRecords).toHaveLength(0)
  })

  it('does not record a visit when pin is not found', () => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: false, error: null })
    renderSheet('nonexistent-id')
    expect(useCheckInPromptStore.getState().visitRecords).toHaveLength(0)
  })
})
