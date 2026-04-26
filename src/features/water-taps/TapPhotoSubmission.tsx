import { useState, useRef } from 'react'
import { useDeviceId } from '@/hooks/useDeviceId'
import { useTapSubmitMutation } from './waterTapsApi'
import type { TapSubmitResponse } from './waterTapsApi'

interface TapPhotoSubmissionProps {
  tapPinId: string
  /** The tap pin's lat/lng used as the location for the submission */
  tapPinLocation: [number, number]
}

/**
 * TapPhotoSubmission — camera/file input + photo preview + submit button (FR45)
 *
 * States:
 * - idle: file input + (preview if file selected) + submit button
 * - pending: "Checking photo..." spinner
 * - success (created/confirmed): "Photo added! This tap is now on the map."
 * - below_threshold: neutral message
 *
 * Submit button meets 44×44px minimum touch target (NFR-A4).
 */
export default function TapPhotoSubmission({ tapPinId, tapPinLocation }: TapPhotoSubmissionProps) {
  const deviceId = useDeviceId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [result, setResult] = useState<TapSubmitResponse | null>(null)

  const mutation = useTapSubmitMutation(tapPinId)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setResult(null)

    // Generate object URL for preview
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
  }

  function handleSubmit() {
    if (!selectedFile) return

    const formData = new FormData()
    formData.append('photo', selectedFile)
    formData.append('location', JSON.stringify(tapPinLocation))
    formData.append('deviceId', deviceId)

    mutation.mutate(formData, {
      onSuccess: (data) => {
        setResult(data)
        // Clear selection after success
        setSelectedFile(null)
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl)
          setPreviewUrl(null)
        }
        if (fileInputRef.current) fileInputRef.current.value = ''
      },
      onError: () => {
        setResult(null)
      },
    })
  }

  // ── Pending state ──────────────────────────────────────────────────────────
  if (mutation.isPending) {
    return (
      <div className="space-y-2" aria-live="polite">
        <p className="text-sm text-muted-foreground animate-pulse">Checking photo...</p>
        <div
          data-testid="tap-confidence-badge-loading"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border border-border text-xs text-muted-foreground animate-pulse"
        >
          🤖 Analyzing…
        </div>
      </div>
    )
  }

  // ── Success: created or confirmed ──────────────────────────────────────────
  if (result?.status === 'created' || result?.status === 'confirmed') {
    return (
      <div aria-live="polite" className="rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2 text-sm text-green-400">
        Photo added! This tap is now on the map.
      </div>
    )
  }

  // ── below_threshold ────────────────────────────────────────────────────────
  if (result?.status === 'below_threshold') {
    return (
      <div aria-live="polite" className="space-y-2">
        <div className="rounded-lg bg-muted border border-border px-3 py-2 text-sm text-muted-foreground">
          Our model couldn&apos;t confirm a tap in that photo. Try a closer shot of the faucet.
        </div>
        <button
          type="button"
          onClick={() => { setResult(null); setSelectedFile(null); setPreviewUrl(null) }}
          className="text-xs text-sky-400 underline"
        >
          Try again
        </button>
      </div>
    )
  }

  // ── Idle / file selected ───────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <label className="block cursor-pointer">
        <span className="block text-sm font-medium text-foreground mb-1">Add a photo of this tap</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          aria-label="Select a photo of the water tap"
          className="block w-full text-sm text-muted-foreground
            file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0
            file:text-sm file:font-semibold file:bg-sky-500/10 file:text-sky-400
            hover:file:bg-sky-500/20 cursor-pointer"
        />
      </label>

      {/* Photo preview */}
      {previewUrl && (
        <img
          src={previewUrl}
          alt="Selected tap photo preview"
          className="w-full max-h-40 object-cover rounded-lg border border-border"
        />
      )}

      {/* Submit button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!selectedFile || mutation.isPending}
        aria-label="Submit tap photo for verification"
        className="w-full min-h-[44px] rounded-lg bg-sky-500 text-white font-semibold text-sm hover:bg-sky-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Submit Photo
      </button>
    </div>
  )
}
