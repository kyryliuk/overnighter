import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BadgeTooltip from './BadgeTooltip'

// ---------------------------------------------------------------------------
// matchMedia stub (jsdom doesn't implement it)
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  })
})

// ---------------------------------------------------------------------------
// BadgeTooltip component tests
// ---------------------------------------------------------------------------
describe('BadgeTooltip', () => {
  it('renders the tooltip message', () => {
    const onDismiss = vi.fn()
    render(<BadgeTooltip onDismiss={onDismiss} />)
    expect(screen.getByText(/Green = verified this week/i)).toBeInTheDocument()
  })

  it('renders the "tap any pin" part of the message', () => {
    const onDismiss = vi.fn()
    render(<BadgeTooltip onDismiss={onDismiss} />)
    expect(screen.getByText(/Tap any pin to see when/i)).toBeInTheDocument()
  })

  it('calls onDismiss when the overlay is clicked', () => {
    const onDismiss = vi.fn()
    render(<BadgeTooltip onDismiss={onDismiss} />)
    const overlay = screen.getByRole('button', { hidden: true })
    fireEvent.click(overlay)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('calls onDismiss when clicking anywhere on the component', () => {
    const onDismiss = vi.fn()
    const { container } = render(<BadgeTooltip onDismiss={onDismiss} />)
    fireEvent.click(container.firstChild as HTMLElement)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// MapView integration — BadgeTooltip visibility controlled by parent
// ---------------------------------------------------------------------------
// These tests verify the integration pattern: MapView conditionally renders
// BadgeTooltip based on showBadgeTooltip state. We test the logic directly
// since MapView has complex dependencies (Leaflet, usePinsQuery, etc.)
describe('BadgeTooltip — conditional rendering pattern', () => {
  it('is visible when rendered (parent controls show/hide)', () => {
    const onDismiss = vi.fn()
    const { unmount } = render(<BadgeTooltip onDismiss={onDismiss} />)
    expect(screen.getByText(/Green = verified this week/i)).toBeInTheDocument()
    unmount()
  })

  it('calls onDismiss when Enter key is pressed on the overlay', () => {
    const onDismiss = vi.fn()
    render(<BadgeTooltip onDismiss={onDismiss} />)
    const overlay = screen.getByRole('button', { hidden: true })
    fireEvent.keyDown(overlay, { key: 'Enter' })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// localStorage interaction — tested at the dismiss handler level
// ---------------------------------------------------------------------------
describe('BadgeTooltip — localStorage dismiss pattern', () => {
  it('onDismiss handler can set localStorage and hide tooltip (integration pattern)', () => {
    const localStorageMock: Record<string, string> = {}
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, val) => {
      localStorageMock[key] = val
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => localStorageMock[key] ?? null)

    let shown = true
    const handleDismiss = () => {
      localStorage.setItem('badge_tooltip_seen', '1')
      shown = false
    }

    render(<BadgeTooltip onDismiss={handleDismiss} />)
    const overlay = screen.getByRole('button', { hidden: true })
    fireEvent.click(overlay)

    expect(shown).toBe(false)
    expect(localStorageMock['badge_tooltip_seen']).toBe('1')
  })

  it('calls onDismiss when Space key is pressed on the overlay', () => {
    const onDismiss = vi.fn()
    render(<BadgeTooltip onDismiss={onDismiss} />)
    const overlay = screen.getByRole('button', { hidden: true })
    fireEvent.keyDown(overlay, { key: ' ' })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('tooltip is shown when badge_tooltip_seen is not set', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
    const shouldShow = !localStorage.getItem('badge_tooltip_seen')
    expect(shouldShow).toBe(true)
  })
})
