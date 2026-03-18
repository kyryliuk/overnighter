import { useEffect, useRef } from 'react'
import * as L from 'leaflet'
import type { Pin } from '@/types/pin'
import type { RigProfile } from '@/types/rigProfile'
import { createPinMarker } from './PinMarker'

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

export default function PinLayer({ map, pins, rigProfile, isLoading }: PinLayerProps) {
  const markersRef = useRef<L.Marker[]>([])

  useEffect(() => {
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    if (isLoading) {
      // Map tiles still load; markers deferred until data ready
      return
    }

    pins.forEach((pin) => {
      const marker = createPinMarker(pin, rigProfile)
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
