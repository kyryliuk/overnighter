import { useEffect, useRef } from 'react'
import * as L from 'leaflet'
import Supercluster from 'supercluster'
import type { Pin, PinAmenities } from '@/types/pin'
import type { RigProfile } from '@/types/rigProfile'
import { type SourceGroup, GROUP_SOURCES } from '@/store/sourceFilterStore'
import { createPinMarker } from './PinMarker'

interface PinLayerProps {
  map: L.Map
  pins: Pin[]
  rigProfile: RigProfile
  isLoading: boolean
}

export function doesPinMatchFilters(pin: Pin, activeFilters: Array<keyof PinAmenities>): boolean {
  if (activeFilters.length === 0) return true
  return activeFilters.every((amenity) => pin.amenities[amenity])
}

export function doesPinMatchSourceFilter(pin: Pin, activeGroups: SourceGroup[]): boolean {
  if (activeGroups.length === 0) return true
  return activeGroups.some((group) => GROUP_SOURCES[group].includes(pin.pinType))
}

export function doesPinFitRig(pin: Pin, rigProfile: RigProfile): boolean {
  if (!rigProfile.rigType) return true
  const lengthOk =
    pin.maxLengthFt === null ||
    rigProfile.lengthFt === null ||
    rigProfile.lengthFt <= pin.maxLengthFt
  const heightOk =
    pin.maxHeightFt === null ||
    rigProfile.heightFt === null ||
    rigProfile.heightFt <= pin.maxHeightFt
  return lengthOk && heightOk
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
  const markersRef = useRef<L.Marker[]>([])

  useEffect(() => {
    if (isLoading || pins.length === 0) {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
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
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
    }
  }, [map, pins, rigProfile, isLoading])

  return null
}
