import { useDeviceId } from '@/hooks/useDeviceId'
import { useTapVerifyMutation } from './waterTapsApi'

interface TapConfirmDenyProps {
  tapPinId: string
}

/**
 * TapConfirmDeny — "Still here" / "No longer here" buttons (FR46)
 *
 * Fires useTapVerifyMutation with optimistic count update before server responds.
 * Both buttons meet 44×44px minimum touch target (NFR-A4).
 */
export default function TapConfirmDeny({ tapPinId }: TapConfirmDenyProps) {
  const deviceId = useDeviceId()
  const mutation = useTapVerifyMutation(tapPinId)

  function handleConfirm() {
    mutation.mutate({ tapPinId, eventType: 'confirmed', deviceId })
  }

  function handleDeny() {
    mutation.mutate({ tapPinId, eventType: 'denied', deviceId })
  }

  const isLoading = mutation.isPending

  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={handleConfirm}
        disabled={isLoading}
        aria-label="Still here — confirm this tap is present"
        className="flex-1 min-h-[44px] rounded-lg border border-green-500/50 bg-green-500/10 text-green-400 font-semibold text-sm hover:bg-green-500/20 transition-colors disabled:opacity-50"
      >
        ✓ Still here
      </button>
      <button
        type="button"
        onClick={handleDeny}
        disabled={isLoading}
        aria-label="No longer here — report this tap is gone"
        className="flex-1 min-h-[44px] rounded-lg border border-red-500/50 bg-red-500/10 text-red-400 font-semibold text-sm hover:bg-red-500/20 transition-colors disabled:opacity-50"
      >
        ✗ No longer here
      </button>
    </div>
  )
}
