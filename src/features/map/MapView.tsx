import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRigStore } from '@/store/rigStore'

// Story 1.4 will implement the full Leaflet map
export default function MapView() {
  const navigate = useNavigate()
  const hasRigProfile = useRigStore((state) => state.hasRigProfile)
  const rigProfile = useRigStore((state) => state.rigProfile)

  useEffect(() => {
    if (!hasRigProfile()) {
      navigate('/onboarding', { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative min-h-screen bg-background">
      {/* Rig context indicator — shown only when profile exists */}
      {rigProfile.rigType && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <button
            type="button"
            onClick={() => navigate('/rig-edit')}
            className="bg-background/80 border border-border rounded-full px-4 py-2 text-sm text-foreground min-h-[44px]"
          >
            Filtering for: {rigProfile.rigType}, {rigProfile.lengthFt}ft
          </button>
        </div>
      )}
      <div className="flex items-center justify-center min-h-screen">
        Map View (Story 1.4)
      </div>
    </div>
  )
}
