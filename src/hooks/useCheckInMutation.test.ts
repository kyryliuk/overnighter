import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useCheckInMutation, type CheckInPayload } from './useCheckInMutation'
import type { Pin } from '@/types/pin'

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))

import * as Sentry from '@sentry/react'

// ── Fixtures ───────────────────────────────────────────────────────────────

const STUB_PIN: Pin = {
  id: 'pin-123',
  name: 'Test Spot',
  description: null,
  latitude: 37.0,
  longitude: -107.0,
  pinType: 'blm',
  sourceId: null,
  maxLengthFt: null,
  maxHeightFt: null,
  amenities: { water: false, dump: false, electric: false, shower: false, fuel: false, propane: false, overnight: true },
  badgeState: 'yellow',
  lastCheckInAt: null,
  recentCheckInCount: 0,
  isVerified: false,
  isFlagged: false,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}

const PAYLOAD: CheckInPayload = {
  pinId: 'pin-123',
  deviceId: 'device-xyz',
  status: 'still_open',
}

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useCheckInMutation', () => {
  it('onMutate sets target pin badgeState to green in cache before fetch resolves (5.4)', async () => {
    const queryClient = freshClient()
    queryClient.setQueryData<Pin[]>(['pins'], [STUB_PIN])

    // Capture cache state at the moment mutationFn runs (after onMutate has fired)
    let badgeStateDuringFetch: string | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        const cached = queryClient.getQueryData<Pin[]>(['pins'])
        badgeStateDuringFetch = cached?.find((p) => p.id === PAYLOAD.pinId)?.badgeState
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }),
    )

    const { result } = renderHook(() => useCheckInMutation(), { wrapper: makeWrapper(queryClient) })

    await act(async () => {
      result.current.mutate(PAYLOAD)
      await Promise.resolve()
    })

    expect(badgeStateDuringFetch).toBe('green')
  })

  it('onError rolls back cache to snapshot when fetch rejects (5.5)', async () => {
    const queryClient = freshClient()
    queryClient.setQueryData<Pin[]>(['pins'], [STUB_PIN])

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    const { result } = renderHook(() => useCheckInMutation(), { wrapper: makeWrapper(queryClient) })

    await act(async () => {
      result.current.mutate(PAYLOAD)
      // Wait for the rejection to propagate through onError and onSettled
      await new Promise((r) => setTimeout(r, 10))
    })

    const cached = queryClient.getQueryData<Pin[]>(['pins'])
    expect(cached?.[0].badgeState).toBe('yellow') // original value restored
  })

  it('onError calls Sentry.captureException with the error (5.6)', async () => {
    const queryClient = freshClient()
    const networkError = new Error('connection reset')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkError))

    const { result } = renderHook(() => useCheckInMutation(), { wrapper: makeWrapper(queryClient) })

    await act(async () => {
      result.current.mutate(PAYLOAD)
      await new Promise((r) => setTimeout(r, 10))
    })

    expect(Sentry.captureException).toHaveBeenCalledWith(networkError)
  })

  it('onSettled invalidates pins query after successful mutation (5.7)', async () => {
    const queryClient = freshClient()
    queryClient.setQueryData<Pin[]>(['pins'], [STUB_PIN])
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    )
    const spy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCheckInMutation(), { wrapper: makeWrapper(queryClient) })

    await act(async () => {
      result.current.mutate(PAYLOAD)
      await new Promise((r) => setTimeout(r, 10))
    })

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['pins'] }))
  })

  it('onSettled invalidates pins query after failed mutation (5.8)', async () => {
    const queryClient = freshClient()
    queryClient.setQueryData<Pin[]>(['pins'], [STUB_PIN])
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    const spy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCheckInMutation(), { wrapper: makeWrapper(queryClient) })

    await act(async () => {
      result.current.mutate(PAYLOAD)
      await new Promise((r) => setTimeout(r, 10))
    })

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['pins'] }))
  })
})
