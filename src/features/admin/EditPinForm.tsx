import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Pin } from '@/types/pin'

interface EditPinFormProps {
  pin: Pin
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
  wifi: boolean
  kitchen: boolean
  restaurant: boolean
  big_rig: boolean
  tent: boolean
}

const AMENITY_LABELS: { key: keyof AmenitiesState; label: string }[] = [
  { key: 'overnight',  label: 'Overnight' },
  { key: 'tent',       label: 'Tent' },
  { key: 'big_rig',   label: 'Big Rig OK' },
  { key: 'water',      label: 'Water' },
  { key: 'dump',       label: 'Dump Station' },
  { key: 'toilets',    label: 'Toilets' },
  { key: 'shower',     label: 'Shower' },
  { key: 'electric',   label: 'Electric' },
  { key: 'wifi',       label: 'WiFi' },
  { key: 'fuel',       label: 'Fuel' },
  { key: 'propane',    label: 'Propane' },
  { key: 'kitchen',    label: 'Kitchen' },
  { key: 'restaurant', label: 'Restaurant' },
  { key: 'pets',       label: 'Pets OK' },
]

const PIN_TYPES = ['blm', 'usfs', 'nps', 'overpass', 'community'] as const

const inputCls = 'w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]'
const labelCls = 'block text-sm font-medium text-foreground mb-1'
const errorCls = 'text-xs text-red-400 mt-1'

export default function EditPinForm({ pin, adminToken, onSuccess, onCancel }: EditPinFormProps) {
  const queryClient = useQueryClient()

  const [name, setName] = useState(pin.name)
  const [pinType, setPinType] = useState(pin.pinType)
  const [lat, setLat] = useState(String(pin.latitude))
  const [lng, setLng] = useState(String(pin.longitude))
  const [amenities, setAmenities] = useState<AmenitiesState>({
    water: pin.amenities.water ?? false,
    dump: pin.amenities.dump ?? false,
    electric: pin.amenities.electric ?? false,
    shower: pin.amenities.shower ?? false,
    fuel: pin.amenities.fuel ?? false,
    propane: pin.amenities.propane ?? false,
    overnight: pin.amenities.overnight ?? false,
    toilets: pin.amenities.toilets ?? false,
    pets: pin.amenities.pets ?? false,
    wifi: pin.amenities.wifi ?? false,
    kitchen: pin.amenities.kitchen ?? false,
    restaurant: pin.amenities.restaurant ?? false,
    big_rig: pin.amenities.big_rig ?? false,
    tent: pin.amenities.tent ?? false,
  })
  const [maxLengthFt, setMaxLengthFt] = useState(pin.maxLengthFt != null ? String(pin.maxLengthFt) : '')
  const [maxHeightFt, setMaxHeightFt] = useState(pin.maxHeightFt != null ? String(pin.maxHeightFt) : '')
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

  const updateMutation = useMutation({
    mutationFn: async (body: object) => {
      const res = await fetch(`/api/pins/${pin.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to update pin')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'all-pins'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'flagged-pins'] })
      onSuccess()
    },
  })

  function handleSubmit() {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    updateMutation.mutate({
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
      <h2 className="text-base font-semibold text-foreground mb-1">Edit Pin</h2>
      <p className="text-xs text-muted-foreground mb-6 font-mono">{pin.id}</p>

      <div className="space-y-5">
        {/* Name + Type row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="edit-pin-name" className={labelCls}>Name *</label>
            <input id="edit-pin-name" type="text" value={name}
              onChange={(e) => setName(e.target.value)}
              aria-describedby={errors.name ? 'edit-name-error' : undefined}
              className={inputCls} />
            {errors.name && <p id="edit-name-error" role="alert" className={errorCls}>{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="edit-pin-type" className={labelCls}>Stop Type</label>
            <select id="edit-pin-type" value={pinType}
              onChange={(e) => setPinType(e.target.value as typeof pinType)}
              className={inputCls}>
              {PIN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Coordinates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="edit-pin-lat" className={labelCls}>Latitude *</label>
            <input id="edit-pin-lat" type="number" value={lat}
              onChange={(e) => setLat(e.target.value)}
              aria-describedby={errors.latitude ? 'edit-lat-error' : undefined}
              className={inputCls} />
            {errors.latitude && <p id="edit-lat-error" role="alert" className={errorCls}>{errors.latitude}</p>}
          </div>
          <div>
            <label htmlFor="edit-pin-lng" className={labelCls}>Longitude *</label>
            <input id="edit-pin-lng" type="number" value={lng}
              onChange={(e) => setLng(e.target.value)}
              aria-describedby={errors.longitude ? 'edit-lng-error' : undefined}
              className={inputCls} />
            {errors.longitude && <p id="edit-lng-error" role="alert" className={errorCls}>{errors.longitude}</p>}
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
            <label htmlFor="edit-pin-max-length" className={labelCls}>Max Rig Length (ft)</label>
            <input id="edit-pin-max-length" type="number" value={maxLengthFt}
              onChange={(e) => setMaxLengthFt(e.target.value)}
              className={inputCls} placeholder="Optional" />
          </div>
          <div>
            <label htmlFor="edit-pin-max-height" className={labelCls}>Max Rig Height (ft)</label>
            <input id="edit-pin-max-height" type="number" value={maxHeightFt}
              onChange={(e) => setMaxHeightFt(e.target.value)}
              className={inputCls} placeholder="Optional" />
          </div>
        </div>

        {/* Display-only fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 opacity-50">
          <div>
            <label htmlFor="edit-pin-fee" className={labelCls}>Fee <span className="text-muted-foreground font-normal">(not stored)</span></label>
            <input id="edit-pin-fee" type="text" disabled placeholder="Not stored in database" className={inputCls} />
          </div>
          <div>
            <label htmlFor="edit-pin-notes" className={labelCls}>Notes <span className="text-muted-foreground font-normal">(not stored)</span></label>
            <textarea id="edit-pin-notes" disabled placeholder="Not stored in database"
              className={`${inputCls} resize-none`} />
          </div>
        </div>

        {updateMutation.isError && (
          <p role="alert" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            Failed to update pin. Please try again.
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            className="min-h-[44px] px-6 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            className="min-h-[44px] px-6 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 disabled:opacity-50 transition-colors"
            onClick={onCancel}
            disabled={updateMutation.isPending}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
