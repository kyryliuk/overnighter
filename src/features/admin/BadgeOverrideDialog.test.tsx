import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BadgeOverrideDialog from './BadgeOverrideDialog'

// Mock HTMLDialogElement methods
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
})

function renderDialog(overrides: Partial<Parameters<typeof BadgeOverrideDialog>[0]> = {}) {
  const defaults = {
    open: true,
    onOpenChange: vi.fn(),
    pinName: 'Test Pin',
    currentOverride: null as string | null,
    onConfirm: vi.fn(),
    isLoading: false,
  }
  const props = { ...defaults, ...overrides }
  render(<BadgeOverrideDialog {...props} />)
  return props
}

describe('BadgeOverrideDialog', () => {
  it('renders dialog with title and pin name', () => {
    renderDialog({ pinName: 'Dirty Dump' })
    expect(screen.getByText('Override Badge Status')).toBeInTheDocument()
    expect(screen.getByText(/Dirty Dump/)).toBeInTheDocument()
  })

  it('renders four badge color options', () => {
    renderDialog()
    expect(screen.getByRole('radio', { name: 'green' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'yellow' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'red' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'grey' })).toBeInTheDocument()
  })

  it('pre-selects currentOverride if non-null', () => {
    renderDialog({ currentOverride: 'yellow' })
    expect(screen.getByRole('radio', { name: 'yellow' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'green' })).toHaveAttribute('aria-checked', 'false')
  })

  it('"Apply Override" button calls onConfirm with selected badge', () => {
    const props = renderDialog()
    fireEvent.click(screen.getByRole('radio', { name: 'red' }))
    fireEvent.click(screen.getByRole('button', { name: /apply override/i }))
    expect(props.onConfirm).toHaveBeenCalledWith('red')
  })

  it('"Remove Override" button visible only when currentOverride is non-null', () => {
    // With no override
    const { unmount } = render(
      <BadgeOverrideDialog
        open={true}
        onOpenChange={vi.fn()}
        pinName="Test"
        currentOverride={null}
        onConfirm={vi.fn()}
        isLoading={false}
      />,
    )
    expect(screen.queryByRole('button', { name: /remove override/i })).not.toBeInTheDocument()
    unmount()

    // With override
    render(
      <BadgeOverrideDialog
        open={true}
        onOpenChange={vi.fn()}
        pinName="Test"
        currentOverride="green"
        onConfirm={vi.fn()}
        isLoading={false}
      />,
    )
    expect(screen.getByRole('button', { name: /remove override/i })).toBeInTheDocument()
  })

  it('"Remove Override" calls onConfirm(null)', () => {
    const props = renderDialog({ currentOverride: 'green' })
    fireEvent.click(screen.getByRole('button', { name: /remove override/i }))
    expect(props.onConfirm).toHaveBeenCalledWith(null)
  })

  it('Cancel button calls onOpenChange(false)', () => {
    const props = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('confirm button disabled when no badge is selected and no current override', () => {
    renderDialog({ currentOverride: null })
    expect(screen.getByRole('button', { name: /apply override/i })).toBeDisabled()
  })
})
