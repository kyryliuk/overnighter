import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/account/AuthContext'
import { SPOT_AMENITY_LABELS, EMPTY_PIN_AMENITIES } from '@/features/spots/spotFormConfig'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import PhotoUpload from '@/features/check-in/PhotoUpload'
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

const STATUS_LABELS: Record<SpotSubmissionStatus, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  changes_requested: 'Changes requested',
}

const SPOT_TYPE_CHIPS: Array<{ key: keyof PinAmenities; label: string }> = [
  { key: 'overnight', label: 'Overnight' },
  { key: 'dump', label: 'Dump Station' },
  { key: 'water', label: 'Water' },
  { key: 'fuel', label: 'Fuel' },
]

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={[
            'h-2 rounded-full transition-all',
            i + 1 === current ? 'w-8 bg-primary' : i + 1 < current ? 'w-2 bg-primary/60' : 'w-2 bg-muted',
          ].join(' ')}
          aria-label={`Step ${i + 1} of ${total}${i + 1 === current ? ' (current)' : ''}`}
        />
      ))}
      <span className="ml-2 text-xs text-muted-foreground">Step {current} of {total}</span>
    </div>
  )
}

function SubmissionDetail({ submission }: { submission: SpotSubmission }) {
  const navigate = useNavigate()
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(submission.createdAt))

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">Submitted</span>
          <p className="text-foreground">{formattedDate}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Status</span>
          <p className="text-foreground">{STATUS_LABELS[submission.status]}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">Coordinates</span>
          <p className="text-foreground font-mono text-xs">
            {submission.latitude.toFixed(6)}, {submission.longitude.toFixed(6)}
          </p>
        </div>
        {(submission.maxLengthFt || submission.maxHeightFt) && (
          <div>
            <span className="text-muted-foreground">Size limits</span>
            <p className="text-foreground">
              {[
                submission.maxLengthFt && `${submission.maxLengthFt}ft L`,
                submission.maxHeightFt && `${submission.maxHeightFt}ft H`,
              ].filter(Boolean).join(', ')}
            </p>
          </div>
        )}
      </div>

      {submission.description && (
        <div className="text-sm">
          <span className="text-muted-foreground">Description</span>
          <p className="text-foreground">{submission.description}</p>
        </div>
      )}

      {submission.website && (
        <div className="text-sm">
          <span className="text-muted-foreground">Website</span>
          <a href={submission.website.startsWith('http') ? submission.website : `https://${submission.website}`} target="_blank" rel="noopener noreferrer"
            className="text-sky-400 underline break-all block">{submission.website}</a>
        </div>
      )}

      {submission.phone && (
        <div className="text-sm">
          <span className="text-muted-foreground">Phone</span>
          <a href={`tel:${submission.phone}`} className="text-sky-400 underline block">{submission.phone}</a>
        </div>
      )}

      <div className="text-sm">
        <span className="text-muted-foreground">Amenities</span>
        <div className="flex flex-wrap gap-1 mt-1">
          {Object.entries(submission.amenities)
            .filter(([, v]) => v)
            .map(([key]) => (
              <span key={key} className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                {key.replace(/_/g, ' ')}
              </span>
            ))}
        </div>
      </div>

      {submission.adminNotes && (
        <div className="rounded-lg border border-border px-3 py-2 text-sm">
          <span className="text-muted-foreground font-medium">Admin feedback</span>
          <p className="text-foreground mt-1">{submission.adminNotes}</p>
        </div>
      )}

      {submission.status === 'approved' && submission.publishedPinId && (
        <button
          onClick={() => navigate(`/pin/${submission.publishedPinId}`)}
          className="w-full min-h-[44px] rounded-lg font-medium text-white bg-green-600 hover:bg-green-700 transition-colors"
        >
          View on map →
        </button>
      )}
    </div>
  )
}

