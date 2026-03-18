import { useEffect, useRef } from 'react'
import * as L from 'leaflet'
import type { Pin } from '@/types/pin'
import type { RigProfile } from '@/types/rigProfile'

interface PinLayerProps {
  map: L.Map
  pins: Pin[]
  rigProfile: RigProfile
  isLoading: boolean
}

export function doesPinFitRig(pin: Pin, rigProfile: RigProfile): boolean {
  if (!rigProfile.rigType) return true // No profile → all pins fit (no greying)

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

const FIT_STYLE: L.CircleMarkerOptions = {
  radius: 8,
  fillColor: '#22c55e',
  fillOpacity: 0.9,
  color: '#16a34a',
  weight: 2,
}

const UNFIT_STYLE: L.CircleMarkerOptions = {
  radius: 8,
  fillColor: '#6b7280',
  fillOpacity: 0.35,
  color: '#4b5563',
  weight: 1,
}

export default function PinLayer({ map, pins, rigProfile, isLoading }: PinLayerProps) {
  const markersRef = useRef<L.CircleMarker[]>([])

  useEffect(() => {
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    if (isLoading) {
      // Map tiles still load; markers deferred until data ready
      return
    }

    pins.forEach((pin) => {
      const fits = doesPinFitRig(pin, rigProfile)
      const marker = L.circleMarker([pin.latitude, pin.longitude], fits ? FIT_STYLE : UNFIT_STYLE)
      marker.addTo(map)
      markersRef.current.push(marker)
    })

    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
    }
  }, [map, pins, rigProfile, isLoading])

  return null
}
