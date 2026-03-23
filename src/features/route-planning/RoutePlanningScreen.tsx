import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { usePinsQuery } from '@/hooks/usePinsQuery'
import { useGeolocation } from '@/hooks/useGeolocation'
import { buildDirectionsUrl } from '@/lib/maps/googleMaps'
import { useAuth } from '@/features/account/AuthContext'
import { getTripPlanCommentSummaries } from '@/lib/supabase/tripPlanComments'
import { getTripPlanHelpfulCounts } from '@/lib/supabase/tripPlanReactions'
import { ensureTripPlanShareToken, revokeTripPlanShare } from '@/lib/supabase/tripPlans'
import { useSpotsStore } from '@/store/spotsStore'
import { useRigStore } from '@/store/rigStore'
import { useTripPlansStore } from '@/store/tripPlansStore'
import type { Pin } from '@/types/pin'
import type { TripPlan, TripPlanPlace } from '@/types/tripPlan'
import { appendUniqueWaypoint, buildRouteSuggestions, distanceMiles, moveWaypoint } from './routePlanning'
import { buildTripShareUrl, clearTripShareState } from './tripSharing'

function formatDistanceLabel(miles: number): string {
  if (miles >= 100) return `${Math.round(miles)} mi`
  return `${miles.toFixed(1)} mi`
}

function formatPinMeta(pin: Pin): string {
  const pieces = []

  if (pin.amenities.dump) pieces.push('dump')
  if (pin.amenities.water) pieces.push('water')
  if (pin.amenities.fuel) pieces.push('fuel')
  if (pin.amenities.big_rig) pieces.push('big rig')

  return pieces.length > 0 ? pieces.join(' • ') : 'overnight stop'
}

function toTripPlanPlace(pin: Pick<Pin, 'id' | 'name' | 'latitude' | 'longitude'>): TripPlanPlace {
  return {
    id: pin.id,
    name: pin.name,
    latitude: pin.latitude,
    longitude: pin.longitude,
  }
}

function getTripShareUrl(plan: TripPlan): string | null {
  if (!plan.shareToken) return null

  return buildTripShareUrl(window.location.origin, plan.shareToken)
}

function getSourceTripUrl(plan: TripPlan): string | null {
  if (!plan.sourceTrip) return null

  return buildTripShareUrl(window.location.origin, plan.sourceTrip.shareToken)
}

