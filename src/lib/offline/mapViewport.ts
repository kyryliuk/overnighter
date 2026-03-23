const MAP_VIEWPORT_KEY = 'map-viewport-v1'

export interface MapViewportSnapshot {
  center: [number, number]
  zoom: number
  updatedAt: string
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function isMapViewportSnapshot(value: unknown): value is MapViewportSnapshot {
  if (!value || typeof value !== 'object') return false

  const snapshot = value as Partial<MapViewportSnapshot>
  return (
    Array.isArray(snapshot.center) &&
    snapshot.center.length === 2 &&
    typeof snapshot.center[0] === 'number' &&
    typeof snapshot.center[1] === 'number' &&
    typeof snapshot.zoom === 'number' &&
    typeof snapshot.updatedAt === 'string'
  )
}

export function readMapViewportSnapshot(): MapViewportSnapshot | null {
  if (!canUseStorage()) return null

  const rawValue = localStorage.getItem(MAP_VIEWPORT_KEY)
  if (!rawValue) return null

  try {
    const parsedValue = JSON.parse(rawValue) as unknown
    return isMapViewportSnapshot(parsedValue) ? parsedValue : null
  } catch {
    return null
  }
}

export function saveMapViewportSnapshot(center: [number, number], zoom: number) {
  if (!canUseStorage()) return

  const snapshot: MapViewportSnapshot = {
    center,
    zoom,
    updatedAt: new Date().toISOString(),
  }

  localStorage.setItem(MAP_VIEWPORT_KEY, JSON.stringify(snapshot))
}
