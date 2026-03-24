import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import CheckInForm from './CheckInForm'

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockMutate, getCallbacks } = vi.hoisted(() => {
  let onSuccess: (() => void) | undefined
  let onError: ((e: Error) => void) | undefined

  const mockMutate = vi.fn((_payload: unknown, opts?: { onSuccess?: () => void; onError?: (e: Error) => void }) => {
    onSuccess = opts?.onSuccess
    onError = opts?.onError
  })

  return {
    mockMutate,
    getCallbacks: () => ({ onSuccess, onError }),
  }
})

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

vi.mock('@/hooks/useCheckInMutation', () => ({
  useCheckInMutation: () => ({ mutate: mockMutate, isPending: false }),
}))

vi.mock('@/hooks/usePinsQuery', () => ({
  usePinsQuery: () => ({
    data: [
      {
        id: 'pin-123',
        name: 'Desert Springs',
        description: null,
        latitude: 37.0,
        longitude: -107.0,
        pinType: 'blm',
        sourceId: null,
        maxLengthFt: null,
        maxHeightFt: null,
        amenities: { water: false, dump: false, electric: false, shower: false, fuel: false, propane: false, overnight: true },
        badgeState: 'yellow',
        lastCheckInAt: null,
        recentCheckInCount: 0,
        isVerified: false,
        isFlagged: false,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ],
  }),
}))

vi.mock('@/hooks/useDeviceId', () => ({
  useDeviceId: () => 'stub-device-uuid',
}))

// ── Helpers ────────────────────────────────────────────────────────────────

const defaultProps = {
  pinId: 'pin-123',
  onClose: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
  mockUseAuth.mockReturnValue({
    session: null,
    isAuthenticated: false,
    isLoading: false,
  })
})

// ── Tests ──────────────────────────────────────────────────────────────────

describe('CheckInForm', () => {
  it('renders all three status chips: Still Open, Closed, Changed (7.4)', () => {
    render(<CheckInForm {...defaultProps} />)
    expect(screen.getByText('Still Open')).toBeInTheDocument()
    expect(screen.getByText('Closed')).toBeInTheDocument()
    expect(screen.getByText('Changed')).toBeInTheDocument()
  })

  it('submit button is disabled when no status selected (7.5)', () => {
    render(<CheckInForm {...defaultProps} />)
    expect(screen.getByText('Submit Check-In')).toBeDisabled()
  })

  it('submit button is enabled after selecting a status (7.6)', () => {
    render(<CheckInForm {...defaultProps} />)
    fireEvent.click(screen.getByText('Still Open'))
    expect(screen.getByText('Submit Check-In')).not.toBeDisabled()
  })

  it('clicking a chip sets aria-pressed=true on that chip (7.7)', () => {
    render(<CheckInForm {...defaultProps} />)
    const chip = screen.getByText('Closed')
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    // Other chips remain unselected
    expect(screen.getByText('Still Open')).toHaveAttribute('aria-pressed', 'false')
  })

  it('optional note textarea is present and accepts input (7.8)', () => {
    render(<CheckInForm {...defaultProps} />)
    const textarea = screen.getByRole('textbox', { name: /optional note/i })
    expect(textarea).toBeInTheDocument()
    fireEvent.change(textarea, { target: { value: 'Fee is now $12' } })
    expect(textarea).toHaveValue('Fee is now $12')
  })

  it('submitting calls mutate with correct pinId, deviceId, and status (7.9)', () => {
    render(<CheckInForm {...defaultProps} />)
    fireEvent.click(screen.getByText('Still Open'))
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ pinId: 'pin-123', deviceId: 'stub-device-uuid', status: 'still_open' }),
      expect.any(Object),
    )
  })

  it('submitting with note includes note in payload (7.10)', () => {
    render(<CheckInForm {...defaultProps} />)
    fireEvent.click(screen.getByText('Changed'))
    const textarea = screen.getByRole('textbox', { name: /optional note/i })
    fireEvent.change(textarea, { target: { value: 'Hours changed' } })
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ note: 'Hours changed' }),
      expect.any(Object),
    )
  })

  it('shows role=alert error message when mutation onError is triggered (7.11)', () => {
    render(<CheckInForm {...defaultProps} />)
    fireEvent.click(screen.getByText('Still Open'))
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)

    const { onError } = getCallbacks()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    act(() => { onError?.(new Error('network')) })
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save check-in. Tap to retry.")
  })

  it('onClose prop is called when mutation succeeds — form closes after submit (M1)', () => {
    const onClose = vi.fn()
    render(<CheckInForm pinId="pin-123" onClose={onClose} />)
    fireEvent.click(screen.getByText('Still Open'))
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)

    const { onSuccess } = getCallbacks()
    expect(onClose).not.toHaveBeenCalled()
    act(() => { onSuccess?.() })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('onClose prop is called when close button is clicked (7.12)', () => {
    const onClose = vi.fn()
    render(<CheckInForm pinId="pin-123" onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close check-in form'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('has role=dialog with aria-modal=true (7.13)', () => {
    render(<CheckInForm {...defaultProps} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('queues check-in when offline and shows guidance message', () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false })
    window.dispatchEvent(new Event('offline'))

    render(<CheckInForm {...defaultProps} />)
    fireEvent.click(screen.getByText('Still Open'))

    expect(screen.getByRole('status')).toHaveTextContent(/your check-in will be saved and submitted when you reconnect/i)
    // Submit button is enabled when offline (queuing is supported)
    expect(screen.getByRole('button', { name: /submit check-in/i })).not.toBeDisabled()
  })

  // ── Photo upload integration tests ───────────────────────────────────────

  it('does NOT render PhotoUpload when user is unauthenticated', () => {
    mockUseAuth.mockReturnValue({ session: null, isAuthenticated: false, isLoading: false })
    render(<CheckInForm {...defaultProps} />)
    expect(screen.queryByLabelText('Add photo')).not.toBeInTheDocument()
  })

  it('renders PhotoUpload when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'user-1' }, access_token: 'token' },
      isAuthenticated: true,
      isLoading: false,
    })
    render(<CheckInForm {...defaultProps} />)
    expect(screen.getByLabelText('Add photo')).toBeInTheDocument()
  })

  it('PhotoUpload shows disabled state when offline and authenticated', () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false })
    window.dispatchEvent(new Event('offline'))
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'user-1' }, access_token: 'token' },
      isAuthenticated: true,
      isLoading: false,
    })
    render(<CheckInForm {...defaultProps} />)
    expect(screen.getByText('Photo unavailable offline')).toBeInTheDocument()
  })

  it('check-in submits successfully without photo (existing behavior preserved)', () => {
    render(<CheckInForm {...defaultProps} />)
    fireEvent.click(screen.getByText('Still Open'))
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ pinId: 'pin-123', deviceId: 'stub-device-uuid', status: 'still_open' }),
      expect.any(Object),
    )
    // Verify photo fields are undefined when no photo attached
    const payload = mockMutate.mock.calls[0][0]
    expect(payload.photoCdnUrl).toBeUndefined()
    expect(payload.photoStoragePath).toBeUndefined()
  })

  it('mutation payload includes checkInId', () => {
    render(<CheckInForm {...defaultProps} />)
    fireEvent.click(screen.getByText('Still Open'))
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
    const payload = mockMutate.mock.calls[0][0]
    // checkInId should be a valid UUID
    expect(payload.checkInId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })
})
