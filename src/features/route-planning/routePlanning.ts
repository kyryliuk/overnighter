import { doesPinFitRig } from '@/lib/pins/doesPinFitRig'
import type { Pin } from '@/types/pin'
import type { RigProfile } from '@/types/rigProfile'
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

export function appendUniqueWaypoint(
  currentWaypoints: TripPlanPlace[],
  nextWaypoint: TripPlanPlace,
): TripPlanPlace[] {
  if (currentWaypoints.some((waypoint) => waypoint.id === nextWaypoint.id)) {
    return currentWaypoints.filter((waypoint) => waypoint.id !== nextWaypoint.id)
  }

  return [...currentWaypoints, nextWaypoint]
}

export function moveWaypoint(
  currentWaypoints: TripPlanPlace[],
  index: number,
  direction: 'up' | 'down',
): TripPlanPlace[] {
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || index >= currentWaypoints.length) return currentWaypoints
  if (targetIndex < 0 || targetIndex >= currentWaypoints.length) return currentWaypoints

  const nextWaypoints = [...currentWaypoints]
  const [item] = nextWaypoints.splice(index, 1)
  nextWaypoints.splice(targetIndex, 0, item)
  return nextWaypoints
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
  limit = 5,
}: BuildRouteSuggestionsOptions): RouteSuggestion[] {
  if (!origin) return []

  const tripDistance = distanceMiles(origin, destination)
  if (tripDistance < 40) return []

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
