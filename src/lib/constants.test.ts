import { describe, it, expect } from 'vitest'
import { CACHE_NAMES, MAX_OFFLINE_TILES } from './constants'

describe('CACHE_NAMES', () => {
  it('exports MAP_TILES as "map-tiles"', () => {
    expect(CACHE_NAMES.MAP_TILES).toBe('map-tiles')
  })

  it('exports PINS as "pins-cache"', () => {
    expect(CACHE_NAMES.PINS).toBe('pins-cache')
  })

  it('exports APP_SHELL as "app-shell"', () => {
    expect(CACHE_NAMES.APP_SHELL).toBe('app-shell')
  })

  it('exports OSM_TILES as "osm-tiles"', () => {
    expect(CACHE_NAMES.OSM_TILES).toBe('osm-tiles')
  })

  it('exports OFFLINE_TILES as "offline-tiles-meta"', () => {
    expect(CACHE_NAMES.OFFLINE_TILES).toBe('offline-tiles-meta')
  })

  it('has exactly five cache name entries', () => {
    expect(Object.keys(CACHE_NAMES)).toHaveLength(5)
  })
})

describe('MAX_OFFLINE_TILES', () => {
  it('exports a positive number', () => {
    expect(MAX_OFFLINE_TILES).toBeGreaterThan(0)
    expect(MAX_OFFLINE_TILES).toBe(2000)
  })
})
