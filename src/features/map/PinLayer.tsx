import { useEffect, useRef } from 'react'
import * as L from 'leaflet'
import Supercluster from 'supercluster'
import type { Pin } from '@/types/pin'
import type { RigProfile } from '@/types/rigProfile'
import { createPinMarker } from './PinMarker'

interface PinLayerProps {
  map: L.Map
  pins: Pin[]
  rigProfile: RigProfile
  isLoading: boolean
}

const SKELETON_MARKER_STYLE: L.CircleMarkerOptions = {
  radius: 8,
  fillColor: '#6b7280',
  fillOpacity: 0.2,
  color: '#9ca3af',
  opacity: 0.7,
  weight: 1,
  interactive: false,
}

function createClusterIcon(count: number): L.DivIcon {
  const size = count < 10 ? 36 : count < 100 ? 42 : 48
  return L.divIcon({
    html:
      `<div style="` +
        `width:${size}px;height:${size}px;border-radius:50%;` +
        `background:#0ea5e9;border:3px solid #0284c7;` +
        `box-shadow:0 1px 4px rgba(0,0,0,0.3);` +
        `display:flex;align-items:center;justify-content:center;` +
        `font-size:${count < 100 ? 13 : 11}px;font-weight:700;color:#ffffff;` +
        `cursor:pointer;` +
      `">${count}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export default function PinLayer({ map, pins, rigProfile, isLoading }: PinLayerProps) {
  const markersRef = useRef<Array<L.Marker | L.CircleMarker>>([])

  useEffect(() => {
    const clearMarkers = () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
    }

    clearMarkers()

    if (isLoading) {
      const bounds = map.getBounds()
      const south = bounds.getSouth()
      const north = bounds.getNorth()
      const west = bounds.getWest()
      const east = bounds.getEast()
      const centerLat = (south + north) / 2
      const centerLng = (west + east) / 2
      const latOffset = Math.max((north - south) / 12, 0.01)
      const lngOffset = Math.max((east - west) / 12, 0.01)
      const skeletonPositions: Array<[number, number]> = [
        [centerLat, centerLng],
        [centerLat + latOffset, centerLng - lngOffset],
        [centerLat + latOffset, centerLng + lngOffset],
        [centerLat - latOffset, centerLng - lngOffset],
        [centerLat - latOffset, centerLng + lngOffset],
      ]

      skeletonPositions.forEach((position) => {
        const marker = L.circleMarker(position, SKELETON_MARKER_STYLE)
        marker.addTo(map)
        markersRef.current.push(marker)
      })

      return clearMarkers
    }

    if (pins.length === 0) {
      return
    }

    // Build supercluster index from current pins
    const index = new Supercluster({ radius: 60, maxZoom: 16 })
    index.load(
      pins.map((pin) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [pin.longitude, pin.latitude] },
        properties: { pinId: pin.id },
      }))
    )

    function render() {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []

      const zoom = map.getZoom()
      const bounds = map.getBounds()
      const bbox: [number, number, number, number] = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ]

      const clusters = index.getClusters(bbox, Math.floor(zoom))

      clusters.forEach((feature) => {
        const [lng, lat] = feature.geometry.coordinates
        const props = feature.properties

        if (props.cluster) {
          // Cluster marker
          const marker = L.marker([lat, lng], {
            icon: createClusterIcon(props.point_count),
            keyboard: false,
          })
          marker.on('click', () => {
            const expansionZoom = Math.min(
              index.getClusterExpansionZoom(props.cluster_id as number),
              18,
            )
            map.flyTo([lat, lng], expansionZoom, { duration: 0.4 })
          })
          marker.addTo(map)
          markersRef.current.push(marker)
        } else {
          // Individual pin marker
          const pin = pins.find((p) => p.id === props['pinId'])
          if (pin) {
            const marker = createPinMarker(pin, rigProfile)
            marker.addTo(map)
            markersRef.current.push(marker)
          }
        }
      })
    }

    render()
    map.on('moveend zoomend', render)

    return () => {
      map.off('moveend zoomend', render)
      clearMarkers()
    }
  }, [map, pins, rigProfile, isLoading])

  return null
}
