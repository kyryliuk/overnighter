import { useEffect, useRef, lazy, Suspense, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRigStore } from '@/store/rigStore'
import { usePinsQuery } from '@/hooks/usePinsQuery'
import type * as L from 'leaflet'
import SearchBar from './SearchBar'
import RigFilterOverlay from './RigFilterOverlay'
import BadgeTooltip from './BadgeTooltip'

const LeafletMap = lazy(() => import('./LeafletMap'))

export default function MapView() {
  const navigate = useNavigate()
  const hasRigProfile = useRigStore((state) => state.hasRigProfile)
  const rigProfile = useRigStore((state) => state.rigProfile)
  const onboardingDismissed = useRigStore((state) => state.onboardingDismissed)
  const shouldShowMap = hasRigProfile() || onboardingDismissed
  const { data: pins = [], isLoading } = usePinsQuery({ enabled: shouldShowMap })
  const mapRef = useRef<L.Map | null>(null)

  // Lazy initializer avoids reading localStorage on every render.
  // Set to false immediately when badge_tooltip_seen is already in storage.
  const [showBadgeTooltip, setShowBadgeTooltip] = useState(
    () => !localStorage.getItem('badge_tooltip_seen'),
  )

  useEffect(() => {
    if (!hasRigProfile() && !onboardingDismissed) {
      navigate('/onboarding', { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleDismissTooltip() {
    localStorage.setItem('badge_tooltip_seen', '1')
    setShowBadgeTooltip(false)
  }

  return (
    <div className="relative bg-background" style={{ height: '100dvh' }}>
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex flex-col gap-2 pointer-events-none">
        <div className="pointer-events-auto">
          <SearchBar mapRef={mapRef} />
        </div>
        <div className="pointer-events-auto flex justify-center">
          <RigFilterOverlay />
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
            pins={pins}
            isLoading={isLoading}
            rigProfile={rigProfile}
            onMapReady={(map) => { mapRef.current = map }}
            onMapRemove={() => { mapRef.current = null }}
          />
        </Suspense>
      </div>
      {/* First-session badge onboarding tooltip (AC7) — shown above all map layers */}
      {showBadgeTooltip && pins.length > 0 && !isLoading && (
        <BadgeTooltip onDismiss={handleDismissTooltip} />
      )}
    </div>
  )
}
