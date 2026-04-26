import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import type { Trip, TripWritePayload } from '@/types/trip'
import { appendPendingTripMutation, OFFLINE_QUEUED_ERROR } from '@/lib/offline/pendingTripMutations'
import { createTrip } from './api'

export function useCreateTripMutation() {
  const queryClient = useQueryClient()
  const { isAuthenticated, session } = useAuth()
  const isOnline = useOnlineStatus()
  const accessToken = session?.access_token
  const userId = session?.user.id ?? null

  return useMutation({
    mutationFn: async (payload: TripWritePayload) => {
      if (!isAuthenticated || !accessToken) {
        throw new Error('Sign in again to save your route.')
      }

      if (!isOnline) {
        appendPendingTripMutation({
          id: crypto.randomUUID(),
          kind: 'create',
          // Local placeholder ID — not a real server trip ID. Story 4.3 flush logic
          // must treat 'create' queue items specially and update references after
          // the server assigns the actual ID.
          tripId: crypto.randomUUID(),
          payload,
          queuedAt: new Date().toISOString(),
        })
        throw new Error(OFFLINE_QUEUED_ERROR)
      }

      return createTrip(accessToken, payload)
    },
    onSuccess: (createdTrip) => {
      queryClient.setQueriesData<unknown>(
        { queryKey: ['trips', userId] },
        (currentTrips: unknown) => {
          const trips = Array.isArray(currentTrips) ? currentTrips : []
          return [createdTrip, ...trips.filter((trip) => trip && typeof trip === 'object' && 'id' in trip && trip.id !== createdTrip.id)]
        },
      )
      void queryClient.invalidateQueries({ queryKey: ['trips', userId] })
    },
  })
}
