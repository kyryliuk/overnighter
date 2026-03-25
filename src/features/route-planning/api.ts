import type { Trip, TripWritePayload } from '@/types/trip'

interface TripsResponse {
  trips?: Trip[]
  message?: string
}

interface TripResponse {
  trip?: Trip
  message?: string
}

export async function fetchTrips(accessToken: string) {
  const response = await fetch('/api/trips', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const payload = await response.json().catch(() => ({} satisfies TripsResponse)) as TripsResponse

  if (!response.ok) {
    throw new Error(payload.message ?? 'Unable to load your routes right now.')
  }

  return payload.trips ?? []
}

export async function fetchTrip(accessToken: string, tripId: string) {
  const response = await fetch(`/api/trips/${encodeURIComponent(tripId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const payload = await response.json().catch(() => ({} satisfies TripResponse)) as TripResponse

  if (!response.ok || !payload.trip) {
    if (response.status === 404) {
      throw new Error(payload.message ?? 'We couldn\'t find that saved route.')
    }

    if (response.status === 400) {
      throw new Error(payload.message ?? 'That route link is invalid.')
    }

    throw new Error(payload.message ?? 'Unable to reopen this route right now.')
  }

  return payload.trip
}

export async function createTrip(accessToken: string, payload: TripWritePayload) {
  const response = await fetch('/api/trips', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  const responsePayload = await response.json().catch(() => ({} satisfies TripResponse)) as TripResponse

  if (!response.ok || !responsePayload.trip) {
    throw new Error(responsePayload.message ?? 'Unable to save your route right now.')
  }

  return responsePayload.trip
}

export async function updateTrip(accessToken: string, tripId: string, payload: TripWritePayload) {
  const response = await fetch(`/api/trips/${encodeURIComponent(tripId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  const responsePayload = await response.json().catch(() => ({} satisfies TripResponse)) as TripResponse

  if (!response.ok || !responsePayload.trip) {
    throw new Error(responsePayload.message ?? 'Unable to update your route right now.')
  }

  return responsePayload.trip
}
