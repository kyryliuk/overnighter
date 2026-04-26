import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { appendPendingTripMutation, OFFLINE_QUEUED_ERROR } from '@/lib/offline/pendingTripMutations'
import { deleteTrip } from './api'
import { tripQueryKey } from './useTripQuery'

export function useDeleteTripMutation() {
  const queryClient = useQueryClient()
  const { isAuthenticated, session } = useAuth()
  const isOnline = useOnlineStatus()
  const accessToken = session?.access_token
  const userId = session?.user.id ?? null

  return useMutation({
    mutationFn: async (tripId: string) => {
      if (!isAuthenticated || !accessToken) {
        throw new Error('Sign in again to delete your route.')
      }

      if (!isOnline) {
        appendPendingTripMutation({
          id: crypto.randomUUID(),
          kind: 'delete',
          tripId,
          queuedAt: new Date().toISOString(),
        })
        // Throw sentinel so onSuccess does not fire and remove the trip from cache
        // before the server confirms — prevents ghost-trip flicker on reconnect.
        throw new Error(OFFLINE_QUEUED_ERROR)
      }

      return deleteTrip(accessToken, tripId)
    },
    onSuccess: (_, tripId) => {
      queryClient.removeQueries({ queryKey: tripQueryKey(userId, tripId) })
      void queryClient.invalidateQueries({ queryKey: ['trips', userId] })
    },
  })
}
