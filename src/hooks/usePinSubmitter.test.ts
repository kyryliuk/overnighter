import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { usePinSubmitter } from './usePinSubmitter'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('usePinSubmitter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not fetch when pinType is not community', () => {
    const { result } = renderHook(() => usePinSubmitter('pin-1', 'blm'), {
      wrapper: makeWrapper(),
    })
    expect(result.current.isFetching).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not fetch when pinId is undefined', () => {
    const { result } = renderHook(() => usePinSubmitter(undefined, 'community'), {
      wrapper: makeWrapper(),
    })
    expect(result.current.isFetching).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns submitter name when API responds with valid name', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ submitter: 'Alice' }),
    })
    const { result } = renderHook(() => usePinSubmitter('pin-1', 'community'), {
      wrapper: makeWrapper(),
    })
    await waitFor(() => {
      expect(result.current.data).toBe('Alice')
    })
    expect(mockFetch).toHaveBeenCalledWith('/api/pins/pin-1/submitter')
  })

  it('returns null when API responds with submitter: null', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ submitter: null }),
    })
    const { result } = renderHook(() => usePinSubmitter('pin-1', 'community'), {
      wrapper: makeWrapper(),
    })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toBeNull()
  })

  it('returns null when API responds with error status', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
    const { result } = renderHook(() => usePinSubmitter('pin-1', 'community'), {
      wrapper: makeWrapper(),
    })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toBeNull()
  })
})
