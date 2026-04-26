import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import type { Trip } from '@/types/trip'
import {
  readPendingTripMutations,
  removePendingTripMutation,
  type PendingTripMutation,
} from '@/lib/offline/pendingTripMutations'
import { useTripDraftStore } from '@/store/tripDraftStore'
import { createTrip, deleteTrip, updateTrip, updateTripStatus } from './api'
import { tripQueryKey } from './useTripQuery'
import { tripsQueryKey } from './useTripsQuery'

const FLUSH_LOCK_KEY = 'pendingTripMutations_flushing'
const FLUSH_LOCK_TTL_MS = 30_000
const MIN_VISIBILITY_FLUSH_INTERVAL_MS = 30_000

export function useOfflineTripQueue(): { isFlushing: boolean; triggerFlush: () => void } {
  const isOnline = useOnlineStatus()
  const { session, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const { markClean, markConflicted, removeDraft, hydrateDraftFromServer } =
    useTripDraftStore()

  const flushingRef = useRef(false)
  const lastFlushTimeRef = useRef(0)
  const [isFlushing, setIsFlushing] = useState(false)

  const accessToken = session?.access_token ?? null
  const userId = session?.user.id ?? null

  const flushQueue = useCallback(async () => {
    if (!isAuthenticated || !accessToken) return
    if (flushingRef.current) return

    // Cross-tab lock to prevent duplicate concurrent flushes
    const lockValue = localStorage.getItem(FLUSH_LOCK_KEY)
    if (lockValue && Date.now() - Number(lockValue) < FLUSH_LOCK_TTL_MS) return

    flushingRef.current = true
    localStorage.setItem(FLUSH_LOCK_KEY, String(Date.now()))
    setIsFlushing(true)
    lastFlushTimeRef.current = Date.now()

    try {
      const pending = readPendingTripMutations()
      for (const mutation of pending) {
        await processMutation(mutation)
      }
    } finally {
      localStorage.removeItem(FLUSH_LOCK_KEY)
      flushingRef.current = false
      setIsFlushing(false)
    }

    async function processMutation(mutation: PendingTripMutation) {
      const { id, kind, tripId, payload } = mutation

      try {
        if (kind === 'update') {
          // Conflict detection: if server cached revision is newer than last synced revision,
          // the server moved ahead without our changes — mark conflict, skip flush
          const cachedTrip = queryClient.getQueryData<Trip>(tripQueryKey(userId, tripId))
          // Read live from store — not from a stale closure snapshot
          const draft = useTripDraftStore.getState().draftsById[tripId]
          if (
            cachedTrip &&
            draft?.lastSyncedRevision !== null &&
            cachedTrip.revision > (draft.lastSyncedRevision ?? 0)
          ) {
            markConflicted(tripId)
            return // Leave mutation in queue
          }

          const updatedTrip = await updateTrip(accessToken!, tripId, payload as Parameters<typeof updateTrip>[2])
          removePendingTripMutation(id)
          // markClean first so hydrateDraftFromServer finds the trip non-dirty and updates lastSyncedRevision
          markClean(tripId)
          hydrateDraftFromServer(updatedTrip)
          queryClient.setQueryData(tripQueryKey(userId, updatedTrip.id), updatedTrip)
          void queryClient.invalidateQueries({ queryKey: ['trips', userId] })
          return
        }

        if (kind === 'updateStatus') {
          const updatedTrip = await updateTripStatus(accessToken!, tripId, (payload as { status: 'draft' | 'archived' }).status)
          removePendingTripMutation(id)
          markClean(tripId)
          queryClient.setQueryData(tripQueryKey(userId, updatedTrip.id), updatedTrip)
          void queryClient.invalidateQueries({ queryKey: ['trips', userId] })
          return
        }

        if (kind === 'delete') {
          await deleteTrip(accessToken!, tripId)
          removePendingTripMutation(id)
          removeDraft(tripId)
          queryClient.removeQueries({ queryKey: tripQueryKey(userId, tripId) })
          void queryClient.invalidateQueries({ queryKey: ['trips', userId] })
          return
        }

        if (kind === 'create') {
          const createdTrip = await createTrip(accessToken!, payload as Parameters<typeof createTrip>[1])
          // Remove placeholder draft (temp tripId) before invalidating
          removeDraft(tripId)
          removePendingTripMutation(id)
          void queryClient.invalidateQueries({ queryKey: tripsQueryKey(userId) })
          // Eagerly update cache with the server-confirmed trip
          queryClient.setQueryData(tripQueryKey(userId, createdTrip.id), createdTrip)
          return
        }
      } catch (error) {
        if (error instanceof Error) {
          const status = extractHttpStatus(error)
          if (status === 409) {
            markConflicted(tripId)
            return // Leave in queue
          }
          if (status !== null && status >= 400 && status < 500) {
            // Bad request data — will never succeed, discard
            removePendingTripMutation(id)
            return
          }
        }
        // Network or 5xx error — leave in queue for next flush attempt
      }
    }
  }, [
    isAuthenticated,
    accessToken,
    userId,
    queryClient,
    markClean,
    markConflicted,
    removeDraft,
    hydrateDraftFromServer,
  ])

  // Flush on reconnect
  useEffect(() => {
    if (isOnline) {
      flushQueue()
    }
  }, [isOnline, flushQueue])

  // Flush on visibility regain (min 30s interval)
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible' || !isOnline) return
      if (Date.now() - lastFlushTimeRef.current < MIN_VISIBILITY_FLUSH_INTERVAL_MS) return
      flushQueue()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isOnline, flushQueue])

  return { isFlushing, triggerFlush: flushQueue }
}

function extractHttpStatus(error: Error): number | null {
  // Heuristic: parse status from error message if API throws with status code
  const match = error.message.match(/\b([45]\d{2})\b/)
  return match ? Number(match[1]) : null
}
