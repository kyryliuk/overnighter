import { useEffect, useState } from 'react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { PINS_CACHE_UPDATED_EVENT, readPinsCacheSnapshot } from '@/lib/offline/pinsCache'

function formatCachedAt(cachedAt: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(cachedAt))
}

export default function OfflineStatusBanner() {
  const isOnline = useOnlineStatus()
  const [cachedAt, setCachedAt] = useState<string | null>(
    () => readPinsCacheSnapshot()?.cachedAt ?? null,
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const refreshCacheState = () => setCachedAt(readPinsCacheSnapshot()?.cachedAt ?? null)

    window.addEventListener(PINS_CACHE_UPDATED_EVENT, refreshCacheState)
    window.addEventListener('storage', refreshCacheState)
    window.addEventListener('online', refreshCacheState)
    window.addEventListener('offline', refreshCacheState)

    return () => {
      window.removeEventListener(PINS_CACHE_UPDATED_EVENT, refreshCacheState)
      window.removeEventListener('storage', refreshCacheState)
      window.removeEventListener('online', refreshCacheState)
      window.removeEventListener('offline', refreshCacheState)
    }
  }, [])

  if (isOnline) return null

  const message = cachedAt
    ? `Offline — showing saved map data from ${formatCachedAt(cachedAt)}. Check-ins and reports require a connection.`
    : 'Offline — connect once to download map data. Check-ins and reports require a connection.'

  return (
    <div className="fixed top-4 left-4 right-4 z-[1100] flex justify-center pointer-events-none">
      <p
        role="status"
        className="max-w-xl rounded-lg border border-amber-500/30 bg-background/95 px-4 py-3 text-center text-sm text-foreground shadow-lg"
      >
        {message}
      </p>
    </div>
  )
}
