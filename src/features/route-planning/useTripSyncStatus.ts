import { useEffect, useState } from 'react'
import { useTripDraftStore } from '@/store/tripDraftStore'
import {
  readPendingTripMutations,
  PENDING_TRIP_MUTATIONS_UPDATED_EVENT,
} from '@/lib/offline/pendingTripMutations'

export type TripSyncStatus = 'synced' | 'local-draft' | 'sync-pending' | 'conflicted'

export function useTripSyncStatus(tripId: string | null | undefined): TripSyncStatus {
  const isDirty = useTripDraftStore((state) =>
    tripId ? state.dirtyTripIds.includes(tripId) : false,
  )
  const isConflicted = useTripDraftStore((state) =>
    tripId ? state.conflictedTripIds.includes(tripId) : false,
  )

  // Eagerly read queue so first render reflects the correct state (e.g. after page reload).
  const [hasPendingMutation, setHasPendingMutation] = useState(() => {
    if (!tripId) return false
    return readPendingTripMutations().some((m) => m.tripId === tripId)
  })

  useEffect(() => {
    if (!tripId) return

    function handleQueueChange() {
      setHasPendingMutation(readPendingTripMutations().some((m) => m.tripId === tripId))
    }

    // Sync immediately in case tripId changed since mount (mitigates stale state on prop change)
    handleQueueChange()

    window.addEventListener(PENDING_TRIP_MUTATIONS_UPDATED_EVENT, handleQueueChange)
    return () => window.removeEventListener(PENDING_TRIP_MUTATIONS_UPDATED_EVENT, handleQueueChange)
  }, [tripId])

  if (!isDirty) return 'synced'
  if (isConflicted) return 'conflicted'
  if (hasPendingMutation) return 'sync-pending'
  return 'local-draft'
}
