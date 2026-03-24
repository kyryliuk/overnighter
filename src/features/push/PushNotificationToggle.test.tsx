import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import PushNotificationToggle from './PushNotificationToggle'

const mockSubscribe = vi.fn()
const mockUnsubscribe = vi.fn()
const mockHookReturn = {
  permissionState: 'default' as NotificationPermission | 'unsupported',
  isSubscribed: false,
  isLoading: false,
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
}

vi.mock('@/hooks/usePushSubscription', () => ({
  usePushSubscription: vi.fn(() => mockHookReturn),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockSubscribe.mockResolvedValue(undefined)
  mockUnsubscribe.mockResolvedValue(undefined)
  mockHookReturn.permissionState = 'default'
  mockHookReturn.isSubscribed = false
  mockHookReturn.isLoading = false
})

describe('PushNotificationToggle', () => {
  it('renders toggle with correct label and role="switch"', () => {
    render(<PushNotificationToggle pinId="pin-1" />)
    expect(screen.getByText('Notify me when status changes')).toBeInTheDocument()
    const toggle = screen.getByRole('switch')
    expect(toggle).toBeInTheDocument()
  })

  it('aria-checked is false when not subscribed', () => {
    render(<PushNotificationToggle pinId="pin-1" />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('aria-checked is true when subscribed', () => {
    mockHookReturn.isSubscribed = true
    render(<PushNotificationToggle pinId="pin-1" />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('calls subscribe() when clicked while off', async () => {
    render(<PushNotificationToggle pinId="pin-1" />)
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalled()
    })
  })

  it('calls unsubscribe() when clicked while on', async () => {
    mockHookReturn.isSubscribed = true
    render(<PushNotificationToggle pinId="pin-1" />)
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => {
      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })

  it('shows denied message when permission is denied', () => {
    mockHookReturn.permissionState = 'denied'
    render(<PushNotificationToggle pinId="pin-1" />)
    expect(screen.getByText('Enable notifications in your browser settings')).toBeInTheDocument()
  })

  it('returns null when unsupported', () => {
    mockHookReturn.permissionState = 'unsupported'
    const { container } = render(<PushNotificationToggle pinId="pin-1" />)
    expect(container.innerHTML).toBe('')
  })

  it('toggle is disabled during loading', () => {
    mockHookReturn.isLoading = true
    render(<PushNotificationToggle pinId="pin-1" />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toBeDisabled()
  })

  it('toggle is disabled when permission denied', () => {
    mockHookReturn.permissionState = 'denied'
    render(<PushNotificationToggle pinId="pin-1" />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toBeDisabled()
  })

  it('shows description when permission is default and user clicks toggle', async () => {
    render(<PushNotificationToggle pinId="pin-1" />)

    expect(screen.queryByText(/You'll get an alert/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() => {
      expect(screen.getByText(/You'll get an alert when a new check-in changes this spot's status/)).toBeInTheDocument()
    })
  })

  it('has accessible aria-label on toggle', () => {
    render(<PushNotificationToggle pinId="pin-1" />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-label', 'Notify me when this spot status changes')
  })
})
