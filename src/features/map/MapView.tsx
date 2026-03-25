import { useEffect, useRef, lazy, Suspense, useState, useMemo, useCallback } from 'react'
import { useNavigate, Outlet, useLocation } from 'react-router-dom'
import { useRigStore } from '@/store/rigStore'
import { useUIStore } from '@/store/uiStore'
import { useAmenityFilterStore } from '@/store/amenityFilterStore'
import { useSourceFilterStore } from '@/store/sourceFilterStore'
import { useCheckInPromptStore, type VisitRecord } from '@/store/checkInPromptStore'
import { usePinsQuery } from '@/hooks/usePinsQuery'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useAuth } from '@/contexts/AuthContext'
import { useOfflineMapDownload } from '@/hooks/useOfflineMapDownload'
import type * as L from 'leaflet'
import { TripCorridorOverlay } from '@/features/route-planning/TripCorridorOverlay'
import { useTripCorridorPreview } from '@/features/route-planning/TripCorridorPreviewContext'
import { TripCorridorPreviewProvider } from '@/features/route-planning/TripCorridorPreviewProvider'
import { buildTripCorridorPreview } from '@/features/route-planning/routePlanning'
import { doesPinMatchFilters, doesPinFitRig, doesPinMatchSourceFilter } from './pinFilters'

const GEO_ERROR_MESSAGES: Record<string, string> = {
  denied: 'Location access denied',
  'no-api': 'Location not available',
  unavailable: 'Could not get location — try again',
}
import SearchBar from './SearchBar'
import DeparturePrompt from './DeparturePrompt'
import RigFilterOverlay from './RigFilterOverlay'
import BadgeTooltip from './BadgeTooltip'
import AmenityFilterBar from './AmenityFilterBar'
import { OfflineDownloadGate } from '@/features/offline/OfflineDownloadGate'
import { BboxPreviewOverlay } from '@/features/offline/BboxPreviewOverlay'
import { DownloadProgress } from '@/features/offline/DownloadProgress'

