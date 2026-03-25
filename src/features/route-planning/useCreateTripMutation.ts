import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import type { TripWritePayload } from '@/types/trip'
import { createTrip } from './api'
import { tripsQueryKey } from './useTripsQuery'

export function useCreateTripMutation() {
  const queryClient = useQueryClient()
  const { isAuthenticated, session } = useAuth()
  const accessToken = session?.access_token
  const userId = session?.user.id ?? null

  return useMutation({
    mutationFn: async (payload: TripWritePayload) => {
      if (!isAuthenticated || !accessToken) {
        throw new Error('Sign in again to save your route.')
      }

      return createTrip(accessToken, payload)
    },
    onSuccess: (createdTrip) => {
      queryClient.setQueryData(tripsQueryKey(userId), (currentTrips: unknown) => {
        const trips = Array.isArray(currentTrips) ? currentTrips : []
        return [createdTrip, ...trips.filter((trip) => trip && typeof trip === 'object' && 'id' in trip && trip.id !== createdTrip.id)]
      })
      void queryClient.invalidateQueries({ queryKey: ['trips'] })
    },
  })
}
