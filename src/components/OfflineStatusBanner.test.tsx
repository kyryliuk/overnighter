import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import OfflineStatusBanner from './OfflineStatusBanner'

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(() => true),
}))

vi.mock('@/lib/offline/pinsCache', () => ({
  readPinsCacheSnapshot: vi.fn(() => null),
  PINS_CACHE_UPDATED_EVENT: 'pins-cache-updated',
}))

import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { readPinsCacheSnapshot } from '@/lib/offline/pinsCache'

describe('OfflineStatusBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useOnlineStatus).mockReturnValue(true)
    vi.mocked(readPinsCacheSnapshot).mockReturnValue(null)
  })

  it('renders nothing when online', () => {
    const { container } = render(<OfflineStatusBanner />)
    expect(container.innerHTML).toBe('')
  })

  it('renders offline message when offline with no cache', () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    render(<OfflineStatusBanner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/connect once to download/i)).toBeInTheDocument()
  })

  it('shows cached timestamp when pins cache exists', () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    vi.mocked(readPinsCacheSnapshot).mockReturnValue({
      pins: [],
      cachedAt: '2024-06-15T12:00:00Z',
    })
    render(<OfflineStatusBanner />)
    expect(screen.getByText(/showing saved map data from/i)).toBeInTheDocument()
  })

  it('has role="status" for accessibility', () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    render(<OfflineStatusBanner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('auto-dismisses when transitioning to online', () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    const { rerender, container } = render(<OfflineStatusBanner />)
    expect(screen.getByRole('status')).toBeInTheDocument()

    vi.mocked(useOnlineStatus).mockReturnValue(true)
    rerender(<OfflineStatusBanner />)
    expect(container.innerHTML).toBe('')
  })

  it('uses pointer-events-none on container', () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    render(<OfflineStatusBanner />)
    const container = screen.getByRole('status').parentElement!
    expect(container.className).toContain('pointer-events-none')
  })
})
