import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import BadgeOverrideDialog from './BadgeOverrideDialog'

interface FlaggedPin {
  id: string
  name: string
  latitude: number
  longitude: number
  badge_state: string
  badge_override: string | null
  is_archived: boolean
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

const REASON_FILTERS = ['dump_closed', 'water_unavailable', 'no_overnight', 'access_blocked', 'other'] as const

export default function FlaggedPinList({ adminToken }: FlaggedPinListProps) {
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = useState('')
  const [reasonFilter, setReasonFilter] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [overrideTarget, setOverrideTarget] = useState<{
    pinId: string
    pinName: string
    currentOverride: string | null
  } | null>(null)

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
      queryClient.invalidateQueries({ queryKey: ['admin', 'all-pins'] })
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
      queryClient.invalidateQueries({ queryKey: ['admin', 'all-pins'] })
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
      queryClient.invalidateQueries({ queryKey: ['admin', 'all-pins'] })
    },
  })

  const badgeOverrideMutation = useMutation({
    mutationFn: async ({ pinId, badge_override }: { pinId: string; badge_override: string | null }) => {
      const res = await fetch(`/api/admin/pins/${pinId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ badge_override }),
      })
      if (!res.ok) throw new Error('Badge override failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'flagged-pins'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'all-pins'] })
      setOverrideTarget(null)
    },
  })

  const unarchiveMutation = useMutation({
    mutationFn: async (pinId: string) => {
      const res = await fetch(`/api/admin/pins/${pinId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: false }),
      })
      if (!res.ok) throw new Error('Unarchive failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'flagged-pins'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'all-pins'] })
    },
  })

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading flagged pins…</p>
  if (isError) return <p className="text-sm text-red-400">Failed to load flagged pins. Check your connection.</p>

  // Client-side filtering
  const filteredPins = pins.filter((pin) => {
    if (!showArchived && pin.is_archived) return false
    if (searchQuery && !pin.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (reasonFilter && pin.latest_report_type !== reasonFilter) return false
    return true
  })

  const isPending = (pinId: string) =>
    (archiveMutation.isPending && archiveMutation.variables === pinId) ||
    (verifyMutation.isPending && verifyMutation.variables === pinId) ||
    (dismissMutation.isPending && dismissMutation.variables === pinId) ||
    (badgeOverrideMutation.isPending && badgeOverrideMutation.variables?.pinId === pinId) ||
    (unarchiveMutation.isPending && unarchiveMutation.variables === pinId)

  return (
    <div className="space-y-3">
      {/* Search & Filters */}
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Search pins by name…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Search pins"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setReasonFilter(null)}
            className={`min-h-[44px] px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              reasonFilter === null
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground border border-border hover:text-foreground'
            }`}
          >
            All
          </button>
          {REASON_FILTERS.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => setReasonFilter(reason === reasonFilter ? null : reason)}
              className={`min-h-[44px] px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                reasonFilter === reason
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground border border-border hover:text-foreground'
              }`}
            >
              {REPORT_TYPE_LABELS[reason]}
            </button>
          ))}
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show Archived
          </label>
        </div>
      </div>

      {/* Pin list */}
      {filteredPins.length === 0 ? (
        <p className="text-sm text-muted-foreground bg-secondary border border-border rounded-lg px-4 py-3">
          {pins.length === 0
            ? 'No flagged pins — map data is healthy ✓'
            : 'No pins match current filters'}
        </p>
      ) : (
        <ul className="space-y-3">
          {filteredPins.map((pin) => {
            const displayBadge = pin.badge_override ?? pin.badge_state
            return (
              <li key={pin.id} className="bg-secondary border border-border rounded-xl px-4 py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{pin.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {pin.latitude.toFixed(4)}, {pin.longitude.toFixed(4)}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_STYLES[displayBadge] ?? BADGE_STYLES.grey}`}
                      >
                        {displayBadge}
                        {pin.badge_override && ' 🔒'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {pin.flag_count} flag{pin.flag_count !== 1 ? 's' : ''}
                      </span>
                      {pin.latest_report_type && (
                        <span className="text-xs text-muted-foreground">
                          · {REPORT_TYPE_LABELS[pin.latest_report_type] ?? pin.latest_report_type}
                        </span>
                      )}
                      {pin.is_archived && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">
                          Archived
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    {pin.is_archived ? (
                      <button
                        aria-label={`Unarchive Pin ${pin.name}`}
                        className="min-h-[44px] px-3 text-sm bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 disabled:opacity-40 transition-colors"
                        disabled={isPending(pin.id)}
                        onClick={() => unarchiveMutation.mutate(pin.id)}
                      >
                        Unarchive
                      </button>
                    ) : (
                      <button
                        aria-label={`Archive Pin ${pin.name}`}
                        className="min-h-[44px] px-3 text-sm bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 disabled:opacity-40 transition-colors"
                        disabled={isPending(pin.id)}
                        onClick={() => archiveMutation.mutate(pin.id)}
                      >
                        Archive
                      </button>
                    )}
                    <button
                      aria-label={`Override Badge ${pin.name}`}
                      className="min-h-[44px] px-3 text-sm bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-lg hover:bg-sky-500/20 disabled:opacity-40 transition-colors"
                      disabled={isPending(pin.id)}
                      onClick={() =>
                        setOverrideTarget({
                          pinId: pin.id,
                          pinName: pin.name,
                          currentOverride: pin.badge_override,
                        })
                      }
                    >
                      Override Badge
                    </button>
                    <button
                      aria-label={`Mark Verified ${pin.name}`}
                      className="min-h-[44px] px-3 text-sm bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 disabled:opacity-40 transition-colors"
                      disabled={isPending(pin.id)}
                      onClick={() => verifyMutation.mutate(pin.id)}
                    >
                      Mark Verified
                    </button>
                    <button
                      aria-label={`Clear Flags ${pin.name}`}
                      className="min-h-[44px] px-3 text-sm bg-secondary border border-border text-muted-foreground rounded-lg hover:text-foreground disabled:opacity-40 transition-colors"
                      disabled={isPending(pin.id)}
                      onClick={() => dismissMutation.mutate(pin.id)}
                    >
                      Clear Flags
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Badge Override Dialog */}
      {overrideTarget && (
        <BadgeOverrideDialog
          open={overrideTarget !== null}
          onOpenChange={(open) => {
            if (!open) setOverrideTarget(null)
          }}
          pinName={overrideTarget.pinName}
          currentOverride={overrideTarget.currentOverride}
          onConfirm={(badge) => {
            badgeOverrideMutation.mutate({
              pinId: overrideTarget.pinId,
              badge_override: badge,
            })
          }}
          isLoading={badgeOverrideMutation.isPending}
        />
      )}
    </div>
  )
}
