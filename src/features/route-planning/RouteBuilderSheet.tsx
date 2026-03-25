import { useMemo, useState } from 'react'
import { usePinsQuery } from '@/hooks/usePinsQuery'
import type { Pin } from '@/types/pin'
import type { TripPlaceSnapshot, TripWritePayload } from '@/types/trip'

function pinToTripPlaceSnapshot(pin: Pick<Pin, 'id' | 'name' | 'latitude' | 'longitude'>): TripPlaceSnapshot {
  return {
    id: pin.id,
    name: pin.name,
    latitude: pin.latitude,
    longitude: pin.longitude,
  }
}

function filterPins(pins: Pin[], query: string, excludeId?: string | null) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return []

  return pins
    .filter((pin) => pin.id !== excludeId && pin.name.toLowerCase().includes(normalizedQuery))
    .slice(0, 8)
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

export interface RouteBuilderSheetProps {
  isOpen: boolean
  isSaving?: boolean
  errorMessage?: string | null
  onClose: () => void
  onSave: (payload: TripWritePayload) => Promise<void> | void
}

export default function RouteBuilderSheet({
  isOpen,
  isSaving = false,
  errorMessage,
  onClose,
  onSave,
}: RouteBuilderSheetProps) {
  const { data: pins = [], isLoading } = usePinsQuery()
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [originQuery, setOriginQuery] = useState('')
  const [destinationQuery, setDestinationQuery] = useState('')
  const [origin, setOrigin] = useState<TripPlaceSnapshot | null>(null)
  const [destination, setDestination] = useState<TripPlaceSnapshot | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const originCandidates = useMemo(
    () => filterPins(pins, originQuery, destination?.id),
    [destination?.id, originQuery, pins],
  )
  const destinationCandidates = useMemo(
    () => filterPins(pins, destinationQuery, origin?.id),
    [destinationQuery, origin?.id, pins],
  )

  if (!isOpen) return null

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!destination) {
      setValidationError('Choose a destination before saving your route.')
      return
    }

    setValidationError(null)
    await onSave({
      title,
      notes,
      origin,
      destination,
    })
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/50 p-4 md:items-center md:justify-center" role="presentation">
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label="Create route"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-border bg-background p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-400">Route builder</p>
            <h2 className="text-2xl font-semibold">Create a new route</h2>
            <p className="text-sm text-muted-foreground">
              Save a destination-focused draft now. Stop editing and resume controls arrive in later stories.
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

          {validationError ? <p role="alert" className="text-sm text-red-300">{validationError}</p> : null}
          {errorMessage ? <p role="alert" className="text-sm text-red-300">{errorMessage}</p> : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving || !destination}
              className="min-h-[44px] rounded-full bg-sky-500 px-5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Saving route…' : 'Save route'}
            </button>
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
