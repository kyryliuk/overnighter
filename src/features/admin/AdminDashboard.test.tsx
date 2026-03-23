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

vi.mock('./SpotSubmissionList', () => ({
  default: ({ adminToken }: { adminToken: string }) => (
    <div data-testid="spot-submission-list" data-token={adminToken} />
  ),
}))

vi.mock('./CreatePinForm', () => ({
  default: ({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) => (
    <div data-testid="create-pin-form">
      <button onClick={onSuccess}>mock-success</button>
      <button onClick={onCancel}>mock-cancel</button>
    </div>
  ),
}))

vi.mock('./AdminPinList', () => ({
  default: ({ onSelect }: { onSelect: (pin: unknown) => void }) => (
    <div data-testid="admin-pin-list">
      <button onClick={() => onSelect({ id: 'stub-pin', name: 'Stub Pin' })}>mock-select-pin</button>
    </div>
  ),
}))

vi.mock('./EditPinForm', () => ({
  default: ({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) => (
    <div data-testid="edit-pin-form">
      <button onClick={onSuccess}>mock-edit-success</button>
      <button onClick={onCancel}>mock-edit-cancel</button>
    </div>
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
    expect(screen.getByRole('heading', { name: /overnighter admin/i })).toBeInTheDocument()
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
    expect(screen.getByRole('heading', { name: /overnighter admin/i })).toBeInTheDocument()
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

  it('"Add New Pin" button is present in the authenticated dashboard (16.2)', () => {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, 'test-token-abc')
    render(<AdminDashboard />)
    expect(screen.getByRole('button', { name: /\+ add pin/i })).toBeInTheDocument()
  })

  it('clicking "Add New Pin" renders CreatePinForm (16.3)', () => {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, 'test-token-abc')
    render(<AdminDashboard />)
    expect(screen.queryByTestId('create-pin-form')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /\+ add pin/i }))
    expect(screen.getByTestId('create-pin-form')).toBeInTheDocument()
  })

  it('CreatePinForm is hidden after onSuccess is called (16.4)', () => {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, 'test-token-abc')
    render(<AdminDashboard />)
    fireEvent.click(screen.getByRole('button', { name: /\+ add pin/i }))
    expect(screen.getByTestId('create-pin-form')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /mock-success/i }))
    expect(screen.queryByTestId('create-pin-form')).not.toBeInTheDocument()
  })

  it('CreatePinForm is hidden after onCancel is called (16.5)', () => {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, 'test-token-abc')
    render(<AdminDashboard />)
    fireEvent.click(screen.getByRole('button', { name: /\+ add pin/i }))
    expect(screen.getByTestId('create-pin-form')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /mock-cancel/i }))
    expect(screen.queryByTestId('create-pin-form')).not.toBeInTheDocument()
  })

  it('AdminPinList is rendered in the authenticated dashboard (17.2)', () => {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, 'test-token-abc')
    render(<AdminDashboard />)
    expect(screen.getByTestId('admin-pin-list')).toBeInTheDocument()
  })

  it('clicking mock select in AdminPinList renders EditPinForm (17.3)', () => {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, 'test-token-abc')
    render(<AdminDashboard />)
    expect(screen.queryByTestId('edit-pin-form')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /mock-select-pin/i }))
    expect(screen.getByTestId('edit-pin-form')).toBeInTheDocument()
  })

  it('EditPinForm is hidden and AdminPinList shown again after onCancel (17.4)', () => {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, 'test-token-abc')
    render(<AdminDashboard />)
    fireEvent.click(screen.getByRole('button', { name: /mock-select-pin/i }))
    expect(screen.getByTestId('edit-pin-form')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /mock-edit-cancel/i }))
    expect(screen.queryByTestId('edit-pin-form')).not.toBeInTheDocument()
    expect(screen.getByTestId('admin-pin-list')).toBeInTheDocument()
  })

  it('after onSuccess, EditPinForm is hidden and success message is visible (17.5)', () => {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, 'test-token-abc')
    render(<AdminDashboard />)
    fireEvent.click(screen.getByRole('button', { name: /mock-select-pin/i }))
    fireEvent.click(screen.getByRole('button', { name: /mock-edit-success/i }))
    expect(screen.queryByTestId('edit-pin-form')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/pin updated successfully/i)
  })

  it('CreatePinForm hides AdminPinList while create mode is active (M2)', () => {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, 'test-token-abc')
    render(<AdminDashboard />)
    expect(screen.getByTestId('admin-pin-list')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /\+ add pin/i }))
    expect(screen.getByTestId('create-pin-form')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-pin-list')).not.toBeInTheDocument()
    expect(screen.queryByTestId('edit-pin-form')).not.toBeInTheDocument()
  })

  it('AdminPinList is hidden when EditPinForm is shown (17.6)', () => {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, 'test-token-abc')
    render(<AdminDashboard />)
    expect(screen.getByTestId('admin-pin-list')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /mock-select-pin/i }))
    expect(screen.queryByTestId('admin-pin-list')).not.toBeInTheDocument()
    expect(screen.getByTestId('edit-pin-form')).toBeInTheDocument()
  })
})
