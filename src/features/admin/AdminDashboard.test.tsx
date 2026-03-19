import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AdminDashboard from './AdminDashboard'
import { ADMIN_TOKEN_KEY } from './AdminAuth'

vi.mock('./AdminAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./AdminAuth')>()
  return {
    ...actual,
    default: ({ onAuthenticated }: { onAuthenticated: () => void }) => (
      <div data-testid="admin-auth-form">
        <button onClick={onAuthenticated}>Mock Sign In</button>
      </div>
    ),
  }
})

vi.mock('./FlaggedPinList', () => ({
  default: ({ adminToken }: { adminToken: string }) => (
    <div data-testid="flagged-pin-list" data-token={adminToken} />
  ),
}))

beforeEach(() => {
  sessionStorage.clear()
})

describe('AdminDashboard', () => {
  it('renders AdminAuth when sessionStorage has no token (6.2)', () => {
    render(<AdminDashboard />)
    expect(screen.getByTestId('admin-auth-form')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('renders admin panel (not auth form) when sessionStorage has a token (6.3)', () => {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, 'test-token-abc')
    render(<AdminDashboard />)
    expect(screen.queryByTestId('admin-auth-form')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /admin dashboard/i })).toBeInTheDocument()
  })

  it('clicking "Sign Out" removes token from sessionStorage and shows auth form again (6.4)', () => {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, 'test-token-abc')
    render(<AdminDashboard />)
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    expect(sessionStorage.getItem(ADMIN_TOKEN_KEY)).toBeNull()
    expect(screen.getByTestId('admin-auth-form')).toBeInTheDocument()
  })

  it('handleAuthenticated callback reads token from sessionStorage and updates state (6.5)', () => {
    render(<AdminDashboard />)
    expect(screen.getByTestId('admin-auth-form')).toBeInTheDocument()

    // Simulate AdminAuth setting token in sessionStorage then calling onAuthenticated
    sessionStorage.setItem(ADMIN_TOKEN_KEY, 'fresh-token-xyz')
    fireEvent.click(screen.getByRole('button', { name: /mock sign in/i }))

    expect(screen.queryByTestId('admin-auth-form')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /admin dashboard/i })).toBeInTheDocument()
  })

  it('renders FlaggedPinList when authenticated (15.2)', () => {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, 'test-token-abc')
    render(<AdminDashboard />)
    expect(screen.getByTestId('flagged-pin-list')).toBeInTheDocument()
  })

  it('FlaggedPinList receives adminToken prop equal to stored session token (15.3)', () => {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, 'my-secret-token')
    render(<AdminDashboard />)
    const list = screen.getByTestId('flagged-pin-list')
    expect(list.getAttribute('data-token')).toBe('my-secret-token')
  })
})
