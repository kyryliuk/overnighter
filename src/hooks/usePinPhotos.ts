import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { PinPhoto } from '@/types/photo'
import type { DbPinPhoto } from '@/lib/supabase/types'

export function usePinPhotos(pinId: string) {
  return useQuery<PinPhoto[]>({
    queryKey: ['pin-photos', pinId],
    queryFn: async () => {
      // Two-step query: find check-ins for this pin, then their photos
      const { data: checkIns } = await supabase
        .from('check_ins')
        .select('id')
        .eq('pin_id', pinId)

      if (!checkIns || checkIns.length === 0) return []

      const checkInIds = checkIns.map((ci) => ci.id)
      const { data: photos, error: photosError } = await supabase
        .from('pin_photos')
        .select('id, check_in_id, cdn_url, created_at')
        .in('check_in_id', checkInIds)
        .order('created_at', { ascending: false })
        .limit(5)

      if (photosError || !photos) return []

      return (photos as unknown as DbPinPhoto[]).map((row) => ({
        id: row.id,
        checkInId: row.check_in_id,
        cdnUrl: row.cdn_url,
        createdAt: row.created_at,
      }))
    },
    enabled: !!pinId,
  })
}
