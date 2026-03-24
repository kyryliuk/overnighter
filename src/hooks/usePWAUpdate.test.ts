import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePWAUpdate } from './usePWAUpdate'
import { useUIStore } from '@/store/uiStore'

const mockUpdateServiceWorker = vi.fn()
let mockNeedRefresh = false

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [mockNeedRefresh, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: mockUpdateServiceWorker,
  }),
}))

describe('usePWAUpdate', () => {
  beforeEach(() => {
    mockNeedRefresh = false
    mockUpdateServiceWorker.mockClear()
    useUIStore.setState({ updateAvailable: false })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes needRefresh as a boolean', () => {
    const { result } = renderHook(() => usePWAUpdate())
    expect(typeof result.current.needRefresh).toBe('boolean')
  })

  it('exposes updateServiceWorker as a function', () => {
    const { result } = renderHook(() => usePWAUpdate())
    expect(typeof result.current.updateServiceWorker).toBe('function')
  })

  it('returns needRefresh as false when no update available', () => {
    mockNeedRefresh = false
    const { result } = renderHook(() => usePWAUpdate())
    expect(result.current.needRefresh).toBe(false)
  })

  it('returns the updateServiceWorker function from useRegisterSW', () => {
    const { result } = renderHook(() => usePWAUpdate())
    expect(result.current.updateServiceWorker).toBe(mockUpdateServiceWorker)
  })

  it('sets updateAvailable in uiStore when needRefresh is true', () => {
    mockNeedRefresh = true
    renderHook(() => usePWAUpdate())
    expect(useUIStore.getState().updateAvailable).toBe(true)
  })
})
