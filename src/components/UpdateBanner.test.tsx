import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UpdateBanner from './UpdateBanner'

const mockUpdateServiceWorker = vi.fn()

vi.mock('@/hooks/usePWAUpdate', () => ({
  usePWAUpdate: vi.fn(() => ({
    needRefresh: false,
    updateServiceWorker: mockUpdateServiceWorker,
  })),
}))

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(() => true),
}))

import { usePWAUpdate } from '@/hooks/usePWAUpdate'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

describe('UpdateBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(usePWAUpdate).mockReturnValue({
      needRefresh: false,
      updateServiceWorker: mockUpdateServiceWorker,
    })
    vi.mocked(useOnlineStatus).mockReturnValue(true)
  })

  it('renders nothing when needRefresh is false', () => {
    const { container } = render(<UpdateBanner />)
    expect(container.innerHTML).toBe('')
  })

  it('renders banner when needRefresh is true', () => {
    vi.mocked(usePWAUpdate).mockReturnValue({
      needRefresh: true,
      updateServiceWorker: mockUpdateServiceWorker,
    })
    render(<UpdateBanner />)
    expect(screen.getByTestId('update-banner')).toBeInTheDocument()
    expect(screen.getByText('A new version is available')).toBeInTheDocument()
  })

  it('calls updateServiceWorker when Update is clicked', () => {
    vi.mocked(usePWAUpdate).mockReturnValue({
      needRefresh: true,
      updateServiceWorker: mockUpdateServiceWorker,
    })
    render(<UpdateBanner />)
    fireEvent.click(screen.getByTestId('update-button'))
    expect(mockUpdateServiceWorker).toHaveBeenCalledOnce()
  })

  it('dismisses the banner when ✕ is clicked', () => {
    vi.mocked(usePWAUpdate).mockReturnValue({
      needRefresh: true,
      updateServiceWorker: mockUpdateServiceWorker,
    })
    render(<UpdateBanner />)
    expect(screen.getByTestId('update-banner')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('update-dismiss'))
    expect(screen.queryByTestId('update-banner')).not.toBeInTheDocument()
  })

  it('has role="status" for accessibility', () => {
    vi.mocked(usePWAUpdate).mockReturnValue({
      needRefresh: true,
      updateServiceWorker: mockUpdateServiceWorker,
    })
    render(<UpdateBanner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('uses top-4 when online (no offline banner)', () => {
    vi.mocked(usePWAUpdate).mockReturnValue({
      needRefresh: true,
      updateServiceWorker: mockUpdateServiceWorker,
    })
    vi.mocked(useOnlineStatus).mockReturnValue(true)
    render(<UpdateBanner />)
    const container = screen.getByTestId('update-banner').parentElement!
    expect(container.className).toContain('top-4')
    expect(container.className).not.toContain('top-20')
  })

  it('shifts to top-20 when offline (stacking with offline banner)', () => {
    vi.mocked(usePWAUpdate).mockReturnValue({
      needRefresh: true,
      updateServiceWorker: mockUpdateServiceWorker,
    })
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    render(<UpdateBanner />)
    const container = screen.getByTestId('update-banner').parentElement!
    expect(container.className).toContain('top-20')
  })
})
