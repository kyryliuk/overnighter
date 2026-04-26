import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PremiumGate } from '@/components/PremiumGate'
import { useUIStore } from '@/store/uiStore'
import { useTripDraftStore } from '@/store/tripDraftStore'
import { useTripPlansStore } from '@/store/tripPlansStore'
import { OFFLINE_QUEUED_ERROR } from '@/lib/offline/pendingTripMutations'
import type { Trip, TripWritePayload } from '@/types/trip'
import RouteBuilderSheet, { type PendingRouteStopIntent } from './RouteBuilderSheet'
import { TripSyncBadge } from './TripSyncBadge'
import { buildDuplicateTripPayload } from './routePlanning'
import { useTripCorridorPreview } from './TripCorridorPreviewContext'
import { useCreateTripMutation } from './useCreateTripMutation'
import { useDeleteTripMutation } from './useDeleteTripMutation'
import { useOfflineTripQueue } from './useOfflineTripQueue'
import { useTripQuery } from './useTripQuery'
import { useTripsQuery } from './useTripsQuery'
import { useTripStatusMutation } from './useTripStatusMutation'
import { useUpdateTripMutation } from './useUpdateTripMutation'

function formatUpdatedAt(updatedAt: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(updatedAt))
}

function updateTripIdParam(currentParams: URLSearchParams, tripId: string | null) {
  const nextParams = new URLSearchParams(currentParams)

  if (tripId) {
    nextParams.set('tripId', tripId)
  } else {
    nextParams.delete('tripId')
  }

  return nextParams
}

function clearPendingStopParams(currentParams: URLSearchParams) {
  const nextParams = new URLSearchParams(currentParams)
  nextParams.delete('addStopPinId')
  nextParams.delete('addStopSource')
  return nextParams
}

function buildPreviewTrip(baseTrip: Trip, payload: TripWritePayload | null): Trip {
  if (!payload?.destination) {
    return baseTrip
  }

  const waypointStops = (payload.stops ?? []).map((stop, index) => ({
    id: stop.id ?? `preview-stop-${stop.place.id}-${index}`,
    stopOrder: index,
    stopKind: 'waypoint' as const,
    source: stop.source ?? 'manual',
    pinId: stop.pinId ?? null,
    place: stop.place,
    notes: stop.notes ?? '',
    createdAt: baseTrip.createdAt,
    updatedAt: baseTrip.updatedAt,
  }))

  return {
    ...baseTrip,
    title: payload.title ?? baseTrip.title,
    notes: payload.notes ?? '',
    origin: payload.origin ?? baseTrip.origin ?? null,
    destination: payload.destination,
    stopCount: waypointStops.length + 1,
    stops: [
      ...waypointStops,
      {
        id: `${baseTrip.id}-destination`,
        stopOrder: waypointStops.length,
        stopKind: 'destination',
        source: 'manual',
        pinId: null,
        place: payload.destination,
        notes: '',
        createdAt: baseTrip.createdAt,
        updatedAt: baseTrip.updatedAt,
      },
    ],
  }
}

function PlannerShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-20 bg-background/70 px-4 py-6 text-foreground backdrop-blur-sm sm:px-6 lg:px-8"
      data-testid="my-routes-screen"
    >
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col rounded-[28px] border border-border bg-secondary/60 backdrop-blur md:grid md:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] md:overflow-hidden">
        <section className="relative hidden min-h-[420px] overflow-hidden border-b border-border/60 bg-gradient-to-br from-sky-950 via-slate-950 to-background p-6 md:flex md:flex-col md:justify-end md:border-b-0 md:border-r">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.28),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.14),_transparent_35%)]" />
          <div className="relative max-w-md space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">{eyebrow}</p>
            <h1 className="text-3xl font-semibold text-white">{title}</h1>
            <p className="text-sm leading-6 text-slate-200">{description}</p>
          </div>
        </section>
        <section className="flex flex-1 flex-col justify-end bg-background/95">
          <div className="rounded-t-[28px] border-t border-border bg-background px-5 pb-6 pt-4 sm:px-6 md:h-full md:rounded-none md:border-t-0">
            <div className="mx-auto max-w-xl space-y-4">
              <div className="space-y-2 md:hidden">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-400">{eyebrow}</p>
                <h1 className="text-2xl font-semibold">{title}</h1>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              {children}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: Trip['status'] }) {
  const label = status === 'archived' ? 'Archived' : 'Draft'
  const classes =
    status === 'archived'
      ? 'bg-zinc-700/60 text-zinc-300'
      : 'bg-sky-500/15 text-sky-300'

  return (
    <span
      data-testid="trip-status-badge"
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ${classes}`}
    >
      {label}
    </span>
  )
}

function TripListItem({
  trip,
  isSelected,
  onOpen,
  onDuplicate,
  isDuplicating,
  onArchive,
  onUnarchive,
  onDelete,
  isArchiving,
  isDeleting,
}: {
  trip: Trip
  isSelected: boolean
  onOpen: (tripId: string) => void
  onDuplicate: (tripId: string) => void
  isDuplicating: boolean
  onArchive: (tripId: string) => void
  onUnarchive: (tripId: string) => void
  onDelete: (tripId: string) => void
  isArchiving: boolean
  isDeleting: boolean
}) {
  const isArchived = trip.status === 'archived'

  return (
    <article
      className={`rounded-2xl border bg-secondary p-4 transition ${isSelected ? 'border-sky-400/70 ring-1 ring-sky-400/40' : 'border-border'} ${isArchived ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold">{trip.title}</h2>
            <StatusBadge status={trip.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {trip.destination.name} · {trip.stopCount} stop{trip.stopCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-xs text-muted-foreground">Updated {formatUpdatedAt(trip.updatedAt)}</span>
          <TripSyncBadge tripId={trip.id} />
        </div>
      </div>
      {trip.notes ? (
        <p className="mt-3 text-sm text-muted-foreground">{trip.notes}</p>
      ) : null}
      <div className="mt-4 flex items-center justify-between gap-3">
        {isSelected ? (
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-400">Open in planner</p>
        ) : <span />}
        <div className="flex gap-2">
          {!isArchived && (
            <button
              type="button"
              data-testid="archive-trip-button"
              onClick={() => onArchive(trip.id)}
              disabled={isArchiving}
              className="min-h-[44px] rounded-full border border-border px-4 text-sm font-medium transition hover:border-amber-400 disabled:opacity-50"
            >
              {isArchiving ? 'Archiving…' : 'Archive'}
            </button>
          )}
          {isArchived && (
            <button
              type="button"
              data-testid="unarchive-trip-button"
              onClick={() => onUnarchive(trip.id)}
              disabled={isArchiving}
              className="min-h-[44px] rounded-full border border-border px-4 text-sm font-medium transition hover:border-sky-400 disabled:opacity-50"
            >
              {isArchiving ? 'Restoring…' : 'Unarchive'}
            </button>
          )}
          {isArchived && (
            <button
              type="button"
              data-testid="delete-trip-button"
              onClick={() => onDelete(trip.id)}
              disabled={isDeleting}
              className="min-h-[44px] rounded-full border border-red-500/50 px-4 text-sm font-medium text-red-300 transition hover:border-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              {isDeleting ? 'Deleting…' : 'Delete permanently'}
            </button>
          )}
          {!isArchived ? (
            <button
              type="button"
              data-testid="duplicate-trip-button"
              disabled={isDuplicating}
              onClick={() => onDuplicate(trip.id)}
              className="min-h-[44px] rounded-full border border-border px-4 text-sm font-medium transition hover:border-sky-400 disabled:opacity-50"
            >
              {isDuplicating ? 'Duplicating…' : 'Duplicate'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onOpen(trip.id)}
            aria-pressed={isSelected}
            className="min-h-[44px] rounded-full border border-border px-4 text-sm font-medium transition hover:border-sky-400"
          >
            {isArchived ? 'Reopen route' : (isSelected ? 'Reopen route' : 'Resume route')}
          </button>
        </div>
      </div>
    </article>
  )
}

function MyRoutesContent() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const setActiveTripId = useUIStore((state) => state.setActiveTripId)
  const { setPreviewTrip } = useTripCorridorPreview()
  const { hydrateDraftFromServer, removeDraft } = useTripDraftStore()
  const [isCreating, setIsCreating] = useState(false)
  const [draftPreviewPayload, setDraftPreviewPayload] = useState<TripWritePayload | null>(null)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('recent')
  const [duplicatingTripId, setDuplicatingTripId] = useState<string | null>(null)
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const [archivingTripId, setArchivingTripId] = useState<string | null>(null)
  const [deletingTrip, setDeletingTrip] = useState<Trip | null>(null)
  const requestedTripId = searchParams.get('tripId')
  const pendingAddStopPinId = searchParams.get('addStopPinId')
  const pendingAddStopSource = searchParams.get('addStopSource')
  const tripsQuery = useTripsQuery({ includeArchived })
  const createTripMutation = useCreateTripMutation()
  const updateTripMutation = useUpdateTripMutation()
  const tripStatusMutation = useTripStatusMutation()
  const deleteTripMutation = useDeleteTripMutation()
  useOfflineTripQueue()
  const legacyPlans = useTripPlansStore((state) => state.tripPlans)
  const legacyPlansHydrated = useTripPlansStore((state) => state.hasHydrated)
  // Secondary query to check if any normalized trips exist (including archived),
  // so we don't show the legacy migration notice when the user only has archived trips.
  const allTripsQuery = useTripsQuery({ includeArchived: true })
  const hasAnyNormalizedTrips = (allTripsQuery.data?.length ?? 0) > 0
  const rawTrips = useMemo(() => tripsQuery.data ?? [], [tripsQuery.data])
  const trips = useMemo(() => {
    if (sortOrder === 'oldest') return [...rawTrips].reverse()
    return rawTrips
  }, [rawTrips, sortOrder])
  const listSelectedTrip = useMemo(
    () => trips.find((trip) => trip.id === requestedTripId) ?? null,
    [requestedTripId, trips],
  )
  const tripQuery = useTripQuery(requestedTripId, {
    enabled: Boolean(requestedTripId),
    initialTrip: listSelectedTrip,
  })
  const activeTrip = requestedTripId ? (tripQuery.data ?? listSelectedTrip) : null
  const pendingAddStop = useMemo<PendingRouteStopIntent | null>(() => {
    if (!pendingAddStopPinId) return null

    if (
      pendingAddStopSource !== 'manual'
      && pendingAddStopSource !== 'saved'
      && pendingAddStopSource !== 'suggested'
      && pendingAddStopSource !== 'imported'
    ) {
      return null
    }

    return {
      pinId: pendingAddStopPinId,
      source: pendingAddStopSource,
    }
  }, [pendingAddStopPinId, pendingAddStopSource])
  const isBuilderOpen = isCreating || Boolean(requestedTripId && activeTrip)
  const activeTripError = requestedTripId && tripQuery.isError
    ? (tripQuery.error instanceof Error ? tripQuery.error.message : 'Unable to reopen this saved route right now.')
    : null

  useEffect(() => {
    setActiveTripId(isCreating ? null : requestedTripId)
  }, [isCreating, requestedTripId, setActiveTripId])

  useEffect(() => {
    if (isCreating || !requestedTripId || !activeTrip) {
      setPreviewTrip(null)
      return
    }

    setPreviewTrip(buildPreviewTrip(activeTrip, draftPreviewPayload))

    return () => {
      setPreviewTrip(null)
    }
  }, [activeTrip, draftPreviewPayload, isCreating, requestedTripId, setPreviewTrip])

  useEffect(() => {
    if (!deletingTrip) return
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setDeletingTrip(null)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [deletingTrip])

  // Hydrate draft store when server trip data arrives (no-op if already dirty locally)
  useEffect(() => {
    if (activeTrip) {
      hydrateDraftFromServer(activeTrip)
    }
  }, [activeTrip, hydrateDraftFromServer])

  function openCreateBuilder() {
    setIsCreating(true)
    setDraftPreviewPayload(null)
    setSearchParams((currentParams) => clearPendingStopParams(updateTripIdParam(currentParams, null)))
  }

  function openTrip(tripId: string) {
    setIsCreating(false)
    setDraftPreviewPayload(null)
    setSearchParams((currentParams) => clearPendingStopParams(updateTripIdParam(currentParams, tripId)))
  }

  function closeBuilder() {
    setIsCreating(false)
    setDraftPreviewPayload(null)
    setPreviewTrip(null)
    setSearchParams((currentParams) => clearPendingStopParams(updateTripIdParam(currentParams, null)))
  }

  const handlePendingAddStopHandled = useCallback(() => {
    setSearchParams((currentParams) => clearPendingStopParams(currentParams))
  }, [setSearchParams])

  async function handleDuplicateTrip(tripId: string) {
    const tripToDuplicate = trips.find((t) => t.id === tripId)
    if (!tripToDuplicate) return

    setDuplicatingTripId(tripId)
    setDuplicateError(null)
    try {
      const payload = buildDuplicateTripPayload(tripToDuplicate)
      const createdTrip = await createTripMutation.mutateAsync(payload)
      openTrip(createdTrip.id)
    } catch (error) {
      if (error instanceof Error && error.message === OFFLINE_QUEUED_ERROR) {
        // Queued offline — user will see the duplicate once back online
        return
      }
      setDuplicateError(error instanceof Error ? error.message : 'Unable to duplicate this route right now.')
    } finally {
      setDuplicatingTripId(null)
    }
  }

  async function handleArchiveTrip(tripId: string) {
    setArchivingTripId(tripId)
    try {
      await tripStatusMutation.mutateAsync({ tripId, status: 'archived' })
      removeDraft(tripId)
      if (tripId === requestedTripId) {
        closeBuilder()
      }
    } catch (error) {
      if (error instanceof Error && error.message === OFFLINE_QUEUED_ERROR) {
        // Queued offline — draft removed optimistically, builder closed if open
        removeDraft(tripId)
        if (tripId === requestedTripId) closeBuilder()
        return
      }
      // Mutation error is tracked via tripStatusMutation state
    } finally {
      setArchivingTripId(null)
    }
  }

  async function handleUnarchiveTrip(tripId: string) {
    setArchivingTripId(tripId)
    try {
      await tripStatusMutation.mutateAsync({ tripId, status: 'draft' })
    } catch {
      // Mutation error is tracked via tripStatusMutation state
    } finally {
      setArchivingTripId(null)
    }
  }

  function handleRequestDeleteTrip(tripId: string) {
    const tripToDelete = trips.find((t) => t.id === tripId)
    if (tripToDelete) setDeletingTrip(tripToDelete)
  }

  async function handleConfirmDelete(tripId: string) {
    try {
      await deleteTripMutation.mutateAsync(tripId)
      removeDraft(tripId)
      if (tripId === requestedTripId) {
        closeBuilder()
      }
    } catch (error) {
      if (error instanceof Error && error.message === OFFLINE_QUEUED_ERROR) {
        // Queued offline — remove draft optimistically and close builder if open
        removeDraft(tripId)
        if (tripId === requestedTripId) closeBuilder()
        return
      }
      // Mutation error is tracked via deleteTripMutation state
    } finally {
      setDeletingTrip(null)
    }
  }

  if (tripsQuery.isLoading) {
    return (
      <PlannerShell
        eyebrow="My Routes"
        title="Your route workspace"
        description="Open your saved trips in a map-native planner shell without slowing down the main map experience."
      >
        <div
          className="space-y-3 rounded-2xl border border-border bg-secondary p-5"
          data-testid="my-routes-loading"
        >
          <div className="h-5 w-32 animate-pulse rounded bg-zinc-700" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-700" />
          <div className="h-24 animate-pulse rounded-2xl bg-zinc-800/70" />
        </div>
      </PlannerShell>
    )
  }

  if (tripsQuery.isError) {
    return (
      <PlannerShell
        eyebrow="My Routes"
        title="Your route workspace"
        description="Open your saved trips in a map-native planner shell without slowing down the main map experience."
      >
        <div className="space-y-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-5" data-testid="my-routes-error">
          <p className="text-sm font-medium text-red-200">We couldn&apos;t load your saved routes.</p>
          <p className="text-sm text-red-100/80">
            {tripsQuery.error instanceof Error ? tripsQuery.error.message : 'Please try again in a moment.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => tripsQuery.refetch()}
              className="min-h-[44px] rounded-lg bg-white px-4 text-sm font-medium text-zinc-900"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="min-h-[44px] rounded-lg border border-red-200/40 px-4 text-sm font-medium text-red-50"
            >
              Start from map
            </button>
          </div>
        </div>
      </PlannerShell>
    )
  }

  return (
    <PlannerShell
      eyebrow="My Routes"
      title="Your route workspace"
      description="Resume saved routes from the normalized Phase 3 trip stack while keeping the map-backed planner shell intact."
    >
      <div className="space-y-4" data-testid="my-routes-list-state">
        {requestedTripId && activeTrip && !tripQuery.isFetching ? (
          <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-50">
            Restoring <span className="font-semibold">{activeTrip.title}</span> in the planner.
          </div>
        ) : null}

        {activeTripError ? (
          <div className="space-y-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3" role="alert">
            <p className="text-sm font-medium text-red-200">We couldn&apos;t reopen that saved route.</p>
            <p className="text-sm text-red-100/80">{activeTripError}</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => tripQuery.refetch()}
                className="min-h-[44px] rounded-full border border-red-200/40 px-4 text-sm font-medium text-red-50"
              >
                Retry route
              </button>
              <button
                type="button"
                onClick={closeBuilder}
                className="min-h-[44px] rounded-full border border-border px-4 text-sm font-medium"
              >
                Clear selection
              </button>
            </div>
          </div>
        ) : null}

        {duplicateError ? (
          <div className="space-y-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3" role="alert" data-testid="duplicate-error">
            <p className="text-sm font-medium text-red-200">Duplication failed</p>
            <p className="text-sm text-red-100/80">{duplicateError}</p>
            <button
              type="button"
              onClick={() => setDuplicateError(null)}
              className="min-h-[36px] rounded-full border border-red-200/40 px-3 text-xs font-medium text-red-50"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {trips.length === 0 ? (
          <>
            <div className="space-y-4 rounded-3xl border border-border bg-secondary p-5" data-testid="my-routes-empty-state">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">No saved routes yet</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  This is the new trip workspace for route planning. Create a route here or head back to the map to start with a spot.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={openCreateBuilder}
                  className="min-h-[44px] rounded-full bg-sky-500 px-4 text-sm font-semibold text-slate-950"
                >
                  Create route
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="min-h-[44px] rounded-full border border-border px-4 text-sm font-medium"
                >
                  Start from map
                </button>
              </div>
            </div>
            {legacyPlansHydrated && legacyPlans.length > 0 && tripsQuery.isSuccess && !hasAnyNormalizedTrips ? (
              <div
                className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 space-y-1"
                data-testid="legacy-plans-notice"
              >
                <p className="text-sm font-medium text-amber-200">Older trip plans found</p>
                <p className="text-sm text-amber-100/80">
                  You have {legacyPlans.length} trip plan{legacyPlans.length !== 1 ? 's' : ''} from your earlier session.{' '}
                  They&apos;ll appear here once your data is migrated.
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                data-testid="archive-filter-toggle"
                onClick={() => setIncludeArchived((prev) => !prev)}
                className="min-h-[36px] rounded-full border border-border px-3 text-xs font-medium transition hover:border-sky-400"
              >
                {includeArchived ? 'Hide archived' : 'Show archived'}
              </button>
              <button
                type="button"
                data-testid="sort-control"
                onClick={() => setSortOrder((prev) => (prev === 'recent' ? 'oldest' : 'recent'))}
                className="min-h-[36px] rounded-full border border-border px-3 text-xs font-medium transition hover:border-sky-400"
              >
                {sortOrder === 'recent' ? 'Most recent' : 'Oldest first'}
              </button>
            </div>
            <div className="space-y-3">
              {trips.map((trip) => (
                <TripListItem
                  key={trip.id}
                  trip={trip}
                  isSelected={trip.id === activeTrip?.id}
                  onOpen={openTrip}
                  onDuplicate={handleDuplicateTrip}
                  isDuplicating={duplicatingTripId === trip.id}
                  onArchive={handleArchiveTrip}
                  onUnarchive={handleUnarchiveTrip}
                  onDelete={handleRequestDeleteTrip}
                  isArchiving={archivingTripId === trip.id}
                  isDeleting={deletingTrip?.id === trip.id && deleteTripMutation.isPending}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={openCreateBuilder}
                className="min-h-[44px] rounded-full bg-sky-500 px-4 text-sm font-semibold text-slate-950"
              >
                Create route
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="min-h-[44px] rounded-full border border-border px-4 text-sm font-medium"
              >
                Start from map
              </button>
            </div>
          </>
        )}
      </div>
      {deletingTrip && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          data-testid="delete-confirm-dialog"
        >
          <div className="mx-4 max-w-sm rounded-2xl border border-border bg-secondary p-6 space-y-4">
            <h2 className="text-lg font-semibold">Delete permanently?</h2>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{deletingTrip.title}</span> and all its stops
              will be permanently removed. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                data-testid="delete-cancel-button"
                onClick={() => setDeletingTrip(null)}
                className="min-h-[44px] rounded-full border border-border px-4 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="delete-confirm-button"
                onClick={() => handleConfirmDelete(deletingTrip.id)}
                disabled={deleteTripMutation.isPending}
                className="min-h-[44px] rounded-full bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
              >
                {deleteTripMutation.isPending ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
      <RouteBuilderSheet
        key={isCreating ? 'create-route' : activeTrip?.id ?? 'route-builder-closed'}
        isOpen={isBuilderOpen}
        isSaving={isCreating ? createTripMutation.isPending : updateTripMutation.isPending}
        errorMessage={isCreating
          ? (createTripMutation.error instanceof Error && createTripMutation.error.message !== OFFLINE_QUEUED_ERROR ? createTripMutation.error.message : null)
          : (updateTripMutation.error instanceof Error && updateTripMutation.error.message !== OFFLINE_QUEUED_ERROR ? updateTripMutation.error.message : null)}
        onClose={closeBuilder}
        onSave={isCreating
          ? async (payload: TripWritePayload) => {
              const createdTrip = await createTripMutation.mutateAsync(payload)
              setIsCreating(false)
              setSearchParams((currentParams) => clearPendingStopParams(updateTripIdParam(currentParams, createdTrip.id)))
            }
          : async (payload: TripWritePayload) => {
              if (!activeTrip) return
              await updateTripMutation.mutateAsync({
                tripId: activeTrip.id,
                payload,
              })
            }}
        trip={isCreating ? null : activeTrip}
        pendingAddStop={isCreating ? null : pendingAddStop}
        onPreviewChange={isCreating ? undefined : setDraftPreviewPayload}
        onPendingAddStopHandled={handlePendingAddStopHandled}
      />
    </PlannerShell>
  )
}

export default function MyRoutesScreen() {
  return (
    <PremiumGate
      feature="Route Planning"
      description="Build and manage premium route plans from the map-native My Routes workspace."
    >
      <MyRoutesContent />
    </PremiumGate>
  )
}
