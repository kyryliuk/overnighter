import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface CreatePinFormProps {
  adminToken: string
  onSuccess: () => void
  onCancel: () => void
}

type AmenitiesState = {
  water: boolean
  dump: boolean
  electric: boolean
  shower: boolean
  fuel: boolean
  propane: boolean
  overnight: boolean
  toilets: boolean
  pets: boolean
}

const AMENITY_LABELS: { key: keyof AmenitiesState; label: string }[] = [
  { key: 'overnight', label: 'Overnight' },
  { key: 'water', label: 'Water' },
  { key: 'dump', label: 'Dump' },
  { key: 'toilets', label: 'Toilets' },
  { key: 'shower', label: 'Shower' },
  { key: 'electric', label: 'Electric' },
  { key: 'fuel', label: 'Fuel' },
  { key: 'propane', label: 'Propane' },
  { key: 'pets', label: 'Pets OK' },
]

const PIN_TYPES = ['blm', 'usfs', 'nps', 'overpass', 'community'] as const

const inputCls = 'w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]'
const labelCls = 'block text-sm font-medium text-foreground mb-1'
const errorCls = 'text-xs text-red-400 mt-1'

export default function CreatePinForm({ adminToken, onSuccess, onCancel }: CreatePinFormProps) {
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [pinType, setPinType] = useState<string>('community')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [amenities, setAmenities] = useState<AmenitiesState>({
    water: false, dump: false, electric: false, shower: false,
    fuel: false, propane: false, overnight: false, toilets: false, pets: false,
  })
  const [maxLengthFt, setMaxLengthFt] = useState('')
  const [maxHeightFt, setMaxHeightFt] = useState('')
  const [fee, setFee] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Name is required'
    const latNum = parseFloat(lat)
    if (!lat || isNaN(latNum)) errs.latitude = 'Latitude is required'
    else if (latNum < 24 || latNum > 49) errs.latitude = 'Coordinates appear to be outside the supported region'
    const lngNum = parseFloat(lng)
    if (!lng || isNaN(lngNum)) errs.longitude = 'Longitude is required'
    else if (lngNum < -125 || lngNum > -66) errs.longitude = 'Coordinates appear to be outside the supported region'
    if (!Object.values(amenities).some(Boolean)) errs.amenities = 'At least one amenity is required'
    return errs
  }

  const createMutation = useMutation({
    mutationFn: async (body: object) => {
      const res = await fetch('/api/admin/pins', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to create pin')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'flagged-pins'] })
      onSuccess()
    },
  })

  function handleSubmit() {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    createMutation.mutate({
      name: name.trim(), pin_type: pinType,
      latitude: parseFloat(lat), longitude: parseFloat(lng), amenities,
      max_length_ft: maxLengthFt ? parseInt(maxLengthFt, 10) : null,
      max_height_ft: maxHeightFt ? parseFloat(maxHeightFt) : null,
    })
  }

  function handleAmenityChange(key: keyof AmenitiesState) {
    setAmenities((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="bg-secondary border border-border rounded-xl p-6">
      <h2 className="text-base font-semibold text-foreground mb-6">Add New Pin</h2>

      <div className="space-y-5">
        {/* Name + Type row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="pin-name" className={labelCls}>Name *</label>
            <input id="pin-name" type="text" value={name}
              onChange={(e) => setName(e.target.value)}
              aria-describedby={errors.name ? 'name-error' : undefined}
              className={inputCls} placeholder="e.g. Lone Pine BLM" />
            {errors.name && <p id="name-error" role="alert" className={errorCls}>{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="pin-type" className={labelCls}>Stop Type</label>
            <select id="pin-type" value={pinType}
              onChange={(e) => setPinType(e.target.value)}
              className={inputCls}>
              {PIN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Coordinates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="pin-lat" className={labelCls}>Latitude *</label>
            <input id="pin-lat" type="number" value={lat}
              onChange={(e) => setLat(e.target.value)}
              aria-describedby={errors.latitude ? 'lat-error' : undefined}
              className={inputCls} placeholder="36.7783" />
            {errors.latitude && <p id="lat-error" role="alert" className={errorCls}>{errors.latitude}</p>}
          </div>
          <div>
            <label htmlFor="pin-lng" className={labelCls}>Longitude *</label>
            <input id="pin-lng" type="number" value={lng}
              onChange={(e) => setLng(e.target.value)}
              aria-describedby={errors.longitude ? 'lng-error' : undefined}
              className={inputCls} placeholder="-119.4179" />
            {errors.longitude && <p id="lng-error" role="alert" className={errorCls}>{errors.longitude}</p>}
          </div>
        </div>

        {/* Amenities */}
        <fieldset>
          <legend className={labelCls}>Amenities * <span className="text-muted-foreground font-normal">(select at least one)</span></legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            {AMENITY_LABELS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 min-h-[44px] px-3 bg-background border border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                <input type="checkbox" checked={amenities[key]}
                  onChange={() => handleAmenityChange(key)}
                  aria-label={label}
                  className="accent-primary w-4 h-4 flex-shrink-0" />
                <span className="text-sm text-foreground">{label}</span>
              </label>
            ))}
          </div>
          {errors.amenities && <p role="alert" className={errorCls}>{errors.amenities}</p>}
        </fieldset>

        {/* Rig limits */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="pin-max-length" className={labelCls}>Max Rig Length (ft)</label>
            <input id="pin-max-length" type="number" value={maxLengthFt}
              onChange={(e) => setMaxLengthFt(e.target.value)}
              className={inputCls} placeholder="Optional" />
          </div>
          <div>
            <label htmlFor="pin-max-height" className={labelCls}>Max Rig Height (ft)</label>
            <input id="pin-max-height" type="number" value={maxHeightFt}
              onChange={(e) => setMaxHeightFt(e.target.value)}
              className={inputCls} placeholder="Optional" />
          </div>
        </div>

        {/* Fee + Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="pin-fee" className={labelCls}>Fee (optional)</label>
            <input id="pin-fee" type="text" value={fee}
              onChange={(e) => setFee(e.target.value)}
              className={inputCls} placeholder="e.g. Free, $10/night" />
          </div>
          <div>
            <label htmlFor="pin-notes" className={labelCls}>Notes (optional)</label>
            <textarea id="pin-notes" value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${inputCls} min-h-[44px] resize-none`}
              placeholder="Any additional info for travelers" />
          </div>
        </div>

        {createMutation.isError && (
          <p role="alert" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            Failed to create pin. Please try again.
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            className="min-h-[44px] px-6 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            onClick={handleSubmit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Publishing…' : 'Publish Pin'}
          </button>
          <button
            className="min-h-[44px] px-6 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 disabled:opacity-50 transition-colors"
            onClick={onCancel}
            disabled={createMutation.isPending}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
