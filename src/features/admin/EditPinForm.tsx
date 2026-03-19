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
}

const AMENITY_LABELS: { key: keyof AmenitiesState; label: string }[] = [
  { key: 'water', label: 'Water' },
  { key: 'dump', label: 'Dump' },
  { key: 'electric', label: 'Electric' },
  { key: 'shower', label: 'Shower' },
  { key: 'fuel', label: 'Fuel' },
  { key: 'propane', label: 'Propane' },
  { key: 'overnight', label: 'Overnight' },
]

const PIN_TYPES = ['blm', 'usfs', 'nps', 'overpass', 'community'] as const

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
  })
  const [maxLengthFt, setMaxLengthFt] = useState(pin.maxLengthFt != null ? String(pin.maxLengthFt) : '')
  const [maxHeightFt, setMaxHeightFt] = useState(pin.maxHeightFt != null ? String(pin.maxHeightFt) : '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}

    if (!name.trim()) {
      errs.name = 'Name is required'
    }

    const latNum = parseFloat(lat)
    if (!lat || isNaN(latNum)) {
      errs.latitude = 'Latitude is required'
    } else if (latNum < 24 || latNum > 49) {
      errs.latitude = 'Coordinates appear to be outside the supported region'
    }

    const lngNum = parseFloat(lng)
    if (!lng || isNaN(lngNum)) {
      errs.longitude = 'Longitude is required'
    } else if (lngNum < -125 || lngNum > -66) {
      errs.longitude = 'Coordinates appear to be outside the supported region'
    }

    if (!Object.values(amenities).some(Boolean)) {
      errs.amenities = 'At least one amenity is required'
    }

    return errs
  }

  const updateMutation = useMutation({
    mutationFn: async (body: object) => {
      const res = await fetch(`/api/pins/${pin.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
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
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})

    const payload = {
      name: name.trim(),
      pin_type: pinType,
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      amenities,
      max_length_ft: maxLengthFt ? parseInt(maxLengthFt, 10) : null,
      max_height_ft: maxHeightFt ? parseFloat(maxHeightFt) : null,
    }
    updateMutation.mutate(payload)
  }

  function handleAmenityChange(key: keyof AmenitiesState) {
    setAmenities((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div>
      <h2>Edit Pin</h2>

      <div>
        <label htmlFor="edit-pin-name">Name *</label>
        <input
          id="edit-pin-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-describedby={errors.name ? 'edit-name-error' : undefined}
        />
        {errors.name && <span id="edit-name-error" role="alert">{errors.name}</span>}
      </div>

      <div>
        <label htmlFor="edit-pin-type">Stop Type</label>
        <select
          id="edit-pin-type"
          value={pinType}
          onChange={(e) => setPinType(e.target.value as typeof pinType)}
        >
          {PIN_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="edit-pin-lat">Latitude *</label>
        <input
          id="edit-pin-lat"
          type="number"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          aria-describedby={errors.latitude ? 'edit-lat-error' : undefined}
        />
        {errors.latitude && <span id="edit-lat-error" role="alert">{errors.latitude}</span>}
      </div>

      <div>
        <label htmlFor="edit-pin-lng">Longitude *</label>
        <input
          id="edit-pin-lng"
          type="number"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          aria-describedby={errors.longitude ? 'edit-lng-error' : undefined}
        />
        {errors.longitude && <span id="edit-lng-error" role="alert">{errors.longitude}</span>}
      </div>

      <fieldset>
        <legend>Amenities * (select at least one)</legend>
        {AMENITY_LABELS.map(({ key, label }) => (
          <label key={key} className="min-h-[44px]" style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={amenities[key]}
              onChange={() => handleAmenityChange(key)}
              aria-label={label}
            />
            {label}
          </label>
        ))}
        {errors.amenities && <span role="alert">{errors.amenities}</span>}
      </fieldset>

      <div>
        <label htmlFor="edit-pin-max-length">Max Rig Length (ft)</label>
        <input
          id="edit-pin-max-length"
          type="number"
          value={maxLengthFt}
          onChange={(e) => setMaxLengthFt(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="edit-pin-max-height">Max Rig Height (ft)</label>
        <input
          id="edit-pin-max-height"
          type="number"
          value={maxHeightFt}
          onChange={(e) => setMaxHeightFt(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="edit-pin-fee">Fee (display-only, not persisted)</label>
        <input
          id="edit-pin-fee"
          type="text"
          disabled
          placeholder="Not stored in database"
        />
      </div>

      <div>
        <label htmlFor="edit-pin-notes">Notes (display-only, not persisted)</label>
        <textarea
          id="edit-pin-notes"
          disabled
          placeholder="Not stored in database"
        />
      </div>

      {updateMutation.isError && (
        <p role="alert">Failed to update pin. Please try again.</p>
      )}

      <button
        className="min-h-[44px] min-w-[44px]"
        onClick={handleSubmit}
        disabled={updateMutation.isPending}
      >
        Save Changes
      </button>

      <button
        className="min-h-[44px] min-w-[44px]"
        onClick={onCancel}
        disabled={updateMutation.isPending}
      >
        Cancel
      </button>
    </div>
  )
}
