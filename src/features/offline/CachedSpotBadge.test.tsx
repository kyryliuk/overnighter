import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CachedSpotBadge } from './CachedSpotBadge'

describe('CachedSpotBadge', () => {
  it('renders "Offline ready" text', () => {
    render(<CachedSpotBadge />)
    expect(screen.getByText('Offline ready')).toBeInTheDocument()
  })

  it('has the correct data-testid', () => {
    render(<CachedSpotBadge />)
    expect(screen.getByTestId('cached-spot-badge')).toBeInTheDocument()
  })

  it('applies sky-500 background styling', () => {
    render(<CachedSpotBadge />)
    const badge = screen.getByTestId('cached-spot-badge')
    expect(badge.className).toContain('bg-sky-500')
    expect(badge.className).toContain('text-white')
  })

  it('renders as an inline span element', () => {
    render(<CachedSpotBadge />)
    const badge = screen.getByTestId('cached-spot-badge')
    expect(badge.tagName).toBe('SPAN')
  })
})
