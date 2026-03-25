import { useQuery } from '@tanstack/react-query'
import { getAllPins, fetchPinsByRadius } from '@/lib/supabase/pins'
import { readPinsCacheSnapshot, savePinsCacheSnapshot } from '@/lib/offline/pinsCache'
import type { Pin } from '@/types/pin'

export interface PinsQueryParams {
  enabled?: boolean
  lat?: number
  lng?: number
  radiusM?: number
}

export function usePinsQuery({ enabled = true, lat, lng, radiusM }: PinsQueryParams = {}) {
  const hasViewport = lat !== undefined && lng !== undefined && radiusM !== undefined

  return useQuery<Pin[]>({
    queryKey: hasViewport ? ['pins', { lat, lng, radiusM }] : ['pins'],
    queryFn: async () => {
      try {
        if (hasViewport) {
          const result = await fetchPinsByRadius(lat, lng, radiusM)
          return result.pins as Pin[]
        }
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
    staleTime: hasViewport ? 30_000 : 5 * 60 * 1000,
  })
}
