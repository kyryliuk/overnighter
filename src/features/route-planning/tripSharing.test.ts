import { describe, expect, it } from 'vitest'
import type { TripPlan } from '@/types/tripPlan'
import { buildTripShareUrl, clearTripShareState, createTripCopyDraft } from './tripSharing'

describe('buildTripShareUrl', () => {
  it('builds an absolute shared trip url from the current origin', () => {
    expect(buildTripShareUrl('https://overnighter.app', 'share-123')).toBe(
      'https://overnighter.app/shared-trip/share-123',
    )
  })
})

describe('createTripCopyDraft', () => {
  it('creates a private editable copy of a shared trip', () => {
    const trip: TripPlan = {
      id: 'trip-1',
      title: 'Snowbird Run',
      notes: 'Stop for fuel before crossing the state line.',
      destination: { id: 'dest', name: 'Quartzsite', latitude: 33.6, longitude: -114.2 },
      stops: [{ id: 'stop', name: 'Pilot', latitude: 34, longitude: -113 }],
      isPublic: true,
      shareToken: 'share-123',
      createdAt: '2026-03-23T00:00:00.000Z',
      updatedAt: '2026-03-23T00:00:00.000Z',
    }

    expect(createTripCopyDraft(trip)).toEqual({
      title: 'Snowbird Run (copy)',
      notes: 'Stop for fuel before crossing the state line.',
      destination: trip.destination,
      stops: trip.stops,
      isPublic: false,
      shareToken: null,
      sourceTrip: {
        shareToken: 'share-123',
        title: 'Snowbird Run',
      },
    })
  })
})

describe('clearTripShareState', () => {
  it('removes public sharing metadata from a trip plan', () => {
    const trip: TripPlan = {
      id: 'trip-1',
      title: 'Snowbird Run',
      notes: 'Original trip note',
      destination: { id: 'dest', name: 'Quartzsite', latitude: 33.6, longitude: -114.2 },
      stops: [],
      isPublic: true,
      shareToken: 'share-123',
      sourceTrip: {
        shareToken: 'parent-share-456',
        title: 'Earlier trip',
      },
      createdAt: '2026-03-23T00:00:00.000Z',
      updatedAt: '2026-03-23T00:00:00.000Z',
    }

    expect(clearTripShareState(trip)).toMatchObject({
      id: 'trip-1',
      notes: 'Original trip note',
      isPublic: false,
      shareToken: null,
      sourceTrip: {
        shareToken: 'parent-share-456',
        title: 'Earlier trip',
      },
    })
  })
})
