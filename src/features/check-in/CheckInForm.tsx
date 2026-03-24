import { useState } from 'react'
import { usePinsQuery } from '@/hooks/usePinsQuery'
import { useDeviceId } from '@/hooks/useDeviceId'
import { useCheckInMutation, type CheckInStatus } from '@/hooks/useCheckInMutation'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { appendPendingCheckin } from '@/lib/offline/pendingCheckins'
import { useAuth } from '@/contexts/AuthContext'
import PhotoUpload from './PhotoUpload'

interface CheckInFormProps {
  pinId: string
  onClose: () => void
}

const STATUS_OPTIONS: Array<{ value: CheckInStatus; label: string }> = [
  { value: 'still_open', label: 'Still Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'changed', label: 'Changed' },
]

export default function CheckInForm({ pinId, onClose }: CheckInFormProps) {
  const [status, setStatus] = useState<CheckInStatus | null>(null)
  const [note, setNote] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [photoCdnUrl, setPhotoCdnUrl] = useState<string | null>(null)
  const [photoStoragePath, setPhotoStoragePath] = useState<string | null>(null)
  const [tempCheckInId] = useState(() => crypto.randomUUID())

  const { data: pins = [] } = usePinsQuery({ enabled: false })
  const pin = pins.find((p) => p.id === pinId)
  const pinName = pin?.name ?? 'this spot'

  const deviceId = useDeviceId()
  const mutation = useCheckInMutation()
  const isOnline = useOnlineStatus()
  const { isAuthenticated } = useAuth()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!status) return

    if (!isOnline) {
      try {
        appendPendingCheckin({
          pinId,
          deviceId,
          status,
          note: note || undefined,
          timestamp: new Date().toISOString(),
          queuedAt: new Date().toISOString(),
        })
        onClose()
      } catch {
        setErrorMsg("Couldn't save check-in locally. Storage may be full.")
      }
      return
    }

    setErrorMsg(null)
    mutation.mutate(
      {
        pinId,
        deviceId,
        status,
        note: note || undefined,
        checkInId: tempCheckInId,
        photoCdnUrl: photoCdnUrl ?? undefined,
        photoStoragePath: photoStoragePath ?? undefined,
      },
      {
        onSuccess: () => { onClose() },
        onError: () => { setErrorMsg("Couldn't save check-in. Tap to retry.") },
      },
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" aria-hidden="true" />
      {/* Form card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Check-in form"
        className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border rounded-t-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-base font-semibold text-foreground">How is {pinName}?</p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground rounded-full"
            aria-label="Close check-in form"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Status chips */}
          <div className="flex gap-2 mb-4" role="group" aria-label="Select spot status">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={status === opt.value}
                onClick={() => setStatus(opt.value)}
                className={[
                  'flex-1 min-h-[44px] rounded-lg border text-sm font-medium transition-colors',
                  status === opt.value
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'bg-background border-border text-foreground',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Photo upload — authenticated users only */}
          {isAuthenticated && (
            <PhotoUpload
              pinId={pinId}
              checkInId={tempCheckInId}
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
          )}

          {/* Optional note */}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note (e.g. fee change)"
            maxLength={500}
            rows={3}
            className="w-full border border-border rounded-lg p-3 text-sm text-foreground bg-background resize-none mb-4 min-h-[44px]"
            aria-label="Optional note"
          />

          {!isOnline && (
            <p role="status" className="text-sm text-amber-400 text-center mb-4">
              Offline — your check-in will be saved and submitted when you reconnect.
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={status === null || mutation.isPending}
            className="w-full min-h-[44px] rounded-lg text-white text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: '#0ea5e9' }}
          >
            {mutation.isPending ? 'Saving…' : 'Submit Check-In'}
          </button>

          {/* Error message */}
          {errorMsg && (
            <p role="alert" className="text-sm text-red-500 text-center mt-2">
              {errorMsg}
            </p>
          )}
        </form>
      </div>
    </>
  )
}
