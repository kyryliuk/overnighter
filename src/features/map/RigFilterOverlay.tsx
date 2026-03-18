import { useNavigate } from 'react-router-dom'
import { useRigStore } from '@/store/rigStore'

export default function RigFilterOverlay() {
  const navigate = useNavigate()
  const rigProfile = useRigStore((state) => state.rigProfile)

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
      {rigProfile.rigType ? (
        <button
          type="button"
          onClick={() => navigate('/rig-edit')}
          className="bg-background/80 border border-border rounded-full px-4 py-2 text-sm text-foreground min-h-[44px] whitespace-nowrap"
        >
          Filtering for: {rigProfile.rigType}, {rigProfile.lengthFt}ft
        </button>
      ) : (
        <button
          type="button"
          onClick={() => navigate('/onboarding')}
          className="bg-background/80 border border-border rounded-full px-4 py-2 text-sm text-muted-foreground min-h-[44px] whitespace-nowrap"
        >
          No rig profile — set up your rig for filtered results
        </button>
      )}
    </div>
  )
}
