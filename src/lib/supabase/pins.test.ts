import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchPinsByRadius } from './pins'

describe('fetchPinsByRadius', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('constructs correct URL with all parameters', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ pins: [], total: 0, limit: 200, offset: 0 }),
    })

    await fetchPinsByRadius(39.7, -105.0, 50000)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('/api/pins?')
    expect(url).toContain('lat=39.7')
    expect(url).toContain('lng=-105')
    expect(url).toContain('radiusM=50000')
    expect(url).toContain('limit=200')
    expect(url).toContain('offset=0')
  })

  it('forwards custom limit and offset', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ pins: [], total: 0, limit: 50, offset: 100 }),
    })

    await fetchPinsByRadius(39.7, -105.0, 50000, 50, 100)

    const url = mockFetch.mock.calls[0][0] as string
    // Use regex to match exact param values, avoiding substring collisions
    expect(url).toMatch(/[?&]limit=50(&|$)/)
    expect(url).toMatch(/[?&]offset=100(&|$)/)
  })

  it('returns parsed JSON response on success', async () => {
    const mockResult = {
      pins: [{ id: 'pin-1', name: 'Test', distanceM: 1234 }],
      total: 1,
      limit: 200,
      offset: 0,
    }
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    })

    const result = await fetchPinsByRadius(39.7, -105.0, 50000)
    expect(result).toEqual(mockResult)
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'INVALID_PARAMS' }),
    })

    await expect(fetchPinsByRadius(39.7, -105.0, 50000)).rejects.toThrow('Radius search failed: 400')
  })

  it('throws on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    await expect(fetchPinsByRadius(39.7, -105.0, 50000)).rejects.toThrow('Network error')
  })
})
