import { useEffect, useRef, useState } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import PinLayer from './PinLayer'
import type { Pin } from '@/types/pin'
import type { RigProfile } from '@/types/rigProfile'
import { readMapViewportSnapshot, saveMapViewportSnapshot } from '@/lib/offline/mapViewport'

const CARTO_LIGHT_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
const OSM_FALLBACK_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const DEFAULT_CENTER: [number, number] = [39.5, -98.35]
const DEFAULT_ZOOM = 4

interface LeafletMapProps {
  pins: Pin[]
  isLoading: boolean
  rigProfile: RigProfile
  onMapReady?: (map: L.Map) => void
  onMapRemove?: () => void
}

export default function LeafletMap({ pins, isLoading, rigProfile, onMapReady, onMapRemove }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapInstance) return
    const savedViewport = readMapViewportSnapshot()

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const map = L.map(containerRef.current, {
      center: savedViewport?.center ?? DEFAULT_CENTER,
      zoom: savedViewport?.zoom ?? DEFAULT_ZOOM,
      // tap exists in Leaflet 1.9.x runtime but is absent from @types/leaflet
      tap: false,
      // Respect prefers-reduced-motion (NFR-A5)
      zoomAnimation: !prefersReduced,
      fadeAnimation: !prefersReduced,
    } as unknown as L.MapOptions)

    const cartoTile = L.tileLayer(CARTO_LIGHT_URL, {
      attribution: '© <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    })

    const osmFallback = L.tileLayer(OSM_FALLBACK_URL, {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    })

    cartoTile.on('tileerror', () => {
      if (map.hasLayer(cartoTile)) {
        cartoTile.remove()
        osmFallback.addTo(map)
      }
    })

    cartoTile.addTo(map)

    const persistViewport = () => {
      const center = map.getCenter()
      saveMapViewportSnapshot([center.lat, center.lng], map.getZoom())
    }

    map.on('moveend zoomend', persistViewport)

    if (!savedViewport) {
      navigator.geolocation?.getCurrentPosition(
        (position) => {
          map.setView([position.coords.latitude, position.coords.longitude], 10)
        },
        () => {
          // GPS denied or unavailable — keep default US center (silent failure)
        },
        { timeout: 5000 },
      )
    }

    setMapInstance(map)
    onMapReady?.(map)

    return () => {
      map.off('moveend zoomend', persistViewport)
      map.remove()
      setMapInstance(null)
      onMapRemove?.()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ height: '100dvh', width: '100%' }}>
      <div
        ref={containerRef}
        style={{ height: '100%', width: '100%' }}
        aria-label="Map of camping spots"
      />
      {mapInstance && (
        <PinLayer map={mapInstance} pins={pins} rigProfile={rigProfile} isLoading={isLoading} />
      )}
    </div>
  )
}
