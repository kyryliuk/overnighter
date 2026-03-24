import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'

const { mockUseAuth, mockSupabaseSelect } = vi.hoisted(() => {
  const mockSupabaseSelectSingle = vi.fn().mockResolvedValue({
    data: { subscription_status: 'free' },
    error: null,
  })
  const mockUseAuth = vi.fn().mockReturnValue({
    session: { user: { id: 'user-1' }, access_token: 'token' },
    isAuthenticated: true,
    isLoading: false,
  })

  return { mockUseAuth, mockSupabaseSelect: mockSupabaseSelectSingle }
})

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockSupabaseSelect,
        })),
      })),
    })),
  },
}))

import { useSubscription } from './useSubscription'

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

describe('useSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'user-1' }, access_token: 'token' },
      isAuthenticated: true,
      isLoading: false,
    })
  })

  it('returns free defaults when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      session: null,
      isAuthenticated: false,
      isLoading: false,
    })

    const queryClient = freshClient()
    const { result } = renderHook(() => useSubscription(), { wrapper: makeWrapper(queryClient) })

    expect(result.current.isPremium).toBe(false)
    expect(result.current.isTrial).toBe(false)
    expect(result.current.status).toBe('free')
    expect(result.current.isLoading).toBe(false)
  })

  it('returns isPremium=true for premium users', async () => {
    mockSupabaseSelect.mockResolvedValue({
      data: { subscription_status: 'premium' },
      error: null,
    })

    const queryClient = freshClient()
    const { result, rerender } = renderHook(() => useSubscription(), { wrapper: makeWrapper(queryClient) })

    // Wait for query to resolve
    await vi.waitFor(() => {
      rerender()
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isPremium).toBe(true)
    expect(result.current.isTrial).toBe(false)
    expect(result.current.status).toBe('premium')
  })

  it('returns isPremium=true and isTrial=true for trialing users', async () => {
    mockSupabaseSelect.mockResolvedValue({
      data: { subscription_status: 'trialing' },
      error: null,
    })

    const queryClient = freshClient()
    const { result, rerender } = renderHook(() => useSubscription(), { wrapper: makeWrapper(queryClient) })

    await vi.waitFor(() => {
      rerender()
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isPremium).toBe(true)
    expect(result.current.isTrial).toBe(true)
    expect(result.current.status).toBe('trialing')
  })

  it('returns isPremium=false for free users', async () => {
    mockSupabaseSelect.mockResolvedValue({
      data: { subscription_status: 'free' },
      error: null,
    })

    const queryClient = freshClient()
    const { result, rerender } = renderHook(() => useSubscription(), { wrapper: makeWrapper(queryClient) })

    await vi.waitFor(() => {
      rerender()
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isPremium).toBe(false)
    expect(result.current.isTrial).toBe(false)
    expect(result.current.status).toBe('free')
  })

  it('starts with isLoading=true when authenticated', () => {
    mockSupabaseSelect.mockReturnValue(new Promise(() => {})) // never resolves

    const queryClient = freshClient()
    const { result } = renderHook(() => useSubscription(), { wrapper: makeWrapper(queryClient) })

    expect(result.current.isLoading).toBe(true)
  })

  it('uses refetchOnWindowFocus for freshness', () => {
    const queryClient = freshClient()
    const spy = vi.spyOn(queryClient, 'getDefaultOptions')
    renderHook(() => useSubscription(), { wrapper: makeWrapper(queryClient) })

    // The hook configures refetchOnWindowFocus: true via its query options
    // Verify the query was created with the correct key
    const queryCache = queryClient.getQueryCache()
    const queries = queryCache.findAll({ queryKey: ['subscription', 'user-1'] })
    expect(queries.length).toBe(1)
    expect(queries[0].options.refetchOnWindowFocus).toBe(true)

    spy.mockRestore()
  })
})
