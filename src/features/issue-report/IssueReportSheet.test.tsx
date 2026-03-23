import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import IssueReportSheet from './IssueReportSheet'

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

vi.mock('@/hooks/useReportMutation', () => ({
  useReportMutation: () => ({ mutate: mockMutate, isPending: false }),
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
})

// ── Tests ──────────────────────────────────────────────────────────────────

describe('IssueReportSheet', () => {
  it('renders all five issue type chips (8.1)', () => {
    render(<IssueReportSheet {...defaultProps} />)
    expect(screen.getByText('Dump station closed')).toBeInTheDocument()
    expect(screen.getByText('Water unavailable')).toBeInTheDocument()
    expect(screen.getByText('Overnight parking prohibited')).toBeInTheDocument()
    expect(screen.getByText('Access blocked')).toBeInTheDocument()
    expect(screen.getByText('Other')).toBeInTheDocument()
  })

  it('submit button is disabled when no type selected (8.2)', () => {
    render(<IssueReportSheet {...defaultProps} />)
    expect(screen.getByText('Submit Report')).toBeDisabled()
  })

  it('submit button is enabled after selecting a type (8.3)', () => {
    render(<IssueReportSheet {...defaultProps} />)
    fireEvent.click(screen.getByText('Dump station closed'))
    expect(screen.getByText('Submit Report')).not.toBeDisabled()
  })

  it('clicking a chip sets aria-pressed=true on that chip (8.4)', () => {
    render(<IssueReportSheet {...defaultProps} />)
    const chip = screen.getByText('Access blocked')
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    // Other chips remain unselected
    expect(screen.getByText('Dump station closed')).toHaveAttribute('aria-pressed', 'false')
  })

  it('optional note textarea is present and accepts input (8.5)', () => {
    render(<IssueReportSheet {...defaultProps} />)
    const textarea = screen.getByRole('textbox', { name: /optional note/i })
    expect(textarea).toBeInTheDocument()
    fireEvent.change(textarea, { target: { value: 'Gate is locked' } })
    expect(textarea).toHaveValue('Gate is locked')
  })

  it('submitting calls mutate with correct pinId, deviceId, and type (8.6)', () => {
    render(<IssueReportSheet {...defaultProps} />)
    fireEvent.click(screen.getByText('Water unavailable'))
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ pinId: 'pin-123', deviceId: 'stub-device-uuid', type: 'water_unavailable' }),
      expect.any(Object),
    )
  })

  it('shows role=alert error message when mutation onError is triggered (8.7)', () => {
    render(<IssueReportSheet {...defaultProps} />)
    fireEvent.click(screen.getByText('Other'))
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)

    const { onError } = getCallbacks()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    act(() => { onError?.(new Error('network')) })
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save report. Tap to retry.")
  })

  it('onClose prop is called when mutation succeeds — form closes after submit (8.8)', () => {
    const onClose = vi.fn()
    render(<IssueReportSheet pinId="pin-123" onClose={onClose} />)
    fireEvent.click(screen.getByText('Dump station closed'))
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)

    const { onSuccess } = getCallbacks()
    expect(onClose).not.toHaveBeenCalled()
    act(() => { onSuccess?.() })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('onClose prop is called when close button is clicked (8.9)', () => {
    const onClose = vi.fn()
    render(<IssueReportSheet pinId="pin-123" onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close issue report form'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('has role=dialog with aria-modal=true (8.10)', () => {
    render(<IssueReportSheet {...defaultProps} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('dialog is labelled by the visible heading including pin name (8.11)', () => {
    render(<IssueReportSheet {...defaultProps} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-labelledby', 'issue-report-title')
    expect(document.getElementById('issue-report-title')).toHaveTextContent('Report issue at Desert Springs')
  })

  it('shows "this spot" in heading when pin is not in cache (8.12)', () => {
    render(<IssueReportSheet pinId="unknown-pin" onClose={vi.fn()} />)
    expect(screen.getByText('Report issue at this spot')).toBeInTheDocument()
  })
})
