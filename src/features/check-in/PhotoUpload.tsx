import { useRef, useEffect } from 'react'
import { usePhotoUpload } from '@/hooks/usePhotoUpload'

interface PhotoUploadProps {
  pinId: string
  checkInId: string
  disabled?: boolean
  onUploadComplete: (cdnUrl: string, storagePath: string) => void
  onUploadClear: () => void
}

export default function PhotoUpload({
  pinId,
  checkInId,
  disabled = false,
  onUploadComplete,
  onUploadClear,
}: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const notifiedRef = useRef(false)
  const {
    state,
    progress,
    thumbnailUrl,
    errorMessage,
    cdnUrl,
    storagePath,
    startUpload,
    retry,
    reset,
  } = usePhotoUpload()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    notifiedRef.current = false
    startUpload(file, pinId, checkInId)
    if (inputRef.current) inputRef.current.value = ''
  }

  // Notify parent on success (once per upload)
  useEffect(() => {
    if (state === 'success' && cdnUrl && storagePath && !notifiedRef.current) {
      notifiedRef.current = true
      onUploadComplete(cdnUrl, storagePath)
    }
  }, [state, cdnUrl, storagePath, onUploadComplete])

  function handleRemove() {
    reset()
    onUploadClear()
  }

  if (disabled) {
    return (
      <div className="flex items-center gap-2 mb-3 opacity-50" aria-disabled="true">
        <div className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border text-muted-foreground">
          📷
        </div>
        <span className="text-sm text-muted-foreground">Photo unavailable offline</span>
      </div>
    )
  }

  // Idle state: camera icon button
  if (state === 'idle') {
    return (
      <div className="mb-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic"
          capture="environment"
          onChange={handleFileChange}
          className="sr-only"
          aria-label="Select photo"
          data-testid="photo-file-input"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="min-h-[44px] min-w-[44px] flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
          aria-label="Add photo"
        >
          📷 Add photo
        </button>
      </div>
    )
  }

  // Compressing state
  if (state === 'compressing') {
    return (
      <div className="flex items-center gap-2 mb-3">
        <div className="min-h-[44px] min-w-[44px] flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <span className="text-sm text-muted-foreground">Compressing…</span>
      </div>
    )
  }

  // Uploading state
  if (state === 'uploading') {
    return (
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm text-muted-foreground">Uploading…</span>
          <span className="text-sm text-muted-foreground">{progress}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="w-full h-2 bg-muted rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-sky-500 transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    )
  }

  // Success state: thumbnail preview
  if (state === 'success' && thumbnailUrl) {
    return (
      <div className="relative inline-block mb-3">
        <img
          src={thumbnailUrl}
          alt="Upload preview"
          className="w-20 h-20 rounded-lg object-cover border border-border"
        />
        <button
          type="button"
          onClick={handleRemove}
          className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center rounded-full bg-red-500 text-white text-xs"
          aria-label="Remove photo"
        >
          ✕
        </button>
      </div>
    )
  }

  // Error state
  if (state === 'error') {
    return (
      <div className="mb-3">
        <p role="alert" className="text-sm text-red-500 mb-1">{errorMessage}</p>
        <button
          type="button"
          onClick={() => { retry() }}
          className="text-sm text-sky-500 underline"
        >
          Tap to retry
        </button>
      </div>
    )
  }

  return null
}
