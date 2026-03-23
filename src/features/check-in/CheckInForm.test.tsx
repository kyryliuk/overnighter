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

  it('disables submission and shows offline guidance when the user is offline', () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false })
    window.dispatchEvent(new Event('offline'))

    render(<CheckInForm {...defaultProps} />)
    fireEvent.click(screen.getByText('Still Open'))

    expect(screen.getByRole('status')).toHaveTextContent(/offline mode: check-ins require a connection/i)
    expect(screen.getByRole('button', { name: /submit check-in/i })).toBeDisabled()
    expect(mockMutate).not.toHaveBeenCalled()
  })
})
