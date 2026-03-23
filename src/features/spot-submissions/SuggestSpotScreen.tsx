import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/account/AuthContext'
import { SPOT_AMENITY_LABELS, EMPTY_PIN_AMENITIES } from '@/features/spots/spotFormConfig'
import { useGeolocation } from '@/hooks/useGeolocation'
import type { PinAmenities } from '@/types/pin'
import type { SpotSubmission, SpotSubmissionStatus } from '@/types/spotSubmission'

const inputCls = 'w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]'
const labelCls = 'block text-sm font-medium text-foreground mb-1'
const errorCls = 'text-xs text-red-400 mt-1'

const STATUS_STYLES: Record<SpotSubmissionStatus, string> = {
  pending: 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/20',
  approved: 'bg-green-500/15 text-green-300 border border-green-500/20',
  rejected: 'bg-red-500/15 text-red-300 border border-red-500/20',
  changes_requested: 'bg-sky-500/15 text-sky-300 border border-sky-500/20',
}

export default function SuggestSpotScreen() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session, isAuthenticated } = useAuth()
  const [geoState, requestGeo] = useGeolocation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [website, setWebsite] = useState('')
  const [phone, setPhone] = useState('')
  const [maxLengthFt, setMaxLengthFt] = useState('')
  const [maxHeightFt, setMaxHeightFt] = useState('')
  const [amenities, setAmenities] = useState<PinAmenities>(EMPTY_PIN_AMENITIES)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const submissionsQuery = useQuery({
    queryKey: ['spot-submissions', session?.user.id],
    enabled: Boolean(session?.access_token),
    queryFn: async () => {
      const res = await fetch('/api/spot-submissions', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })

      if (!res.ok) throw new Error('Failed to load submissions')
      return res.json() as Promise<SpotSubmission[]>
    },
  })

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/spot-submissions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
          amenities,
          max_length_ft: maxLengthFt ? parseInt(maxLengthFt, 10) : null,
          max_height_ft: maxHeightFt ? parseFloat(maxHeightFt) : null,
          website: website.trim() || null,
          phone: phone.trim() || null,
        }),
      })

      if (!res.ok) throw new Error('Failed to submit spot')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spot-submissions'] })
      setName('')
      setDescription('')
      setLat('')
      setLng('')
      setWebsite('')
      setPhone('')
      setMaxLengthFt('')
      setMaxHeightFt('')
      setAmenities(EMPTY_PIN_AMENITIES)
      setErrors({})
    },
  })

  const geoError = useMemo(() => {
    if (!geoState.error) return null
    if (geoState.error === 'denied') return 'Location access denied'
    if (geoState.error === 'no-api') return 'Location is not available on this device'
    return 'Could not get your location. Try again.'
  }, [geoState.error])

  function validate() {
    const nextErrors: Record<string, string> = {}
    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)

    if (!name.trim()) nextErrors.name = 'Name is required'
    if (!lat || Number.isNaN(latNum)) nextErrors.latitude = 'Latitude is required'
    else if (latNum < 24 || latNum > 49) nextErrors.latitude = 'Coordinates appear to be outside the supported region'
    if (!lng || Number.isNaN(lngNum)) nextErrors.longitude = 'Longitude is required'
    else if (lngNum < -125 || lngNum > -66) nextErrors.longitude = 'Coordinates appear to be outside the supported region'
    if (!Object.values(amenities).some(Boolean)) nextErrors.amenities = 'Select at least one amenity or activity'
    if (website.trim()) {
      try {
        new URL(website.trim())
      } catch {
        nextErrors.website = 'Website must be a valid URL'
      }
    }

    return nextErrors
  }

  function handleAmenityToggle(key: keyof PinAmenities) {
    setAmenities((current) => ({ ...current, [key]: !current[key] }))
  }

  function handleSubmit() {
    const nextErrors = validate()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    submitMutation.mutate()
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground px-6 py-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-secondary p-6 space-y-4">
          <h1 className="text-2xl font-bold">Suggest a spot</h1>
          <p className="text-sm text-muted-foreground">
            Sign in first so we can track your submission status and send it through review safely.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/account')}
              className="min-h-[44px] rounded-lg bg-primary px-4 text-primary-foreground font-semibold"
            >
              Go to account
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="min-h-[44px] rounded-lg border border-border px-4 text-muted-foreground"
            >
              Back to map
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Suggest a spot</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Share a missing overnight stop. Approved submissions will be published to the map.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="min-h-[44px] rounded-lg border border-border px-4 text-sm text-muted-foreground"
          >
            Back to map
          </button>
        </div>

        <section className="rounded-2xl border border-border bg-secondary p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Submission details</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={requestGeo}
                disabled={geoState.isLoading}
                className="min-h-[44px] rounded-lg border border-border bg-background px-4 text-sm"
              >
                {geoState.isLoading ? 'Getting location...' : 'Detect my location'}
              </button>
              {geoState.coords && (
                <button
                  type="button"
                  onClick={() => {
                    setLat(geoState.coords?.latitude.toFixed(6) ?? '')
                    setLng(geoState.coords?.longitude.toFixed(6) ?? '')
                  }}
                  className="min-h-[44px] rounded-lg border border-border bg-background px-4 text-sm"
                >
                  Use detected coordinates
                </button>
              )}
            </div>
          </div>

          {geoError && <p role="alert" className="text-sm text-red-300">{geoError}</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="submission-name">Spot name *</label>
              <input id="submission-name" value={name} onChange={(event) => setName(event.target.value)} className={inputCls} />
              {errors.name && <p className={errorCls}>{errors.name}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="submission-website">Website</label>
              <input id="submission-website" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://example.com" className={inputCls} />
              {errors.website && <p className={errorCls}>{errors.website}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="submission-latitude">Latitude *</label>
              <input id="submission-latitude" value={lat} onChange={(event) => setLat(event.target.value)} className={inputCls} />
              {errors.latitude && <p className={errorCls}>{errors.latitude}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="submission-longitude">Longitude *</label>
              <input id="submission-longitude" value={lng} onChange={(event) => setLng(event.target.value)} className={inputCls} />
              {errors.longitude && <p className={errorCls}>{errors.longitude}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="submission-phone">Phone</label>
              <input id="submission-phone" value={phone} onChange={(event) => setPhone(event.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls} htmlFor="submission-max-length">Max rig length</label>
                <input id="submission-max-length" value={maxLengthFt} onChange={(event) => setMaxLengthFt(event.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls} htmlFor="submission-max-height">Max rig height</label>
                <input id="submission-max-height" value={maxHeightFt} onChange={(event) => setMaxHeightFt(event.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="submission-description">What should travelers know?</label>
            <textarea
              id="submission-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={`${inputCls} min-h-28 resize-y`}
              placeholder="Road access, overnight rules, useful notes, and what makes this stop worth adding."
            />
          </div>

          <fieldset>
            <legend className={labelCls}>Amenities & activities *</legend>
            {(['infra', 'activity'] as const).map((group) => (
              <div key={group} className="mt-3">
                <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 mb-2">
                  {group === 'infra' ? 'Infrastructure' : 'Activities'}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {SPOT_AMENITY_LABELS.filter((amenity) => amenity.group === group).map(({ key, label }) => (
                    <label key={key} className="flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm">
                      <input
                        type="checkbox"
                        checked={amenities[key]}
                        onChange={() => handleAmenityToggle(key)}
                        aria-label={label}
                        className="accent-primary"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {errors.amenities && <p className={errorCls}>{errors.amenities}</p>}
          </fieldset>

          {submitMutation.isError && (
            <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              Failed to submit your spot. Please try again.
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            className="min-h-[44px] rounded-lg bg-primary px-5 text-primary-foreground font-semibold disabled:opacity-50"
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit for review'}
          </button>
        </section>

        <section className="rounded-2xl border border-border bg-secondary p-6 space-y-4">
          <h2 className="text-lg font-semibold">My submissions</h2>

          {submissionsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading your submissions...</p>}
          {submissionsQuery.isError && <p className="text-sm text-red-300">Failed to load your submissions.</p>}

          {!submissionsQuery.isLoading && !submissionsQuery.isError && (submissionsQuery.data?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">You haven&apos;t submitted any spots yet.</p>
          )}

          <ul className="space-y-3">
            {(submissionsQuery.data ?? []).map((submission) => (
              <li key={submission.id} className="rounded-xl border border-border bg-background p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{submission.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {submission.latitude.toFixed(4)}, {submission.longitude.toFixed(4)}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[submission.status]}`}>
                    {submission.status.replace('_', ' ')}
                  </span>
                </div>
                {submission.description && (
                  <p className="text-sm text-muted-foreground">{submission.description}</p>
                )}
                {submission.adminNotes && (
                  <p className="rounded-lg border border-border px-3 py-2 text-sm text-foreground">
                    Admin feedback: {submission.adminNotes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
