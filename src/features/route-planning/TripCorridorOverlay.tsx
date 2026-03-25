import { useEffect, useRef, type RefObject } from 'react'
import type * as L from 'leaflet'
import type { TripCorridorPreview } from './routePlanning'

interface TripCorridorOverlayProps {
  mapRef: RefObject<L.Map | null>
  preview: TripCorridorPreview
}

function buildStopMarkerIconHtml(stopNumber: number) {
  return `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9999px;background:#0f172a;border:2px solid #38bdf8;color:#f8fafc;font:600 14px/1 system-ui,sans-serif;box-shadow:0 4px 12px rgba(15,23,42,0.35);">${stopNumber}</div>`
}

export function TripCorridorOverlay({ mapRef, preview }: TripCorridorOverlayProps) {
  const polylineRef = useRef<L.Polyline | null>(null)
  const markerLayerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    const map = mapRef.current
    if (!map || preview.linePoints.length < 2) {
      return
    }

    let isDisposed = false

    void import('leaflet').then((L) => {
      if (isDisposed) {
        return
      }

      const polyline = L.polyline(
        preview.linePoints.map((point) => [point.latitude, point.longitude] as [number, number]),
        {
          color: '#38bdf8',
          weight: 4,
          opacity: 0.8,
        },
      )

      const markerLayer = L.layerGroup(
        preview.stopMarkers.map((stop) => L.marker(
          [stop.latitude, stop.longitude],
          {
            icon: L.divIcon({
              className: 'trip-corridor-stop-marker',
              html: buildStopMarkerIconHtml(stop.stopOrder + 1),
              iconSize: [32, 32],
              iconAnchor: [16, 16],
            }),
            interactive: false,
            keyboard: false,
            title: `Stop ${stop.stopOrder + 1}: ${stop.name}`,
          },
        )),
      )

      if (isDisposed) {
        polyline.remove()
        markerLayer.remove()
        return
      }

      polyline.addTo(map)
      markerLayer.addTo(map)
      polylineRef.current = polyline
      markerLayerRef.current = markerLayer
    })

    return () => {
      isDisposed = true
      polylineRef.current?.remove()
      markerLayerRef.current?.remove()
      polylineRef.current = null
      markerLayerRef.current = null
    }
  }, [mapRef, preview])

  return null
}
