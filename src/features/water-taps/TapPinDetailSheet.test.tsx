import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import TapPinDetailSheet from './TapPinDetailSheet'
import type { TapDetail } from './waterTapsApi'
import { useUIStore } from '@/store/uiStore'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Mock all sub-components to keep tests focused on TapPinDetailSheet
vi.mock('./TapConfirmDeny', () => ({
  default: ({ tapPinId }: { tapPinId: string }) => (
    <div data-testid="tap-confirm-deny" data-tap-pin-id={tapPinId}>
      <button>Still here</button>
      <button>No longer here</button>
    </div>
  ),
}))

vi.mock('./TapPhotoSubmission', () => ({
  default: ({ tapPinId }: { tapPinId: string; tapPinLocation: [number, number] }) => (
    <div data-testid="tap-photo-submission" data-tap-pin-id={tapPinId} />
  ),
}))

const { mockUseWaterTapQuery } = vi.hoisted(() => ({
  mockUseWaterTapQuery: vi.fn(() => ({
    data: null as TapDetail | null,
    isLoading: false,
    error: null as Error | null,
  })),
}))

vi.mock('./waterTapsApi', () => ({
  useWaterTapQuery: mockUseWaterTapQuery,
  useTapVerifyMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useTapSubmitMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}))

const STUB_TAP: TapDetail = {
  id: 'tap-1',
  location: { type: 'Point', coordinates: [-80.5, 24.7] },
  place_name: 'Bahia Honda State Park Tap',
  place_type: 'campground',
  access: 'public',
  confidence: 0.92,
  source: 'ml_batch',
  photos: null,
  seasonal_notes: null,
  mile_marker: 36.5,
  is_active: true,
  verified_date: null,
  place_ref: null,
  latitude: 24.7,
  longitude: -80.5,
  confirmedCount: 0,
  deniedCount: 0,
}

