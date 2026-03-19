import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePinsQuery } from '@/hooks/usePinsQuery'
import { useRigStore } from '@/store/rigStore'
import { useUIStore } from '@/store/uiStore'
import { useSpotsStore } from '@/store/spotsStore'
import type { Pin, PinAmenities, PinSource } from '@/types/pin'
import type { RigProfile } from '@/types/rigProfile'
import RecencyBadge from '@/components/RecencyBadge'

// Named export so it can be unit-tested directly without stubbing navigator globals (Story 3.2)
export function buildMapsUrl(
  lat: number,
  lng: number,
  name: string,
  userAgent = navigator.userAgent,
): string {
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    return `maps://?daddr=${lat},${lng}`
  }
  if (/Android/.test(userAgent)) {
    return `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(name)})`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

// Inline to avoid cross-feature import (architecture: features must not import from other features)
// Logic mirrors PinLayer.tsx:doesPinFitRig exactly — must stay in sync if that logic changes
function doesPinFitRig(pin: Pin, rigProfile: RigProfile): boolean {
  if (!rigProfile.rigType) return true
  const lengthOk =
    pin.maxLengthFt === null ||
    rigProfile.lengthFt === null ||
    rigProfile.lengthFt <= pin.maxLengthFt
  const heightOk =
    pin.maxHeightFt === null ||
    rigProfile.heightFt === null ||
    rigProfile.heightFt <= pin.maxHeightFt
  return lengthOk && heightOk
}

const PIN_TYPE_LABELS: Record<PinSource, string> = {
  blm: 'BLM Land',
  usfs: 'National Forest',
  nps: 'National Park',
  overpass: 'OpenStreetMap',
  community: 'Community Stop',
}

const AMENITY_CHIPS: Array<{ key: keyof PinAmenities; label: string; emoji: string }> = [
  { key: 'water',     label: 'Water',    emoji: '💧' },
  { key: 'dump',      label: 'Dump',     emoji: '🚽' },
  { key: 'overnight', label: 'Overnight',emoji: '🏕' },
  { key: 'fuel',      label: 'Fuel',     emoji: '⛽' },
  { key: 'propane',   label: 'Propane',  emoji: '🔵' },
  { key: 'electric',  label: 'Electric', emoji: '⚡' },
  { key: 'shower',    label: 'Shower',   emoji: '🚿' },
]

export default function PinDetailSheet() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: pins = [], isLoading, error } = usePinsQuery({ enabled: true })
  const rigProfile = useRigStore((state) => state.rigProfile)
  const pin = pins.find((p) => p.id === id)
  const isSaved = useSpotsStore((state) => state.isSaved(id ?? ''))
  const saveSpot = useSpotsStore((state) => state.saveSpot)
  const removeSpot = useSpotsStore((state) => state.removeSpot)

  function handleBookmark() {
    if (!pin) return
    if (isSaved) {
      removeSpot(pin.id)
    } else {
      saveSpot(pin)
    }
  }

  // M1 fix: clear selectedPinId on unmount so the same pin can be re-tapped after
  // browser back navigation (which doesn't call handleDismiss)
  useEffect(() => {
    return () => { useUIStore.getState().setSelectedPin(null) }
  }, [])

  function handleDismiss() {
    useUIStore.getState().setSelectedPin(null)
    navigate('/')
  }

  function handleGetDirections() {
    if (!pin) return
    const url = buildMapsUrl(pin.latitude, pin.longitude, pin.name)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const fits = pin ? doesPinFitRig(pin, rigProfile) : true
  const showRigNotice = rigProfile.rigType !== null && !fits

  const activeAmenities = pin
    ? AMENITY_CHIPS.filter(({ key }) => pin.amenities[key])
    : []

  const lastVerified = pin?.lastCheckInAt
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        .format(new Date(pin.lastCheckInAt))
    : 'Never verified'

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="pin-detail-backdrop"
        className="fixed inset-0 bg-black/50 z-20"
        onClick={handleDismiss}
        aria-hidden="true"
      />
      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-detail-name"
        className="fixed bottom-0 left-0 right-0 z-30 bg-background border-t border-border rounded-t-2xl max-h-[70vh] flex flex-col"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full bg-muted-foreground/40" aria-hidden="true" />
        </div>
        {/* Bookmark button — only when pin is loaded and found */}
        {!isLoading && !error && pin && (
          <button
            onClick={handleBookmark}
            aria-label={isSaved ? 'Remove saved spot' : 'Save spot'}
            aria-pressed={isSaved}
            className="absolute top-4 right-14 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center text-xl"
            style={{ color: isSaved ? '#0ea5e9' : undefined }}
          >
            {isSaved ? '★' : '☆'}
          </button>
        )}
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Close pin details"
        >
          ✕
        </button>
        {/* Scrollable content */}
        <div className="overflow-y-auto px-6 pb-6 pt-2 flex-1">
          {isLoading ? (
            <div aria-label="Loading pin details" className="space-y-3 animate-pulse">
              <div className="h-6 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Couldn't load spot details. Check your connection.</p>
              <button
                onClick={handleDismiss}
                className="text-sm text-sky-500 underline"
              >
                Back to map
              </button>
            </div>
          ) : !pin ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Spot not found</p>
              <button
                onClick={handleDismiss}
                className="text-sm text-sky-500 underline"
              >
                Back to map
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Name — linked by aria-labelledby on the dialog */}
              <h2 id="pin-detail-name" className="text-lg font-bold text-foreground pr-10">
                {pin.name}
              </h2>
              {/* Category */}
              <p className="text-sm text-muted-foreground">
                {PIN_TYPE_LABELS[pin.pinType] ?? pin.pinType}
              </p>
              {/* Recency badge */}
              <RecencyBadge badgeState={pin.badgeState} />
              {/* Amenities */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                  Amenities
                </p>
                {activeAmenities.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {activeAmenities.map(({ key, label, emoji }) => (
                      <span
                        key={key}
                        className="flex items-center gap-1 px-2 py-1 rounded-full border border-border text-sm text-foreground"
                      >
                        <span aria-hidden="true">{emoji}</span>
                        {label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No amenity data</p>
                )}
              </div>
              {/* Rig restrictions */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Size Restrictions
                </p>
                {pin.maxLengthFt !== null || pin.maxHeightFt !== null ? (
                  <p className="text-sm text-foreground">
                    {[
                      pin.maxLengthFt !== null && `Max length: ${pin.maxLengthFt}ft`,
                      pin.maxHeightFt !== null && `Max height: ${pin.maxHeightFt}ft`,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No size restrictions</p>
                )}
              </div>
              {/* Rig fit notice (AC4) */}
              {showRigNotice && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 text-sm text-yellow-500">
                  This spot may not fit your {rigProfile.rigType}, {rigProfile.lengthFt}ft rig
                </div>
              )}
              {/* Last verified */}
              <p className="text-sm text-muted-foreground">Verified: {lastVerified}</p>
              {/* Description / community notes */}
              {pin.description && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Community notes
                  </p>
                  <p className="text-sm text-foreground">{pin.description}</p>
                </div>
              )}
              {/* Get Directions — primary CTA (AC1, AC5). Visible even on stale pins: warn never block */}
              <button
                onClick={handleGetDirections}
                aria-label="Get Directions"
                className="w-full min-h-[44px] rounded-lg font-semibold text-white"
                style={{ backgroundColor: '#0ea5e9' }}
              >
                Get Directions →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
