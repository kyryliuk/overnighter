import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { createElement } from 'react'

const { mockUseSubscription, mockUseAuth } = vi.hoisted(() => {
  const mockUseSubscription = vi.fn().mockReturnValue({
    isPremium: false,
    isTrial: false,
    status: 'free',
    isLoading: false,
  })
  const mockUseAuth = vi.fn().mockReturnValue({
    session: null,
    isAuthenticated: false,
    isLoading: false,
  })

  return { mockUseSubscription, mockUseAuth }
})

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: mockUseSubscription,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import { PremiumGate } from './PremiumGate'

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(MemoryRouter, null, children),
    )
}

describe('PremiumGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders children when user is premium', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      isTrial: false,
      status: 'premium',
      isLoading: false,
    })

    render(
      <PremiumGate feature="Route Planning">
        <div>Premium Content</div>
      </PremiumGate>,
      { wrapper: makeWrapper() },
    )

    expect(screen.getByText('Premium Content')).toBeInTheDocument()
    expect(screen.queryByTestId('premium-gate-upsell')).not.toBeInTheDocument()
  })

  it('renders children when user is trialing', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      isTrial: true,
      status: 'trialing',
      isLoading: false,
    })

    render(
      <PremiumGate feature="Route Planning">
        <div>Premium Content</div>
      </PremiumGate>,
      { wrapper: makeWrapper() },
    )

    expect(screen.getByText('Premium Content')).toBeInTheDocument()
  })

  it('renders upsell card when user is free', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })

    render(
      <PremiumGate feature="Route Planning" description="Plan your trips efficiently">
        <div>Premium Content</div>
      </PremiumGate>,
      { wrapper: makeWrapper() },
    )

    expect(screen.queryByText('Premium Content')).not.toBeInTheDocument()
    expect(screen.getByText('Route Planning')).toBeInTheDocument()
    expect(screen.getByText('Plan your trips efficiently')).toBeInTheDocument()
    expect(screen.getByText('$19.99/year')).toBeInTheDocument()
    expect(screen.getByText('Unlock with Premium')).toBeInTheDocument()
    expect(screen.getByText('Cancel anytime')).toBeInTheDocument()
  })

  it('shows loading skeleton when subscription is loading', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: true,
    })

    render(
      <PremiumGate feature="Route Planning">
        <div>Premium Content</div>
      </PremiumGate>,
      { wrapper: makeWrapper() },
    )

    expect(screen.getByTestId('premium-gate-skeleton')).toBeInTheDocument()
    expect(screen.queryByText('Premium Content')).not.toBeInTheDocument()
  })

  it('navigates to /account with returnTo when unauthenticated user clicks CTA', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })
    mockUseAuth.mockReturnValue({
      session: null,
      isAuthenticated: false,
      isLoading: false,
    })

    const user = userEvent.setup()

    render(
      <PremiumGate feature="Route Planning">
        <div>Premium Content</div>
      </PremiumGate>,
      { wrapper: makeWrapper() },
    )

    await user.click(screen.getByText('Unlock with Premium'))
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/account?returnTo='),
    )
  })

  it('calls checkout API when authenticated user clicks CTA', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })
    mockUseAuth.mockReturnValue({
      session: { access_token: 'test-token', user: { id: 'user-1' } },
      isAuthenticated: true,
      isLoading: false,
    })

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: 'https://checkout.stripe.com/session123' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const user = userEvent.setup()

    render(
      <PremiumGate feature="Route Planning">
        <div>Premium Content</div>
      </PremiumGate>,
      { wrapper: makeWrapper() },
    )

    await user.click(screen.getByText('Unlock with Premium'))

    expect(mockFetch).toHaveBeenCalledWith('/api/stripe/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
    })

    vi.unstubAllGlobals()
  })

  it('shows inline error when checkout API returns non-ok response', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })
    mockUseAuth.mockReturnValue({
      session: { access_token: 'test-token', user: { id: 'user-1' } },
      isAuthenticated: true,
      isLoading: false,
    })

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'INTERNAL_ERROR' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const user = userEvent.setup()

    render(
      <PremiumGate feature="Route Planning">
        <div>Premium Content</div>
      </PremiumGate>,
      { wrapper: makeWrapper() },
    )

    await user.click(screen.getByText('Unlock with Premium'))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Unable to start checkout. Please try again.')).toBeInTheDocument()

    vi.unstubAllGlobals()
  })

  it('shows inline error when checkout API throws network error', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })
    mockUseAuth.mockReturnValue({
      session: { access_token: 'test-token', user: { id: 'user-1' } },
      isAuthenticated: true,
      isLoading: false,
    })

    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.stubGlobal('fetch', mockFetch)

    const user = userEvent.setup()

    render(
      <PremiumGate feature="Route Planning">
        <div>Premium Content</div>
      </PremiumGate>,
      { wrapper: makeWrapper() },
    )

    await user.click(screen.getByText('Unlock with Premium'))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()

    vi.unstubAllGlobals()
  })

  it('shows redirecting state while checkout session is being created', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })
    mockUseAuth.mockReturnValue({
      session: { access_token: 'test-token', user: { id: 'user-1' } },
      isAuthenticated: true,
      isLoading: false,
    })

    // Never resolving fetch to keep redirecting state
    const mockFetch = vi.fn().mockReturnValue(new Promise(() => {}))
    vi.stubGlobal('fetch', mockFetch)

    const user = userEvent.setup()

    render(
      <PremiumGate feature="Route Planning">
        <div>Premium Content</div>
      </PremiumGate>,
      { wrapper: makeWrapper() },
    )

    await user.click(screen.getByText('Unlock with Premium'))

    expect(screen.getByText('Redirecting…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Redirecting…' })).toBeDisabled()

    vi.unstubAllGlobals()
  })

  it('clears error on retry', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })
    mockUseAuth.mockReturnValue({
      session: { access_token: 'test-token', user: { id: 'user-1' } },
      isAuthenticated: true,
      isLoading: false,
    })

    // First call fails, second succeeds
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: 'https://checkout.stripe.com/session456' }),
      })
    vi.stubGlobal('fetch', mockFetch)

    const user = userEvent.setup()

    render(
      <PremiumGate feature="Route Planning">
        <div>Premium Content</div>
      </PremiumGate>,
      { wrapper: makeWrapper() },
    )

    // First click — error
    await user.click(screen.getByText('Unlock with Premium'))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Second click — error should clear
    await user.click(screen.getByText('Unlock with Premium'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    vi.unstubAllGlobals()
  })

  it('preserves free status when cancel flow returns user to app', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })

    render(
      <PremiumGate feature="Route Planning">
        <div>Premium Content</div>
      </PremiumGate>,
      { wrapper: makeWrapper() },
    )

    // After cancel, user lands back — PremiumGate upsell is still visible
    expect(screen.getByTestId('premium-gate-upsell')).toBeInTheDocument()
    expect(screen.queryByText('Premium Content')).not.toBeInTheDocument()
    expect(screen.getByText('Unlock with Premium')).toBeInTheDocument()
  })

  it('compact variant renders feature name, price, and CTA but no description', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })

    render(
      <PremiumGate feature="Route Planning" description="Plan your trips" variant="compact">
        <div>Premium Content</div>
      </PremiumGate>,
      { wrapper: makeWrapper() },
    )

    expect(screen.getByText('Route Planning')).toBeInTheDocument()
    expect(screen.getByText('$19.99/year')).toBeInTheDocument()
    expect(screen.getByText('Unlock with Premium')).toBeInTheDocument()
    expect(screen.getByText('Cancel anytime')).toBeInTheDocument()
    // Description is NOT rendered in compact variant
    expect(screen.queryByText('Plan your trips')).not.toBeInTheDocument()
  })

  it('full variant (default) renders all elements including description', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })

    render(
      <PremiumGate feature="Route Planning" description="Plan your trips efficiently">
        <div>Premium Content</div>
      </PremiumGate>,
      { wrapper: makeWrapper() },
    )

    expect(screen.getByText('Route Planning')).toBeInTheDocument()
    expect(screen.getByText('Plan your trips efficiently')).toBeInTheDocument()
    expect(screen.getByText('$19.99/year')).toBeInTheDocument()
    expect(screen.getByText('Unlock with Premium')).toBeInTheDocument()
    expect(screen.getByText('Cancel anytime')).toBeInTheDocument()
  })

  it('custom className prop is applied to the outer container', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })

    render(
      <PremiumGate feature="Route Planning" className="mt-4 max-w-md">
        <div>Premium Content</div>
      </PremiumGate>,
      { wrapper: makeWrapper() },
    )

    const container = screen.getByTestId('premium-gate-upsell')
    expect(container.className).toContain('mt-4')
    expect(container.className).toContain('max-w-md')
  })

  it('compact variant applies className prop', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })

    render(
      <PremiumGate feature="Route Planning" variant="compact" className="my-2">
        <div>Premium Content</div>
      </PremiumGate>,
      { wrapper: makeWrapper() },
    )

    const container = screen.getByTestId('premium-gate-upsell')
    expect(container.className).toContain('my-2')
  })

  it('compact variant shows inline error when checkout fails', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })
    mockUseAuth.mockReturnValue({
      session: { access_token: 'test-token' },
      isAuthenticated: true,
      isLoading: false,
    })

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'INTERNAL_ERROR' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const user = userEvent.setup()
    render(
      <PremiumGate feature="Route Planning" variant="compact">
        <div>Premium Content</div>
      </PremiumGate>,
      { wrapper: makeWrapper() },
    )

    await user.click(screen.getByRole('button', { name: /unlock with premium/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to start checkout. Please try again.',
    )
  })
})
