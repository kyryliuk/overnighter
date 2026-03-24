import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockUseSubscription = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    isPremium: false,
    isTrial: false,
    status: 'free',
    isLoading: false,
  }),
)

const mockUseAuth = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    session: { user: { id: 'user-1' }, access_token: 'test-token' },
    isAuthenticated: true,
    isLoading: false,
  }),
)

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: mockUseSubscription,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}))

import { SubscriptionStatusCard } from './SubscriptionStatusCard'

function renderCard() {
  return render(
    <MemoryRouter>
      <SubscriptionStatusCard />
    </MemoryRouter>,
  )
}

describe('SubscriptionStatusCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'user-1' }, access_token: 'test-token' },
      isAuthenticated: true,
      isLoading: false,
    })
  })

  it('renders premium status with amber badge and manage button', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      isTrial: false,
      status: 'premium',
      isLoading: false,
    })

    renderCard()

    expect(screen.getByText('Overnighter Premium')).toBeInTheDocument()
    expect(screen.getByText('Premium')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /manage subscription/i })).toBeInTheDocument()
  })

  it('renders trialing status with trial badge and manage button', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      isTrial: true,
      status: 'trialing',
      isLoading: false,
    })

    renderCard()

    expect(screen.getByText('Premium Trial')).toBeInTheDocument()
    expect(screen.getByText('Trial')).toBeInTheDocument()
    expect(screen.getByText('Trial active')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /manage subscription/i })).toBeInTheDocument()
  })

  it('renders expired status with Resubscribe CTA', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'expired',
      isLoading: false,
    })

    renderCard()

    expect(screen.getByText('Subscription Expired')).toBeInTheDocument()
    expect(screen.getByText('Expired')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resubscribe/i })).toBeInTheDocument()
  })

  it('renders free status with Upgrade to Premium CTA', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })

    renderCard()

    expect(screen.getByText('Free Plan')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upgrade to premium/i })).toBeInTheDocument()
  })

  it('does not render when user is unauthenticated', () => {
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

    const { container } = renderCard()

    expect(container.innerHTML).toBe('')
  })

  it('calls portal API and redirects on manage subscription click', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      isTrial: false,
      status: 'premium',
      isLoading: false,
    })

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: 'https://billing.stripe.com/session/test' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const originalLocation = window.location
    const mockLocation = { ...originalLocation, href: '' }
    Object.defineProperty(window, 'location', { value: mockLocation, writable: true })

    const user = userEvent.setup()
    renderCard()

    await user.click(screen.getByRole('button', { name: /manage subscription/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      })
      expect(window.location.href).toBe('https://billing.stripe.com/session/test')
    })

    Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
  })

  it('shows inline error message when portal API call fails', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      isTrial: false,
      status: 'premium',
      isLoading: false,
    })

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'INTERNAL_ERROR' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const user = userEvent.setup()
    renderCard()

    await user.click(screen.getByRole('button', { name: /manage subscription/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to open subscription management. Please try again.',
    )
  })

  it('shows inline error message when checkout API call fails', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'INTERNAL_ERROR' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const user = userEvent.setup()
    renderCard()

    await user.click(screen.getByRole('button', { name: /upgrade to premium/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to start checkout. Please try again.',
    )
  })

  it('shows inline error when network request throws', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      isTrial: false,
      status: 'premium',
      isLoading: false,
    })

    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.stubGlobal('fetch', mockFetch)

    const user = userEvent.setup()
    renderCard()

    await user.click(screen.getByRole('button', { name: /manage subscription/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    )
  })

  it('shows skeleton during loading state', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: true,
    })

    renderCard()

    expect(screen.getByTestId('subscription-card-skeleton')).toBeInTheDocument()
  })

  it('calls checkout API for resubscribe on expired status', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'expired',
      isLoading: false,
    })

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: 'https://checkout.stripe.com/session/test' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const originalLocation = window.location
    const mockLocation = { ...originalLocation, href: '' }
    Object.defineProperty(window, 'location', { value: mockLocation, writable: true })

    const user = userEvent.setup()
    renderCard()

    await user.click(screen.getByRole('button', { name: /resubscribe/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      })
      expect(window.location.href).toBe('https://checkout.stripe.com/session/test')
    })

    Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
  })

  it('shows error when API returns ok but no URL', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      isTrial: false,
      status: 'premium',
      isLoading: false,
    })

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    })
    vi.stubGlobal('fetch', mockFetch)

    const user = userEvent.setup()
    renderCard()

    await user.click(screen.getByRole('button', { name: /manage subscription/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to open subscription management. Please try again.',
    )
  })
})
