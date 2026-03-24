export interface BBox {
  north: number
  south: number
  east: number
  west: number
}

export interface TileCoord {
  x: number
  y: number
  z: number
}

/**
 * Convert longitude/latitude to tile coordinates at a given zoom level.
 * Standard OSM slippy map tile formula.
 */
export function lngLatToTile(lng: number, lat: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom)
  const x = Math.floor(((lng + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  )
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) }
}

/**
 * Get all tile coordinates for a bounding box at a given zoom level.
 * Handles antimeridian crossing (west > east) by splitting into two ranges.
 */
export function getTilesForBbox(bbox: BBox, zoom: number): TileCoord[] {
  const n = Math.pow(2, zoom)
  const topLeft = lngLatToTile(bbox.west, bbox.north, zoom)
  const bottomRight = lngLatToTile(bbox.east, bbox.south, zoom)
  const tiles: TileCoord[] = []

  if (topLeft.x <= bottomRight.x) {
    for (let x = topLeft.x; x <= bottomRight.x; x++) {
      for (let y = topLeft.y; y <= bottomRight.y; y++) {
        tiles.push({ x, y, z: zoom })
      }
    }
  } else {
    // Antimeridian crossing: west side (topLeft.x → n-1), then east side (0 → bottomRight.x)
    for (let x = topLeft.x; x < n; x++) {
      for (let y = topLeft.y; y <= bottomRight.y; y++) {
        tiles.push({ x, y, z: zoom })
      }
    }
    for (let x = 0; x <= bottomRight.x; x++) {
      for (let y = topLeft.y; y <= bottomRight.y; y++) {
        tiles.push({ x, y, z: zoom })
      }
    }
  }

  return tiles
}

/**
 * Estimate total number of tiles for a bbox across multiple zoom levels.
 */
export function estimateTileCount(bbox: BBox, zoomLevels: readonly number[]): number {
  return zoomLevels.reduce((total, zoom) => total + getTilesForBbox(bbox, zoom).length, 0)
}
