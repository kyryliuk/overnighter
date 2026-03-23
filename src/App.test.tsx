import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, screen } from '@testing-library/react'
import App from './App'
import { DEVICE_ID_KEY } from '@/hooks/useDeviceId'
import { useUIStore } from '@/store/uiStore'

// Mock all lazy-loaded routes — prevents dynamic import resolution in jsdom
vi.mock('@/features/account/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('@/features/map/MapView', () => ({ default: () => null }))
vi.mock('@/features/rig-profile/OnboardingScreen', () => ({ default: () => null }))
vi.mock('@/features/rig-profile/RigEditScreen', () => ({ default: () => null }))
vi.mock('@/features/pin-detail/PinDetailSheet', () => ({ default: () => null }))
vi.mock('@/features/saved-spots/SavedSpotsScreen', () => ({ default: () => null }))
vi.mock('@/features/route-planning/RoutePlanningScreen', () => ({ default: () => null }))
vi.mock('@/features/route-planning/SharedTripPlanScreen', () => ({ default: () => null }))
vi.mock('@/features/admin/AdminDashboard', () => ({ default: () => null }))
vi.mock('@/features/check-in/CheckInForm', () => ({
  default: ({ pinId }: { pinId: string }) => (
    <div data-testid="check-in-form" data-pin-id={pinId} />
  ),
}))
vi.mock('@/features/issue-report/IssueReportSheet', () => ({
  default: ({ pinId }: { pinId: string }) => (
    <div data-testid="issue-report-sheet" data-pin-id={pinId} />
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

describe('App IssueReportSheet mounting (Story 4.4)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => STUB_UUID) })
    useUIStore.setState({ pendingReport: null })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    useUIStore.setState({ pendingReport: null })
  })

  it('does NOT render IssueReportSheet when pendingReport is null', async () => {
    await act(async () => { render(<App />) })
    expect(screen.queryByTestId('issue-report-sheet')).not.toBeInTheDocument()
  })

  it('renders IssueReportSheet when pendingReport is set', async () => {
    useUIStore.setState({ pendingReport: { pinId: 'p2' } })
    await act(async () => { render(<App />) })
    expect(screen.getByTestId('issue-report-sheet')).toBeInTheDocument()
  })

  it('passes correct pinId prop to IssueReportSheet', async () => {
    useUIStore.setState({ pendingReport: { pinId: 'p2' } })
    await act(async () => { render(<App />) })
    expect(screen.getByTestId('issue-report-sheet')).toHaveAttribute('data-pin-id', 'p2')
  })
})
