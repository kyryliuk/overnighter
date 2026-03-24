import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

import { OfflineDownloadGate } from './OfflineDownloadGate'

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

describe('OfflineDownloadGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders PremiumGate with correct feature name "Offline Maps"', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })

    render(<OfflineDownloadGate />, { wrapper: makeWrapper() })

    expect(screen.getByText('Offline Maps')).toBeInTheDocument()
  })

  it('renders description about offline map downloads', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })

    render(<OfflineDownloadGate />, { wrapper: makeWrapper() })

    expect(
      screen.getByText('Download map areas for offline use when you have no signal.'),
    ).toBeInTheDocument()
  })

  it('premium users see children content (placeholder)', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      isTrial: false,
      status: 'premium',
      isLoading: false,
    })

    render(<OfflineDownloadGate />, { wrapper: makeWrapper() })

    expect(screen.getByTestId('offline-download-placeholder')).toBeInTheDocument()
    expect(screen.getByText('Download area')).toBeInTheDocument()
    expect(screen.queryByTestId('premium-gate-upsell')).not.toBeInTheDocument()
  })

  it('free users see the upsell card', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isTrial: false,
      status: 'free',
      isLoading: false,
    })

    render(<OfflineDownloadGate />, { wrapper: makeWrapper() })

    expect(screen.getByTestId('premium-gate-upsell')).toBeInTheDocument()
    expect(screen.getByText('Unlock with Premium')).toBeInTheDocument()
    expect(screen.queryByTestId('offline-download-placeholder')).not.toBeInTheDocument()
  })

  it('renders custom children when provided', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      isTrial: false,
      status: 'premium',
      isLoading: false,
    })

    render(
      <OfflineDownloadGate>
        <div data-testid="custom-content">Custom Download UI</div>
      </OfflineDownloadGate>,
      { wrapper: makeWrapper() },
    )

    expect(screen.getByTestId('custom-content')).toBeInTheDocument()
    expect(screen.queryByTestId('offline-download-placeholder')).not.toBeInTheDocument()
  })
})
