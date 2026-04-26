import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWaterTapQuery } from './waterTapsApi'
import { useUIStore } from '@/store/uiStore'
import TapConfidenceBadge from './TapConfidenceBadge'
import TapConfirmDeny from './TapConfirmDeny'
import TapPhotoSubmission from './TapPhotoSubmission'

const PLACE_TYPE_LABELS: Record<string, string> = {
  gas_station: 'Gas Station',
  campground: 'Campground',
  restaurant: 'Restaurant / Stop',
}

const ACCESS_LABELS: Record<string, string> = {
  public: 'Public Access',
  ask_permission: 'Ask Permission',
  private: 'Private',
}

/**
 * TapPinDetailSheet — bottom sheet for `/tap/:id` (FR45, FR46, FR47)
 *
 * - Slides up from bottom within 300ms (NFR-P3)
 * - Swipe down (>80px) to dismiss
 * - All interactive elements ≥44×44px (NFR-A4)
 * - No imports from src/features/pin-detail/ (module isolation)
 */
export default function TapPinDetailSheet() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: tap, isLoading, error } = useWaterTapQuery(id)

  // Clear selectedTapPinId on unmount so the same tap pin can be re-tapped after
  // browser back navigation (mirrors PinDetailSheet pattern)
  useEffect(() => {
    return () => { useUIStore.getState().setSelectedTapPin(null) }
  }, [])

  // Slide-up animation state
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Swipe-down to dismiss
  const touchStartY = useRef<number>(0)
  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const diff = e.changedTouches[0].clientY - touchStartY.current
    if (diff > 80) handleDismiss()
  }

  function handleDismiss() {
    navigate('/')
  }

  const sheetStyle: React.CSSProperties = {
    transform: mounted ? 'translateY(0)' : 'translateY(100%)',
    transition: 'transform 300ms ease-out',
  }

  const lastVerified = tap?.verified_date
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
        new Date(tap.verified_date),
      )
    : null

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="tap-detail-backdrop"
        className="fixed inset-0 bg-black/50 z-20"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tap-detail-name"
        style={sheetStyle}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="fixed bottom-0 left-0 right-0 z-30 bg-background border-t border-border rounded-t-2xl max-h-[80vh] flex flex-col"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full bg-muted-foreground/40" aria-hidden="true" />
        </div>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Close tap details"
        >
          ✕
        </button>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-6 pb-6 pt-2 flex-1">
          {isLoading ? (
            // Loading skeleton
            <div aria-label="Loading tap details" className="space-y-3 animate-pulse">
              <div className="h-6 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-10 bg-muted rounded" />
            </div>
          ) : error ? (
            // Error state
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Couldn&apos;t load tap details. Check your connection.</p>
              <button
                onClick={handleDismiss}
                className="text-sm text-sky-500 underline"
              >
                Back to map
              </button>
            </div>
          ) : !tap ? (
            // Not found
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Tap not found</p>
              <button
                onClick={handleDismiss}
                className="text-sm text-sky-500 underline"
              >
                Back to map
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Place name */}
              <h2 id="tap-detail-name" className="text-lg font-bold text-foreground pr-10">
                {tap.place_name}
              </h2>

              {/* Place type */}
              <p className="text-sm text-muted-foreground">
                {PLACE_TYPE_LABELS[tap.place_type] ?? tap.place_type}
              </p>

              {/* Access classification */}
              {tap.access && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border text-xs text-muted-foreground">
                  🔑 {ACCESS_LABELS[tap.access] ?? tap.access}
                </div>
              )}

              {/* Confidence badge */}
              <TapConfidenceBadge
                source={tap.source}
                confidence={tap.confidence}
                verifiedDate={tap.verified_date}
                confirmedCount={tap.confirmedCount}
              />

              {/* Photos */}
              {tap.photos && tap.photos.length > 0 && (
                <div>
                  <span className="block text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 border-l-2 border-muted-foreground/30 pl-2 mb-2">
                    Photos
                  </span>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {tap.photos.map((url: string) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0"
                      >
                        <img
                          src={url}
                          alt="Tap photo"
                          className="w-20 h-20 rounded-lg object-cover border border-border"
                          loading="lazy"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Mile marker */}
              {tap.mile_marker !== null && tap.mile_marker !== undefined && (
                <div>
                  <span className="block text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 border-l-2 border-muted-foreground/30 pl-2 mb-1">
                    Mile Marker
                  </span>
                  <p className="text-sm text-foreground">MM {tap.mile_marker}</p>
                </div>
              )}

              {/* Seasonal notes */}
              {tap.seasonal_notes && (
                <div>
                  <span className="block text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 border-l-2 border-muted-foreground/30 pl-2 mb-1">
                    Seasonal Notes
                  </span>
                  <p className="text-sm text-foreground">{tap.seasonal_notes}</p>
                </div>
              )}

              {/* Last verified date */}
              {lastVerified && (
                <p className="text-xs text-muted-foreground">
                  Community verified: {lastVerified}
                </p>
              )}

              {/* Confirm / Deny */}
              <div>
                <span className="block text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 border-l-2 border-muted-foreground/30 pl-2 mb-2">
                  Is this tap still here?
                </span>
                <TapConfirmDeny tapPinId={tap.id} />
              </div>

              {/* Photo submission */}
              <div>
                <span className="block text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 border-l-2 border-muted-foreground/30 pl-2 mb-2">
                  Submit a Photo
                </span>
                <TapPhotoSubmission
                  tapPinId={tap.id}
                  tapPinLocation={[tap.latitude, tap.longitude]}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
