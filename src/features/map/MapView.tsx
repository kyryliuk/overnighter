import { useEffect, useRef, lazy, Suspense, useState, useMemo } from 'react'
import { useNavigate, Outlet, useLocation } from 'react-router-dom'
import { useRigStore } from '@/store/rigStore'
import { useUIStore } from '@/store/uiStore'
import { useAmenityFilterStore } from '@/store/amenityFilterStore'
import { usePinsQuery } from '@/hooks/usePinsQuery'
import type * as L from 'leaflet'
import SearchBar from './SearchBar'
import RigFilterOverlay from './RigFilterOverlay'
import BadgeTooltip from './BadgeTooltip'
import AmenityFilterBar from './AmenityFilterBar'
import { doesPinMatchFilters, doesPinFitRig } from './PinLayer'

const LeafletMap = lazy(() => import('./LeafletMap'))

export default function MapView() {
  const navigate = useNavigate()
  const hasRigProfile = useRigStore((state) => state.hasRigProfile)
  const rigProfile = useRigStore((state) => state.rigProfile)
  const onboardingDismissed = useRigStore((state) => state.onboardingDismissed)
  const shouldShowMap = hasRigProfile() || onboardingDismissed
  const { data: pins = [], isLoading } = usePinsQuery({ enabled: shouldShowMap })
  const mapRef = useRef<L.Map | null>(null)
  const activeFilters = useAmenityFilterStore((state) => state.activeFilters)

  // Lazy initializer avoids reading localStorage on every render.
  // Set to false immediately when badge_tooltip_seen is already in storage.
  const [showBadgeTooltip, setShowBadgeTooltip] = useState(
    () => !localStorage.getItem('badge_tooltip_seen'),
  )

  const selectedPinId = useUIStore((state) => state.selectedPinId)
  const location = useLocation()

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

  function handleDismissTooltip() {
    localStorage.setItem('badge_tooltip_seen', '1')
    setShowBadgeTooltip(false)
  }

  // Client-side amenity filtering (NFR-P2: 200ms, no server round trip).
  // Rig-greyed pins (don't fit rig) remain visible regardless of amenity filter.
  // Only rig-fit pins that don't match amenity filters are hidden.
  const visiblePins = useMemo(() => {
    if (activeFilters.length === 0) return pins
    return pins.filter(
      (pin) => doesPinMatchFilters(pin, activeFilters) || !doesPinFitRig(pin, rigProfile),
    )
  }, [pins, activeFilters, rigProfile])

  // Show empty state when filters are active but no rig-fit pins match
  const hasAnyMatch = useMemo(
    () => activeFilters.length === 0 || pins.some((pin) => doesPinMatchFilters(pin, activeFilters)),
    [pins, activeFilters],
  )

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
          <LeafletMap
            pins={visiblePins}
            isLoading={isLoading}
            rigProfile={rigProfile}
            onMapReady={(map) => { mapRef.current = map }}
            onMapRemove={() => { mapRef.current = null }}
          />
        </Suspense>
      </div>
      {/* Empty state — shown when active filters match no pins in the dataset */}
      {!hasAnyMatch && !isLoading && (
        <div className="absolute bottom-20 left-0 right-0 flex justify-center z-10 pointer-events-none">
          <div className="bg-background/90 border border-border rounded-lg px-4 py-3 text-sm text-foreground max-w-xs text-center">
            No matching spots in this area — try zooming out or adjusting filters
          </div>
        </div>
      )}
      {/* First-session badge onboarding tooltip (AC7) — shown above all map layers */}
      {showBadgeTooltip && pins.length > 0 && !isLoading && (
        <BadgeTooltip onDismiss={handleDismissTooltip} />
      )}
      {/* Pin detail sheet overlay — rendered via nested route /pin/:id */}
      <Outlet />
    </div>
  )
}
