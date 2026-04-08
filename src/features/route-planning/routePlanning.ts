import { doesPinFitRig } from '@/lib/pins/doesPinFitRig'
import type { Pin } from '@/types/pin'
import type { RigProfile } from '@/types/rigProfile'
import type { Trip, TripPlaceSnapshot, TripStop, TripStopSource, TripWaypointInput, TripWritePayload } from '@/types/trip'
import type { TripPlanPlace } from '@/types/tripPlan'

export interface RoutePoint {
  latitude: number
  longitude: number
}

export interface RouteSuggestion {
  pin: Pin
  detourMiles: number
  originDistanceMiles: number
  destinationDistanceMiles: number
  score: number
}

export const MAX_TRIP_STOPS = 12
export const MAX_TRIP_WAYPOINTS = MAX_TRIP_STOPS - 1
export const DUPLICATE_TRIP_STOP_MESSAGE = 'That stop is already part of this route.'
export const MAX_TRIP_STOPS_MESSAGE = `You can add up to ${MAX_TRIP_STOPS} total stops including the destination.`
export const MIN_ROUTE_SUGGESTION_TRIP_DISTANCE_MILES = 40
export const DEFAULT_ROUTE_SUGGESTION_LIMIT = 5

export function appendUniqueWaypoint(
  currentWaypoints: TripPlanPlace[],
  nextWaypoint: TripPlanPlace,
): TripPlanPlace[] {
  if (currentWaypoints.some((waypoint) => waypoint.id === nextWaypoint.id)) {
    return currentWaypoints.filter((waypoint) => waypoint.id !== nextWaypoint.id)
  }

  return [...currentWaypoints, nextWaypoint]
}

export function moveWaypoint<T>(
  currentWaypoints: T[],
  index: number,
  direction: 'up' | 'down',
): T[] {
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || index >= currentWaypoints.length) return currentWaypoints
  if (targetIndex < 0 || targetIndex >= currentWaypoints.length) return currentWaypoints

  const nextWaypoints = [...currentWaypoints]
  const [item] = nextWaypoints.splice(index, 1)
  nextWaypoints.splice(targetIndex, 0, item)
  return nextWaypoints
}

export function pinToTripPlaceSnapshot(pin: Pick<Pin, 'id' | 'name' | 'latitude' | 'longitude'>): TripPlaceSnapshot {
  return {
    id: pin.id,
    name: pin.name,
    latitude: pin.latitude,
    longitude: pin.longitude,
  }
}

export function pinToTripWaypointInput(
  pin: Pick<Pin, 'id' | 'name' | 'latitude' | 'longitude'>,
  source: TripStopSource = 'manual',
): TripWaypointInput {
  return {
    stopOrder: 0,
    source,
    pinId: pin.id,
    place: pinToTripPlaceSnapshot(pin),
    notes: '',
  }
}

export function tripStopToWaypointInput(stop: Pick<TripStop, 'id' | 'stopOrder' | 'source' | 'pinId' | 'place' | 'notes'>): TripWaypointInput {
  return {
    id: stop.id,
    stopOrder: stop.stopOrder,
    source: stop.source,
    pinId: stop.pinId,
    place: stop.place,
    notes: stop.notes,
  }
}

export function compactTripWaypointOrders(stops: TripWaypointInput[]): TripWaypointInput[] {
  return stops.map((stop, index) => ({
    ...stop,
    stopOrder: index,
  }))
}

export interface TripCorridorStopMarker extends RoutePoint {
  stopOrder: number
  name: string
}

export interface TripCorridorPreview {
  linePoints: RoutePoint[]
  stopMarkers: TripCorridorStopMarker[]
}

export function buildTripCorridorPreview(trip: Pick<Trip, 'origin' | 'destination' | 'stops'> | null | undefined): TripCorridorPreview {
  if (!trip) {
    return {
      linePoints: [],
      stopMarkers: [],
    }
  }

  const orderedWaypoints = [...trip.stops]
    .filter((stop) => stop.stopKind === 'waypoint')
    .sort((left, right) => left.stopOrder - right.stopOrder)

  return {
    linePoints: [
      ...(trip.origin ? [{
        latitude: trip.origin.latitude,
        longitude: trip.origin.longitude,
      }] : []),
      ...orderedWaypoints.map((stop) => ({
        latitude: stop.place.latitude,
        longitude: stop.place.longitude,
      })),
      {
        latitude: trip.destination.latitude,
        longitude: trip.destination.longitude,
      },
    ],
    stopMarkers: orderedWaypoints.map((stop, index) => ({
      stopOrder: index,
      name: stop.place.name,
      latitude: stop.place.latitude,
      longitude: stop.place.longitude,
    })),
  }
}

