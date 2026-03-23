import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { usePinsQuery } from './usePinsQuery'
import type { Pin } from '@/types/pin'

const { mockGetAllPins } = vi.hoisted(() => ({
  mockGetAllPins: vi.fn(),
}))

vi.mock('@/lib/supabase/pins', () => ({
  getAllPins: mockGetAllPins,
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
})
