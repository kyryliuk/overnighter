import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import SuggestSpotScreen from './SuggestSpotScreen'

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockUseAuth } = vi.hoisted(() => {
  const mockUseAuth = vi.fn().mockReturnValue({
    session: { user: { id: 'user-1' }, access_token: 'test-token' },
    isAuthenticated: true,
    isLoading: false,
  })
  return { mockUseAuth }
})

vi.mock('@/features/account/AuthContext', () => ({
  useAuth: mockUseAuth,
}))

const { mockUseGeolocation } = vi.hoisted(() => ({
  mockUseGeolocation: vi.fn(() => [
    { isLoading: false, coords: null as GeolocationCoordinates | null, error: null as 'denied' | 'no-api' | 'unavailable' | null },
    vi.fn(),
  ]),
}))

vi.mock('@/hooks/useGeolocation', () => ({
  useGeolocation: mockUseGeolocation,
}))

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => {
    if (typeof navigator !== 'undefined') return navigator.onLine !== false
    return true
  },
}))

vi.mock('@/features/check-in/PhotoUpload', () => ({
  default: () => <div data-testid="photo-upload">PhotoUpload</div>,
}))

// ── Helpers ────────────────────────────────────────────────────────────────

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SuggestSpotScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function fillStep1Valid() {
  fireEvent.change(screen.getByLabelText(/spot name/i), { target: { value: 'Desert Oasis' } })
  fireEvent.change(screen.getByLabelText(/latitude/i), { target: { value: '35.5' } })
  fireEvent.change(screen.getByLabelText(/longitude/i), { target: { value: '-110.5' } })
}

function selectAmenity() {
  // Click the "Overnight" chip on step 1 to pre-select an amenity
  fireEvent.click(screen.getByRole('button', { name: 'Overnight' }))
}

function advanceToStep2() {
  fillStep1Valid()
  selectAmenity()
  fireEvent.click(screen.getByRole('button', { name: /next/i }))
}

function advanceToStep3() {
  advanceToStep2()
  fireEvent.click(screen.getByRole('button', { name: /next/i }))
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
  } as Response))
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
  mockUseAuth.mockReturnValue({
    session: { user: { id: 'user-1' }, access_token: 'test-token' },
    isAuthenticated: true,
    isLoading: false,
  })
  mockUseGeolocation.mockReturnValue([
    { isLoading: false, coords: null, error: null },
    vi.fn(),
  ])
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Tests ──────────────────────────────────────────────────────────────────

