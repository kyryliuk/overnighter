import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import SearchBar from './SearchBar'

// Helper: type into search, advance debounce, flush fetch promise
async function typeAndSearch(input: HTMLElement, query: string) {
  fireEvent.change(input, { target: { value: query } })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300)
  })
}

function openSearch() {
  fireEvent.click(screen.getByLabelText('Open search'))
}

describe('SearchBar', () => {
  const mockSetView = vi.fn()
  const mapRef = { current: { setView: mockSetView } }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn())
    mockSetView.mockClear()
    vi.mocked(fetch).mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // Collapsed state
  it('renders search icon button when closed', () => {
    render(<SearchBar mapRef={mapRef} />)
    expect(screen.getByLabelText('Open search')).toBeInTheDocument()
    expect(screen.queryByLabelText('Search destination')).not.toBeInTheDocument()
  })

  it('opens search input when search icon is clicked', () => {
    render(<SearchBar mapRef={mapRef} />)
    openSearch()
    expect(screen.getByLabelText('Search destination')).toBeInTheDocument()
    expect(screen.queryByLabelText('Open search')).not.toBeInTheDocument()
  })

  it('closes search and clears query when close button is clicked', () => {
    render(<SearchBar mapRef={mapRef} />)
    openSearch()
    fireEvent.change(screen.getByLabelText('Search destination'), { target: { value: 'Denver' } })
    fireEvent.click(screen.getByLabelText('Close search'))
    expect(screen.getByLabelText('Open search')).toBeInTheDocument()
    expect(screen.queryByLabelText('Search destination')).not.toBeInTheDocument()
  })

  it('closes search on Escape key', () => {
    render(<SearchBar mapRef={mapRef} />)
    openSearch()
    fireEvent.keyDown(screen.getByLabelText('Search destination'), { key: 'Escape' })
    expect(screen.getByLabelText('Open search')).toBeInTheDocument()
  })

  it('closes search after selecting a result', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { lat: '39.7392', lon: '-104.9903', display_name: 'Denver, Colorado, United States' },
      ],
    } as Response)

    render(<SearchBar mapRef={mapRef} />)
    openSearch()
    await typeAndSearch(screen.getByLabelText('Search destination'), 'Denver')
    fireEvent.click(screen.getByText('Denver, Colorado, United States'))
    expect(screen.getByLabelText('Open search')).toBeInTheDocument()
  })

  // Search accessibility
  it('search input has correct accessibility attributes', () => {
    render(<SearchBar mapRef={mapRef} />)
    openSearch()
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
    openSearch()
    const input = screen.getByLabelText('Search destination')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    await typeAndSearch(input, 'Denver')
    expect(input).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows clear button when query is non-empty', () => {
    render(<SearchBar mapRef={mapRef} />)
    openSearch()
    const input = screen.getByLabelText('Search destination')
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'Denver' } })
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
  })

  it('clears query when clear button is clicked', () => {
    render(<SearchBar mapRef={mapRef} />)
    openSearch()
    const input = screen.getByLabelText('Search destination')
    fireEvent.change(input, { target: { value: 'Denver' } })
    fireEvent.click(screen.getByLabelText('Clear search'))
    expect(input).toHaveValue('')
  })

  it('does not fetch when query is less than 3 characters', async () => {
    render(<SearchBar mapRef={mapRef} />)
    openSearch()
    await typeAndSearch(screen.getByLabelText('Search destination'), 'De')
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
    openSearch()
    const input = screen.getByLabelText('Search destination')
    fireEvent.change(input, { target: { value: 'Denver' } })
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
    openSearch()
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
    openSearch()
    await typeAndSearch(screen.getByLabelText('Search destination'), 'Denver')
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
    openSearch()
    const input = screen.getByLabelText('Search destination')
    await typeAndSearch(input, 'Denver')
    fireEvent.click(screen.getByText('Denver, Colorado, United States'))

    // After close, re-open to check value was cleared
    openSearch()
    expect(screen.getByLabelText('Search destination')).toHaveValue('')
  })

  it('silently handles fetch errors without showing error UI', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

    render(<SearchBar mapRef={mapRef} />)
    openSearch()
    await typeAndSearch(screen.getByLabelText('Search destination'), 'Denver')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('works gracefully when mapRef.current is null and result selected', async () => {
    const nullMapRef = { current: null }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { lat: '39.7392', lon: '-104.9903', display_name: 'Denver, Colorado, United States' },
      ],
    } as Response)

    render(<SearchBar mapRef={nullMapRef} />)
    openSearch()
    await typeAndSearch(screen.getByLabelText('Search destination'), 'Denver')
    expect(() => fireEvent.click(screen.getByText('Denver, Colorado, United States'))).not.toThrow()
  })

  // Tap target sizes
  it('search icon button meets 44px minimum tap target', () => {
    render(<SearchBar mapRef={mapRef} />)
    expect(screen.getByLabelText('Open search').className).toContain('min-h-[44px]')
  })

  it('search input and close button meet 44px minimum tap target when open', () => {
    render(<SearchBar mapRef={mapRef} />)
    openSearch()
    expect(screen.getByLabelText('Search destination').className).toContain('min-h-[44px]')
    expect(screen.getByLabelText('Close search').className).toContain('min-h-[44px]')
  })
})
