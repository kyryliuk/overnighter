import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import type { TripWritePayload } from '@/types/trip'
import { appendPendingTripMutation, OFFLINE_QUEUED_ERROR } from '@/lib/offline/pendingTripMutations'
import { updateTrip } from './api'
import { tripQueryKey } from './useTripQuery'

interface UpdateTripMutationInput {
  tripId: string
  payload: TripWritePayload
}

export function useUpdateTripMutation() {
  const queryClient = useQueryClient()
  const { isAuthenticated, session } = useAuth()
  const isOnline = useOnlineStatus()
  const accessToken = session?.access_token
  const userId = session?.user.id ?? null

  return useMutation({
    mutationFn: async ({ tripId, payload }: UpdateTripMutationInput) => {
      if (!isAuthenticated || !accessToken) {
        throw new Error('Sign in again to update your route.')
      }

      if (!isOnline) {
        appendPendingTripMutation({
          id: crypto.randomUUID(),
          kind: 'update',
          tripId,
          payload,
          queuedAt: new Date().toISOString(),
        })
        throw new Error(OFFLINE_QUEUED_ERROR)
      }

      return updateTrip(accessToken, tripId, payload)
    },
    onSuccess: (updatedTrip) => {
      queryClient.setQueryData(tripQueryKey(userId, updatedTrip.id), updatedTrip)
      void queryClient.invalidateQueries({ queryKey: ['trips', userId] })
      void queryClient.invalidateQueries({ queryKey: tripQueryKey(userId, updatedTrip.id) })
    },
  })
}
