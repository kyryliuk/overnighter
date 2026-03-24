import { useState } from 'react'
import { usePWAUpdate } from '@/hooks/usePWAUpdate'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export default function UpdateBanner() {
  const { needRefresh, updateServiceWorker } = usePWAUpdate()
  const isOnline = useOnlineStatus()
  const [dismissed, setDismissed] = useState(false)

  if (!needRefresh || dismissed) return null

  // Shift down when offline banner is also visible
  const topClass = isOnline ? 'top-4' : 'top-20'

  return (
    <div
      className={`fixed ${topClass} left-4 right-4 z-[1099] flex justify-center pointer-events-none`}
    >
      <div
        role="status"
        className="max-w-xl w-full flex items-center justify-between gap-3 rounded-lg border border-blue-500/30 bg-background/95 px-4 py-3 text-sm text-foreground shadow-lg pointer-events-auto"
        data-testid="update-banner"
      >
        <span>A new version is available</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => updateServiceWorker()}
            className="min-h-11 min-w-11 rounded-lg bg-blue-500 px-4 font-medium text-white"
            data-testid="update-button"
            aria-label="Update app now (page will reload)"
          >
            Update
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="min-h-11 min-w-11 rounded-lg font-medium text-foreground"
            aria-label="Dismiss update banner"
            data-testid="update-dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
