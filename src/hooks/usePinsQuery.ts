import { useQuery } from '@tanstack/react-query'
import { getAllPins } from '@/lib/supabase/pins'

export function usePinsQuery({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['pins'],
    queryFn: getAllPins,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 min — stale-while-revalidate for offline browsing (NFR-R3)
  })
}
