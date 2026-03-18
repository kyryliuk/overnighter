import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import SearchBar from './SearchBar'

// Mock useGeolocation hook
const mockRequest = vi.fn()
let mockGeoState = { isLoading: false, coords: null as GeolocationCoordinates | null, error: null as string | null }

vi.mock('@/hooks/useGeolocation', () => ({
  useGeolocation: () => [mockGeoState, mockRequest] as const,
}))

// Helper: type into search, advance debounce, flush fetch promise
async function typeAndSearch(input: HTMLElement, query: string) {
  fireEvent.change(input, { target: { value: query } })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300)
  })
}

describe('SearchBar', () => {
  const mockSetView = vi.fn()
  const mapRef = { current: { setView: mockSetView } }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn())
    mockGeoState = { isLoading: false, coords: null, error: null }
    mockSetView.mockClear()
    mockRequest.mockClear()
    vi.mocked(fetch).mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders search input and Near Me button', () => {
    render(<SearchBar mapRef={mapRef} />)

    expect(screen.getByLabelText('Search destination')).toBeInTheDocument()
    expect(screen.getByText('📍 Near Me')).toBeInTheDocument()
  })

  it('search input has correct accessibility attributes', () => {
    render(<SearchBar mapRef={mapRef} />)

    const input = screen.getByLabelText('Search destination')
    expect(input).toHaveAttribute('role', 'combobox')
    expect(input).toHaveAttribute('aria-autocomplete', 'list')
    expect(input).toHaveAttribute('aria-controls', 'search-results')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(input).toHaveAttribute('type', 'search')
  })

  it('sets aria-expanded to true when results are shown', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { lat: '39.7392', lon: '-104.9903', display_name: 'Denver, Colorado, United States' },
      ],
    } as Response)

    render(<SearchBar mapRef={mapRef} />)

    const input = screen.getByLabelText('Search destination')
    expect(input).toHaveAttribute('aria-expanded', 'false')

    await typeAndSearch(input, 'Denver')

    expect(input).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows clear button when query is non-empty', () => {
    render(<SearchBar mapRef={mapRef} />)

    const input = screen.getByLabelText('Search destination')
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'Denver' } })
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
  })

  it('clears query when clear button is clicked', () => {
    render(<SearchBar mapRef={mapRef} />)

    const input = screen.getByLabelText('Search destination')
    fireEvent.change(input, { target: { value: 'Denver' } })
    fireEvent.click(screen.getByLabelText('Clear search'))

    expect(input).toHaveValue('')
  })

  it('does not fetch when query is less than 3 characters', async () => {
    render(<SearchBar mapRef={mapRef} />)

    const input = screen.getByLabelText('Search destination')
    await typeAndSearch(input, 'De')

    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches Nominatim results after 300ms debounce with 3+ chars', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { lat: '39.7392', lon: '-104.9903', display_name: 'Denver, Colorado, United States' },
      ],
    } as Response)

    render(<SearchBar mapRef={mapRef} />)

    const input = screen.getByLabelText('Search destination')
    fireEvent.change(input, { target: { value: 'Denver' } })

    // Should not have fired yet (before debounce)
    expect(fetch).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('nominatim.openstreetmap.org/search?q=Denver'),
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
  })

  it('displays search results as dropdown list', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { lat: '39.7392', lon: '-104.9903', display_name: 'Denver, Colorado, United States' },
        { lat: '39.5501', lon: '-105.7821', display_name: 'Denver Mountain Parks, Colorado, US' },
      ],
    } as Response)

    render(<SearchBar mapRef={mapRef} />)

    await typeAndSearch(screen.getByLabelText('Search destination'), 'Denver')

    expect(screen.getByRole('listbox')).toBeInTheDocument()
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveTextContent('Denver, Colorado, United States')
  })

  it('re-centers map when a search result is selected', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { lat: '39.7392', lon: '-104.9903', display_name: 'Denver, Colorado, United States' },
      ],
    } as Response)

    render(<SearchBar mapRef={mapRef} />)

    await typeAndSearch(screen.getByLabelText('Search destination'), 'Denver')

    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Denver, Colorado, United States'))

    expect(mockSetView).toHaveBeenCalledWith([39.7392, -104.9903], 12)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('sets query to first segment of display_name after selection', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { lat: '39.7392', lon: '-104.9903', display_name: 'Denver, Colorado, United States' },
      ],
    } as Response)

    render(<SearchBar mapRef={mapRef} />)

    const input = screen.getByLabelText('Search destination')
    await typeAndSearch(input, 'Denver')

    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Denver, Colorado, United States'))
    expect(input).toHaveValue('Denver')
  })

  it('silently handles fetch errors without showing error UI', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

    render(<SearchBar mapRef={mapRef} />)

    await typeAndSearch(screen.getByLabelText('Search destination'), 'Denver')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    // No error alert shown
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  // Near Me button tests
  it('calls requestGeo when Near Me button is clicked', () => {
    render(<SearchBar mapRef={mapRef} />)

    fireEvent.click(screen.getByText('📍 Near Me'))
    expect(mockRequest).toHaveBeenCalledOnce()
  })

  it('disables Near Me button and shows "..." when GPS is loading', () => {
    mockGeoState = { isLoading: true, coords: null, error: null }

    render(<SearchBar mapRef={mapRef} />)

    const button = screen.getByLabelText('Getting location...')
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('...')
  })

  it('shows denied error message when geolocation permission is denied', () => {
    mockGeoState = { isLoading: false, coords: null, error: 'denied' }

    render(<SearchBar mapRef={mapRef} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Location access denied')
    expect(alert).toHaveTextContent('search for a place to get started')
  })

  it('shows no-api error message when geolocation is unavailable', () => {
    mockGeoState = { isLoading: false, coords: null, error: 'no-api' }

    render(<SearchBar mapRef={mapRef} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Location not available')
    expect(alert).toHaveTextContent('search for a place instead')
  })

  it('shows unavailable error message when GPS position cannot be determined', () => {
    mockGeoState = { isLoading: false, coords: null, error: 'unavailable' }

    render(<SearchBar mapRef={mapRef} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Could not get location')
    expect(alert).toHaveTextContent('try again or search for a place')
  })

  it('re-centers map when geolocation succeeds', () => {
    mockGeoState = {
      isLoading: false,
      coords: {
        latitude: 40.7,
        longitude: -74.0,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      } as GeolocationCoordinates,
      error: null,
    }

    render(<SearchBar mapRef={mapRef} />)

    expect(mockSetView).toHaveBeenCalledWith([40.7, -74.0], 12)
  })

  it('works gracefully when mapRef.current is null', () => {
    const nullMapRef = { current: null }
    mockGeoState = {
      isLoading: false,
      coords: {
        latitude: 40.7,
        longitude: -74.0,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      } as GeolocationCoordinates,
      error: null,
    }

    // Should not throw
    expect(() => render(<SearchBar mapRef={nullMapRef} />)).not.toThrow()
  })

  it('all interactive elements meet 44px minimum tap target', () => {
    mockGeoState = { isLoading: false, coords: null, error: null }

    render(<SearchBar mapRef={mapRef} />)

    const input = screen.getByLabelText('Search destination')
    const nearMeBtn = screen.getByText('📍 Near Me')

    expect(input.className).toContain('min-h-[44px]')
    expect(nearMeBtn.className).toContain('min-h-[44px]')
  })
})