const LeafletMap = lazy(() => import('./LeafletMap'))

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function MapViewContent() {
  const navigate = useNavigate()
  const { session, isAuthenticated } = useAuth()
  const hasRigProfile = useRigStore((state) => state.hasRigProfile)
  const rigProfile = useRigStore((state) => state.rigProfile)
  const onboardingDismissed = useRigStore((state) => state.onboardingDismissed)
  const shouldShowMap = hasRigProfile() || onboardingDismissed
  const [viewport, setViewport] = useState<{ lat: number; lng: number; radiusM: number } | null>(null)
  const { data: pins = [], isLoading } = usePinsQuery({
    enabled: shouldShowMap,
    ...viewport,
  })
  const mapRef = useRef<L.Map | null>(null)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeFilters = useAmenityFilterStore((state) => state.activeFilters)
  const activeGroups = useSourceFilterStore((state) => state.activeGroups)

  // Lazy initializer avoids reading localStorage on every render.
  // Set to false immediately when badge_tooltip_seen is already in storage.
  const [showBadgeTooltip, setShowBadgeTooltip] = useState(
    () => !localStorage.getItem('badge_tooltip_seen'),
  )

  const selectedPinId = useUIStore((state) => state.selectedPinId)
  const pendingMapCenter = useUIStore((state) => state.pendingMapCenter)
  const setPendingMapCenter = useUIStore((state) => state.setPendingMapCenter)
  const location = useLocation()
  const { previewTrip } = useTripCorridorPreview()
  const [geoState, requestGeo] = useGeolocation()
  const [pendingDeparturePin, setPendingDeparturePin] = useState<VisitRecord | null>(null)
  const departureCheckedRef = useRef(false)
  const lastFittedRouteSignatureRef = useRef<string | null>(null)
  const visitRecords = useCheckInPromptStore((state) => state.visitRecords)
  const isDismissed = useCheckInPromptStore((state) => state.isDismissed)
  const setPendingCheckIn = useUIStore((state) => state.setPendingCheckIn)
  const geoError = geoState.error ? GEO_ERROR_MESSAGES[geoState.error] ?? 'Location error' : null
  const accountInitial = session?.user.email?.trim().charAt(0).toUpperCase() || 'A'

  const {
    status: downloadStatus,
    progress: downloadProgress,
    totalTiles,
    previewBbox,
    estimatedTiles,
    startPreview,
    startDownload,
    cancelPreview,
    retry: retryDownload,
    dismiss: dismissDownload,
  } = useOfflineMapDownload()

  const computeViewport = useCallback((map: L.Map) => {
    const center = map.getCenter()
    const bounds = map.getBounds()
    const ne = bounds.getNorthEast()
    // Clamp to API max (500km) to avoid 400 errors at low zoom levels
    const radiusM = Math.min(Math.round(center.distanceTo(ne)), 500000)
    return { lat: center.lat, lng: center.lng, radiusM }
  }, [])

  const onMoveEnd = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (mapRef.current) setViewport(computeViewport(mapRef.current))
    }, 300)
  }, [computeViewport])

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map
    setMapInstance(map)
    setViewport(computeViewport(map))
    map.on('moveend', onMoveEnd)
  }, [computeViewport, onMoveEnd])

  const handleMapRemove = useCallback(() => {
    mapRef.current?.off('moveend', onMoveEnd)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    mapRef.current = null
    setMapInstance(null)
  }, [onMoveEnd])

  function handleStartPreview() {
    const map = mapRef.current
    if (!map) return
    const bounds = map.getBounds()
    startPreview({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    })
  }

  useEffect(() => {
    // M2 fix: skip onboarding redirect on deep-linked pin routes (/pin/:id)
    // so new users can view a shared pin URL without being bounced to onboarding
    const isOnPinRoute = location.pathname.startsWith('/pin/')
    if (!hasRigProfile() && !onboardingDismissed && !isOnPinRoute) {
      navigate('/onboarding', { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedPinId) navigate('/pin/' + selectedPinId)
  }, [selectedPinId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pendingMapCenter && mapRef.current) {
      mapRef.current.setView([pendingMapCenter.lat, pendingMapCenter.lng], 14)
      setPendingMapCenter(null)
    }
  }, [pendingMapCenter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (geoState.coords) {
      const { latitude, longitude } = geoState.coords
      const map = mapRef.current as { setView?: (center: [number, number], zoom: number) => void } | null
      map?.setView?.([latitude, longitude], 12)
    }
  }, [geoState.coords])

  // One-shot departure check: fires when GPS coords first become available this session (AC1, AC3, AC4)
  useEffect(() => {
    if (!geoState.coords || departureCheckedRef.current) return
    departureCheckedRef.current = true
    const { latitude, longitude } = geoState.coords
    const candidates = visitRecords.filter(
      (v) => !isDismissed(v.visitKey) && distanceMiles(latitude, longitude, v.latitude, v.longitude) > 0.5,
    )
    if (candidates.length > 0) setPendingDeparturePin(candidates[0])
  }, [geoState.coords, isDismissed, visitRecords])

  function handleDepartureSkip() {
    if (pendingDeparturePin) {
      useCheckInPromptStore.getState().dismissVisit(pendingDeparturePin.visitKey)
    }
    setPendingDeparturePin(null)
  }

  function handleDepartureCheckIn() {
    if (pendingDeparturePin) {
      useCheckInPromptStore.getState().dismissVisit(pendingDeparturePin.visitKey)
      setPendingCheckIn({ pinId: pendingDeparturePin.pinId })
    }
    setPendingDeparturePin(null)
  }

  function handleDismissTooltip() {
    localStorage.setItem('badge_tooltip_seen', '1')
    setShowBadgeTooltip(false)
  }

  // Client-side amenity filtering (NFR-P2: 200ms, no server round trip).
  // Rig-greyed pins (don't fit rig) remain visible regardless of amenity filter.
  // Only rig-fit pins that don't match amenity filters are hidden.
  const visiblePins = useMemo(() => {
    if (activeFilters.length === 0 && activeGroups.length === 0) return pins
    return pins.filter((pin) => {
      const fitsRig = doesPinFitRig(pin, rigProfile)
      const matchesSource = doesPinMatchSourceFilter(pin, activeGroups)
      const matchesAmenity = doesPinMatchFilters(pin, activeFilters)
      // Rig-greyed pins remain visible regardless of filters
      if (!fitsRig) return matchesSource
      return matchesSource && matchesAmenity
    })
  }, [pins, activeFilters, activeGroups, rigProfile])

  // Show empty state when filters are active but no rig-fit pins match
  const hasAnyMatch = useMemo(
    () =>
      (activeFilters.length === 0 && activeGroups.length === 0) ||
      pins.some(
        (pin) =>
          doesPinMatchSourceFilter(pin, activeGroups) &&
          doesPinMatchFilters(pin, activeFilters),
      ),
    [pins, activeFilters, activeGroups],
  )
  const corridorPreview = useMemo(() => buildTripCorridorPreview(previewTrip), [previewTrip])
  const corridorFitSignature = useMemo(
    () => corridorPreview.linePoints.map((point) => `${point.latitude}:${point.longitude}`).join('|'),
    [corridorPreview.linePoints],
  )
  const mapElement = useMemo(() => (
    <LeafletMap
      pins={visiblePins}
      isLoading={isLoading}
      rigProfile={rigProfile}
      onMapReady={handleMapReady}
      onMapRemove={handleMapRemove}
    />
  ), [handleMapReady, handleMapRemove, isLoading, rigProfile, visiblePins])

  useEffect(() => {
    if (!corridorFitSignature || corridorPreview.linePoints.length < 2) {
      lastFittedRouteSignatureRef.current = null
      return
    }

    if (lastFittedRouteSignatureRef.current === corridorFitSignature) {
      return
    }

    if (pendingMapCenter) {
      return
    }

    if (!mapInstance) {
      return
    }

    lastFittedRouteSignatureRef.current = corridorFitSignature

    void import('leaflet').then((L) => {
      const bounds = L.latLngBounds(
        corridorPreview.linePoints.map((point) => [point.latitude, point.longitude] as [number, number]),
      )
      mapInstance.fitBounds(bounds, {
        padding: [48, 48],
        maxZoom: 14,
      })
    })
  }, [corridorFitSignature, corridorPreview.linePoints, mapInstance, pendingMapCenter])

  return (
    <div className="relative bg-background" style={{ height: '100dvh' }}>
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex flex-col gap-2 pointer-events-none">
        <div className="pointer-events-auto">
          <SearchBar mapRef={mapRef} />
        </div>
        <div className="pointer-events-auto flex justify-center">
          <RigFilterOverlay />
        </div>
        <div className="pointer-events-auto w-full">
          <AmenityFilterBar />
        </div>
        {downloadStatus === 'idle' && (
          <div className="pointer-events-auto">
            <OfflineDownloadGate onStartPreview={handleStartPreview} />
          </div>
        )}
        {(downloadStatus === 'downloading' || downloadStatus === 'complete' || downloadStatus === 'error') && (
          <div className="pointer-events-auto w-full">
            <DownloadProgress
              progress={downloadProgress}
              total={totalTiles}
              status={downloadStatus as 'downloading' | 'complete' | 'error'}
              onRetry={retryDownload}
              onDismiss={dismissDownload}
            />
          </div>
        )}
      </div>
      {/* z-0 creates a stacking context that contains all Leaflet internal panes (z-index 400–1000),
          preventing them from bleeding above the overlay controls at z-10 */}
      <div className="absolute inset-0 z-0">
        <Suspense
          fallback={
            <div className="flex items-center justify-center" style={{ height: '100dvh' }}>
              <span className="text-muted-foreground text-sm">Loading map…</span>
            </div>
          }
        >
          {mapElement}
        </Suspense>
      </div>
      {mapInstance && corridorPreview.linePoints.length >= 2 ? (
        <TripCorridorOverlay mapRef={mapRef} preview={corridorPreview} />
      ) : null}
      {/* Empty state — shown when active filters match no pins in the dataset */}
      {!hasAnyMatch && !isLoading && (
        <div className="absolute bottom-20 left-0 right-0 flex justify-center z-10 pointer-events-none">
          <div className="bg-background/90 border border-border rounded-lg px-4 py-3 text-sm text-foreground max-w-xs text-center">
            No matching spots in this area — try zooming out or adjusting filters
          </div>
        </div>
      )}
      {/* Near Me FAB — bottom-right floating action button */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-2">
        {geoError && (
          <p
            className="text-xs text-foreground bg-background/90 border border-border rounded-lg px-3 py-1 max-w-[180px] text-right"
            role="alert"
          >
            {geoError}
          </p>
        )}
        <button
          type="button"
          onClick={requestGeo}
          disabled={geoState.isLoading}
          className="bg-surface border border-border rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center shadow-md disabled:opacity-50 text-lg"
          aria-label={geoState.isLoading ? 'Getting location...' : 'Use my current location'}
        >
          {geoState.isLoading ? '…' : '📍'}
        </button>
      </div>
      <div className="absolute bottom-4 left-4 z-10 flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => navigate('/trips')}
          className="bg-surface border border-border rounded-full min-h-[44px] px-4 shadow-md text-sm font-medium"
          aria-label="Open My Routes"
        >
          My Routes
        </button>
        <button
          type="button"
          onClick={() => navigate('/suggest-spot')}
          className="bg-surface border border-border rounded-full min-h-[44px] px-4 shadow-md text-sm font-medium"
          aria-label="Suggest a spot"
        >
          Suggest spot
        </button>
        <button
          type="button"
          onClick={() => navigate('/saved')}
          className="bg-surface border border-border rounded-full min-h-[44px] px-4 shadow-md text-sm font-medium"
          aria-label="Open saved spots"
        >
          Saved spots
        </button>
        <button
          type="button"
          onClick={() => navigate('/account')}
          className={`bg-surface border border-border min-h-[44px] shadow-md text-sm font-medium ${
            isAuthenticated ? 'min-w-[44px] rounded-full px-0 flex items-center justify-center' : 'rounded-full px-4'
          }`}
          aria-label={isAuthenticated ? `Open profile for ${session?.user.email ?? 'your account'}` : 'Open account'}
        >
          {isAuthenticated ? accountInitial : 'Account'}
        </button>
      </div>
      {/* First-session badge onboarding tooltip (AC7) — shown above all map layers */}
      {showBadgeTooltip && pins.length > 0 && !isLoading && (
        <BadgeTooltip onDismiss={handleDismissTooltip} />
      )}
      {/* Departure check-in prompt (Story 4.2) — shown when user has left a visited spot */}
      {pendingDeparturePin && (
        <DeparturePrompt
          pinName={pendingDeparturePin.pinName}
          rigType={rigProfile.rigType}
          onSkip={handleDepartureSkip}
          onCheckIn={handleDepartureCheckIn}
        />
      )}
      {/* Bbox preview overlay — shown when user is previewing download area */}
      {downloadStatus === 'previewing' && previewBbox && (
        <BboxPreviewOverlay
          bbox={previewBbox}
          mapRef={mapRef}
          estimatedTiles={estimatedTiles}
          onConfirm={() => startDownload(previewBbox)}
          onCancel={cancelPreview}
        />
      )}
      {/* Pin detail sheet overlay — rendered via nested route /pin/:id */}
      <Outlet />
    </div>
  )
}

export default function MapView() {
  return (
    <TripCorridorPreviewProvider>
      <MapViewContent />
    </TripCorridorPreviewProvider>
  )
}
