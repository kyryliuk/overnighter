import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  readPendingCheckins,
  appendPendingCheckin,
  removePendingCheckin,
  clearPendingCheckins,
  PENDING_CHECKINS_UPDATED_EVENT,
} from './pendingCheckins'
import type { PendingCheckIn } from './pendingCheckins'

const makePending = (overrides?: Partial<PendingCheckIn>): PendingCheckIn => ({
  pinId: 'pin-1',
  deviceId: 'dev-1',
  status: 'still_open',
  timestamp: '2024-06-15T12:00:00Z',
  queuedAt: '2024-06-15T12:00:01Z',
  ...overrides,
})

describe('pendingCheckins', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('readPendingCheckins', () => {
    it('returns empty array when no data', () => {
      expect(readPendingCheckins()).toEqual([])
    })

    it('returns parsed check-ins from localStorage', () => {
      const items = [makePending()]
      localStorage.setItem('pendingCheckins', JSON.stringify(items))
      expect(readPendingCheckins()).toEqual(items)
    })

    it('returns empty array for corrupt data', () => {
      localStorage.setItem('pendingCheckins', 'not-json')
      expect(readPendingCheckins()).toEqual([])
    })

    it('returns empty array for invalid structure', () => {
      localStorage.setItem('pendingCheckins', JSON.stringify([{ bad: true }]))
      expect(readPendingCheckins()).toEqual([])
    })
  })

  describe('appendPendingCheckin', () => {
    it('adds to localStorage and dispatches event', () => {
      const handler = vi.fn()
      window.addEventListener(PENDING_CHECKINS_UPDATED_EVENT, handler)

      appendPendingCheckin(makePending())
      expect(readPendingCheckins()).toHaveLength(1)
      expect(handler).toHaveBeenCalledOnce()

      window.removeEventListener(PENDING_CHECKINS_UPDATED_EVENT, handler)
    })

    it('appends to existing items', () => {
      appendPendingCheckin(makePending({ queuedAt: '2024-06-15T12:00:01Z' }))
      appendPendingCheckin(makePending({ queuedAt: '2024-06-15T12:00:02Z' }))
      expect(readPendingCheckins()).toHaveLength(2)
    })
  })

  describe('removePendingCheckin', () => {
    it('removes by queuedAt key', () => {
      appendPendingCheckin(makePending({ queuedAt: 'q1' }))
      appendPendingCheckin(makePending({ queuedAt: 'q2' }))
      removePendingCheckin('q1')
      const remaining = readPendingCheckins()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].queuedAt).toBe('q2')
    })

    it('dispatches event on removal', () => {
      appendPendingCheckin(makePending({ queuedAt: 'q1' }))
      const handler = vi.fn()
      window.addEventListener(PENDING_CHECKINS_UPDATED_EVENT, handler)
      removePendingCheckin('q1')
      expect(handler).toHaveBeenCalledOnce()
      window.removeEventListener(PENDING_CHECKINS_UPDATED_EVENT, handler)
    })
  })

  describe('clearPendingCheckins', () => {
    it('empties the queue', () => {
      appendPendingCheckin(makePending())
      clearPendingCheckins()
      expect(readPendingCheckins()).toEqual([])
    })

    it('dispatches event on clear', () => {
      const handler = vi.fn()
      window.addEventListener(PENDING_CHECKINS_UPDATED_EVENT, handler)
      clearPendingCheckins()
      expect(handler).toHaveBeenCalledOnce()
      window.removeEventListener(PENDING_CHECKINS_UPDATED_EVENT, handler)
    })
  })
})
