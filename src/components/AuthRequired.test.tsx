import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'

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
vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => {
    mockNavigate(to)
    return createElement('div', { 'data-testid': 'navigate', 'data-to': to })
  },
  useLocation: () => ({ pathname: '/test' }),
}))

import { AuthRequired } from './AuthRequired'

describe('AuthRequired', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to /account when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    })

    const wrapper = ({ children }: { children: ReactNode }) => createElement(AuthRequired, null, children)
    renderHook(() => 'content', { wrapper })

    expect(mockNavigate).toHaveBeenCalledWith('/account')
  })

  it('renders children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'user-1' }, access_token: 'token' },
      isAuthenticated: true,
      isLoading: false,
    })

    const wrapper = ({ children }: { children: ReactNode }) => createElement(AuthRequired, null, children)
    renderHook(() => 'content', { wrapper })

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('shows loading state while auth is initializing', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    })

    const wrapper = ({ children }: { children: ReactNode }) => createElement(AuthRequired, null, children)
    renderHook(() => 'content', { wrapper })

    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
