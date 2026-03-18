import { useEffect, useRef, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRigStore } from '@/store/rigStore'
import { usePinsQuery } from '@/hooks/usePinsQuery'
import type * as L from 'leaflet'
import SearchBar from './SearchBar'
import RigFilterOverlay from './RigFilterOverlay'

const LeafletMap = lazy(() => import('./LeafletMap'))

export default function MapView() {
  const navigate = useNavigate()
  const hasRigProfile = useRigStore((state) => state.hasRigProfile)
  const rigProfile = useRigStore((state) => state.rigProfile)
  const onboardingDismissed = useRigStore((state) => state.onboardingDismissed)
  const shouldShowMap = hasRigProfile() || onboardingDismissed
  const { data: pins = [], isLoading } = usePinsQuery({ enabled: shouldShowMap })
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!hasRigProfile() && !onboardingDismissed) {
      navigate('/onboarding', { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
  )
}
