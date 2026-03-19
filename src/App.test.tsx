import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import App from './App'
import { DEVICE_ID_KEY } from '@/hooks/useDeviceId'

// Mock all lazy-loaded routes — prevents dynamic import resolution in jsdom
vi.mock('@/features/map/MapView', () => ({ default: () => null }))
vi.mock('@/features/rig-profile/OnboardingScreen', () => ({ default: () => null }))
vi.mock('@/features/rig-profile/RigEditScreen', () => ({ default: () => null }))
vi.mock('@/features/pin-detail/PinDetailSheet', () => ({ default: () => null }))
vi.mock('@/features/saved-spots/SavedSpotsScreen', () => ({ default: () => null }))
vi.mock('@/features/admin/AdminDashboard', () => ({ default: () => null }))

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
