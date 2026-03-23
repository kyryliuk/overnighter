import { useQuery } from '@tanstack/react-query'
import { getAllPins } from '@/lib/supabase/pins'
import { readPinsCacheSnapshot, savePinsCacheSnapshot } from '@/lib/offline/pinsCache'

export function usePinsQuery({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['pins'],
    queryFn: async () => {
      try {
        const pins = await getAllPins()
        savePinsCacheSnapshot(pins)
        return pins
      } catch (error) {
        const cachedSnapshot = readPinsCacheSnapshot()
        if (cachedSnapshot) return cachedSnapshot.pins
        throw error
      }
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 min — stale-while-revalidate for offline browsing (NFR-R3)
  })
}
