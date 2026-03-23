import { useState } from 'react'
import { usePinsQuery } from '@/hooks/usePinsQuery'
import { useDeviceId } from '@/hooks/useDeviceId'
import { useReportMutation, type IssueReportType } from '@/hooks/useReportMutation'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

interface IssueReportSheetProps {
  pinId: string
  onClose: () => void
}

const ISSUE_OPTIONS: Array<{ value: IssueReportType; label: string }> = [
  { value: 'dump_closed',       label: 'Dump station closed' },
  { value: 'water_unavailable', label: 'Water unavailable' },
  { value: 'no_overnight',      label: 'Overnight parking prohibited' },
  { value: 'access_blocked',    label: 'Access blocked' },
  { value: 'other',             label: 'Other' },
]

export default function IssueReportSheet({ pinId, onClose }: IssueReportSheetProps) {
  const [selectedType, setSelectedType] = useState<IssueReportType | null>(null)
  const [note, setNote] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const { data: pins = [] } = usePinsQuery({ enabled: false })
  const pin = pins.find((p) => p.id === pinId)
  const pinName = pin?.name ?? 'this spot'

  const deviceId = useDeviceId()
  const mutation = useReportMutation()
  const isOnline = useOnlineStatus()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedType) return
    if (!isOnline) {
      setErrorMsg("You're offline. Reconnect to save this report.")
      return
    }
    setErrorMsg(null)
    mutation.mutate(
      { pinId, deviceId, type: selectedType, note: note || undefined },
      {
        onSuccess: () => { onClose() },
        onError: () => { setErrorMsg("Couldn't save report. Tap to retry.") },
      },
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" aria-hidden="true" />
      {/* Sheet card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="issue-report-title"
        className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border rounded-t-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <p id="issue-report-title" className="text-base font-semibold text-foreground">Report issue at {pinName}</p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground rounded-full"
            aria-label="Close issue report form"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Issue type chips */}
          <div className="flex flex-col gap-2 mb-4" role="group" aria-label="Select issue type">
            {ISSUE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selectedType === opt.value}
                onClick={() => setSelectedType(opt.value)}
                className={[
                  'w-full min-h-[44px] rounded-lg border text-sm font-medium transition-colors text-left px-4',
                  selectedType === opt.value
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-background border-border text-foreground',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Optional note */}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note"
            maxLength={500}
            rows={2}
            className="w-full border border-border rounded-lg p-3 text-sm text-foreground bg-background resize-none mb-4 min-h-[44px]"
            aria-label="Optional note"
          />

          {!isOnline && (
            <p role="status" className="text-sm text-amber-400 text-center mb-4">
              Offline mode: reports require a connection.
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={selectedType === null || mutation.isPending || !isOnline}
            className="w-full min-h-[44px] rounded-lg text-white text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: '#ef4444' }}
          >
            {mutation.isPending ? 'Saving…' : 'Submit Report'}
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
