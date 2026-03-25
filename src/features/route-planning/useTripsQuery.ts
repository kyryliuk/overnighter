import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import type { Trip } from '@/types/trip'
import { fetchTrips } from './api'

export function tripsQueryKey(userId: string | null) {
  return ['trips', userId] as const
}

export function useTripsQuery({ enabled = true }: { enabled?: boolean } = {}) {
  const { isAuthenticated, session } = useAuth()
  const accessToken = session?.access_token
  const userId = session?.user.id ?? null

  return useQuery<Trip[]>({
    queryKey: tripsQueryKey(userId),
    queryFn: () => fetchTrips(accessToken ?? ''),
    enabled: enabled && isAuthenticated && Boolean(accessToken),
    staleTime: 60_000,
  })
}
