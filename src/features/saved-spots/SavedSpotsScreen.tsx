import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSpotsStore } from '@/store/spotsStore'
import { useUIStore } from '@/store/uiStore'
import { useGeolocation } from '@/hooks/useGeolocation'
import RecencyBadge from '@/components/RecencyBadge'
import type { Pin, PinSource } from '@/types/pin'

const PIN_TYPE_LABELS: Record<PinSource, string> = {
  blm: 'BLM Land',
  usfs: 'National Forest',
  nps: 'National Park',
  overpass: 'OpenStreetMap',
  community: 'Community Stop',
  water_tap: 'Water Tap',
}

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959 // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function SavedSpotsScreen() {
  const navigate = useNavigate()
  const savedSpots = useSpotsStore((state) => state.savedSpots)
  const activeTripId = useUIStore((state) => state.activeTripId)
  const [geoState, requestGeo] = useGeolocation()

  useEffect(() => { requestGeo() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSpotTap(pin: Pin) {
    useUIStore.getState().setPendingMapCenter({ lat: pin.latitude, lng: pin.longitude })
    useUIStore.getState().setSelectedPin(pin.id)
    navigate('/pin/' + pin.id)
  }

  function handleAddToRoute(pin: Pin) {
    if (!activeTripId) return

    const nextParams = new URLSearchParams({
      tripId: activeTripId,
      addStopPinId: pin.id,
      addStopSource: 'saved',
    })
    navigate(`/trips?${nextParams.toString()}`)
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          aria-label="Back to map"
          className="text-sky-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          ←
        </button>
        <h1 className="text-lg font-bold">Saved Spots</h1>
      </div>

      {/* Content */}
      {savedSpots.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 px-6 py-16 text-center">
          <p className="text-muted-foreground mb-2">No saved spots yet</p>
          <p className="text-sm text-muted-foreground">Tap the bookmark icon on any pin to save it</p>
        </div>
      ) : (
        <ul role="list" className="flex-1 overflow-y-auto">
          {savedSpots.map((pin) => (
            <li key={pin.id}>
              <button
                onClick={() => handleSpotTap(pin)}
                className="w-full text-left px-4 py-3 border-b border-border flex flex-col gap-1 hover:bg-muted/20 active:bg-muted/30"
                aria-label={`View ${pin.name}`}
              >
                <span className="font-semibold text-foreground">{pin.name}</span>
                <span className="text-sm text-muted-foreground">{PIN_TYPE_LABELS[pin.pinType] ?? pin.pinType}</span>
                <div className="flex items-center gap-3 mt-1">
                  <RecencyBadge badgeState={pin.badgeState} />
                  {geoState.coords && (
                    <span className="text-xs text-muted-foreground">
                      {distanceMiles(
                        geoState.coords.latitude,
                        geoState.coords.longitude,
                        pin.latitude,
                        pin.longitude,
                      ).toFixed(1)} mi
                    </span>
                  )}
                </div>
              </button>
              {activeTripId ? (
                <div className="border-b border-border px-4 pb-3">
                  <button
                    type="button"
                    onClick={() => handleAddToRoute(pin)}
                    className="min-h-[44px] rounded-full border border-border px-4 text-sm font-medium"
                    aria-label={`Add ${pin.name} to route`}
                  >
                    Add to route
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
