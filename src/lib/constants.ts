export const CACHE_NAMES = {
  MAP_TILES: 'map-tiles',
  OSM_TILES: 'osm-tiles',
  PINS: 'pins-cache',
  APP_SHELL: 'app-shell', // Reserved for Story 3.3 UpdateBanner
  OFFLINE_TILES: 'offline-tiles-meta',
} as const

export const OFFLINE_ZOOM_LEVELS = [10, 11, 12, 13, 14] as const
export const OFFLINE_REGION_KEY = 'offlineCachedRegion'
export const MAX_OFFLINE_TILES = 2000
