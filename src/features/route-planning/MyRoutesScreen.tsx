import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PremiumGate } from '@/components/PremiumGate'
import type { TripWritePayload } from '@/types/trip'
import RouteBuilderSheet from './RouteBuilderSheet'
import { useCreateTripMutation } from './useCreateTripMutation'
import { useTripsQuery } from './useTripsQuery'

function formatUpdatedAt(updatedAt: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(updatedAt))
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

function MyRoutesContent() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [isBuilderOpen, setIsBuilderOpen] = useState(false)
  const requestedTripId = searchParams.get('tripId')
  const tripsQuery = useTripsQuery()
  const createTripMutation = useCreateTripMutation()
  const trips = useMemo(() => tripsQuery.data ?? [], [tripsQuery.data])
  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === requestedTripId) ?? null,
    [requestedTripId, trips],
  )

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

  if (trips.length === 0) {
    return (
      <PlannerShell
        eyebrow="My Routes"
        title="Your route workspace"
        description="Save route ideas here, jump back into them later, and keep trip planning anchored to the map."
      >
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
              onClick={() => setIsBuilderOpen(true)}
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
        <RouteBuilderSheet
          isOpen={isBuilderOpen}
          isSaving={createTripMutation.isPending}
          errorMessage={createTripMutation.error instanceof Error ? createTripMutation.error.message : null}
          onClose={() => setIsBuilderOpen(false)}
          onSave={async (payload) => {
            const createdTrip = await createTripMutation.mutateAsync(payload)
            setIsBuilderOpen(false)
            setSearchParams((currentParams) => {
              const nextParams = new URLSearchParams(currentParams)
              nextParams.set('tripId', createdTrip.id)
              return nextParams
            })
          }}
        />
      </PlannerShell>
    )
  }

  return (
    <PlannerShell
      eyebrow="My Routes"
      title="Your route workspace"
      description="Your saved routes now load from the normalized Phase 3 trip stack. Resume and editing controls land in later stories."
    >
      <div className="space-y-4" data-testid="my-routes-list-state">
        {requestedTripId && (
          <div className="rounded-2xl border border-border bg-secondary px-4 py-3 text-sm text-muted-foreground">
            {selectedTrip
              ? `Selected route: ${selectedTrip.title}. Resume controls arrive in the next planner story.`
              : 'The requested route will plug into this shell once resume flow lands in the next story.'}
          </div>
        )}
        <div className="space-y-3">
          {trips.map((trip) => (
            <article key={trip.id} className="rounded-2xl border border-border bg-secondary p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold">{trip.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    Destination: {trip.destination.name} · {trip.stopCount} stop{trip.stopCount === 1 ? '' : 's'}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">Updated {formatUpdatedAt(trip.updatedAt)}</span>
              </div>
              {trip.notes && (
                <p className="mt-3 text-sm text-muted-foreground">{trip.notes}</p>
              )}
            </article>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setIsBuilderOpen(true)}
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
      <RouteBuilderSheet
        isOpen={isBuilderOpen}
        isSaving={createTripMutation.isPending}
        errorMessage={createTripMutation.error instanceof Error ? createTripMutation.error.message : null}
        onClose={() => setIsBuilderOpen(false)}
        onSave={async (payload: TripWritePayload) => {
          const createdTrip = await createTripMutation.mutateAsync(payload)
          setIsBuilderOpen(false)
          setSearchParams((currentParams) => {
            const nextParams = new URLSearchParams(currentParams)
            nextParams.set('tripId', createdTrip.id)
            return nextParams
          })
        }}
      />
    </PlannerShell>
  )
}

export default function MyRoutesScreen() {
  return (
    <PremiumGate
      feature="My Routes"
      description="Save and revisit route plans with the same premium checkout flow already used across Overnighter."
    >
      <MyRoutesContent />
    </PremiumGate>
  )
}
