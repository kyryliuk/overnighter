import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(() => true),
}))

vi.mock('@/lib/offline/pendingCheckins', () => ({
  readPendingCheckins: vi.fn(() => []),
  removePendingCheckin: vi.fn(),
}))

import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { readPendingCheckins, removePendingCheckin } from '@/lib/offline/pendingCheckins'
import { useOfflineCheckinQueue } from './useOfflineCheckinQueue'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('useOfflineCheckinQueue', () => {
  const pending = [
    {
      pinId: 'p1',
      deviceId: 'd1',
      status: 'still_open',
      timestamp: '2024-06-15T12:00:00Z',
      queuedAt: 'q1',
    },
    {
      pinId: 'p2',
      deviceId: 'd1',
      status: 'closed',
      timestamp: '2024-06-15T12:01:00Z',
      queuedAt: 'q2',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.mocked(useOnlineStatus).mockReturnValue(true)
    vi.mocked(readPendingCheckins).mockReturnValue([])
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not flush when offline', () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    vi.mocked(readPendingCheckins).mockReturnValue([...pending])
    renderHook(() => useOfflineCheckinQueue())
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('flushes pending check-ins on mount when online', async () => {
    vi.mocked(readPendingCheckins).mockReturnValue([pending[0]])
    mockFetch.mockResolvedValueOnce({ ok: true })

    renderHook(() => useOfflineCheckinQueue())

    // Let the async flush complete
    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/checkin',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(removePendingCheckin).toHaveBeenCalledWith('q1')
  })

  it('removes successfully submitted check-ins from queue', async () => {
    vi.mocked(readPendingCheckins).mockReturnValue([...pending])
    mockFetch.mockResolvedValue({ ok: true })

    renderHook(() => useOfflineCheckinQueue())

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(removePendingCheckin).toHaveBeenCalledWith('q1')
    expect(removePendingCheckin).toHaveBeenCalledWith('q2')
  })

  it('removes check-ins with 4xx client errors (poison queue prevention)', async () => {
    vi.mocked(readPendingCheckins).mockReturnValue([pending[0]])
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 })

    renderHook(() => useOfflineCheckinQueue())

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    // 4xx = bad data, removed after 1 attempt (no retry)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(removePendingCheckin).toHaveBeenCalledWith('q1')
  })

  it('retains failed check-ins in queue after retries on 5xx', async () => {
    vi.mocked(readPendingCheckins).mockReturnValue([pending[0]])
    mockFetch.mockResolvedValue({ ok: false, status: 500 })

    renderHook(() => useOfflineCheckinQueue())

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    // 3 retry attempts for server errors
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(removePendingCheckin).not.toHaveBeenCalled()
  })

  it('flushes on online event (reconnect)', async () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    vi.mocked(readPendingCheckins).mockReturnValue([pending[0]])

    const { rerender } = renderHook(() => useOfflineCheckinQueue())

    expect(mockFetch).not.toHaveBeenCalled()

    // Simulate reconnect
    vi.mocked(useOnlineStatus).mockReturnValue(true)
    mockFetch.mockResolvedValueOnce({ ok: true })

    rerender()

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(mockFetch).toHaveBeenCalled()
    expect(removePendingCheckin).toHaveBeenCalledWith('q1')
  })
})
