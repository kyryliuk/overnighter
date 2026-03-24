import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { OFFLINE_REGION_KEY } from '@/lib/constants'

const mockPostMessage = vi.fn()

const mockServiceWorker = {
  controller: { postMessage: mockPostMessage },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}

vi.stubGlobal('navigator', {
  ...navigator,
  serviceWorker: mockServiceWorker,
})

vi.mock('@/store/spotsStore', () => ({
  useSpotsStore: {
    getState: () => ({
      savedSpots: [
        { id: 'p1', latitude: 28.55, longitude: -81.35, name: 'Spot A' },
        { id: 'p2', latitude: 50, longitude: 10, name: 'Spot B' },
      ],
    }),
  },
}))

import { useOfflineMapDownload, isSpotCached } from './useOfflineMapDownload'

describe('useOfflineMapDownload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('starts with idle status', () => {
    const { result } = renderHook(() => useOfflineMapDownload())
    expect(result.current.status).toBe('idle')
    expect(result.current.progress).toBe(0)
    expect(result.current.totalTiles).toBe(0)
  })

  it('startPreview transitions to previewing with bbox', () => {
    const { result } = renderHook(() => useOfflineMapDownload())
    const bbox = { north: 29, south: 28, east: -81, west: -82 }
    act(() => {
      result.current.startPreview(bbox)
    })
    expect(result.current.status).toBe('previewing')
    expect(result.current.previewBbox).toEqual(bbox)
    expect(result.current.estimatedTiles).toBeGreaterThan(0)
  })

  it('cancelPreview resets to idle', () => {
    const { result } = renderHook(() => useOfflineMapDownload())
    act(() => {
      result.current.startPreview({ north: 29, south: 28, east: -81, west: -82 })
    })
    act(() => {
      result.current.cancelPreview()
    })
    expect(result.current.status).toBe('idle')
    expect(result.current.previewBbox).toBeNull()
  })

  it('startDownload sends CACHE_TILES message to SW', () => {
    const { result } = renderHook(() => useOfflineMapDownload())
    const bbox = { north: 28.6, south: 28.5, east: -81.3, west: -81.4 }
    act(() => {
      result.current.startDownload(bbox)
    })
    expect(result.current.status).toBe('downloading')
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CACHE_TILES',
        bbox,
        zoomLevels: expect.arrayContaining([10, 11, 12, 13, 14]),
      }),
    )
  })

  it('sets error status when SW controller is not available', () => {
    const original = mockServiceWorker.controller
    mockServiceWorker.controller = null as unknown as typeof mockServiceWorker.controller
    const { result } = renderHook(() => useOfflineMapDownload())
    act(() => {
      result.current.startDownload({ north: 29, south: 28, east: -81, west: -82 })
    })
    expect(result.current.status).toBe('error')
    mockServiceWorker.controller = original
  })

  it('rejects download when tile count exceeds MAX_OFFLINE_TILES', () => {
    const { result } = renderHook(() => useOfflineMapDownload())
    // 1°×1° bbox produces ~3292 tiles at zoom 10-14, well over 2000 cap
    const largeBbox = { north: 29, south: 28, east: -81, west: -82 }
    act(() => {
      result.current.startDownload(largeBbox)
    })
    expect(result.current.status).toBe('error')
    expect(mockPostMessage).not.toHaveBeenCalled()
  })

  it('handles CACHE_PROGRESS messages', () => {
    const { result } = renderHook(() => useOfflineMapDownload())
    // Get the message handler registered with addEventListener
    const handler = mockServiceWorker.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'message',
    )?.[1] as ((event: { data: unknown }) => void) | undefined

    expect(handler).toBeDefined()
    act(() => {
      handler!({ data: { type: 'CACHE_PROGRESS', current: 50, total: 100 } })
    })
    expect(result.current.progress).toBe(50)
    expect(result.current.totalTiles).toBe(100)
  })

  it('handles CACHE_COMPLETE messages and saves region to localStorage', () => {
    const { result } = renderHook(() => useOfflineMapDownload())
    const bbox = { north: 29, south: 28, east: -81, west: -82 }

    act(() => {
      result.current.startPreview(bbox)
    })
    act(() => {
      result.current.startDownload(bbox)
    })

    const handler = mockServiceWorker.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'message',
    )?.[1] as ((event: { data: unknown }) => void) | undefined

    act(() => {
      handler!({ data: { type: 'CACHE_COMPLETE', total: 100 } })
    })
    expect(result.current.status).toBe('complete')

    const stored = JSON.parse(localStorage.getItem(OFFLINE_REGION_KEY) || 'null')
    expect(stored).not.toBeNull()
    expect(stored.north).toBe(29)
    expect(stored.tileCount).toBe(100)
  })

  it('handles CACHE_ERROR messages', () => {
    const { result } = renderHook(() => useOfflineMapDownload())
    const handler = mockServiceWorker.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'message',
    )?.[1] as ((event: { data: unknown }) => void) | undefined

    act(() => {
      handler!({ data: { type: 'CACHE_ERROR', error: 'network fail' } })
    })
    expect(result.current.status).toBe('error')
  })

  it('retry re-sends CACHE_TILES with same bbox', () => {
    const { result } = renderHook(() => useOfflineMapDownload())
    const bbox = { north: 28.6, south: 28.5, east: -81.3, west: -81.4 }

    act(() => {
      result.current.startDownload(bbox)
    })
    mockPostMessage.mockClear()

    act(() => {
      result.current.retry()
    })
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CACHE_TILES', bbox }),
    )
  })

  it('dismiss resets to idle', () => {
    const { result } = renderHook(() => useOfflineMapDownload())
    act(() => {
      result.current.startPreview({ north: 29, south: 28, east: -81, west: -82 })
    })
    act(() => {
      result.current.dismiss()
    })
    expect(result.current.status).toBe('idle')
  })

  it('caches pins within bbox on CACHE_COMPLETE', () => {
    const { result } = renderHook(() => useOfflineMapDownload())
    const bbox = { north: 28.6, south: 28.5, east: -81.3, west: -81.4 }

    act(() => {
      result.current.startDownload(bbox)
    })
    mockPostMessage.mockClear()

    const handler = mockServiceWorker.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'message',
    )?.[1] as ((event: { data: unknown }) => void) | undefined

    act(() => {
      handler!({ data: { type: 'CACHE_COMPLETE', total: 100 } })
    })

    // Should have posted CACHE_PINS with only spots within bbox
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CACHE_PINS',
        pins: expect.arrayContaining([
          expect.objectContaining({ id: 'p1' }),
        ]),
      }),
    )
    // Spot B (lat 50, lng 10) is outside bbox — should NOT be included
    const pinsCall = mockPostMessage.mock.calls.find(
      (call: unknown[]) => (call[0] as { type: string }).type === 'CACHE_PINS',
    )
    expect(pinsCall[0].pins).not.toContainEqual(
      expect.objectContaining({ id: 'p2' }),
    )
  })
})

describe('isSpotCached', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('returns false when no cached region exists', () => {
    expect(isSpotCached(28.5, -81.3)).toBe(false)
  })

  it('returns true when spot is within cached region', () => {
    localStorage.setItem(
      OFFLINE_REGION_KEY,
      JSON.stringify({ north: 29, south: 28, east: -81, west: -82, cachedAt: '2026-01-01', tileCount: 50 }),
    )
    expect(isSpotCached(28.5, -81.5)).toBe(true)
  })

  it('returns false when spot is outside cached region', () => {
    localStorage.setItem(
      OFFLINE_REGION_KEY,
      JSON.stringify({ north: 29, south: 28, east: -81, west: -82, cachedAt: '2026-01-01', tileCount: 50 }),
    )
    expect(isSpotCached(50, 10)).toBe(false)
  })
})