export default function RoutePlanningScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { session, isAuthenticated } = useAuth()
  const savedSpots = useSpotsStore((state) => state.savedSpots)
  const rigProfile = useRigStore((state) => state.rigProfile)
  const tripPlans = useTripPlansStore((state) => state.tripPlans)
  const saveTripPlan = useTripPlansStore((state) => state.saveTripPlan)
  const removeTripPlan = useTripPlansStore((state) => state.removeTripPlan)
  const { data: pins = [], isLoading } = usePinsQuery()
  const [geoState, requestGeo] = useGeolocation()
  const importedPlan = useMemo(() => {
    const openPlanId = searchParams.get('openPlan')
    if (!openPlanId) return null
    return tripPlans.find((candidate) => candidate.id === openPlanId) ?? null
  }, [searchParams, tripPlans])
  const [tripTitle, setTripTitle] = useState(() => importedPlan?.title ?? '')
  const [tripNotes, setTripNotes] = useState(() => importedPlan?.notes ?? '')
  const [destinationQuery, setDestinationQuery] = useState(() => importedPlan?.destination.name ?? '')
  const [activePlanId, setActivePlanId] = useState<string | null>(() => importedPlan?.id ?? null)
  const [selectedDestination, setSelectedDestination] = useState<TripPlanPlace | null>(() => importedPlan?.destination ?? null)
  const [selectedStops, setSelectedStops] = useState<TripPlanPlace[]>(() => importedPlan?.stops ?? [])
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)

  useEffect(() => { requestGeo() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const sharedTripShareTokens = useMemo(
    () =>
      tripPlans
        .map((plan) => plan.shareToken)
        .filter((shareToken): shareToken is string => Boolean(shareToken))
        .sort(),
    [tripPlans],
  )

  const sharedReactionCountsQuery = useQuery({
    queryKey: ['trip-plan-helpful-counts', sharedTripShareTokens],
    queryFn: () => getTripPlanHelpfulCounts(sharedTripShareTokens),
    enabled: sharedTripShareTokens.length > 0,
  })

  const sharedCommentSummariesQuery = useQuery({
    queryKey: ['trip-plan-comment-summaries', sharedTripShareTokens],
    queryFn: () => getTripPlanCommentSummaries(sharedTripShareTokens),
    enabled: sharedTripShareTokens.length > 0,
  })

  const origin = useMemo(
    () =>
      geoState.coords
        ? { latitude: geoState.coords.latitude, longitude: geoState.coords.longitude }
        : null,
    [geoState.coords],
  )

  const destinationMatches = useMemo(() => {
    const query = destinationQuery.trim().toLowerCase()
    if (!query) return []

    return pins
      .filter((pin) => pin.name.toLowerCase().includes(query))
      .slice(0, 8)
  }, [pins, destinationQuery])

  const pinLookup = useMemo(
    () => new Map(pins.map((pin) => [pin.id, pin])),
    [pins],
  )

  const manualStopCandidates = useMemo(
    () =>
      savedSpots.filter(
        (pin) =>
          pin.id !== selectedDestination?.id &&
          !selectedStops.some((stop) => stop.id === pin.id),
      ),
    [savedSpots, selectedDestination?.id, selectedStops],
  )

  const suggestedStops = useMemo(() => {
    if (!selectedDestination) return []

    return buildRouteSuggestions({
      pins: pins.filter((pin) => pin.id !== selectedDestination.id),
      origin,
      destination: {
        latitude: selectedDestination.latitude,
        longitude: selectedDestination.longitude,
      },
      rigProfile,
      limit: 5,
    })
  }, [origin, pins, rigProfile, selectedDestination])

  const directTripDistance = origin && selectedDestination
    ? distanceMiles(origin, {
      latitude: selectedDestination.latitude,
      longitude: selectedDestination.longitude,
    })
    : null

  const routeHref = selectedDestination
    ? buildDirectionsUrl({
      origin,
      destination: {
        latitude: selectedDestination.latitude,
        longitude: selectedDestination.longitude,
      },
      waypoints: selectedStops.map((pin) => ({
        latitude: pin.latitude,
        longitude: pin.longitude,
      })),
    })
    : null

  function handleDestinationPick(pin: Pin) {
    setActivePlanId(null)
    setSelectedDestination(toTripPlanPlace(pin))
    setDestinationQuery(pin.name)
    setSelectedStops([])
    setTripTitle((currentTitle) => currentTitle || `Trip to ${pin.name}`)
  }

  function toggleStop(pin: Pin) {
    const nextStop = toTripPlanPlace(pin)
    setSelectedStops((current) => appendUniqueWaypoint(current, nextStop))
  }

  function handleSaveTrip() {
    if (!selectedDestination || !tripTitle.trim()) return

    const savedId = saveTripPlan({
      id: activePlanId ?? undefined,
      title: tripTitle.trim(),
      notes: tripNotes.trim(),
      destination: selectedDestination,
      stops: selectedStops,
    })

    setActivePlanId(savedId)
  }

  async function handleShareTrip(plan: TripPlan) {
    setShareMessage(null)
    setShareError(null)

    if (!isAuthenticated || !session?.user.id) {
      setShareError('Sign in to create a public trip link.')
      return
    }

    try {
      const shareToken = await ensureTripPlanShareToken(session.user.id, {
        ...plan,
        isPublic: true,
      })

      saveTripPlan({
        id: plan.id,
        title: plan.title,
        notes: plan.notes,
        destination: plan.destination,
        stops: plan.stops,
        isPublic: true,
        shareToken,
      })

      const shareUrl = buildTripShareUrl(window.location.origin, shareToken)
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        setShareMessage(`Public trip link copied. ${shareUrl}`)
      } else {
        setShareMessage(`Public trip link ready: ${shareUrl}`)
      }
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'Failed to create share link')
    }
  }

  async function handleCopyShareLink(plan: TripPlan) {
    setShareMessage(null)
    setShareError(null)

    const shareUrl = getTripShareUrl(plan)
    if (!shareUrl) {
      setShareError('This trip does not have an active public link yet.')
      return
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareUrl)
      setShareMessage(`Public trip link copied. ${shareUrl}`)
      return
    }

    setShareMessage(`Public trip link: ${shareUrl}`)
  }

  async function handleUnshareTrip(plan: TripPlan) {
    setShareMessage(null)
    setShareError(null)

    if (!isAuthenticated || !session?.user.id) {
      setShareError('Sign in to manage public trip links.')
      return
    }

    if (!window.confirm('Disable this public trip link? Anyone using the current link will lose access.')) {
      return
    }

    try {
      await revokeTripPlanShare(session.user.id, clearTripShareState(plan))

      saveTripPlan({
        id: plan.id,
        title: plan.title,
        notes: plan.notes,
        destination: plan.destination,
        stops: plan.stops,
        isPublic: false,
        shareToken: null,
      })

      setShareMessage('Share link disabled. This trip is private again.')
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'Failed to disable share link')
    }
  }

  function loadTripPlan(plan: TripPlan) {
    setActivePlanId(plan.id)
    setTripTitle(plan.title)
    setTripNotes(plan.notes)
    setDestinationQuery(plan.destination.name)
    setSelectedDestination(plan.destination)
    setSelectedStops(plan.stops)
  }

  function moveSelectedStop(index: number, direction: 'up' | 'down') {
    setSelectedStops((current) => moveWaypoint(current, index, direction))
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Back to map"
          className="text-sky-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          ←
        </button>
        <div>
          <h1 className="text-lg font-bold">Plan route</h1>
          <p className="text-sm text-muted-foreground">Use current pins to build a Google Maps handoff.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        <section className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Saved trip drafts</h2>
              <p className="text-sm text-muted-foreground">
                Keep route ideas locally until the full trip model lands.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveTrip}
              disabled={!selectedDestination || !tripTitle.trim()}
              className="min-h-[44px] rounded-lg bg-sky-500 px-4 text-sm font-semibold text-white disabled:bg-slate-400"
            >
              Save draft
            </button>
          </div>
          <input
            value={tripTitle}
            onChange={(event) => setTripTitle(event.target.value)}
            placeholder="Name this trip"
            className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm"
            aria-label="Trip name"
          />
          <textarea
            value={tripNotes}
            onChange={(event) => setTripNotes(event.target.value)}
            placeholder="Add a note for future you or anyone you share this route with"
            className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-3 text-sm"
            aria-label="Trip notes"
          />
          {tripPlans.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved drafts yet.</p>
          ) : (
            <ul className="space-y-2">
              {tripPlans.map((plan) => (
                <li key={plan.id} className="rounded-lg border border-border bg-background px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => loadTripPlan(plan)}
                      className="text-left"
                    >
                      <span className="block font-medium">{plan.title}</span>
                      <span className="block text-sm text-muted-foreground">
                        {plan.destination.name} • {plan.stops.length} saved stops
                        {plan.isPublic ? ' • shared' : ''}
                        {plan.sourceTrip ? ' • remixed' : ''}
                      </span>
                      {plan.notes && (
                        <span className="mt-1 block text-sm text-muted-foreground whitespace-pre-wrap">
                          {plan.notes}
                        </span>
                      )}
                    </button>
                    <div className="flex gap-2">
                      {plan.isPublic ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleCopyShareLink(plan)}
                            disabled={!plan.shareToken}
                            className="min-h-[44px] rounded-lg border border-border px-3 text-sm font-medium disabled:opacity-50"
                          >
                            Copy link
                          </button>
                          <a
                            href={getTripShareUrl(plan) ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-disabled={!plan.shareToken}
                            className={`min-h-[44px] rounded-lg border border-border px-3 text-sm font-medium flex items-center justify-center ${
                              plan.shareToken ? '' : 'pointer-events-none opacity-50'
                            }`}
                          >
                            Open link
                          </a>
                          <button
                            type="button"
                            onClick={() => void handleUnshareTrip(plan)}
                            disabled={!isAuthenticated}
                            className="min-h-[44px] rounded-lg border border-border px-3 text-sm font-medium disabled:opacity-50"
                          >
                            Unshare
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleShareTrip(plan)}
                          disabled={!isAuthenticated}
                          className="min-h-[44px] rounded-lg border border-border px-3 text-sm font-medium disabled:opacity-50"
                        >
                          Share
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeTripPlan(plan.id)}
                        className="min-h-[44px] rounded-lg border border-border px-3 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {plan.isPublic && (
                    <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3">
                      <p className="text-sm font-medium text-foreground">Public trip link is live.</p>
                      <p className="mt-1 text-sm text-muted-foreground break-all">
                        {getTripShareUrl(plan) ?? 'Public link pending'}
                      </p>
                      {plan.shareToken && (
                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                          <p>
                            {sharedReactionCountsQuery.isLoading
                              ? 'Loading helpful reactions…'
                              : `${sharedReactionCountsQuery.data?.[plan.shareToken] ?? 0} traveler${
                                (sharedReactionCountsQuery.data?.[plan.shareToken] ?? 0) === 1 ? '' : 's'
                              } found this helpful.`}
                          </p>
                          <p>
                            {sharedCommentSummariesQuery.isLoading
                              ? 'Loading comment activity…'
                              : `${sharedCommentSummariesQuery.data?.[plan.shareToken]?.count ?? 0} comment${
                                (sharedCommentSummariesQuery.data?.[plan.shareToken]?.count ?? 0) === 1 ? '' : 's'
                              } on this shared trip.`}
                          </p>
                          {(() => {
                            const latestComment = sharedCommentSummariesQuery.data?.[plan.shareToken]?.latestComment

                            if (!latestComment) return null

                            return (
                              <p className="whitespace-pre-wrap">
                                Latest: {latestComment.authorLabel} {'—'} {latestComment.body}
                              </p>
                            )
                          })()}
                        </div>
                      )}
                      {sharedReactionCountsQuery.error && (
                        <p className="mt-2 text-sm text-red-300">
                          Could not load trip feedback summary right now.
                        </p>
                      )}
                      {sharedCommentSummariesQuery.error && (
                        <p className="mt-2 text-sm text-red-300">
                          Could not load trip discussion summary right now.
                        </p>
                      )}
                    </div>
                  )}
                  {plan.sourceTrip && (
                    <div className="mt-3 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-3 space-y-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">Remixed from a shared trip.</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Source: {plan.sourceTrip.title}
                        </p>
                      </div>
                      <a
                        href={getSourceTripUrl(plan) ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-disabled={!plan.sourceTrip}
                        className={`inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border px-3 text-sm font-medium ${
                          plan.sourceTrip ? '' : 'pointer-events-none opacity-50'
                        }`}
                      >
                        Open original shared trip
                      </a>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {shareError && (
            <p role="alert" className="text-sm text-red-300">{shareError}</p>
          )}
          {shareMessage && (
            <p role="status" className="text-sm text-green-300 break-all">{shareMessage}</p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Trip start</h2>
              <p className="text-sm text-muted-foreground">
                {origin
                  ? 'Using your current location for corridor suggestions.'
                  : 'Google Maps can still open the route even if location is unavailable.'}
              </p>
            </div>
            <button
              type="button"
              onClick={requestGeo}
              className="min-h-[44px] rounded-lg border border-border px-3 text-sm font-medium"
            >
              Refresh location
            </button>
          </div>
          {origin ? (
            <p className="text-sm text-foreground">
              Current location ready: {origin.latitude.toFixed(3)}, {origin.longitude.toFixed(3)}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {geoState.error === 'denied'
                ? 'Location permission was denied. You can still open a destination-only route.'
                : geoState.error === 'no-api'
                  ? 'Geolocation is not available on this device.'
                  : geoState.error === 'unavailable'
                    ? 'We could not fetch your location yet.'
                    : 'Trying to fetch your current location...'}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div>
            <h2 className="font-semibold">Destination</h2>
            <p className="text-sm text-muted-foreground">Search the spot database and pick your final stop.</p>
          </div>
          <input
            value={destinationQuery}
            onChange={(event) => setDestinationQuery(event.target.value)}
            placeholder="Search by spot name"
            className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm"
            aria-label="Search destination"
          />
          {selectedDestination && (
            <div className="rounded-lg border border-border bg-background px-3 py-3">
              <p className="font-medium">{selectedDestination.name}</p>
              <p className="text-sm text-muted-foreground">
                {pinLookup.get(selectedDestination.id)
                  ? formatPinMeta(pinLookup.get(selectedDestination.id) as Pin)
                  : `${selectedDestination.latitude.toFixed(3)}, ${selectedDestination.longitude.toFixed(3)}`}
              </p>
            </div>
          )}
          {destinationMatches.length > 0 && (
            <ul className="space-y-2">
              {destinationMatches.map((pin) => (
                <li key={pin.id}>
                  <button
                    type="button"
                    onClick={() => handleDestinationPick(pin)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-3 text-left"
                  >
                    <span className="block font-medium">{pin.name}</span>
                    <span className="block text-sm text-muted-foreground">{formatPinMeta(pin)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {savedSpots.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Quick picks from saved spots</p>
              <div className="flex flex-wrap gap-2">
                {savedSpots.slice(0, 4).map((pin) => (
                  <button
                    key={pin.id}
                    type="button"
                    onClick={() => handleDestinationPick(pin)}
                    className="rounded-full border border-border px-3 py-2 text-sm"
                  >
                    {pin.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div>
            <h2 className="font-semibold">Selected waypoints</h2>
            <p className="text-sm text-muted-foreground">
              Reorder your overnight stops before opening the route in Google Maps.
            </p>
          </div>
          {selectedStops.length === 0 ? (
            <p className="text-sm text-muted-foreground">No waypoints added yet.</p>
          ) : (
            <ul className="space-y-2">
              {selectedStops.map((stop, index) => (
                <li key={stop.id} className="rounded-lg border border-border bg-background px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">Stop {index + 1}: {stop.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {stop.latitude.toFixed(3)}, {stop.longitude.toFixed(3)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => moveSelectedStop(index, 'up')}
                        disabled={index === 0}
                        className="min-h-[44px] rounded-lg border border-border px-3 text-sm font-medium disabled:opacity-50"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSelectedStop(index, 'down')}
                        disabled={index === selectedStops.length - 1}
                        className="min-h-[44px] rounded-lg border border-border px-3 text-sm font-medium disabled:opacity-50"
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedStops((current) => current.filter((waypoint) => waypoint.id !== stop.id))}
                        className="min-h-[44px] rounded-lg border border-border px-3 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {manualStopCandidates.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Add from saved spots</p>
              <div className="flex flex-wrap gap-2">
                {manualStopCandidates.slice(0, 6).map((pin) => (
                  <button
                    key={pin.id}
                    type="button"
                    onClick={() => toggleStop(pin)}
                    className="rounded-full border border-border px-3 py-2 text-sm"
                  >
                    + {pin.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div>
            <h2 className="font-semibold">Suggested overnight stops</h2>
            <p className="text-sm text-muted-foreground">
              We rank current pins by detour, rig fit, and freshness. Pick the ones you want to keep.
            </p>
          </div>
          {!selectedDestination && (
            <p className="text-sm text-muted-foreground">Choose a destination to generate stop suggestions.</p>
          )}
          {selectedDestination && !origin && (
            <p className="text-sm text-muted-foreground">
              Turn on location to see corridor suggestions. You can still hand off the destination to Google Maps.
            </p>
          )}
          {selectedDestination && origin && suggestedStops.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No strong overnight suggestions were found on this corridor yet.
            </p>
          )}
          {suggestedStops.length > 0 && (
            <ul className="space-y-2">
              {suggestedStops.map((suggestion) => {
                const isSelected = selectedStops.some((stop) => stop.id === suggestion.pin.id)

                return (
                  <li key={suggestion.pin.id} className="rounded-lg border border-border bg-background px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{suggestion.pin.name}</p>
                        <p className="text-sm text-muted-foreground">{formatPinMeta(suggestion.pin)}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Detour {formatDistanceLabel(suggestion.detourMiles)} • {formatDistanceLabel(suggestion.destinationDistanceMiles)} from destination
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleStop(suggestion.pin)}
                        className="min-h-[44px] rounded-lg border border-border px-3 text-sm font-medium"
                      >
                        {isSelected ? 'Remove' : 'Add'}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div>
            <h2 className="font-semibold">Route handoff</h2>
            <p className="text-sm text-muted-foreground">
              Send your selected stop sequence to Google Maps for live navigation.
            </p>
          </div>
          {directTripDistance !== null && (
            <p className="text-sm text-muted-foreground">
              Direct trip distance: {formatDistanceLabel(directTripDistance)}
            </p>
          )}
          {selectedStops.length > 0 && (
            <ul className="space-y-2">
              {selectedStops.map((pin, index) => (
                <li key={pin.id} className="text-sm text-foreground">
                  Stop {index + 1}: {pin.name}
                </li>
              ))}
            </ul>
          )}
          <a
            href={routeHref ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!routeHref}
            className={`flex min-h-[44px] items-center justify-center rounded-lg font-semibold text-white ${
              routeHref ? 'bg-sky-500' : 'bg-slate-400 pointer-events-none'
            }`}
          >
            Open in Google Maps
          </a>
        </section>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading spot data…</p>
        )}
      </div>
    </div>
  )
}
