import { describe, it, expect } from 'vitest'
import { lngLatToTile, getTilesForBbox, estimateTileCount } from './tileMath'
import type { BBox } from './tileMath'

describe('lngLatToTile', () => {
  it('converts center of the world (0, 0) at zoom 0 to tile (0, 0)', () => {
    const tile = lngLatToTile(0, 0, 0)
    expect(tile).toEqual({ x: 0, y: 0 })
  })

  it('converts (0, 0) at zoom 1 to tile (1, 1)', () => {
    const tile = lngLatToTile(0, 0, 1)
    expect(tile).toEqual({ x: 1, y: 1 })
  })

  it('converts a known Florida location at zoom 12', () => {
    // Orlando, FL: approx 28.5384, -81.3789
    const tile = lngLatToTile(-81.3789, 28.5384, 12)
    expect(tile.x).toBe(1122)
    expect(tile.y).toBe(1708)
  })

  it('converts New York City at zoom 10', () => {
    // NYC: approx 40.7128, -74.006
    const tile = lngLatToTile(-74.006, 40.7128, 10)
    expect(tile.x).toBe(301)
    expect(tile.y).toBe(385)
  })

  it('clamps x and y to valid tile range', () => {
    // -180 lng at zoom 1 should clamp to 0
    const tile = lngLatToTile(-180, 0, 1)
    expect(tile.x).toBeGreaterThanOrEqual(0)
    expect(tile.x).toBeLessThan(2)
  })

  it('handles high latitudes near the poles', () => {
    const tile = lngLatToTile(0, 85, 2)
    expect(tile.y).toBe(0)
  })
})

describe('getTilesForBbox', () => {
  const smallBbox: BBox = {
    north: 28.6,
    south: 28.5,
    east: -81.3,
    west: -81.4,
  }

  it('returns an array of tile coordinates', () => {
    const tiles = getTilesForBbox(smallBbox, 12)
    expect(tiles.length).toBeGreaterThan(0)
    tiles.forEach((t) => {
      expect(t).toHaveProperty('x')
      expect(t).toHaveProperty('y')
      expect(t.z).toBe(12)
    })
  })

  it('returns more tiles at higher zoom levels', () => {
    const tilesZ10 = getTilesForBbox(smallBbox, 10)
    const tilesZ14 = getTilesForBbox(smallBbox, 14)
    expect(tilesZ14.length).toBeGreaterThan(tilesZ10.length)
  })

  it('returns a single tile for a point bbox at low zoom', () => {
    const pointBbox: BBox = { north: 28.5, south: 28.5, east: -81.3, west: -81.3 }
    const tiles = getTilesForBbox(pointBbox, 1)
    expect(tiles.length).toBe(1)
  })

  it('covers the entire bbox area', () => {
    const tiles = getTilesForBbox(smallBbox, 12)
    const topLeft = tiles[0]
    const bottomRight = tiles[tiles.length - 1]
    expect(topLeft.x).toBeLessThanOrEqual(bottomRight.x)
    expect(topLeft.y).toBeLessThanOrEqual(bottomRight.y)
  })

  it('handles antimeridian crossing (west > east in tile coords)', () => {
    // Bbox crossing the antimeridian: Fiji area
    const antimeridianBbox: BBox = { north: -16, south: -18, east: -179.5, west: 179.5 }
    const tiles = getTilesForBbox(antimeridianBbox, 4)
    expect(tiles.length).toBeGreaterThan(0)
    // Should have tiles from both sides of the antimeridian
    const xValues = tiles.map((t) => t.x)
    const hasHighX = xValues.some((x) => x >= 15) // near tile max at zoom 4
    const hasLowX = xValues.some((x) => x <= 0)
    expect(hasHighX).toBe(true)
    expect(hasLowX).toBe(true)
  })
})

describe('estimateTileCount', () => {
  const metroBbox: BBox = {
    north: 28.8,
    south: 28.3,
    east: -81.0,
    west: -81.6,
  }

  it('sums tiles across multiple zoom levels', () => {
    const count = estimateTileCount(metroBbox, [10, 11, 12])
    const countZ10 = getTilesForBbox(metroBbox, 10).length
    const countZ11 = getTilesForBbox(metroBbox, 11).length
    const countZ12 = getTilesForBbox(metroBbox, 12).length
    expect(count).toBe(countZ10 + countZ11 + countZ12)
  })

  it('returns 0 for empty zoom levels array', () => {
    expect(estimateTileCount(metroBbox, [])).toBe(0)
  })

  it('returns reasonable count for typical metro bbox at zoom 10-14', () => {
    const count = estimateTileCount(metroBbox, [10, 11, 12, 13, 14])
    expect(count).toBeGreaterThan(10)
    expect(count).toBeLessThan(2000)
  })
})
