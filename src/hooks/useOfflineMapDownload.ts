import { useState, useCallback, useEffect, useRef } from 'react'
import { useSpotsStore } from '@/store/spotsStore'
import { estimateTileCount } from '@/lib/tileMath'
import { CACHE_NAMES, OFFLINE_ZOOM_LEVELS, OFFLINE_REGION_KEY, MAX_OFFLINE_TILES } from '@/lib/constants'
import type { BBox } from '@/lib/tileMath'

export type DownloadStatus = 'idle' | 'previewing' | 'downloading' | 'complete' | 'error'

export interface CachedRegion extends BBox {
  cachedAt: string
  tileCount: number
}

function loadCachedRegion(): CachedRegion | null {
  try {
    const raw = localStorage.getItem(OFFLINE_REGION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Check if a coordinate falls within the stored offline cached region. */
export function isSpotCached(lat: number, lng: number): boolean {
  const region = loadCachedRegion()
  if (!region) return false
  return (
    lat <= region.north && lat >= region.south && lng >= region.west && lng <= region.east
  )
}

export function useOfflineMapDownload() {
  const [status, setStatus] = useState<DownloadStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [totalTiles, setTotalTiles] = useState(0)
  const [previewBbox, setPreviewBbox] = useState<BBox | null>(null)
  const [cachedRegion, setCachedRegion] = useState<CachedRegion | null>(loadCachedRegion)
  const bboxRef = useRef<BBox | null>(null)

  useEffect(() => {
    const sw = navigator.serviceWorker
    if (!sw) return

    const handler = (event: MessageEvent) => {
      const data = event.data
      if (data?.type === 'CACHE_PROGRESS') {
        setProgress(data.current)
        setTotalTiles(data.total)
      } else if (data?.type === 'CACHE_COMPLETE') {
        // Cache pins that fall within the downloaded bbox
        const bbox = bboxRef.current
        if (bbox) {
          const savedSpots = useSpotsStore.getState().savedSpots
          const spotsInBbox = savedSpots.filter(
            (s) =>
              s.latitude >= bbox.south &&
              s.latitude <= bbox.north &&
              s.longitude >= bbox.west &&
              s.longitude <= bbox.east,
          )
          navigator.serviceWorker?.controller?.postMessage({
            type: 'CACHE_PINS',
            pins: spotsInBbox,
          })

          const region: CachedRegion = {
            ...bbox,
            cachedAt: new Date().toISOString(),
            tileCount: data.total,
          }
          localStorage.setItem(OFFLINE_REGION_KEY, JSON.stringify(region))
          setCachedRegion(region)
        }
        setStatus('complete')
      } else if (data?.type === 'CACHE_ERROR') {
        setStatus('error')
      }
    }

    sw.addEventListener('message', handler)
    return () => {
      sw.removeEventListener('message', handler)
    }
  }, [])

  const startPreview = useCallback(
    (mapBounds: { north: number; south: number; east: number; west: number }) => {
      const bbox: BBox = {
        north: mapBounds.north,
        south: mapBounds.south,
        east: mapBounds.east,
        west: mapBounds.west,
      }
      setPreviewBbox(bbox)
      bboxRef.current = bbox
      setStatus('previewing')
      return bbox
    },
    [],
  )

  const startDownload = useCallback((bbox: BBox) => {
    if (!navigator.serviceWorker?.controller) {
      setStatus('error')
      return
    }
    const tiles = estimateTileCount(bbox, OFFLINE_ZOOM_LEVELS)
    if (tiles > MAX_OFFLINE_TILES) {
      setStatus('error')
      return
    }
    setStatus('downloading')
    setProgress(0)
    bboxRef.current = bbox
    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_TILES',
      bbox,
      zoomLevels: [...OFFLINE_ZOOM_LEVELS],
    })
  }, [])

  const cancelPreview = useCallback(() => {
    setPreviewBbox(null)
    bboxRef.current = null
    setStatus('idle')
  }, [])

  const retry = useCallback(() => {
    const bbox = bboxRef.current
    if (bbox) {
      startDownload(bbox)
    }
  }, [startDownload])

  const dismiss = useCallback(() => {
    setStatus('idle')
    setProgress(0)
    setTotalTiles(0)
    setPreviewBbox(null)
  }, [])

  // Deletes entire MAP_TILES cache (includes both proactive downloads and passively cached tiles).
  // This is intentional: passive tiles will re-cache on next visit.
  const clearCache = useCallback(async () => {
    await caches.delete(CACHE_NAMES.MAP_TILES)
    localStorage.removeItem(OFFLINE_REGION_KEY)
    setCachedRegion(null)
    setStatus('idle')
    setProgress(0)
    setTotalTiles(0)
    setPreviewBbox(null)
    bboxRef.current = null
  }, [])

  const estimatedTiles = previewBbox
    ? estimateTileCount(previewBbox, OFFLINE_ZOOM_LEVELS)
    : 0

  return {
    status,
    progress,
    totalTiles,
    cachedRegion,
    previewBbox,
    estimatedTiles,
    startPreview,
    startDownload,
    cancelPreview,
    retry,
    dismiss,
    clearCache,
    isSpotCached,
  }
}
