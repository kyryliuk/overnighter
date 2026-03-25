import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { createElement } from 'react'

const { mockUseSubscription, mockUseAuth, mockRefreshSession } = vi.hoisted(() => {
  const mockRefreshSession = vi.fn().mockResolvedValue({ data: { session: {} }, error: null })

  const mockUseSubscription = vi.fn().mockReturnValue({
    isPremium: false,
    isTrial: false,
    status: 'free',
    isLoading: false,
  })
  const mockUseAuth = vi.fn().mockReturnValue({
    session: { user: { id: 'user-1' }, access_token: 'token' },
    isAuthenticated: true,
    isLoading: false,
  })

  return { mockUseSubscription, mockUseAuth, mockRefreshSession }
})

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: mockUseSubscription,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { refreshSession: mockRefreshSession },
  },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import PremiumWelcomeScreen from './PremiumWelcomeScreen'

let testQueryClient: QueryClient

function makeWrapper(initialRoute = '/premium-welcome?session_id=cs_test_123') {
  testQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: testQueryClient },
      createElement(
        MemoryRouter,
        { initialEntries: [initialRoute] },
        createElement(Routes, null,
          createElement(Route, { path: '/premium-welcome', element: children }),
        ),
      ),
    )
}

describe('PremiumWelcomeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows confirmed state immediately when already premium', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      isTrial: false,
      status: 'premium',
      isLoading: false,
    })

    vi.useRealTimers()

    render(<PremiumWelcomeScreen />, { wrapper: makeWrapper() })

    expect(screen.getByTestId('premium-welcome-confirmed')).toBeInTheDocument()
    expect(screen.getByText("You're now an Overnighter Premium member")).toBeInTheDocument()
    expect(screen.getByText('Start Exploring')).toBeInTheDocument()
  })

  it('shows confirmed state for trialing users', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      isTrial: true,
      status: 'trialing',
      isLoading: false,
    })

    vi.useRealTimers()

    render(<PremiumWelcomeScreen />, { wrapper: makeWrapper() })

    expect(screen.getByTestId('premium-welcome-confirmed')).toBeInTheDocument()
  })

  it('shows unlocked features list on confirmation', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      isTrial: false,
      status: 'premium',
      isLoading: false,
    })

    vi.useRealTimers()

    render(<PremiumWelcomeScreen />, { wrapper: makeWrapper() })

    expect(screen.getByText('Offline maps for trips without signal')).toBeInTheDocument()
    expect(screen.getByText('Advanced route planning')).toBeInTheDocument()
    expect(screen.getByText('Priority support')).toBeInTheDocument()
  })

  it('navigates to returnTo when CTA is clicked', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      isTrial: false,
      status: 'premium',
      isLoading: false,
    })

    vi.useRealTimers()
    const user = userEvent.setup()

    render(<PremiumWelcomeScreen />, { wrapper: makeWrapper('/premium-welcome?session_id=cs_test_123&returnTo=%2Ftrips%3FtripId%3Dtrip-123') })

    await user.click(screen.getByTestId('premium-welcome-cta'))
    expect(mockNavigate).toHaveBeenCalledWith('/trips?tripId=trip-123')
  })

  it('shows polling state when subscription is not yet confirmed', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })

    render(<PremiumWelcomeScreen />, { wrapper: makeWrapper() })

    expect(screen.getByTestId('premium-welcome-polling')).toBeInTheDocument()
    expect(screen.getByText('Confirming your subscription…')).toBeInTheDocument()
  })

  it('transitions from polling to confirmed when subscription updates', async () => {
    let refetchCount = 0
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })

    vi.useRealTimers()

    render(<PremiumWelcomeScreen />, { wrapper: makeWrapper() })

    // Simulate webhook updating subscription after 2nd poll by seeding cache
    await waitFor(() => {
      expect(mockRefreshSession).toHaveBeenCalled()
    })

    // After refetch, set cache to premium so next poll reads it
    refetchCount++
    if (refetchCount >= 1) {
      testQueryClient.setQueryData(['subscription', 'user-1'], { subscription_status: 'premium' })
    }

    // isPremium from the hook takes precedence for rendering
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      isTrial: false,
      status: 'premium',
      isLoading: false,
    })

    // Force re-render by invalidating
    testQueryClient.invalidateQueries({ queryKey: ['subscription', 'user-1'] })

    await waitFor(() => {
      expect(screen.getByTestId('premium-welcome-confirmed')).toBeInTheDocument()
    }, { timeout: 10000 })
  })

  it('shows pending state after polling times out', async () => {
    // Cache always returns free so polling exhausts all attempts
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })

    vi.useRealTimers()

    render(<PremiumWelcomeScreen />, { wrapper: makeWrapper() })

    // Cache stays free — polling will exhaust and go to pending
    testQueryClient.setQueryData(['subscription', 'user-1'], { subscription_status: 'free' })

    await waitFor(() => {
      expect(screen.getByTestId('premium-welcome-pending')).toBeInTheDocument()
    }, { timeout: 15000 })

    expect(screen.getByText('Payment Processing')).toBeInTheDocument()
    expect(screen.getByText('Back to Map')).toBeInTheDocument()
  })

  it('navigates to returnTo from pending state', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })

    vi.useRealTimers()
    const user = userEvent.setup()

    render(<PremiumWelcomeScreen />, { wrapper: makeWrapper('/premium-welcome?session_id=cs_test_123&returnTo=%2Ftrips') })

    testQueryClient.setQueryData(['subscription', 'user-1'], { subscription_status: 'free' })

    await waitFor(() => {
      expect(screen.getByTestId('premium-welcome-pending')).toBeInTheDocument()
    }, { timeout: 15000 })

    await user.click(screen.getByText('Back to Map'))
    expect(mockNavigate).toHaveBeenCalledWith('/trips')
  })

  it('calls refreshSession on mount', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })

    vi.useRealTimers()

    render(<PremiumWelcomeScreen />, { wrapper: makeWrapper() })

    testQueryClient.setQueryData(['subscription', 'user-1'], { subscription_status: 'premium' })

    await waitFor(() => {
      expect(mockRefreshSession).toHaveBeenCalled()
    })
  })

  it('handles missing session gracefully', () => {
    mockUseAuth.mockReturnValue({
      session: null,
      isAuthenticated: false,
      isLoading: false,
    })

    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })

    // Should not throw
    render(<PremiumWelcomeScreen />, { wrapper: makeWrapper() })

    expect(screen.getByTestId('premium-welcome-polling')).toBeInTheDocument()
  })
})
