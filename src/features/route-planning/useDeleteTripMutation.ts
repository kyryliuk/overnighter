import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { deleteTrip } from './api'
import { tripQueryKey } from './useTripQuery'

export function useDeleteTripMutation() {
  const queryClient = useQueryClient()
  const { isAuthenticated, session } = useAuth()
  const accessToken = session?.access_token
  const userId = session?.user.id ?? null

  return useMutation({
    mutationFn: async (tripId: string) => {
      if (!isAuthenticated || !accessToken) {
        throw new Error('Sign in again to delete your route.')
      }
      return deleteTrip(accessToken, tripId)
    },
    onSuccess: (_, tripId) => {
      queryClient.removeQueries({ queryKey: tripQueryKey(userId, tripId) })
      void queryClient.invalidateQueries({ queryKey: ['trips', userId] })
    },
  })
}
