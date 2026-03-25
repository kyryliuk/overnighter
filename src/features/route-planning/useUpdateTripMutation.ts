import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import type { TripWritePayload } from '@/types/trip'
import { updateTrip } from './api'
import { tripQueryKey } from './useTripQuery'
import { tripsQueryKey } from './useTripsQuery'

interface UpdateTripMutationInput {
  tripId: string
  payload: TripWritePayload
}

export function useUpdateTripMutation() {
  const queryClient = useQueryClient()
  const { isAuthenticated, session } = useAuth()
  const accessToken = session?.access_token
  const userId = session?.user.id ?? null

  return useMutation({
    mutationFn: async ({ tripId, payload }: UpdateTripMutationInput) => {
      if (!isAuthenticated || !accessToken) {
        throw new Error('Sign in again to update your route.')
      }

      return updateTrip(accessToken, tripId, payload)
    },
    onSuccess: (updatedTrip) => {
      queryClient.setQueryData(tripQueryKey(userId, updatedTrip.id), updatedTrip)
      queryClient.setQueryData(tripsQueryKey(userId), (currentTrips: unknown) => {
        const trips = Array.isArray(currentTrips) ? currentTrips : []
        const nextTrips = trips.map((trip) => (
          trip && typeof trip === 'object' && 'id' in trip && trip.id === updatedTrip.id
            ? updatedTrip
            : trip
        ))
        return nextTrips.some((trip) => trip && typeof trip === 'object' && 'id' in trip && trip.id === updatedTrip.id)
          ? nextTrips
          : [updatedTrip, ...nextTrips]
      })
      void queryClient.invalidateQueries({ queryKey: tripsQueryKey(userId) })
      void queryClient.invalidateQueries({ queryKey: tripQueryKey(userId, updatedTrip.id) })
    },
  })
}
