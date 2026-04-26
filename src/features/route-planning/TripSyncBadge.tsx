import { useTripSyncStatus } from './useTripSyncStatus'

export function TripSyncBadge({ tripId }: { tripId: string }) {
  const status = useTripSyncStatus(tripId)

  return (
    <span aria-live="polite" aria-atomic="true" data-testid="trip-sync-indicator">
      {status === 'synced' && (
        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
          <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Synced
        </span>
      )}
      {status === 'local-draft' && (
        <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
          <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
          Local draft
        </span>
      )}
      {status === 'sync-pending' && (
        <span className="inline-flex items-center gap-1 text-[11px] text-sky-400">
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400"
          />
          Sync pending
        </span>
      )}
    </span>
  )
}
