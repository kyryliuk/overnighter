import { useEffect, useRef, type RefObject } from 'react'
import type { BBox } from '@/lib/tileMath'
import { MAX_OFFLINE_TILES } from '@/lib/constants'

interface BboxPreviewOverlayProps {
  bbox: BBox
  mapRef: RefObject<unknown>
  estimatedTiles: number
  onConfirm: () => void
  onCancel: () => void
}

export function BboxPreviewOverlay({
  bbox,
  mapRef,
  estimatedTiles,
  onConfirm,
  onCancel,
}: BboxPreviewOverlayProps) {
  const rectRef = useRef<unknown>(null)

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let rect: ReturnType<typeof import('leaflet')['rectangle']> | null = null

    import('leaflet').then((L) => {
      const bounds: [[number, number], [number, number]] = [
        [bbox.south, bbox.west],
        [bbox.north, bbox.east],
      ]
      rect = L.rectangle(bounds, {
        color: '#3B82F6',
        weight: 2,
        fillOpacity: 0.15,
      })
      rect.addTo(map as import('leaflet').Map)
      rectRef.current = rect
    })

    return () => {
      if (rect) rect.remove()
      rectRef.current = null
    }
  }, [mapRef, bbox])

  const approxSizeMB = Math.max(1, Math.round((estimatedTiles * 15) / 1024))
  const overCap = estimatedTiles > MAX_OFFLINE_TILES

  return (
    <div
      className="absolute bottom-20 left-4 right-4 z-20 bg-background/95 border border-border rounded-lg p-4 shadow-lg pointer-events-auto"
      data-testid="bbox-preview-overlay"
    >
      <p className="text-sm text-foreground mb-3">
        {estimatedTiles} tiles · ~{approxSizeMB} MB
      </p>
      {overCap && (
        <p className="text-xs text-red-500 mb-2">
          Exceeds {MAX_OFFLINE_TILES} tile limit — zoom in to reduce the area
        </p>
      )}
      {!overCap && estimatedTiles > 500 && (
        <p className="text-xs text-yellow-500 mb-2">
          Large download — consider zooming in for a smaller area
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={overCap}
          className="flex-1 bg-blue-500 text-white rounded-lg min-h-11 min-w-11 font-medium disabled:opacity-50"
          data-testid="bbox-confirm"
        >
          Download
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg min-h-11 min-w-11 font-medium border border-border text-foreground"
          data-testid="bbox-cancel"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
