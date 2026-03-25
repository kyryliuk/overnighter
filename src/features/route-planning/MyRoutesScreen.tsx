import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PremiumGate } from '@/components/PremiumGate'
import { useUIStore } from '@/store/uiStore'
import type { Trip, TripWritePayload } from '@/types/trip'
import RouteBuilderSheet, { type PendingRouteStopIntent } from './RouteBuilderSheet'
import { useTripCorridorPreview } from './TripCorridorPreviewContext'
import { useCreateTripMutation } from './useCreateTripMutation'
import { useTripQuery } from './useTripQuery'
import { useTripsQuery } from './useTripsQuery'
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

function TripListItem({
  trip,
  isSelected,
  onOpen,
}: {
  trip: Trip
  isSelected: boolean
  onOpen: (tripId: string) => void
}) {
  return (
    <article
      className={`rounded-2xl border bg-secondary p-4 transition ${isSelected ? 'border-sky-400/70 ring-1 ring-sky-400/40' : 'border-border'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{trip.title}</h2>
          <p className="text-sm text-muted-foreground">
            Destination: {trip.destination.name} · {trip.stopCount} stop{trip.stopCount === 1 ? '' : 's'}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">Updated {formatUpdatedAt(trip.updatedAt)}</span>
      </div>
      {trip.notes ? (
        <p className="mt-3 text-sm text-muted-foreground">{trip.notes}</p>
      ) : null}
      <div className="mt-4 flex items-center justify-between gap-3">
        {isSelected ? (
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-400">Open in planner</p>
        ) : <span />}
        <button
          type="button"
          onClick={() => onOpen(trip.id)}
          aria-pressed={isSelected}
          className="min-h-[44px] rounded-full border border-border px-4 text-sm font-medium transition hover:border-sky-400"
        >
          {isSelected ? 'Reopen route' : 'Resume route'}
        </button>
      </div>
    </article>
  )
}

function MyRoutesContent() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const setActiveTripId = useUIStore((state) => state.setActiveTripId)
  const { setPreviewTrip } = useTripCorridorPreview()
  const [isCreating, setIsCreating] = useState(false)
  const [draftPreviewPayload, setDraftPreviewPayload] = useState<TripWritePayload | null>(null)
  const requestedTripId = searchParams.get('tripId')
  const pendingAddStopPinId = searchParams.get('addStopPinId')
  const pendingAddStopSource = searchParams.get('addStopSource')
  const tripsQuery = useTripsQuery()
  const createTripMutation = useCreateTripMutation()
  const updateTripMutation = useUpdateTripMutation()
  const trips = useMemo(() => tripsQuery.data ?? [], [tripsQuery.data])
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

        {trips.length === 0 ? (
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
        ) : (
          <>
            <div className="space-y-3">
              {trips.map((trip) => (
                <TripListItem
                  key={trip.id}
                  trip={trip}
                  isSelected={trip.id === activeTrip?.id}
                  onOpen={openTrip}
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
      <RouteBuilderSheet
        key={isCreating ? 'create-route' : activeTrip?.id ?? 'route-builder-closed'}
        isOpen={isBuilderOpen}
        isSaving={isCreating ? createTripMutation.isPending : updateTripMutation.isPending}
        errorMessage={isCreating
          ? (createTripMutation.error instanceof Error ? createTripMutation.error.message : null)
          : (updateTripMutation.error instanceof Error ? updateTripMutation.error.message : null)}
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
