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

const BADGE_STYLES: Record<string, string> = {
  red: 'bg-red-500/20 text-red-400 border border-red-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  green: 'bg-green-500/20 text-green-400 border border-green-500/30',
  grey: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  dump_closed: 'Dump Closed',
  water_unavailable: 'Water Unavailable',
  no_overnight: 'No Overnight',
  access_blocked: 'Access Blocked',
  other: 'Other',
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

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading flagged pins…</p>
  if (isError) return <p className="text-sm text-red-400">Failed to load flagged pins. Check your connection.</p>
  if (pins.length === 0) return (
    <p className="text-sm text-muted-foreground bg-secondary border border-border rounded-lg px-4 py-3">
      No flagged pins — map data is healthy ✓
    </p>
  )

  const isPending = (pinId: string) =>
    (archiveMutation.isPending && archiveMutation.variables === pinId) ||
    (verifyMutation.isPending && verifyMutation.variables === pinId) ||
    (dismissMutation.isPending && dismissMutation.variables === pinId)

  return (
    <ul className="space-y-3">
      {pins.map((pin) => (
        <li key={pin.id} className="bg-secondary border border-border rounded-xl px-4 py-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1 min-w-0">
              <p className="font-semibold text-foreground truncate">{pin.name}</p>
              <p className="text-xs text-muted-foreground">
                {pin.latitude.toFixed(4)}, {pin.longitude.toFixed(4)}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_STYLES[pin.badge_state] ?? BADGE_STYLES.grey}`}>
                  {pin.badge_state}
                </span>
                <span className="text-xs text-muted-foreground">
                  {pin.flag_count} flag{pin.flag_count !== 1 ? 's' : ''}
                </span>
                {pin.latest_report_type && (
                  <span className="text-xs text-muted-foreground">
                    · {REPORT_TYPE_LABELS[pin.latest_report_type] ?? pin.latest_report_type}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              <button
                aria-label={`Archive Pin ${pin.name}`}
                className="min-h-[44px] px-3 text-sm bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 disabled:opacity-40 transition-colors"
                disabled={isPending(pin.id)}
                onClick={() => archiveMutation.mutate(pin.id)}
              >
                Archive
              </button>
              <button
                aria-label={`Override Badge — Mark Verified ${pin.name}`}
                className="min-h-[44px] px-3 text-sm bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 disabled:opacity-40 transition-colors"
                disabled={isPending(pin.id)}
                onClick={() => verifyMutation.mutate(pin.id)}
              >
                Mark Verified
              </button>
              <button
                aria-label={`Dismiss Flag ${pin.name}`}
                className="min-h-[44px] px-3 text-sm bg-secondary border border-border text-muted-foreground rounded-lg hover:text-foreground disabled:opacity-40 transition-colors"
                disabled={isPending(pin.id)}
                onClick={() => dismissMutation.mutate(pin.id)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
