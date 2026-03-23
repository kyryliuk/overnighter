import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePinsQuery } from '@/hooks/usePinsQuery'
import { useGeolocation } from '@/hooks/useGeolocation'
import { buildDirectionsUrl } from '@/lib/maps/googleMaps'
import { useSpotsStore } from '@/store/spotsStore'
import { useRigStore } from '@/store/rigStore'
import { useTripPlansStore } from '@/store/tripPlansStore'
import type { Pin } from '@/types/pin'
import type { TripPlan, TripPlanPlace } from '@/types/tripPlan'
import { buildRouteSuggestions, distanceMiles } from './routePlanning'

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

export default function RoutePlanningScreen() {
  const navigate = useNavigate()
  const savedSpots = useSpotsStore((state) => state.savedSpots)
  const rigProfile = useRigStore((state) => state.rigProfile)
  const tripPlans = useTripPlansStore((state) => state.tripPlans)
  const saveTripPlan = useTripPlansStore((state) => state.saveTripPlan)
  const removeTripPlan = useTripPlansStore((state) => state.removeTripPlan)
  const { data: pins = [], isLoading } = usePinsQuery()
  const [geoState, requestGeo] = useGeolocation()
  const [tripTitle, setTripTitle] = useState('')
  const [destinationQuery, setDestinationQuery] = useState('')
  const [activePlanId, setActivePlanId] = useState<string | null>(null)
  const [selectedDestination, setSelectedDestination] = useState<TripPlanPlace | null>(null)
  const [selectedStops, setSelectedStops] = useState<TripPlanPlace[]>([])

  useEffect(() => { requestGeo() }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

    setSelectedStops((current) =>
      current.some((stop) => stop.id === nextStop.id)
        ? current.filter((stop) => stop.id !== nextStop.id)
        : [...current, nextStop],
    )
  }

  function handleSaveTrip() {
    if (!selectedDestination || !tripTitle.trim()) return

    const savedId = saveTripPlan({
      id: activePlanId ?? undefined,
      title: tripTitle.trim(),
      destination: selectedDestination,
      stops: selectedStops,
    })

    setActivePlanId(savedId)
  }

  function loadTripPlan(plan: TripPlan) {
    setActivePlanId(plan.id)
    setTripTitle(plan.title)
    setDestinationQuery(plan.destination.name)
    setSelectedDestination(plan.destination)
    setSelectedStops(plan.stops)
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
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTripPlan(plan.id)}
                      className="min-h-[44px] rounded-lg border border-border px-3 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
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
