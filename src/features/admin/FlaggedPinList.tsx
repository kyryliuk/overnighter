import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface FlaggedPin {
  id: string
  name: string
  latitude: number
  longitude: number
  badge_state: string
  flag_count: number
  latest_report_type: string | null
}

interface FlaggedPinListProps {
  adminToken: string
}

export default function FlaggedPinList({ adminToken }: FlaggedPinListProps) {
  const queryClient = useQueryClient()

  const { data: pins = [], isLoading, isError } = useQuery({
    queryKey: ['admin', 'flagged-pins', adminToken],
    queryFn: async () => {
      const res = await fetch('/api/admin/flagged-pins', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      if (!res.ok) throw new Error('Failed to fetch flagged pins')
      return res.json() as Promise<FlaggedPin[]>
    },
  })

  const archiveMutation = useMutation({
    mutationFn: async (pinId: string) => {
      const res = await fetch(`/api/pins/${pinId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      if (!res.ok) throw new Error('Archive failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'flagged-pins'] })
    },
  })

  const verifyMutation = useMutation({
    mutationFn: async (pinId: string) => {
      const res = await fetch(`/api/pins/${pinId}/verify`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
      })
      if (!res.ok) throw new Error('Verify failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'flagged-pins'] })
    },
  })

  const dismissMutation = useMutation({
    mutationFn: async (pinId: string) => {
      const res = await fetch(`/api/pins/${pinId}/verify`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss' }),
      })
      if (!res.ok) throw new Error('Dismiss failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'flagged-pins'] })
    },
  })

  if (isLoading) return <p>Loading flagged pins...</p>
  if (isError) return <p>Failed to load flagged pins. Check your connection.</p>
  if (pins.length === 0) return <p>No flagged pins — map data is healthy</p>

  const isPending = (pinId: string) =>
    (archiveMutation.isPending && archiveMutation.variables === pinId) ||
    (verifyMutation.isPending && verifyMutation.variables === pinId) ||
    (dismissMutation.isPending && dismissMutation.variables === pinId)

  return (
    <ul>
      {pins.map((pin) => (
        <li key={pin.id}>
          <span>{pin.name}</span>
          <span>{pin.latitude}, {pin.longitude}</span>
          <span>{pin.badge_state}</span>
          <span>Flags: {pin.flag_count}</span>
          <span>Latest: {pin.latest_report_type ?? '—'}</span>
          <button
            aria-label={`Archive Pin ${pin.name}`}
            className="min-h-[44px] min-w-[44px]"
            disabled={isPending(pin.id)}
            onClick={() => archiveMutation.mutate(pin.id)}
          >
            Archive Pin
          </button>
          <button
            aria-label={`Override Badge — Mark Verified ${pin.name}`}
            className="min-h-[44px] min-w-[44px]"
            disabled={isPending(pin.id)}
            onClick={() => verifyMutation.mutate(pin.id)}
          >
            Override Badge — Mark Verified
          </button>
          <button
            aria-label={`Dismiss Flag ${pin.name}`}
            className="min-h-[44px] min-w-[44px]"
            disabled={isPending(pin.id)}
            onClick={() => dismissMutation.mutate(pin.id)}
          >
            Dismiss Flag
          </button>
        </li>
      ))}
    </ul>
  )
}
