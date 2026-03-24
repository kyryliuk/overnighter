import { useEffect, useRef, useCallback } from 'react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { readPendingCheckins, removePendingCheckin } from '@/lib/offline/pendingCheckins'

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

async function submitCheckin(checkin: {
  pinId: string
  deviceId: string
  status: string
  note?: string
  timestamp: string
}): Promise<'success' | 'client_error' | 'retry_exhausted'> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkin),
      })
      if (res.ok) return 'success'
      // 4xx = bad data, will never succeed — don't retry
      if (res.status >= 400 && res.status < 500) return 'client_error'
    } catch {
      // Network error — retry
    }
    if (attempt < MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
    }
  }
  return 'retry_exhausted'
}

const FLUSH_LOCK_KEY = 'pendingCheckins_flushing'
const FLUSH_LOCK_TTL_MS = 30000

export function useOfflineCheckinQueue() {
  const isOnline = useOnlineStatus()
  const flushingRef = useRef(false)

  const flushQueue = useCallback(async () => {
    if (flushingRef.current) return

    // Cross-tab lock via localStorage to prevent duplicate submissions
    const lockValue = localStorage.getItem(FLUSH_LOCK_KEY)
    if (lockValue && Date.now() - Number(lockValue) < FLUSH_LOCK_TTL_MS) return

    flushingRef.current = true
    localStorage.setItem(FLUSH_LOCK_KEY, String(Date.now()))

    try {
      const pending = readPendingCheckins()
      for (const checkin of pending) {
        const result = await submitCheckin({
          pinId: checkin.pinId,
          deviceId: checkin.deviceId,
          status: checkin.status,
          note: checkin.note,
          timestamp: checkin.timestamp,
        })
        // Remove on success or on 4xx (bad data that will never succeed)
        if (result === 'success' || result === 'client_error') {
          removePendingCheckin(checkin.queuedAt)
        }
      }
    } finally {
      localStorage.removeItem(FLUSH_LOCK_KEY)
      flushingRef.current = false
    }
  }, [])

  // Flush on mount when online (AC3) and on reconnect (AC2)
  useEffect(() => {
    if (isOnline) {
      flushQueue()
    }
  }, [isOnline, flushQueue])
}
