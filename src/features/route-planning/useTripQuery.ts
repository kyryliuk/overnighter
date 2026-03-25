import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import type { Trip } from '@/types/trip'
import { fetchTrip } from './api'

export function tripQueryKey(userId: string | null, tripId: string | null) {
  return ['trips', userId, tripId] as const
}

export function useTripQuery(
  tripId: string | null,
  {
    enabled = true,
    initialTrip,
  }: {
    enabled?: boolean
    initialTrip?: Trip | null
  } = {},
) {
  const { isAuthenticated, session } = useAuth()
  const accessToken = session?.access_token
  const userId = session?.user.id ?? null

  return useQuery<Trip>({
    queryKey: tripQueryKey(userId, tripId),
    queryFn: async () => {
      if (!tripId) {
        throw new Error('Trip id is required.')
      }

      if (!accessToken) {
        throw new Error('Authentication required to load trip.')
      }

      return fetchTrip(accessToken, tripId)
    },
    enabled: enabled && isAuthenticated && Boolean(accessToken) && Boolean(tripId),
    initialData: initialTrip ?? undefined,
    staleTime: 60_000,
  })
}
