import { useEffect, useRef } from 'react'
import * as L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
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

export default function PinLayer({ map, pins, rigProfile, isLoading }: PinLayerProps) {
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)

  useEffect(() => {
    if (clusterRef.current) {
      clusterRef.current.remove()
      clusterRef.current = null
    }

    if (isLoading) return

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 60,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: true,
      iconCreateFunction(c) {
        const count = c.getChildCount()
        return L.divIcon({
          html:
            `<div style="` +
              `width:36px;height:36px;border-radius:50%;` +
              `background:#0ea5e9;border:3px solid #0284c7;` +
              `box-shadow:0 1px 4px rgba(0,0,0,0.25);` +
              `display:flex;align-items:center;justify-content:center;` +
              `font-size:12px;font-weight:700;color:#ffffff;` +
              `cursor:pointer;` +
            `">${count}</div>`,
          className: '',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        })
      },
    })

    pins.forEach((pin) => {
      const marker = createPinMarker(pin, rigProfile)
      cluster.addLayer(marker)
    })

    cluster.addTo(map)
    clusterRef.current = cluster

    return () => {
      cluster.remove()
      clusterRef.current = null
    }
  }, [map, pins, rigProfile, isLoading])

  return null
}
