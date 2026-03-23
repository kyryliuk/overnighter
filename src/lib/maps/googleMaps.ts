export interface MapCoordinate {
  latitude: number
  longitude: number
}

interface DirectionsOptions {
  destination: MapCoordinate
  origin?: MapCoordinate | null
  waypoints?: MapCoordinate[]
}

function formatCoordinate(point: MapCoordinate): string {
  return `${point.latitude},${point.longitude}`
}

export function buildMapsUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`
}

export function buildDirectionsUrl({ destination, origin, waypoints = [] }: DirectionsOptions): string {
  const params = new URLSearchParams({
    api: '1',
    destination: formatCoordinate(destination),
    travelmode: 'driving',
  })

  if (origin) {
    params.set('origin', formatCoordinate(origin))
  }

  if (waypoints.length > 0) {
    params.set(
      'waypoints',
      waypoints
        .slice(0, 5)
        .map((waypoint) => formatCoordinate(waypoint))
        .join('|'),
    )
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`
}
