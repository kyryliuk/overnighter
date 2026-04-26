import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  readPendingTripMutations,
  appendPendingTripMutation,
  removePendingTripMutation,
  clearPendingTripMutations,
  PENDING_TRIP_MUTATIONS_UPDATED_EVENT,
  OFFLINE_QUEUED_ERROR,
} from './pendingTripMutations'
import type { PendingTripMutation } from './pendingTripMutations'

const makeMutation = (overrides?: Partial<PendingTripMutation>): PendingTripMutation => ({
  id: 'mutation-1',
  kind: 'update',
  tripId: 'trip-1',
  queuedAt: '2024-06-15T12:00:00Z',
  ...overrides,
})

describe('pendingTripMutations', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('readPendingTripMutations', () => {
    it('returns empty array when no data', () => {
      expect(readPendingTripMutations()).toEqual([])
    })

    it('returns parsed mutations from localStorage', () => {
      const items = [makeMutation()]
      localStorage.setItem('pendingTripMutations', JSON.stringify(items))
      expect(readPendingTripMutations()).toEqual(items)
    })

    it('returns empty array for corrupt JSON', () => {
      localStorage.setItem('pendingTripMutations', 'not-json')
      expect(readPendingTripMutations()).toEqual([])
    })

    it('returns empty array for items failing the type guard', () => {
      localStorage.setItem('pendingTripMutations', JSON.stringify([{ bad: true }]))
      expect(readPendingTripMutations()).toEqual([])
    })

    it('returns empty array for non-array JSON', () => {
      localStorage.setItem('pendingTripMutations', JSON.stringify({ id: 'not-array' }))
      expect(readPendingTripMutations()).toEqual([])
    })
  })

  describe('appendPendingTripMutation', () => {
    it('adds to localStorage and dispatches event', () => {
      const handler = vi.fn()
      window.addEventListener(PENDING_TRIP_MUTATIONS_UPDATED_EVENT, handler)

      appendPendingTripMutation(makeMutation())
      expect(readPendingTripMutations()).toHaveLength(1)
      expect(handler).toHaveBeenCalledOnce()

      window.removeEventListener(PENDING_TRIP_MUTATIONS_UPDATED_EVENT, handler)
    })

    it('appends to existing items', () => {
      appendPendingTripMutation(makeMutation({ id: 'id-1', queuedAt: '2024-06-15T12:00:01Z' }))
      appendPendingTripMutation(makeMutation({ id: 'id-2', queuedAt: '2024-06-15T12:00:02Z' }))
      expect(readPendingTripMutations()).toHaveLength(2)
    })

    it('preserves prior items when appending', () => {
      appendPendingTripMutation(makeMutation({ id: 'first', kind: 'create' }))
      appendPendingTripMutation(makeMutation({ id: 'second', kind: 'delete' }))
      const queue = readPendingTripMutations()
      expect(queue[0].id).toBe('first')
      expect(queue[1].id).toBe('second')
    })
  })

  describe('removePendingTripMutation', () => {
    it('removes by id field', () => {
      appendPendingTripMutation(makeMutation({ id: 'id-1' }))
      appendPendingTripMutation(makeMutation({ id: 'id-2' }))
      removePendingTripMutation('id-1')
      const remaining = readPendingTripMutations()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].id).toBe('id-2')
    })

    it('dispatches event on removal', () => {
      appendPendingTripMutation(makeMutation({ id: 'id-1' }))
      const handler = vi.fn()
      window.addEventListener(PENDING_TRIP_MUTATIONS_UPDATED_EVENT, handler)
      removePendingTripMutation('id-1')
      expect(handler).toHaveBeenCalledOnce()
      window.removeEventListener(PENDING_TRIP_MUTATIONS_UPDATED_EVENT, handler)
    })

    it('is a no-op when id not found — does not write or dispatch', () => {
      appendPendingTripMutation(makeMutation({ id: 'id-1' }))
      const handler = vi.fn()
      window.addEventListener(PENDING_TRIP_MUTATIONS_UPDATED_EVENT, handler)
      expect(() => removePendingTripMutation('nonexistent')).not.toThrow()
      expect(readPendingTripMutations()).toHaveLength(1)
      expect(handler).not.toHaveBeenCalled()
      window.removeEventListener(PENDING_TRIP_MUTATIONS_UPDATED_EVENT, handler)
    })

    it('leaves other items intact', () => {
      appendPendingTripMutation(makeMutation({ id: 'keep-a' }))
      appendPendingTripMutation(makeMutation({ id: 'remove' }))
      appendPendingTripMutation(makeMutation({ id: 'keep-b' }))
      removePendingTripMutation('remove')
      const remaining = readPendingTripMutations()
      expect(remaining.map((m) => m.id)).toEqual(['keep-a', 'keep-b'])
    })
  })

  describe('clearPendingTripMutations', () => {
    it('empties the queue', () => {
      appendPendingTripMutation(makeMutation({ id: 'id-1' }))
      appendPendingTripMutation(makeMutation({ id: 'id-2' }))
      clearPendingTripMutations()
      expect(readPendingTripMutations()).toEqual([])
    })

    it('dispatches event on clear', () => {
      const handler = vi.fn()
      window.addEventListener(PENDING_TRIP_MUTATIONS_UPDATED_EVENT, handler)
      clearPendingTripMutations()
      expect(handler).toHaveBeenCalledOnce()
      window.removeEventListener(PENDING_TRIP_MUTATIONS_UPDATED_EVENT, handler)
    })

    it('dispatches event even when queue is already empty', () => {
      const handler = vi.fn()
      window.addEventListener(PENDING_TRIP_MUTATIONS_UPDATED_EVENT, handler)
      clearPendingTripMutations()
      expect(readPendingTripMutations()).toEqual([])
      expect(handler).toHaveBeenCalledOnce()
      window.removeEventListener(PENDING_TRIP_MUTATIONS_UPDATED_EVENT, handler)
    })
  })

  describe('OFFLINE_QUEUED_ERROR', () => {
    it('is a non-empty string sentinel', () => {
      expect(typeof OFFLINE_QUEUED_ERROR).toBe('string')
      expect(OFFLINE_QUEUED_ERROR.length).toBeGreaterThan(0)
    })
  })
})
