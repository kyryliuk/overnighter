import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import type { Trip, TripStatus } from '@/types/trip'
import { appendPendingTripMutation, OFFLINE_QUEUED_ERROR } from '@/lib/offline/pendingTripMutations'
import { updateTripStatus } from './api'
import { tripQueryKey } from './useTripQuery'

export function useTripStatusMutation() {
  const queryClient = useQueryClient()
  const { isAuthenticated, session } = useAuth()
  const isOnline = useOnlineStatus()
  const accessToken = session?.access_token
  const userId = session?.user.id ?? null

  return useMutation({
    mutationFn: async ({ tripId, status }: { tripId: string; status: TripStatus }) => {
      if (!isAuthenticated || !accessToken) {
        throw new Error('Sign in again to update your route.')
      }

      if (!isOnline) {
        appendPendingTripMutation({
          id: crypto.randomUUID(),
          kind: 'updateStatus',
          tripId,
          payload: { status },
          queuedAt: new Date().toISOString(),
        })
        throw new Error(OFFLINE_QUEUED_ERROR)
      }

      return updateTripStatus(accessToken, tripId, status)
    },
    onSuccess: (updatedTrip) => {
      queryClient.setQueryData(tripQueryKey(userId, updatedTrip.id), updatedTrip)
      void queryClient.invalidateQueries({ queryKey: ['trips', userId] })
    },
  })
}