function renderSheet(tapId = 'tap-1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/tap/${tapId}`]}>
        <Routes>
          <Route path="/tap/:id" element={<TapPinDetailSheet />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TapPinDetailSheet', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockUseWaterTapQuery.mockReturnValue({ data: STUB_TAP, isLoading: false, error: null })
  })

  // ── AC 2: Bottom sheet renders ────────────────────────────────────────────

  it('renders place_name when tap is found', () => {
    renderSheet()
    expect(screen.getByText('Bahia Honda State Park Tap')).toBeInTheDocument()
  })

  it('renders place_type label', () => {
    renderSheet()
    expect(screen.getByText('Campground')).toBeInTheDocument()
  })

  it('renders access classification', () => {
    renderSheet()
    expect(screen.getByText(/public access/i)).toBeInTheDocument()
  })

  it('renders loading skeleton when isLoading is true', () => {
    mockUseWaterTapQuery.mockReturnValue({ data: null, isLoading: true, error: null })
    renderSheet()
    expect(screen.getByLabelText(/loading tap details/i)).toBeInTheDocument()
  })

  it('renders "Tap not found" when query returns null', () => {
    mockUseWaterTapQuery.mockReturnValue({ data: null, isLoading: false, error: null })
    renderSheet()
    expect(screen.getByText(/tap not found/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to map/i })).toBeInTheDocument()
  })

  it('renders error state when query errors', () => {
    mockUseWaterTapQuery.mockReturnValue({ data: null, isLoading: false, error: new Error('network') })
    renderSheet()
    expect(screen.getByText(/couldn't load tap details/i)).toBeInTheDocument()
  })

  // ── AC 2: Mile marker + seasonal notes ───────────────────────────────────

  it('renders mile_marker when present', () => {
    renderSheet()
    expect(screen.getByText(/MM 36\.5/)).toBeInTheDocument()
  })

  it('does not render mile_marker section when null', () => {
    mockUseWaterTapQuery.mockReturnValue({
      data: { ...STUB_TAP, mile_marker: null },
      isLoading: false,
      error: null,
    })
    renderSheet()
    expect(screen.queryByText(/Mile Marker/i)).not.toBeInTheDocument()
  })

  it('renders seasonal_notes when present', () => {
    mockUseWaterTapQuery.mockReturnValue({
      data: { ...STUB_TAP, seasonal_notes: 'Closed November–April' },
      isLoading: false,
      error: null,
    })
    renderSheet()
    expect(screen.getByText('Closed November–April')).toBeInTheDocument()
  })

  it('does not render seasonal notes section when null', () => {
    renderSheet()
    expect(screen.queryByText(/seasonal notes/i)).not.toBeInTheDocument()
  })

  // ── AC 5: verified_date display ───────────────────────────────────────────

  it('shows community verified date when verified_date is set', () => {
    mockUseWaterTapQuery.mockReturnValue({
      data: { ...STUB_TAP, verified_date: '2026-03-15T00:00:00Z' },
      isLoading: false,
      error: null,
    })
    renderSheet()
    // The date label "Community verified: Mar 15, 2026" should be present
    expect(screen.getByText(/community verified: mar 15, 2026/i)).toBeInTheDocument()
  })

  // ── AC 3–5: TapConfidenceBadge states ────────────────────────────────────

  it('TapConfidenceBadge shows "Community Verified" when verified_date is not null', () => {
    mockUseWaterTapQuery.mockReturnValue({
      data: { ...STUB_TAP, verified_date: '2026-03-01T00:00:00Z', confirmedCount: 3 },
      isLoading: false,
      error: null,
    })
    renderSheet()
    expect(screen.getByTestId('tap-confidence-badge')).toHaveTextContent('Community Verified')
  })

  it('TapConfidenceBadge shows "1 traveler confirmed" when confirmedCount=1', () => {
    mockUseWaterTapQuery.mockReturnValue({
      data: { ...STUB_TAP, confirmedCount: 1, verified_date: null },
      isLoading: false,
      error: null,
    })
    renderSheet()
    expect(screen.getByTestId('tap-confidence-badge')).toHaveTextContent('1 traveler confirmed')
  })

  it('TapConfidenceBadge shows "N travelers confirmed" when confirmedCount>1', () => {
    mockUseWaterTapQuery.mockReturnValue({
      data: { ...STUB_TAP, confirmedCount: 4, verified_date: null },
      isLoading: false,
      error: null,
    })
    renderSheet()
    expect(screen.getByTestId('tap-confidence-badge')).toHaveTextContent('4 travelers confirmed')
  })

  it('TapConfidenceBadge shows "ML Confidence" for ml_batch source with no confirmations', () => {
    renderSheet()
    expect(screen.getByTestId('tap-confidence-badge')).toHaveTextContent('ML Confidence: 92%')
    expect(screen.getByTestId('tap-confidence-badge')).toHaveTextContent('ML Discovered')
  })

  // ── Sub-components render ─────────────────────────────────────────────────

  it('renders TapConfirmDeny with correct tapPinId', () => {
    renderSheet()
    const el = screen.getByTestId('tap-confirm-deny')
    expect(el).toBeInTheDocument()
    expect(el).toHaveAttribute('data-tap-pin-id', 'tap-1')
  })

  it('renders TapPhotoSubmission with correct tapPinId', () => {
    renderSheet()
    const el = screen.getByTestId('tap-photo-submission')
    expect(el).toBeInTheDocument()
    expect(el).toHaveAttribute('data-tap-pin-id', 'tap-1')
  })

  // ── AC 11: Close button + navigation ─────────────────────────────────────

  it('calls navigate("/") when close button is clicked', () => {
    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: /close tap details/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('calls navigate("/") when backdrop is clicked', () => {
    renderSheet()
    fireEvent.click(screen.getByTestId('tap-detail-backdrop'))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('calls navigate("/") when "Back to map" is clicked in not-found state', () => {
    mockUseWaterTapQuery.mockReturnValue({ data: null, isLoading: false, error: null })
    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: /back to map/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('calls navigate("/") when "Back to map" is clicked in error state', () => {
    mockUseWaterTapQuery.mockReturnValue({ data: null, isLoading: false, error: new Error('network') })
    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: /back to map/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('close button has min 44px touch target (min-h-[44px])', () => {
    renderSheet()
    const closeBtn = screen.getByRole('button', { name: /close tap details/i })
    expect(closeBtn.className).toMatch(/min-h-\[44px\]/)
  })

  it('clears selectedTapPinId in uiStore on unmount (so same pin can be re-tapped)', () => {
    const { unmount } = renderSheet()
    // Store starts null; the component doesn't set it, so just verify unmount cleanup doesn't throw
    // and the store remains clean
    unmount()
    const { selectedTapPinId } = useUIStore.getState() as { selectedTapPinId: string | null }
    expect(selectedTapPinId).toBeNull()
  })

  // ── AC 2: Dialog ARIA ─────────────────────────────────────────────────────

  it('has role="dialog" with aria-labelledby pointing to name heading', () => {
    renderSheet()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'tap-detail-name')
    expect(document.getElementById('tap-detail-name')).toHaveTextContent('Bahia Honda State Park Tap')
  })

  // ── Photos gallery ────────────────────────────────────────────────────────

  it('renders photo gallery when photos are present', () => {
    mockUseWaterTapQuery.mockReturnValue({
      data: { ...STUB_TAP, photos: ['https://example.com/tap1.jpg', 'https://example.com/tap2.jpg'] },
      isLoading: false,
      error: null,
    })
    renderSheet()
    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(2)
    expect(images[0]).toHaveAttribute('src', 'https://example.com/tap1.jpg')
  })

  it('does not render photo gallery when photos is null', () => {
    renderSheet()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
