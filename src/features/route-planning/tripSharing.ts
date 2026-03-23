import type { TripPlan } from '@/types/tripPlan'

export function buildTripShareUrl(origin: string, shareToken: string): string {
  return new URL(`/shared-trip/${shareToken}`, origin).toString()
}

export function createTripCopyDraft(tripPlan: TripPlan): Omit<TripPlan, 'id' | 'createdAt' | 'updatedAt'> {
  const sourceShareToken = tripPlan.shareToken ?? tripPlan.sourceTrip?.shareToken ?? null

  return {
    title: `${tripPlan.title} (copy)`,
    notes: tripPlan.notes,
    destination: tripPlan.destination,
    stops: tripPlan.stops,
    isPublic: false,
    shareToken: null,
    sourceTrip: sourceShareToken
      ? {
        shareToken: sourceShareToken,
        title: tripPlan.title,
      }
      : tripPlan.sourceTrip,
  }
}

export function clearTripShareState(tripPlan: TripPlan): TripPlan {
  return {
    ...tripPlan,
    isPublic: false,
    shareToken: null,
  }
}