export function appendTripWaypoint(
  currentStops: TripWaypointInput[],
  nextStop: TripWaypointInput,
  {
    originId,
    destinationId,
  }: {
    originId?: string | null
    destinationId?: string | null
  } = {},
): { stops: TripWaypointInput[]; error: string | null } {
  const nextPlaceId = nextStop.place.id
  const isDuplicate =
    currentStops.some((stop) => stop.place.id === nextPlaceId)
    || originId === nextPlaceId
    || destinationId === nextPlaceId

  if (isDuplicate) {
    return { stops: currentStops, error: DUPLICATE_TRIP_STOP_MESSAGE }
  }

  if (currentStops.length >= MAX_TRIP_WAYPOINTS) {
    return { stops: currentStops, error: MAX_TRIP_STOPS_MESSAGE }
  }

  return {
    stops: [
      ...currentStops,
      {
        ...nextStop,
        stopOrder: currentStops.length,
      },
    ],
    error: null,
  }
}

export function removeTripWaypoint(
  currentStops: TripWaypointInput[],
  stopIdentifier: string,
): TripWaypointInput[] {
  return compactTripWaypointOrders(currentStops.filter((stop) => stop.id !== stopIdentifier && stop.place.id !== stopIdentifier))
}

const DUPLICATE_TITLE_SUFFIX = ' (copy)'
const MAX_TRIP_TITLE_LENGTH = 160

export function buildDuplicateTripPayload(trip: Trip): TripWritePayload {
  const maxBaseLength = MAX_TRIP_TITLE_LENGTH - DUPLICATE_TITLE_SUFFIX.length
  const baseTitle = trip.title.length > maxBaseLength ? trip.title.slice(0, maxBaseLength) : trip.title
  const title = `${baseTitle}${DUPLICATE_TITLE_SUFFIX}`

  const waypointStops = trip.stops
    .filter((stop) => stop.stopKind === 'waypoint')
    .sort((a, b) => a.stopOrder - b.stopOrder)
    .map((stop, index): TripWaypointInput => ({
      stopOrder: index,
      source: stop.source,
      pinId: stop.pinId,
      place: stop.place,
      notes: stop.notes,
    }))

  return {
    title,
    notes: trip.notes,
    origin: trip.origin,
    destination: trip.destination,
    routeMode: trip.routeMode,
    stops: waypointStops,
    sourceTripId: trip.id,
  }
}

interface BuildRouteSuggestionsOptions {
  pins: Pin[]
  origin: RoutePoint | null
  destination: RoutePoint
  rigProfile: RigProfile
  limit?: number
}

const BADGE_PENALTIES: Record<Pin['badgeState'], number> = {
  green: 0,
  yellow: 8,
  red: 18,
  grey: 12,
}

export function distanceMiles(a: RoutePoint, b: RoutePoint): number {
  const earthRadiusMiles = 3959
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180
  const lat1 = (a.latitude * Math.PI) / 180
  const lat2 = (b.latitude * Math.PI) / 180

  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

export function buildRouteSuggestions({
  pins,
  origin,
  destination,
  rigProfile,
  limit = DEFAULT_ROUTE_SUGGESTION_LIMIT,
}: BuildRouteSuggestionsOptions): RouteSuggestion[] {
  if (!origin) return []

  const tripDistance = distanceMiles(origin, destination)
  if (tripDistance < MIN_ROUTE_SUGGESTION_TRIP_DISTANCE_MILES) return []

  const maxDetourMiles = Math.max(30, tripDistance * 0.35)

  return pins
    .filter((pin) => pin.amenities.overnight)
    .filter((pin) => doesPinFitRig(pin, rigProfile))
    .map((pin) => {
      const point = { latitude: pin.latitude, longitude: pin.longitude }
      const originDistanceMiles = distanceMiles(origin, point)
      const destinationDistanceMiles = distanceMiles(point, destination)
      const detourMiles = originDistanceMiles + destinationDistanceMiles - tripDistance
      const verificationPenalty = pin.isVerified ? 0 : 10
      const recencyPenalty = BADGE_PENALTIES[pin.badgeState]
      const score = detourMiles * 2 + verificationPenalty + recencyPenalty + destinationDistanceMiles * 0.02

      return {
        pin,
        detourMiles,
        originDistanceMiles,
        destinationDistanceMiles,
        score,
      }
    })
    .filter((suggestion) => suggestion.originDistanceMiles > 10)
    .filter((suggestion) => suggestion.destinationDistanceMiles > 10)
    .filter((suggestion) => suggestion.detourMiles >= 0)
    .filter((suggestion) => suggestion.detourMiles <= maxDetourMiles)
    .sort((left, right) => left.score - right.score)
    .slice(0, limit)
}
