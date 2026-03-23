import { useEffect, useState } from 'react'

function getInitialOnlineStatus() {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(getInitialOnlineStatus)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