export default function SuggestSpotScreen() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const [geoState, requestGeo] = useGeolocation()
  const isOnline = useOnlineStatus()

  const [step, setStep] = useState<1 | 2 | 3>(1)
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
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Photo state — CDN URL tracked for future use when spot_submissions gains a photo column
  const [, setPhotoCdnUrl] = useState<string | null>(null)
  const [, setPhotoStoragePath] = useState<string | null>(null)
  const [tempUploadId] = useState(() => crypto.randomUUID())

  // Auto-detect location on mount
  useEffect(() => {
    requestGeo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-fill coordinates from geo detection
  useEffect(() => {
    if (geoState.coords && !lat && !lng) {
      setLat(geoState.coords.latitude.toFixed(6))
      setLng(geoState.coords.longitude.toFixed(6))
    }
  }, [geoState.coords, lat, lng])

  const [expandedId, setExpandedId] = useState<string | null>(null)

  const submissionsQuery = useQuery({
    queryKey: ['spot-submissions', session?.user.id],
    enabled: Boolean(session?.access_token),
    refetchInterval: 30_000,
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
      setPhotoCdnUrl(null)
      setPhotoStoragePath(null)
      setStep(1)
      setSuccessMsg('Submitted — your spot is under review')
    },
  })

  // Clear success message after 5 seconds
  useEffect(() => {
    if (!successMsg) return
    const timer = setTimeout(() => setSuccessMsg(null), 5000)
    return () => clearTimeout(timer)
  }, [successMsg])

  const geoError = useMemo(() => {
    if (!geoState.error) return null
    if (geoState.error === 'denied') return 'Location access denied'
    if (geoState.error === 'no-api') return 'Location is not available on this device'
    return 'Could not get your location. Try again.'
  }, [geoState.error])

  function validateStep1(): Record<string, string> {
    const nextErrors: Record<string, string> = {}
    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)
    if (!name.trim()) nextErrors.name = 'Name is required'
    if (!lat || Number.isNaN(latNum)) nextErrors.latitude = 'Latitude is required'
    else if (latNum < 24 || latNum > 49) nextErrors.latitude = 'Coordinates appear to be outside the supported region'
    if (!lng || Number.isNaN(lngNum)) nextErrors.longitude = 'Longitude is required'
    else if (lngNum < -125 || lngNum > -66) nextErrors.longitude = 'Coordinates appear to be outside the supported region'
    return nextErrors
  }

  function validateStep2(): Record<string, string> {
    const nextErrors: Record<string, string> = {}
    if (!Object.values(amenities).some(Boolean)) {
      nextErrors.amenities = 'Select at least one amenity or activity'
    }
    if (website.trim()) {
      try { new URL(website.trim()) }
      catch { nextErrors.website = 'Website must be a valid URL' }
    }
    if (maxLengthFt.trim()) {
      const num = parseInt(maxLengthFt, 10)
      if (Number.isNaN(num) || num <= 0) {
        nextErrors.max_length_ft = 'Must be a positive number'
      }
    }
    if (maxHeightFt.trim()) {
      const num = parseFloat(maxHeightFt)
      if (Number.isNaN(num) || num <= 0) {
        nextErrors.max_height_ft = 'Must be a positive number'
      }
    }
    return nextErrors
  }

  function handleAmenityToggle(key: keyof PinAmenities) {
    setAmenities((current) => ({ ...current, [key]: !current[key] }))
  }

  function handleStep1Next() {
    const stepErrors = validateStep1()
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return
    }
    setErrors({})
    setStep(2)
  }

  function handleStep2Next() {
    const stepErrors = validateStep2()
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return
    }
    setErrors({})
    setStep(3)
  }

  function handleSubmit() {
    setErrors({})
    submitMutation.mutate()
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

        {successMsg && (
          <div role="status" className="rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
            ✓ {successMsg}
          </div>
        )}

        {!isOnline && (
          <p role="status" className="text-sm text-muted-foreground text-center mb-4">
            Offline — you need a connection to submit spots.
          </p>
        )}

        <section className="rounded-2xl border border-border bg-secondary p-6 space-y-5">
          <StepIndicator current={step} total={3} />

          {/* Step 1: Spot type & location */}
          {step === 1 && (
            <>
              <h2 className="text-lg font-semibold">Spot type &amp; location</h2>

              <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Spot type">
                {SPOT_TYPE_CHIPS.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    aria-pressed={amenities[chip.key]}
                    onClick={() => handleAmenityToggle(chip.key)}
                    className={[
                      'min-h-[44px] rounded-lg border text-sm font-medium px-4 transition-colors',
                      amenities[chip.key]
                        ? 'bg-sky-500 text-white border-sky-500'
                        : 'bg-background border-border text-foreground',
                    ].join(' ')}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="submission-name">Spot name *</label>
                  <input id="submission-name" value={name} onChange={(event) => setName(event.target.value)} className={inputCls} />
                  {errors.name && <p className={errorCls}>{errors.name}</p>}
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
              </div>

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

              {geoError && <p role="alert" className="text-sm text-red-300">{geoError}</p>}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleStep1Next}
                  className="min-h-[44px] rounded-lg bg-primary px-5 text-primary-foreground font-semibold"
                >
                  Next
                </button>
              </div>
            </>
          )}

          {/* Step 2: Details & amenities */}
          {step === 2 && (
            <>
              <h2 className="text-lg font-semibold">Details &amp; amenities</h2>

              <fieldset>
                <legend className={labelCls}>Amenities &amp; activities *</legend>
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

              <div>
                <label className={labelCls} htmlFor="submission-description">What should travelers know?</label>
                <textarea
                  id="submission-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={2000}
                  className={`${inputCls} min-h-28 resize-y`}
                  placeholder="Road access, overnight rules, useful notes, and what makes this stop worth adding."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls} htmlFor="submission-website">Website</label>
                  <input id="submission-website" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://example.com" className={inputCls} />
                  {errors.website && <p className={errorCls}>{errors.website}</p>}
                </div>
                <div>
                  <label className={labelCls} htmlFor="submission-phone">Phone</label>
                  <input id="submission-phone" value={phone} onChange={(event) => setPhone(event.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="submission-max-length">Max rig length</label>
                  <input id="submission-max-length" type="number" inputMode="numeric" min="1" value={maxLengthFt} onChange={(event) => setMaxLengthFt(event.target.value)} className={inputCls} />
                  {errors.max_length_ft && <p className="text-destructive text-sm mt-1">{errors.max_length_ft}</p>}
                </div>
                <div>
                  <label className={labelCls} htmlFor="submission-max-height">Max rig height</label>
                  <input id="submission-max-height" type="number" inputMode="numeric" min="1" value={maxHeightFt} onChange={(event) => setMaxHeightFt(event.target.value)} className={inputCls} />
                  {errors.max_height_ft && <p className="text-destructive text-sm mt-1">{errors.max_height_ft}</p>}
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => { setErrors({}); setStep(1) }}
                  className="min-h-[44px] rounded-lg border border-border px-5 text-sm text-foreground"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleStep2Next}
                  className="min-h-[44px] rounded-lg bg-primary px-5 text-primary-foreground font-semibold"
                >
                  Next
                </button>
              </div>
            </>
          )}

          {/* Step 3: Photo & submit */}
          {step === 3 && (
            <>
              <h2 className="text-lg font-semibold">Review &amp; submit</h2>

              <div className="rounded-lg border border-border bg-background p-4 mb-4">
                <p className="font-semibold">{name}</p>
                <p className="text-xs text-muted-foreground">{lat}, {lng}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {Object.entries(amenities).filter(([, v]) => v).length} amenities selected
                </p>
              </div>

              <div>
                <p className={labelCls}>Photo (optional)</p>
                <PhotoUpload
                  pinId={tempUploadId}
                  checkInId={tempUploadId}
                  disabled={!isOnline}
                  onUploadComplete={(cdn, path) => {
                    setPhotoCdnUrl(cdn)
                    setPhotoStoragePath(path)
                  }}
                  onUploadClear={() => {
                    setPhotoCdnUrl(null)
                    setPhotoStoragePath(null)
                  }}
                />
              </div>

              {submitMutation.isError && (
                <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  Failed to submit your spot. Please try again.
                </p>
              )}

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => { setErrors({}); setStep(2) }}
                  className="min-h-[44px] rounded-lg border border-border px-5 text-sm text-foreground"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending || !isOnline}
                  className="min-h-[44px] rounded-lg bg-primary px-5 text-primary-foreground font-semibold disabled:opacity-50"
                >
                  {submitMutation.isPending ? 'Submitting...' : 'Submit for review'}
                </button>
              </div>
            </>
          )}
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
              <li
                key={submission.id}
                className="rounded-xl border border-border bg-background p-4 space-y-2 cursor-pointer transition-colors hover:bg-background/80"
                onClick={() => setExpandedId(expandedId === submission.id ? null : submission.id)}
                role="button"
                aria-expanded={expandedId === submission.id}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setExpandedId(expandedId === submission.id ? null : submission.id)
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{submission.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {submission.latitude.toFixed(4)}, {submission.longitude.toFixed(4)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[submission.status]}`}>
                      {submission.status.replace('_', ' ')}
                    </span>
                    <span className="text-muted-foreground text-xs" aria-hidden="true">
                      {expandedId === submission.id ? '▲' : '▼'}
                    </span>
                  </div>
                </div>
                {expandedId === submission.id && (
                  <SubmissionDetail submission={submission} />
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
