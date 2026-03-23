import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DeparturePrompt from './DeparturePrompt'

describe('DeparturePrompt', () => {
  const defaultProps = {
    pinName: 'Desert Springs',
    rigType: 'Class A',
    onSkip: vi.fn(),
    onCheckIn: vi.fn(),
  }

  it('renders prompt message with spot name and rig type', () => {
    render(<DeparturePrompt {...defaultProps} />)
    expect(screen.getByText(/How was Desert Springs for your Class A/)).toBeInTheDocument()
  })

  it('renders prompt message with spot name only when rigType is null', () => {
    render(<DeparturePrompt {...defaultProps} rigType={null} />)
    expect(screen.getByText(/How was Desert Springs\?/)).toBeInTheDocument()
    expect(screen.queryByText(/for your/)).not.toBeInTheDocument()
  })

  it('"Skip" button calls onSkip', () => {
    const onSkip = vi.fn()
    render(<DeparturePrompt {...defaultProps} onSkip={onSkip} />)
    fireEvent.click(screen.getByLabelText('Skip check-in'))
    expect(onSkip).toHaveBeenCalledOnce()
  })

  it('"Check In" button calls onCheckIn', () => {
    const onCheckIn = vi.fn()
    render(<DeparturePrompt {...defaultProps} onCheckIn={onCheckIn} />)
    fireEvent.click(screen.getByLabelText('Submit check-in'))
    expect(onCheckIn).toHaveBeenCalledOnce()
  })

  it('has role="dialog" and aria-modal="true"', () => {
    render(<DeparturePrompt {...defaultProps} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('both buttons meet min-h-[44px] tap target', () => {
    render(<DeparturePrompt {...defaultProps} />)
    expect(screen.getByLabelText('Skip check-in').className).toContain('min-h-[44px]')
    expect(screen.getByLabelText('Submit check-in').className).toContain('min-h-[44px]')
  })
})
