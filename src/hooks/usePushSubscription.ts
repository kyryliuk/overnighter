import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { urlBase64ToUint8Array, arrayBufferToBase64 } from '@/lib/push'

export interface UsePushSubscriptionReturn {
  permissionState: NotificationPermission | 'unsupported'
  isSubscribed: boolean
  isLoading: boolean
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
}

export function usePushSubscription(): UsePushSubscriptionReturn {
  const { session } = useAuth()

  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
    return Notification.permission
  })
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermissionState('unsupported')
      return
    }

    setPermissionState(Notification.permission)

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        setIsSubscribed(subscription !== null)
      })
      .catch(() => {
        // SW not available — leave as unsubscribed
      })
  }, [])

  const subscribe = useCallback(async () => {
    if (permissionState === 'denied') return

    setIsLoading(true)
    let subscription: PushSubscription | null = null
    try {
      let currentPermission: NotificationPermission | 'unsupported' = permissionState
      if (currentPermission === 'default') {
        const result = await Notification.requestPermission()
        setPermissionState(result)
        currentPermission = result
        if (result === 'denied') return
      }

      const vapidRes = await fetch('/api/push/vapid-key')
      if (!vapidRes.ok) throw new Error(`VAPID key fetch failed: ${vapidRes.status}`)
      const { publicKey } = (await vapidRes.json()) as { publicKey: string }
      const vapidKeyArray = urlBase64ToUint8Array(publicKey)

      const registration = await navigator.serviceWorker.ready
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKeyArray as Uint8Array<ArrayBuffer>,
      })

      const p256dh = arrayBufferToBase64(subscription.getKey('p256dh')!)
      const auth = arrayBufferToBase64(subscription.getKey('auth')!)

      const apiRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ endpoint: subscription.endpoint, p256dh, auth }),
      })
      if (!apiRes.ok) throw new Error(`Subscribe API failed: ${apiRes.status}`)

      setIsSubscribed(true)

      // Fire-and-forget test notification via SW
      registration.showNotification('Notifications active', {
        body: "You'll be notified when this spot's status changes.",
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
      }).catch(() => {})
    } catch (error) {
      // Clean up orphaned browser subscription on API failure
      if (subscription) {
        try { await subscription.unsubscribe() } catch { /* best-effort */ }
      }
      setIsSubscribed(false)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [permissionState, session?.access_token])

  const unsubscribe = useCallback(async () => {
    setIsLoading(true)
    try {
      // Call API first — only remove browser subscription on success
      const apiRes = await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      })
      if (!apiRes.ok) throw new Error(`Unsubscribe API failed: ${apiRes.status}`)

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
      }

      setIsSubscribed(false)
    } catch (error) {
      setIsSubscribed(true)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [session?.access_token])

  return { permissionState, isSubscribed, isLoading, subscribe, unsubscribe }
}
