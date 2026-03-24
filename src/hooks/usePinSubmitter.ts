import { useQuery } from '@tanstack/react-query'

export function usePinSubmitter(pinId: string | undefined, pinType: string | undefined) {
  return useQuery({
    queryKey: ['pin-submitter', pinId],
    enabled: Boolean(pinId) && pinType === 'community',
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await fetch(`/api/pins/${pinId}/submitter`)
      if (!res.ok) return null
      const data = (await res.json()) as { submitter: string | null }
      return data.submitter
    },
  })
}
