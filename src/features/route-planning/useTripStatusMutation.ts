import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { updateTripStatus } from './api'
import { tripQueryKey } from './useTripQuery'

export function useTripStatusMutation() {
  const queryClient = useQueryClient()
  const { isAuthenticated, session } = useAuth()
  const accessToken = session?.access_token
  const userId = session?.user.id ?? null

  return useMutation({
    mutationFn: async ({ tripId, status }: { tripId: string; status: 'draft' | 'archived' }) => {
      if (!isAuthenticated || !accessToken) {
        throw new Error('Sign in again to update your route.')
      }
      return updateTripStatus(accessToken, tripId, status)
    },
    onSuccess: (updatedTrip) => {
      queryClient.setQueryData(tripQueryKey(userId, updatedTrip.id), updatedTrip)
      void queryClient.invalidateQueries({ queryKey: ['trips', userId] })
    },
  })
}
