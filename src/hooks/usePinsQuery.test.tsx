import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { usePinsQuery } from './usePinsQuery'
import type { Pin } from '@/types/pin'

const { mockGetAllPins, mockFetchPinsByRadius } = vi.hoisted(() => ({
  mockGetAllPins: vi.fn(),
  mockFetchPinsByRadius: vi.fn(),
}))

vi.mock('@/lib/supabase/pins', () => ({
  getAllPins: mockGetAllPins,
  fetchPinsByRadius: mockFetchPinsByRadius,
}))

const STUB_PIN: Pin = {
  id: 'pin-1',
  name: 'Cached Spot',
  description: null,
  latitude: 40,
  longitude: -104,
  pinType: 'community',
  sourceId: null,
  maxLengthFt: null,
  maxHeightFt: null,
  website: null,
  phone: null,
  elevationM: null,
  amenities: {
    water: true,
    dump: false,
    electric: false,
    shower: false,
    fuel: false,
    propane: false,
    overnight: true,
    toilets: false,
    pets: false,
    wifi: false,
    kitchen: false,
    restaurant: false,
    big_rig: false,
    tent: false,
    hiking: false,
    fishing: false,
    swimming: false,
    boating: false,
    biking: false,
    ohv: false,
    climbing: false,
    winter_sports: false,
    hunting: false,
    wildlife: false,
    horseback: false,
    hot_springs: false,
  },
  badgeState: 'green',
  lastCheckInAt: null,
  recentCheckInCount: 0,
  isVerified: true,
  isFlagged: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('usePinsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('persists fetched pins into the offline cache', async () => {
    mockGetAllPins.mockResolvedValue([STUB_PIN])

    const { result } = renderHook(() => usePinsQuery(), { wrapper: makeWrapper() })

    await waitFor(() => {
      expect(result.current.data).toEqual([STUB_PIN])
    })

    const cachedValue = JSON.parse(localStorage.getItem('pins-cache-v1') ?? '{}') as {
      pins?: Pin[]
      cachedAt?: string
    }

    expect(cachedValue.pins).toEqual([STUB_PIN])
    expect(typeof cachedValue.cachedAt).toBe('string')
  })

  it('falls back to cached pins when the live fetch fails', async () => {
    localStorage.setItem(
      'pins-cache-v1',
      JSON.stringify({
        pins: [STUB_PIN],
        cachedAt: '2026-03-23T17:00:00.000Z',
      }),
    )
    mockGetAllPins.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => usePinsQuery(), { wrapper: makeWrapper() })

    await waitFor(() => {
      expect(result.current.data).toEqual([STUB_PIN])
      expect(result.current.isSuccess).toBe(true)
    })
  })

  it('calls fetchPinsByRadius when viewport params are provided', async () => {
    mockFetchPinsByRadius.mockResolvedValue({
      pins: [STUB_PIN],
      total: 1,
      limit: 200,
      offset: 0,
    })

    const { result } = renderHook(
      () => usePinsQuery({ lat: 39.7, lng: -105.0, radiusM: 50000 }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => {
      expect(result.current.data).toEqual([STUB_PIN])
    })

    expect(mockFetchPinsByRadius).toHaveBeenCalledWith(39.7, -105.0, 50000)
    expect(mockGetAllPins).not.toHaveBeenCalled()
  })

  it('calls getAllPins when no viewport params are provided', async () => {
    mockGetAllPins.mockResolvedValue([STUB_PIN])

    const { result } = renderHook(() => usePinsQuery(), { wrapper: makeWrapper() })

    await waitFor(() => {
      expect(result.current.data).toEqual([STUB_PIN])
    })

    expect(mockGetAllPins).toHaveBeenCalled()
    expect(mockFetchPinsByRadius).not.toHaveBeenCalled()
  })

  it('falls back to cached pins when viewport fetch fails', async () => {
    localStorage.setItem(
      'pins-cache-v1',
      JSON.stringify({
        pins: [STUB_PIN],
        cachedAt: '2026-03-23T17:00:00.000Z',
      }),
    )
    mockFetchPinsByRadius.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(
      () => usePinsQuery({ lat: 39.7, lng: -105.0, radiusM: 50000 }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => {
      expect(result.current.data).toEqual([STUB_PIN])
      expect(result.current.isSuccess).toBe(true)
    })
  })

  it('does not fetch when enabled is false', async () => {
    renderHook(() => usePinsQuery({ enabled: false }), { wrapper: makeWrapper() })
    // Give it a tick
    await new Promise((r) => setTimeout(r, 50))
    expect(mockGetAllPins).not.toHaveBeenCalled()
    expect(mockFetchPinsByRadius).not.toHaveBeenCalled()
  })
})
