/// <reference lib="webworker" />

import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CACHE_NAMES } from './lib/constants'
import { getTilesForBbox } from './lib/tileMath'
import type { BBox } from './lib/tileMath'

declare const self: ServiceWorkerGlobalScope

// Precache static assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST)

// CartoDB Light map tiles — CacheFirst, max 500 entries, 30-day expiry
registerRoute(
  ({ url }) => url.hostname.includes('basemaps.cartocdn.com'),
  new CacheFirst({
    cacheName: CACHE_NAMES.MAP_TILES,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
)

// OSM tiles — CacheFirst (maintaining parity with existing generateSW config)
registerRoute(
  ({ url }) => url.hostname.includes('tile.openstreetmap.org'),
  new CacheFirst({
    cacheName: CACHE_NAMES.OSM_TILES,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
)

// Pins API — StaleWhileRevalidate, max 50 entries, 24-hour expiry
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname.endsWith('/rest/v1/pins'),
  new StaleWhileRevalidate({
    cacheName: CACHE_NAMES.PINS,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24,
      }),
    ],
  }),
)

// Push notification listener
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'Overnighter', options: {} }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      ...data.options,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const raw = event.notification.data?.url
  if (raw) {
    try {
      const parsed = new URL(raw, self.location.origin)
      if (parsed.origin !== self.location.origin) return
      event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then((windowClients) => {
          const existing = windowClients.find((c) => c.url === parsed.href && 'focus' in c)
          if (existing) return existing.focus()
          return self.clients.openWindow(parsed.href)
        }),
      )
    } catch {
      // invalid URL — ignore
    }
  }
})

// --- Active tile download (Story 3.2) ---

const SUBDOMAINS = ['a', 'b', 'c', 'd']

// Match Leaflet's subdomain selection: (x + y) % subdomains.length
function tileUrl(x: number, y: number, z: number): string {
  const s = SUBDOMAINS[Math.abs(x + y) % SUBDOMAINS.length]
  return `https://${s}.basemaps.cartocdn.com/light_all/${z}/${x}/${y}@2x.png`
}

async function postToClients(msg: Record<string, unknown>) {
  const clients = await self.clients.matchAll()
  clients.forEach((client) => client.postMessage(msg))
}

async function cacheTilesForBbox(bbox: BBox, zoomLevels: number[]) {
  const allTiles = zoomLevels.flatMap((z) => getTilesForBbox(bbox, z))
  const total = allTiles.length
  const cache = await caches.open(CACHE_NAMES.MAP_TILES)
  let current = 0
  const BATCH_SIZE = 10

  const cachedUrls: string[] = []
  try {
    for (let i = 0; i < allTiles.length; i++) {
      const { x, y, z } = allTiles[i]
      const url = tileUrl(x, y, z)

      // Skip already cached tiles for speed
      const cached = await cache.match(url)
      if (!cached) {
        const response = await fetch(url)
        if (response.ok) {
          await cache.put(url, response)
          cachedUrls.push(url)
        }
      }

      current++
      if (current % BATCH_SIZE === 0 || current === total) {
        await postToClients({ type: 'CACHE_PROGRESS', current, total })
      }
    }

    await postToClients({ type: 'CACHE_COMPLETE', total })
  } catch (error) {
    // Clean up partially cached tiles to avoid inconsistent state
    for (const url of cachedUrls) {
      await cache.delete(url).catch(() => {})
    }
    await postToClients({
      type: 'CACHE_ERROR',
      error: error instanceof Error ? error.message : 'Download failed',
    })
  }
}

async function cachePins(pins: unknown[]) {
  const cache = await caches.open(CACHE_NAMES.PINS)
  const response = new Response(JSON.stringify(pins), {
    headers: { 'Content-Type': 'application/json' },
  })
  await cache.put('offline-pins', response)
}

self.addEventListener('message', (event) => {
  const data = event.data
  if (data?.type === 'CACHE_TILES') {
    event.waitUntil(cacheTilesForBbox(data.bbox, data.zoomLevels))
  } else if (data?.type === 'CACHE_PINS') {
    event.waitUntil(cachePins(data.pins))
  }
})
