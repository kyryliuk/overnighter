import { useState } from 'react'
import { usePushSubscription } from '@/hooks/usePushSubscription'

interface PushNotificationToggleProps {
  pinId: string
}

export default function PushNotificationToggle({ pinId }: PushNotificationToggleProps) {
  void pinId // Reserved for future per-spot granularity
  const { permissionState, isSubscribed, isLoading, subscribe, unsubscribe } = usePushSubscription()
  const [showDescription, setShowDescription] = useState(false)

  if (permissionState === 'unsupported') return null

  async function handleToggle() {
    if (isLoading) return

    if (!isSubscribed) {
      if (permissionState === 'default') {
        setShowDescription(true)
      }
      try {
        await subscribe()
      } catch {
        // subscribe failed — state already reverted by hook
      }
    } else {
      try {
        await unsubscribe()
      } catch {
        // unsubscribe failed — state already reverted by hook
      }
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground">Notify me when status changes</span>
        <button
          role="switch"
          aria-checked={isSubscribed}
          aria-label="Notify me when this spot status changes"
          disabled={isLoading || permissionState === 'denied'}
          onClick={handleToggle}
          className={`relative inline-flex h-7 w-12 min-h-[44px] min-w-[44px] items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            isSubscribed ? 'bg-sky-500' : 'bg-muted-foreground/30'
          } ${isLoading || permissionState === 'denied' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              isSubscribed ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
          {isLoading && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </span>
          )}
        </button>
      </div>
      {permissionState === 'denied' && (
        <p className="text-xs text-muted-foreground">Enable notifications in your browser settings</p>
      )}
      {showDescription && permissionState !== 'denied' && (
        <p className="text-xs text-muted-foreground">
          You&apos;ll get an alert when a new check-in changes this spot&apos;s status
        </p>
      )}
    </div>
  )
}
