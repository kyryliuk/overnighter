import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePinsQuery } from '@/hooks/usePinsQuery'
import { useRigStore } from '@/store/rigStore'
import { useSpotsStore } from '@/store/spotsStore'
import type { Pin } from '@/types/pin'
import type { Trip, TripPlaceSnapshot, TripStopSource, TripWritePayload } from '@/types/trip'
import {
  appendTripWaypoint,
  buildRouteSuggestions,
  compactTripWaypointOrders,
  DEFAULT_ROUTE_SUGGESTION_LIMIT,
  distanceMiles,
  MIN_ROUTE_SUGGESTION_TRIP_DISTANCE_MILES,
  moveWaypoint,
  pinToTripPlaceSnapshot,
  pinToTripWaypointInput,
  removeTripWaypoint,
  tripStopToWaypointInput,
} from './routePlanning'

function toIdSet(ids: Array<string | null | undefined>): Set<string> {
  return new Set(ids.filter((id): id is string => Boolean(id)))
}

function filterPins(pins: Pin[], query: string, excludeIds: Set<string>) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return []

  return pins
    .filter((pin) => !excludeIds.has(pin.id) && pin.name.toLowerCase().includes(normalizedQuery))
    .slice(0, 8)
}

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

function PlaceSearchField({
  label,
  query,
  selectedPlace,
  candidates,
  isLoading,
  onQueryChange,
  onPick,
  onClear,
  required = false,
}: {
  label: string
  query: string
  selectedPlace: TripPlaceSnapshot | null
  candidates: Pin[]
  isLoading: boolean
  onQueryChange: (value: string) => void
  onPick: (pin: Pin) => void
  onClear: () => void
  required?: boolean
}) {
  const inputId = `${label.toLowerCase().replace(/\s+/g, '-')}-search`

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label} {required ? <span className="text-red-400">*</span> : null}
      </label>
      <input
        id={inputId}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={required ? 'Search for a destination' : 'Add an origin (optional)'}
        className="min-h-[44px] w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
      />
      {selectedPlace ? (
        <div className="flex items-center justify-between rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3">
          <div>
            <p className="text-sm font-medium">{selectedPlace.name}</p>
            <p className="text-xs text-muted-foreground">
              {selectedPlace.latitude.toFixed(4)}, {selectedPlace.longitude.toFixed(4)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="min-h-[44px] rounded-full px-3 text-sm font-medium text-sky-200"
          >
            Clear
          </button>
        </div>
      ) : null}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading places…</p>
      ) : null}
      {!selectedPlace && candidates.length > 0 ? (
        <ul className="space-y-2" role="listbox" aria-label={`${label} results`}>
          {candidates.map((pin) => (
            <li key={pin.id}>
              <button
                type="button"
                onClick={() => onPick(pin)}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-left transition hover:border-sky-400"
              >
                <p className="text-sm font-medium">{pin.name}</p>
                <p className="text-xs text-muted-foreground">
                  {pin.latitude.toFixed(4)}, {pin.longitude.toFixed(4)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export interface PendingRouteStopIntent {
  pinId: string
  source: TripStopSource
}

export interface RouteBuilderSheetProps {
  isOpen: boolean
  isSaving?: boolean
  errorMessage?: string | null
  onClose: () => void
  onSave?: (payload: TripWritePayload) => Promise<void> | void
  trip?: Trip | null
  pendingAddStop?: PendingRouteStopIntent | null
  onPendingAddStopHandled?: () => void
  onPreviewChange?: (payload: TripWritePayload | null) => void
}

export default function RouteBuilderSheet({
  isOpen,
  isSaving = false,
  errorMessage,
  onClose,
  onSave,
  trip = null,
  pendingAddStop = null,
  onPendingAddStopHandled,
  onPreviewChange,
}: RouteBuilderSheetProps) {
  const { data: pins = [], isLoading } = usePinsQuery()
  const rigProfile = useRigStore((state) => state.rigProfile)
  const savedSpots = useSpotsStore((state) => state.savedSpots)
  const restoredWaypoints = useMemo(
    () => [...(trip?.stops ?? [])]
      .filter((stop) => stop.stopKind === 'waypoint')
      .sort((left, right) => left.stopOrder - right.stopOrder)
      .map(tripStopToWaypointInput),
    [trip],
  )
  const [title, setTitle] = useState(() => trip?.title ?? '')
  const [notes, setNotes] = useState(() => trip?.notes ?? '')
  const [originQuery, setOriginQuery] = useState(() => trip?.origin?.name ?? '')
  const [destinationQuery, setDestinationQuery] = useState(() => trip?.destination?.name ?? '')
  const [stopQuery, setStopQuery] = useState('')
  const [origin, setOrigin] = useState<TripPlaceSnapshot | null>(() => trip?.origin ?? null)
  const [destination, setDestination] = useState<TripPlaceSnapshot | null>(() => trip?.destination ?? null)
  const [waypoints, setWaypoints] = useState(() => restoredWaypoints)
  const [validationError, setValidationError] = useState<string | null>(null)
  const pendingIntentKeyRef = useRef<string | null>(null)
  const isResumeMode = Boolean(trip)
  const previewPayload = useMemo(() => {
    if (!isResumeMode || !trip || !destination) {
      return null
    }

    return {
      title,
      notes,
      origin,
      destination,
      stops: compactTripWaypointOrders(waypoints),
    } satisfies TripWritePayload
  }, [destination, isResumeMode, notes, origin, title, trip, waypoints])

  const originCandidates = useMemo(
    () => filterPins(pins, originQuery, toIdSet([destination?.id])),
    [destination?.id, originQuery, pins],
  )
  const destinationCandidates = useMemo(
    () => filterPins(pins, destinationQuery, toIdSet([origin?.id])),
    [destinationQuery, origin?.id, pins],
  )
  const excludedStopIds = useMemo(
    () => toIdSet([origin?.id, destination?.id, ...waypoints.map((stop) => stop.place.id)]),
    [destination?.id, origin?.id, waypoints],
  )
  const stopCandidates = useMemo(
    () => filterPins(pins, stopQuery, excludedStopIds),
    [excludedStopIds, pins, stopQuery],
  )
  const savedSpotCandidates = useMemo(
    () => savedSpots
      .filter((pin) => !excludedStopIds.has(pin.id))
      .slice(0, 6),
    [excludedStopIds, savedSpots],
  )
  const originPoint = useMemo(
    () => (origin ? { latitude: origin.latitude, longitude: origin.longitude } : null),
    [origin],
  )
  const destinationPoint = useMemo(
    () => (destination ? { latitude: destination.latitude, longitude: destination.longitude } : null),
    [destination],
  )
  const suggestionPins = useMemo(
    () => pins.filter((pin) => !excludedStopIds.has(pin.id)),
    [excludedStopIds, pins],
  )
  const directTripDistance = useMemo(
    () => (
      originPoint && destinationPoint
        ? distanceMiles(originPoint, destinationPoint)
        : null
    ),
    [destinationPoint, originPoint],
  )
  const suggestedStops = useMemo(() => {
    if (!isResumeMode || !originPoint || !destinationPoint) {
      return []
    }

    return buildRouteSuggestions({
      pins: suggestionPins,
      origin: originPoint,
      destination: destinationPoint,
      rigProfile,
      limit: DEFAULT_ROUTE_SUGGESTION_LIMIT,
    })
  }, [destinationPoint, isResumeMode, originPoint, rigProfile, suggestionPins])
  const suggestionStatusMessage = useMemo(() => {
    if (!isResumeMode) return null
    if (!destinationPoint) return 'Choose a destination to review corridor suggestions.'
    if (!originPoint) return 'Add an origin to review corridor suggestions. Manual stop editing still works anytime.'
    if (isLoading) return 'Loading map pins for corridor suggestions…'
    if (pins.length === 0) return 'Suggestions are unavailable until map pins are loaded for this route.'
    if (directTripDistance !== null && directTripDistance < MIN_ROUTE_SUGGESTION_TRIP_DISTANCE_MILES) {
      return 'This route is too short for meaningful corridor suggestions.'
    }
    if (suggestionPins.length === 0) return 'Suggestions are unavailable because there are no additional loaded pins on this route yet.'
    if (suggestedStops.length === 0) return 'No strong overnight suggestions were found on this corridor yet.'
    return null
  }, [destinationPoint, directTripDistance, isLoading, isResumeMode, originPoint, pins.length, suggestedStops.length, suggestionPins.length])

  const addStop = useCallback((pin: Pin, source: TripStopSource) => {
    const result = appendTripWaypoint(
      waypoints,
      pinToTripWaypointInput(pin, source),
      {
        originId: origin?.id ?? null,
        destinationId: destination?.id ?? null,
      },
    )

    if (result.error) {
      setValidationError(result.error)
      return
    }

    setWaypoints(result.stops)
    setStopQuery('')
    setValidationError(null)
  }, [destination?.id, origin?.id, waypoints])

  useEffect(() => {
    if (!pendingAddStop) {
      pendingIntentKeyRef.current = null
      return
    }

    const pendingIntentKey = `${pendingAddStop.source}:${pendingAddStop.pinId}`
    if (pendingIntentKeyRef.current === pendingIntentKey) {
      return
    }

    if (!isResumeMode) {
      pendingIntentKeyRef.current = pendingIntentKey
      onPendingAddStopHandled?.()
      return
    }

    const pendingPin = savedSpots.find((spot) => spot.id === pendingAddStop.pinId)
      ?? pins.find((candidate) => candidate.id === pendingAddStop.pinId)

    if (!pendingPin) {
      if (!isLoading) {
        pendingIntentKeyRef.current = pendingIntentKey
        const timeoutId = window.setTimeout(() => {
          setValidationError('We couldn’t add that stop because the place is no longer available.')
          onPendingAddStopHandled?.()
        }, 0)

        return () => {
          window.clearTimeout(timeoutId)
        }
      }
      return
    }

    pendingIntentKeyRef.current = pendingIntentKey
    const timeoutId = window.setTimeout(() => {
      addStop(pendingPin, pendingAddStop.source)
      onPendingAddStopHandled?.()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [addStop, isLoading, isResumeMode, onPendingAddStopHandled, pendingAddStop, pins, savedSpots])

  useEffect(() => {
    if (!onPreviewChange) {
      return
    }

    if (!previewPayload) {
      onPreviewChange(null)
      return
    }

    onPreviewChange(previewPayload)
  }, [onPreviewChange, previewPayload])

  useEffect(() => {
    if (!onPreviewChange) {
      return
    }

    return () => {
      onPreviewChange(null)
    }
  }, [onPreviewChange])

  if (!isOpen) return null

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!onSave) {
      onClose()
      return
    }

    if (!destination) {
      setValidationError('Choose a destination before saving your route.')
      return
    }

    setValidationError(null)
    const normalizedWaypoints = compactTripWaypointOrders(waypoints)
    await onSave({
      title,
      notes,
      origin,
      destination,
      stops: normalizedWaypoints,
    })
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/50 p-4 md:items-center md:justify-center" role="presentation">
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label={isResumeMode ? 'Resume route' : 'Create route'}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-border bg-background p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-400">Route builder</p>
            <h2 className="text-2xl font-semibold">{isResumeMode ? 'Resume saved route' : 'Create a new route'}</h2>
            <p className="text-sm text-muted-foreground">
              {isResumeMode
                ? 'Add or remove route stops while keeping your normalized trip, title, notes, origin, and destination intact.'
                : 'Save a destination-focused draft now. Stop editing activates once a route already exists.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-full border border-border px-4 text-sm font-medium"
          >
            Close
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <label htmlFor="trip-title" className="text-sm font-medium text-foreground">Title</label>
            <input
              id="trip-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Optional title"
              className="min-h-[44px] w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
            />
            <p className="text-xs text-muted-foreground">Leave blank to use the destination name or “New Route”.</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="trip-notes" className="text-sm font-medium text-foreground">Notes</label>
            <textarea
              id="trip-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add context for this trip"
              rows={4}
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
            />
          </div>

          <PlaceSearchField
            label="Origin"
            query={originQuery}
            selectedPlace={origin}
            candidates={originCandidates}
            isLoading={isLoading}
            onQueryChange={(value) => {
              setOriginQuery(value)
              if (!value.trim()) setOrigin(null)
            }}
            onPick={(pin) => {
              const place = pinToTripPlaceSnapshot(pin)
              setOrigin(place)
              setOriginQuery(pin.name)
            }}
            onClear={() => {
              setOrigin(null)
              setOriginQuery('')
            }}
          />

          <PlaceSearchField
            label="Destination"
            query={destinationQuery}
            selectedPlace={destination}
            candidates={destinationCandidates}
            isLoading={isLoading}
            required
            onQueryChange={(value) => {
              setDestinationQuery(value)
              if (!value.trim()) setDestination(null)
            }}
            onPick={(pin) => {
              const place = pinToTripPlaceSnapshot(pin)
              setDestination(place)
              setDestinationQuery(pin.name)
              setValidationError(null)
            }}
            onClear={() => {
              setDestination(null)
              setDestinationQuery('')
            }}
          />

          {isResumeMode ? (
            <section className="space-y-3 rounded-2xl border border-border bg-secondary/70 p-4" aria-label="Route stops">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Route stops</h3>
                <p className="text-xs text-muted-foreground">
                  Add stops from planner search, saved spots, or map pin intents. The destination stays separate from this list.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="route-stop-search" className="text-sm font-medium text-foreground">Add a stop</label>
                <input
                  id="route-stop-search"
                  value={stopQuery}
                  onChange={(event) => setStopQuery(event.target.value)}
                  placeholder="Search map pins to append a stop"
                  className="min-h-[44px] w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  You can keep up to 12 total stops including the destination.
                </p>
              </div>

              {stopCandidates.length > 0 ? (
                <ul className="space-y-2" role="listbox" aria-label="Route stop results">
                  {stopCandidates.map((pin) => (
                    <li key={pin.id}>
                      <button
                        type="button"
                        onClick={() => addStop(pin, 'manual')}
                        className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-left transition hover:border-sky-400"
                      >
                        <p className="text-sm font-medium">{pin.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {pin.latitude.toFixed(4)}, {pin.longitude.toFixed(4)}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {savedSpotCandidates.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Quick picks from saved spots</p>
                  <div className="flex flex-wrap gap-2">
                    {savedSpotCandidates.map((pin) => (
                      <button
                        key={pin.id}
                        type="button"
                        onClick={() => addStop(pin, 'saved')}
                        className="rounded-full border border-border px-3 py-2 text-sm"
                      >
                        + {pin.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Suggested corridor stops</p>
                  <p className="text-xs text-muted-foreground">
                    Advisory only until you explicitly add one to this trip.
                  </p>
                </div>
                {suggestionStatusMessage ? (
                  <p className="text-xs text-muted-foreground">{suggestionStatusMessage}</p>
                ) : (
                  <ul className="space-y-2" aria-label="Suggested corridor stops">
                    {suggestedStops.map((suggestion) => (
                      <li
                        key={suggestion.pin.id}
                        className="rounded-2xl border border-border bg-background px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{suggestion.pin.name}</p>
                            <p className="text-xs text-muted-foreground">{formatPinMeta(suggestion.pin)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Detour {formatDistanceLabel(suggestion.detourMiles)} • {formatDistanceLabel(suggestion.destinationDistanceMiles)} from destination
                            </p>
                            <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                              {suggestion.pin.isVerified ? 'verified' : 'community reported'} • {suggestion.pin.badgeState}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => addStop(suggestion.pin, 'suggested')}
                            className="min-h-[44px] rounded-full border border-sky-400/40 px-3 text-sm font-medium text-sky-200"
                            aria-label={`Add ${suggestion.pin.name} as a suggested stop`}
                          >
                            Add
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {waypoints.length === 0 ? (
                <p className="text-sm text-muted-foreground">No route stops added yet.</p>
              ) : (
                <ol className="space-y-2" aria-label="Route stops list">
                  {waypoints.map((stop, index) => (
                    <li key={stop.id ?? stop.place.id} className="rounded-2xl border border-border bg-background px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Stop {index + 1}: {stop.place.name}</p>
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{stop.source}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setWaypoints((currentStops) => compactTripWaypointOrders(moveWaypoint(currentStops, index, 'up')))
                              setValidationError(null)
                            }}
                            disabled={index === 0}
                            className="min-h-[44px] min-w-[44px] rounded-full border border-border px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Move stop ${index + 1} up`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setWaypoints((currentStops) => compactTripWaypointOrders(moveWaypoint(currentStops, index, 'down')))
                              setValidationError(null)
                            }}
                            disabled={index === waypoints.length - 1}
                            className="min-h-[44px] min-w-[44px] rounded-full border border-border px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Move stop ${index + 1} down`}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setWaypoints((currentStops) => removeTripWaypoint(currentStops, stop.id ?? stop.place.id))
                              setValidationError(null)
                            }}
                            className="min-h-[44px] rounded-full border border-border px-3 text-sm font-medium"
                            aria-label={`Remove ${stop.place.name} from route`}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {stop.place.latitude.toFixed(4)}, {stop.place.longitude.toFixed(4)}
                      </p>
                      {stop.notes ? <p className="mt-2 text-xs text-muted-foreground">{stop.notes}</p> : null}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ) : null}

          {validationError ? <p role="alert" className="text-sm text-red-300">{validationError}</p> : null}
          {errorMessage ? <p role="alert" className="text-sm text-red-300">{errorMessage}</p> : null}

          <div className="flex flex-wrap gap-3 pt-2">
            {onSave ? (
              <button
                type="submit"
                disabled={isSaving || !destination}
                className="min-h-[44px] rounded-full bg-sky-500 px-5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? (isResumeMode ? 'Updating route…' : 'Saving route…') : (isResumeMode ? 'Update route' : 'Save route')}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] rounded-full bg-sky-500 px-5 text-sm font-semibold text-slate-950"
              >
                Back to routes
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-full border border-border px-5 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
