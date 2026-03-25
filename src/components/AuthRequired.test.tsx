import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const { mockUseAuth } = vi.hoisted(() => {
  const mockUseAuth = vi.fn().mockReturnValue({
    session: null,
    isAuthenticated: false,
    isLoading: false,
  })
  return { mockUseAuth }
})

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}))

// Mock react-router-dom to avoid heavy import
const mockNavigate = vi.fn()
const mockUseLocation = vi.fn(() => ({ pathname: '/test', search: '', hash: '' }))
vi.mock('react-router-dom', () => ({
  Navigate: ({ to, state }: { to: string; state?: unknown }) => {
    mockNavigate(to, state)
    return <div data-testid="navigate" data-to={to} data-state={JSON.stringify(state ?? null)} />
  },
  useLocation: () => mockUseLocation(),
}))

import { AuthRequired } from './AuthRequired'

describe('AuthRequired', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseLocation.mockReturnValue({ pathname: '/test', search: '', hash: '' })
  })

  it('redirects to /account when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    })

    render(<AuthRequired><div>content</div></AuthRequired>)

    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/account')
    expect(mockNavigate).toHaveBeenCalledWith('/account', { from: '/test' })
  })

  it('renders children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'user-1' }, access_token: 'token' },
      isAuthenticated: true,
      isLoading: false,
    })

    render(<AuthRequired><div>content</div></AuthRequired>)

    expect(screen.getByText('content')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('shows loading state while auth is initializing', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    })

    render(<AuthRequired><div>content</div></AuthRequired>)

    expect(screen.getByText(/checking your account/i)).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('preserves pathname, search, and hash in the return path', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/trips',
      search: '?tripId=trip-123',
      hash: '#details',
    })
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    })

    render(<AuthRequired><div>content</div></AuthRequired>)

    expect(mockNavigate).toHaveBeenCalledWith('/account', {
      from: '/trips?tripId=trip-123#details',
    })
  })
})
