import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import type { Trip } from '@/types/trip'
import { fetchTrips } from './api'

export function tripsQueryKey(userId: string | null, options?: { includeArchived?: boolean }) {
  return ['trips', userId, { includeArchived: options?.includeArchived ?? false }] as const
}

export function useTripsQuery({ enabled = true, includeArchived = false }: { enabled?: boolean; includeArchived?: boolean } = {}) {
  const { isAuthenticated, session } = useAuth()
  const accessToken = session?.access_token
  const userId = session?.user.id ?? null

  return useQuery<Trip[]>({
    queryKey: tripsQueryKey(userId, { includeArchived }),
    queryFn: () => fetchTrips(accessToken ?? '', { includeArchived }),
    enabled: enabled && isAuthenticated && Boolean(accessToken),
    staleTime: 60_000,
  })
}