describe('SuggestSpotScreen', () => {
  // Step indicator
  it('shows step indicator "Step 1 of 3" on initial render', () => {
    renderScreen()
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
  })

  // Spot type chips
  it('toggles amenity state when spot type chip is clicked', () => {
    renderScreen()
    const chip = screen.getByRole('button', { name: 'Overnight' })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'false')
  })

  // Step 1 validation — name
  it('blocks advancement when name is empty', () => {
    renderScreen()
    fireEvent.change(screen.getByLabelText(/latitude/i), { target: { value: '35.5' } })
    fireEvent.change(screen.getByLabelText(/longitude/i), { target: { value: '-110.5' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
  })

  // Step 1 validation — coordinates missing
  it('blocks advancement when coordinates are missing', () => {
    renderScreen()
    fireEvent.change(screen.getByLabelText(/spot name/i), { target: { value: 'Test Spot' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('Latitude is required')).toBeInTheDocument()
    expect(screen.getByText('Longitude is required')).toBeInTheDocument()
  })

  // Step 1 validation — coordinates out of range
  it('blocks advancement when coordinates are outside supported region', () => {
    renderScreen()
    fireEvent.change(screen.getByLabelText(/spot name/i), { target: { value: 'Test Spot' } })
    fireEvent.change(screen.getByLabelText(/latitude/i), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText(/longitude/i), { target: { value: '-200' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getAllByText(/outside the supported region/i)).toHaveLength(2)
  })

  // Step 1 → Step 2
  it('advances to Step 2 when Step 1 is valid', () => {
    renderScreen()
    advanceToStep2()
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument()
    expect(screen.getByText(/details & amenities/i)).toBeInTheDocument()
  })

  // Back from Step 2 preserves data
  it('returns to Step 1 with data preserved on Back', () => {
    renderScreen()
    advanceToStep2()
    // The form has "Back to map" (header) and "Back" (step nav) — use exact match
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
    expect(screen.getByLabelText(/spot name/i)).toHaveValue('Desert Oasis')
    expect(screen.getByLabelText(/latitude/i)).toHaveValue('35.5')
  })

  // Step 2 validation — no amenities
  it('blocks advancement when no amenities are selected', () => {
    renderScreen()
    // Advance without selecting amenity chip
    fillStep1Valid()
    // Select overnight to pass step 1, then deselect on step 2
    selectAmenity()
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    // Now on step 2, deselect overnight
    const overnightCheckbox = screen.getByRole('checkbox', { name: 'Overnight' })
    fireEvent.click(overnightCheckbox)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('Select at least one amenity or activity')).toBeInTheDocument()
  })

  // Step 2 validation — invalid URL
  it('blocks advancement when website is invalid URL', () => {
    renderScreen()
    advanceToStep2()
    fireEvent.change(screen.getByLabelText(/website/i), { target: { value: 'not-a-url' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('Website must be a valid URL')).toBeInTheDocument()
  })

  // Step 2 → Step 3
  it('advances to Step 3 when Step 2 is valid', () => {
    renderScreen()
    advanceToStep3()
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument()
  })

  // Step 3 summary
  it('shows summary of spot name and coordinates on Step 3', () => {
    renderScreen()
    advanceToStep3()
    expect(screen.getByText('Desert Oasis')).toBeInTheDocument()
    expect(screen.getByText('35.5, -110.5')).toBeInTheDocument()
  })

  // Step 3 renders PhotoUpload
  it('renders PhotoUpload component on Step 3', () => {
    renderScreen()
    advanceToStep3()
    expect(screen.getByTestId('photo-upload')).toBeInTheDocument()
  })

  // Back from Step 3 preserves data
  it('returns to Step 2 with data preserved on Back from Step 3', () => {
    renderScreen()
    advanceToStep3()
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument()
    // Amenity should still be checked
    expect(screen.getByRole('checkbox', { name: 'Overnight' })).toBeChecked()
  })

  // Successful submission
  it('shows toast and resets to Step 1 on successful submission', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as Response) // GET submissions
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'sub-1' }) } as Response) // POST submission

    renderScreen()
    advanceToStep3()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))
    })

    await waitFor(() => {
      expect(screen.getByText(/submitted — your spot is under review/i)).toBeInTheDocument()
    })
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
  })

  // Submit button disabled during pending
  it('disables submit button while mutation is pending', async () => {
    // Mock fetch to never resolve (pending state)
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as Response) // GET submissions
      .mockImplementationOnce(() => new Promise(() => {})) // POST never resolves

    renderScreen()
    advanceToStep3()

    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled()
    })
  })

  // My submissions section
  it('renders past submissions with status pills', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 'sub-1',
          name: 'Mountain View Camp',
          description: 'Nice spot',
          latitude: 36.0,
          longitude: -112.0,
          amenities: {},
          maxLengthFt: null,
          maxHeightFt: null,
          website: null,
          phone: null,
          status: 'pending',
          adminNotes: null,
          reviewedAt: null,
          publishedPinId: null,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
        {
          id: 'sub-2',
          name: 'River Bend',
          description: null,
          latitude: 35.0,
          longitude: -111.0,
          amenities: {},
          maxLengthFt: null,
          maxHeightFt: null,
          website: null,
          phone: null,
          status: 'approved',
          adminNotes: 'Looks great!',
          reviewedAt: '2025-02-01T00:00:00Z',
          publishedPinId: 'pin-1',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-02-01T00:00:00Z',
        },
      ],
    } as Response)

    renderScreen()

    await waitFor(() => {
      expect(screen.getByText('Mountain View Camp')).toBeInTheDocument()
    })
    expect(screen.getByText('pending')).toBeInTheDocument()
    expect(screen.getByText('River Bend')).toBeInTheDocument()
    expect(screen.getByText('approved')).toBeInTheDocument()
  })

  // Expandable detail view
  it('expands submission card to show detail on click', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 'sub-1',
          name: 'Mountain View Camp',
          description: 'Nice spot near creek',
          latitude: 36.123456,
          longitude: -112.654321,
          amenities: { overnight: true, water: true },
          maxLengthFt: 40,
          maxHeightFt: 12.5,
          website: 'https://example.com',
          phone: '555-1234',
          status: 'rejected',
          adminNotes: 'Too close to road',
          reviewedAt: '2025-02-01T00:00:00Z',
          publishedPinId: null,
          createdAt: '2025-01-15T00:00:00Z',
          updatedAt: '2025-02-01T00:00:00Z',
        },
      ],
    } as Response)

    renderScreen()

    await waitFor(() => {
      expect(screen.getByText('Mountain View Camp')).toBeInTheDocument()
    })

    // Detail should not be visible before click
    expect(screen.queryByText('Nice spot near creek')).not.toBeInTheDocument()

    // Click to expand
    fireEvent.click(screen.getByText('Mountain View Camp').closest('[role="button"]')!)

    // Detail should now be visible
    expect(screen.getByText('Nice spot near creek')).toBeInTheDocument()
    expect(screen.getByText('Jan 15, 2025')).toBeInTheDocument()
    expect(screen.getByText('Rejected')).toBeInTheDocument()
    expect(screen.getByText('36.123456, -112.654321')).toBeInTheDocument()
    expect(screen.getByText('40ft L, 12.5ft H')).toBeInTheDocument()
    expect(screen.getByText('Too close to road')).toBeInTheDocument()
    expect(screen.getByText('https://example.com')).toBeInTheDocument()
    expect(screen.getByText('555-1234')).toBeInTheDocument()
  })

  it('collapses expanded submission card on second click', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 'sub-1',
          name: 'Mountain View Camp',
          description: 'Nice spot',
          latitude: 36.0,
          longitude: -112.0,
          amenities: {},
          maxLengthFt: null,
          maxHeightFt: null,
          website: null,
          phone: null,
          status: 'pending',
          adminNotes: null,
          reviewedAt: null,
          publishedPinId: null,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
    } as Response)

    renderScreen()

    await waitFor(() => {
      expect(screen.getByText('Mountain View Camp')).toBeInTheDocument()
    })

    const card = screen.getByText('Mountain View Camp').closest('[role="button"]')!
    fireEvent.click(card)
    expect(screen.getByText('Nice spot')).toBeInTheDocument()

    // Click again to collapse
    fireEvent.click(card)
    expect(screen.queryByText('Nice spot')).not.toBeInTheDocument()
  })

  it('shows "View on map" button for approved submissions with publishedPinId', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 'sub-1',
          name: 'River Bend',
          description: null,
          latitude: 35.0,
          longitude: -111.0,
          amenities: {},
          maxLengthFt: null,
          maxHeightFt: null,
          website: null,
          phone: null,
          status: 'approved',
          adminNotes: null,
          reviewedAt: '2025-02-01T00:00:00Z',
          publishedPinId: 'pin-42',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-02-01T00:00:00Z',
        },
      ],
    } as Response)

    renderScreen()

    await waitFor(() => {
      expect(screen.getByText('River Bend')).toBeInTheDocument()
    })

    // Expand the card
    fireEvent.click(screen.getByText('River Bend').closest('[role="button"]')!)
    expect(screen.getByText('View on map →')).toBeInTheDocument()
  })

  it('shows empty state when no submissions', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response)

    renderScreen()

    await waitFor(() => {
      expect(screen.getByText("You haven't submitted any spots yet.")).toBeInTheDocument()
    })
  })

  it('submission cards have aria-expanded attribute', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 'sub-1',
          name: 'Test Spot',
          description: null,
          latitude: 36.0,
          longitude: -112.0,
          amenities: {},
          maxLengthFt: null,
          maxHeightFt: null,
          website: null,
          phone: null,
          status: 'pending',
          adminNotes: null,
          reviewedAt: null,
          publishedPinId: null,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
    } as Response)

    renderScreen()

    await waitFor(() => {
      expect(screen.getByText('Test Spot')).toBeInTheDocument()
    })

    const card = screen.getByText('Test Spot').closest('[role="button"]')!
    expect(card).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(card)
    expect(card).toHaveAttribute('aria-expanded', 'true')
  })

  it('applies correct status pill CSS classes', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 'sub-1', name: 'Pending Spot', description: null,
          latitude: 36, longitude: -112, amenities: {},
          maxLengthFt: null, maxHeightFt: null, website: null, phone: null,
          status: 'pending', adminNotes: null, reviewedAt: null,
          publishedPinId: null, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
        },
        {
          id: 'sub-2', name: 'Rejected Spot', description: null,
          latitude: 36, longitude: -112, amenities: {},
          maxLengthFt: null, maxHeightFt: null, website: null, phone: null,
          status: 'rejected', adminNotes: null, reviewedAt: null,
          publishedPinId: null, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
        },
        {
          id: 'sub-3', name: 'Changes Spot', description: null,
          latitude: 36, longitude: -112, amenities: {},
          maxLengthFt: null, maxHeightFt: null, website: null, phone: null,
          status: 'changes_requested', adminNotes: null, reviewedAt: null,
          publishedPinId: null, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
    } as Response)

    renderScreen()

    await waitFor(() => {
      expect(screen.getByText('pending')).toBeInTheDocument()
    })

    expect(screen.getByText('pending').className).toContain('text-yellow-300')
    expect(screen.getByText('rejected').className).toContain('text-red-300')
    expect(screen.getByText('changes requested').className).toContain('text-sky-300')
  })

  // Offline behavior
  it('shows offline banner and disables submit when offline', () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false })

    renderScreen()
    advanceToStep3()

    expect(screen.getByText(/offline — you need a connection to submit spots/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit for review/i })).toBeDisabled()
  })

  // Spot type chips pre-check amenities in Step 2
  it('pre-checks amenities in Step 2 when spot type chips are toggled in Step 1', () => {
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Water' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fuel' }))
    fillStep1Valid()
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByRole('checkbox', { name: 'Water' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Fuel' })).toBeChecked()
  })
})
