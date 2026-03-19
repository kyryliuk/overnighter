import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, screen } from '@testing-library/react'
import App from './App'
import { DEVICE_ID_KEY } from '@/hooks/useDeviceId'
import { useUIStore } from '@/store/uiStore'

// Mock all lazy-loaded routes — prevents dynamic import resolution in jsdom
vi.mock('@/features/map/MapView', () => ({ default: () => null }))
vi.mock('@/features/rig-profile/OnboardingScreen', () => ({ default: () => null }))
vi.mock('@/features/rig-profile/RigEditScreen', () => ({ default: () => null }))
vi.mock('@/features/pin-detail/PinDetailSheet', () => ({ default: () => null }))
vi.mock('@/features/saved-spots/SavedSpotsScreen', () => ({ default: () => null }))
vi.mock('@/features/admin/AdminDashboard', () => ({ default: () => null }))
vi.mock('@/features/check-in/CheckInForm', () => ({
  default: ({ pinId }: { pinId: string }) => (
    <div data-testid="check-in-form" data-pin-id={pinId} />
  ),
}))

const STUB_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

describe('App initialization', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => STUB_UUID) })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('initializes anonymous device ID in localStorage on first render (AC1)', async () => {
    await act(async () => { render(<App />) })
    expect(localStorage.getItem(DEVICE_ID_KEY)).toBe(STUB_UUID)
  })
})

describe('App CheckInForm mounting (Story 4.3)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => STUB_UUID) })
    useUIStore.setState({ pendingCheckIn: null })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    useUIStore.setState({ pendingCheckIn: null })
  })

  it('does NOT render CheckInForm when pendingCheckIn is null (9.2)', async () => {
    await act(async () => { render(<App />) })
    expect(screen.queryByTestId('check-in-form')).not.toBeInTheDocument()
  })

  it('renders CheckInForm when pendingCheckIn is set (9.3)', async () => {
    useUIStore.setState({ pendingCheckIn: { pinId: 'p1' } })
    await act(async () => { render(<App />) })
    expect(screen.getByTestId('check-in-form')).toBeInTheDocument()
  })

  it('passes correct pinId prop to CheckInForm (9.4)', async () => {
    useUIStore.setState({ pendingCheckIn: { pinId: 'p1' } })
    await act(async () => { render(<App />) })
    expect(screen.getByTestId('check-in-form')).toHaveAttribute('data-pin-id', 'p1')
  })
})
