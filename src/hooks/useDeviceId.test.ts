import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDeviceId, DEVICE_ID_KEY } from './useDeviceId'

// Valid UUID4 format — matches the real crypto.randomUUID() output shape
const STUB_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

describe('useDeviceId', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => STUB_UUID) })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('generates a UUID on first call and stores it in localStorage', () => {
    const { result } = renderHook(() => useDeviceId())
    expect(result.current).toBe(STUB_UUID)
    expect(localStorage.getItem(DEVICE_ID_KEY)).toBe(STUB_UUID)
  })

  it('calls crypto.randomUUID() exactly once when no existing device ID', () => {
    renderHook(() => useDeviceId())
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
  })

  it('returns existing UUID from localStorage without calling randomUUID', () => {
    const existingId = 'existing-device-uuid'
    localStorage.setItem(DEVICE_ID_KEY, existingId)
    const { result } = renderHook(() => useDeviceId())
    expect(result.current).toBe(existingId)
    expect(crypto.randomUUID).not.toHaveBeenCalled()
  })

  it('returns the same UUID on subsequent hook invocations (simulates app reopen)', () => {
    const { result: r1 } = renderHook(() => useDeviceId())
    const { result: r2 } = renderHook(() => useDeviceId())
    expect(r2.current).toBe(r1.current)
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
  })

  it('stores device ID under dedicated key separate from rig profile', () => {
    renderHook(() => useDeviceId())
    expect(localStorage.getItem(DEVICE_ID_KEY)).toBe(STUB_UUID)
    expect(localStorage.getItem('rig-profile')).toBeNull()
  })

  it('always returns a non-empty string', () => {
    const { result } = renderHook(() => useDeviceId())
    expect(typeof result.current).toBe('string')
    expect(result.current.length).toBeGreaterThan(0)
  })

  it('generates a new UUID when existing localStorage value is empty string', () => {
    localStorage.setItem(DEVICE_ID_KEY, '')
    const { result } = renderHook(() => useDeviceId())
    expect(result.current).toBe(STUB_UUID)
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
  })
})
