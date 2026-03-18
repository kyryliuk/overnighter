import { useQuery } from '@tanstack/react-query'
import { getAllPins } from '@/lib/supabase/pins'

export function usePinsQuery({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['pins'],
    queryFn: getAllPins,
    enabled,
  })
}
