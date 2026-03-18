import { useEffect, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRigStore } from '@/store/rigStore'
import { usePinsQuery } from '@/hooks/usePinsQuery'
import RigFilterOverlay from './RigFilterOverlay'

const LeafletMap = lazy(() => import('./LeafletMap'))

export default function MapView() {
  const navigate = useNavigate()
  const hasRigProfile = useRigStore((state) => state.hasRigProfile)
  const rigProfile = useRigStore((state) => state.rigProfile)
  const onboardingDismissed = useRigStore((state) => state.onboardingDismissed)
  const shouldShowMap = hasRigProfile() || onboardingDismissed
  const { data: pins = [], isLoading } = usePinsQuery({ enabled: shouldShowMap })

  useEffect(() => {
    if (!hasRigProfile() && !onboardingDismissed) {
      navigate('/onboarding', { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative bg-background" style={{ height: '100dvh' }}>
      <RigFilterOverlay />
      <Suspense
        fallback={
          <div className="flex items-center justify-center" style={{ height: '100dvh' }}>
            <span className="text-muted-foreground text-sm">Loading map…</span>
          </div>
        }
      >
        <LeafletMap pins={pins} isLoading={isLoading} rigProfile={rigProfile} />
      </Suspense>
    </div>
  )
}
