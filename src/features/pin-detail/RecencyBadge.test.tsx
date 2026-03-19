import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RecencyBadge from './RecencyBadge'

describe('RecencyBadge', () => {
  it('renders green badge with ✓ icon for badgeState "green"', () => {
    render(<RecencyBadge badgeState="green" />)
    const badge = screen.getByRole('status')
    expect(badge).toHaveAttribute('aria-label', 'Verified recently')
    expect(badge).toHaveTextContent('✓')
    expect(badge).toHaveTextContent('Verified recently')
  })

  it('renders yellow badge with clock icon for badgeState "yellow"', () => {
    render(<RecencyBadge badgeState="yellow" />)
    const badge = screen.getByRole('status')
    expect(badge).toHaveAttribute('aria-label', 'Verified 8–30 days ago')
    expect(badge).toHaveTextContent('Verified 8–30 days ago')
  })

  it('renders red badge with ⚠ icon for badgeState "red"', () => {
    render(<RecencyBadge badgeState="red" />)
    const badge = screen.getByRole('status')
    expect(badge).toHaveAttribute('aria-label', 'Stale — verify before visiting')
    expect(badge).toHaveTextContent('⚠')
  })

  it('renders grey badge for badgeState "grey"', () => {
    render(<RecencyBadge badgeState="grey" />)
    const badge = screen.getByRole('status')
    expect(badge).toHaveAttribute('aria-label', 'Unknown recency')
    expect(badge).toHaveTextContent('Unknown recency')
  })

  it('each badge has role="status" and descriptive aria-label', () => {
    const { rerender } = render(<RecencyBadge badgeState="green" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label')

    rerender(<RecencyBadge badgeState="yellow" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label')

    rerender(<RecencyBadge badgeState="red" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label')

    rerender(<RecencyBadge badgeState="grey" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label')
  })
})
