import { describe, it, expect, beforeEach } from 'vitest'
import { useSpotsStore } from './spotsStore'
import type { Pin } from '@/types/pin'

const mockPin: Pin = {
  id: 'pin-1',
  name: 'Test Camp',
  description: null,
  latitude: 35.1,
  longitude: -111.6,
  pinType: 'blm',
  sourceId: null,
  maxLengthFt: null,
  maxHeightFt: null,
  amenities: { water: false, dump: false, electric: false, shower: false, fuel: false, propane: false, overnight: true },
  badgeState: 'green',
  lastCheckInAt: null,
  recentCheckInCount: 0,
  isVerified: false,
  isFlagged: false,
  createdAt: '2026-03-17T00:00:00Z',
  updatedAt: '2026-03-17T00:00:00Z',
}

beforeEach(() => {
  localStorage.clear()
  useSpotsStore.setState({ savedSpots: [] })
})

describe('useSpotsStore', () => {
  it('starts with empty saved spots', () => {
    expect(useSpotsStore.getState().savedSpots).toHaveLength(0)
  })

  it('saves a spot', () => {
    useSpotsStore.getState().saveSpot(mockPin)
    expect(useSpotsStore.getState().savedSpots).toHaveLength(1)
    expect(useSpotsStore.getState().savedSpots[0].id).toBe('pin-1')
  })

  it('isSaved returns true for saved pin', () => {
    useSpotsStore.getState().saveSpot(mockPin)
    expect(useSpotsStore.getState().isSaved('pin-1')).toBe(true)
  })

  it('isSaved returns false for unsaved pin', () => {
    expect(useSpotsStore.getState().isSaved('pin-99')).toBe(false)
  })

  it('removes a spot', () => {
    useSpotsStore.getState().saveSpot(mockPin)
    useSpotsStore.getState().removeSpot('pin-1')
    expect(useSpotsStore.getState().savedSpots).toHaveLength(0)
    expect(useSpotsStore.getState().isSaved('pin-1')).toBe(false)
  })

  it('saving same pin again does not duplicate', () => {
    useSpotsStore.getState().saveSpot(mockPin)
    useSpotsStore.getState().saveSpot(mockPin)
    expect(useSpotsStore.getState().savedSpots).toHaveLength(1)
  })
})
