import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import PWAInstallPrompt from './PWAInstallPrompt'

function setVisitCount(count: number) {
  localStorage.setItem('pwa-visit-count', String(count))
}

function setSavedSpots(spots: unknown[]) {
  localStorage.setItem('saved-spots', JSON.stringify({ state: { savedSpots: spots } }))
}

function mockMobileDevice() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query === '(max-width: 768px)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

function mockDesktopDevice() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

function fireBeforeInstallPrompt() {
  const event = new Event('beforeinstallprompt', { cancelable: true })
  Object.assign(event, {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: 'accepted' as const }),
  })
  act(() => {
    window.dispatchEvent(event)
  })
  return event
}

describe('PWAInstallPrompt', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not render on first visit', () => {
    mockMobileDevice()
    render(<PWAInstallPrompt />)
    fireBeforeInstallPrompt()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not render without saved spots', () => {
    mockMobileDevice()
    setVisitCount(5)
    render(<PWAInstallPrompt />)
    fireBeforeInstallPrompt()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not render on desktop even with criteria met', () => {
    mockDesktopDevice()
    setVisitCount(5)
    setSavedSpots([{ id: '1' }])
    render(<PWAInstallPrompt />)
    fireBeforeInstallPrompt()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows bottom sheet when engagement criteria are met on mobile', () => {
    mockMobileDevice()
    setVisitCount(5)
    setSavedSpots([{ id: '1' }])
    render(<PWAInstallPrompt />)
    fireBeforeInstallPrompt()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Overnighter')).toBeInTheDocument()
  })

  it('renders Add to Home Screen and Not now buttons', () => {
    mockMobileDevice()
    setVisitCount(5)
    setSavedSpots([{ id: '1' }])
    render(<PWAInstallPrompt />)
    fireBeforeInstallPrompt()
    expect(screen.getByText('Add to Home Screen')).toBeInTheDocument()
    expect(screen.getByText('Not now')).toBeInTheDocument()
  })

  it('renders app icon', () => {
    mockMobileDevice()
    setVisitCount(5)
    setSavedSpots([{ id: '1' }])
    render(<PWAInstallPrompt />)
    fireBeforeInstallPrompt()
    const icon = screen.getByAltText('Overnighter')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveAttribute('src', '/pwa-icon.svg')
  })

  it('hides sheet when "Not now" is clicked', () => {
    mockMobileDevice()
    setVisitCount(5)
    setSavedSpots([{ id: '1' }])
    render(<PWAInstallPrompt />)
    fireBeforeInstallPrompt()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Not now'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('stores dismissal flag in sessionStorage', () => {
    mockMobileDevice()
    setVisitCount(5)
    setSavedSpots([{ id: '1' }])
    render(<PWAInstallPrompt />)
    fireBeforeInstallPrompt()
    fireEvent.click(screen.getByText('Not now'))
    expect(sessionStorage.getItem('pwa-install-dismissed')).toBe('true')
  })

  it('calls prompt when "Add to Home Screen" is clicked', async () => {
    mockMobileDevice()
    setVisitCount(5)
    setSavedSpots([{ id: '1' }])
    render(<PWAInstallPrompt />)
    const event = fireBeforeInstallPrompt()
    fireEvent.click(screen.getByText('Add to Home Screen'))
    // The prompt mock is on the event object
    expect((event as unknown as { prompt: ReturnType<typeof vi.fn> }).prompt).toHaveBeenCalled()
  })

  it('buttons have minimum 44x44px touch targets', () => {
    mockMobileDevice()
    setVisitCount(5)
    setSavedSpots([{ id: '1' }])
    render(<PWAInstallPrompt />)
    fireBeforeInstallPrompt()
    const installBtn = screen.getByText('Add to Home Screen')
    const dismissBtn = screen.getByText('Not now')
    expect(installBtn.className).toContain('min-h-11')
    expect(installBtn.className).toContain('min-w-11')
    expect(dismissBtn.className).toContain('min-h-11')
    expect(dismissBtn.className).toContain('min-w-11')
  })

  it('increments visit counter on mount', () => {
    mockMobileDevice()
    render(<PWAInstallPrompt />)
    expect(localStorage.getItem('pwa-visit-count')).toBe('1')
  })

  it('does not show if dismissed this session', () => {
    mockMobileDevice()
    setVisitCount(5)
    setSavedSpots([{ id: '1' }])
    sessionStorage.setItem('pwa-install-dismissed', 'true')
    render(<PWAInstallPrompt />)
    fireBeforeInstallPrompt()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
