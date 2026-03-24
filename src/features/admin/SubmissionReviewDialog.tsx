import { useEffect, useRef, useState } from 'react'

export type ReviewAction = 'approve' | 'reject' | 'request_changes'

interface SubmissionReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: ReviewAction
  submissionName: string
  initialNotes?: string
  onConfirm: (notes: string) => void
  isLoading: boolean
}

const DIALOG_CONFIG: Record<
  ReviewAction,
  {
    title: string
    bodyFn: (name: string) => string
    confirmLabel: string
    notesRequired: boolean
    confirmClass: string
  }
> = {
  approve: {
    title: 'Approve Submission?',
    bodyFn: (name) =>
      `This will create a new pin from "${name}" and make it visible on the public map.`,
    confirmLabel: 'Confirm Approval',
    notesRequired: false,
    confirmClass: 'bg-green-600 hover:bg-green-700 text-white',
  },
  reject: {
    title: 'Reject Submission?',
    bodyFn: () => 'Provide a reason — the submitter will be notified.',
    confirmLabel: 'Confirm Rejection',
    notesRequired: true,
    confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
  },
  request_changes: {
    title: 'Request Changes',
    bodyFn: () => 'Describe what needs to change — the submitter will be notified.',
    confirmLabel: 'Send Feedback',
    notesRequired: true,
    confirmClass: 'bg-sky-600 hover:bg-sky-700 text-white',
  },
}

const MIN_NOTES_LENGTH = 10
const MAX_NOTES_LENGTH = 1000

export default function SubmissionReviewDialog({
  open,
  onOpenChange,
  action,
  submissionName,
  initialNotes = '',
  onConfirm,
  isLoading,
}: SubmissionReviewDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [notes, setNotes] = useState(initialNotes)

  const config = DIALOG_CONFIG[action]
  const trimmedLength = notes.trim().length
  const isNotesValid = config.notesRequired ? trimmedLength >= MIN_NOTES_LENGTH : true
  const isOverLimit = trimmedLength > MAX_NOTES_LENGTH

  // Show modal on mount, focus textarea
  useEffect(() => {
    const dialog = dialogRef.current
    if (open && dialog && !dialog.open) {
      dialog.showModal()
      setTimeout(() => textareaRef.current?.focus(), 0)
    }
  }, [open])

  // Handle native close (ESC key)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    function handleClose() {
      onOpenChange(false)
    }
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onOpenChange])

  // Close on backdrop click
  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      onOpenChange(false)
    }
  }

  function handleConfirm() {
    if (!isNotesValid || isOverLimit || isLoading) return
    onConfirm(notes.trim())
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && isNotesValid && !isOverLimit && !isLoading) {
      e.preventDefault()
      handleConfirm()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      role="dialog"
      aria-label={config.title}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      className="backdrop:bg-black/60 bg-transparent p-0 m-0 max-w-full open:flex items-center justify-center fixed inset-0 w-full h-full"
    >
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{config.title}</h2>
        <p className="text-sm text-muted-foreground">{config.bodyFn(submissionName)}</p>

        <div className="space-y-1">
          <textarea
            ref={textareaRef}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              config.notesRequired
                ? 'Required — min 10 characters'
                : 'Optional reviewer notes'
            }
            rows={4}
            maxLength={MAX_NOTES_LENGTH}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[88px]"
            aria-label="Admin notes"
            aria-required={config.notesRequired}
          />
          <div className="flex justify-between text-xs">
            <span
              className={
                config.notesRequired && trimmedLength > 0 && trimmedLength < MIN_NOTES_LENGTH
                  ? 'text-red-400'
                  : 'text-muted-foreground'
              }
            >
              {config.notesRequired && trimmedLength > 0 && trimmedLength < MIN_NOTES_LENGTH
                ? `${MIN_NOTES_LENGTH - trimmedLength} more characters needed`
                : '\u00A0'}
            </span>
            <span
              className={
                isOverLimit
                  ? 'text-red-400'
                  : trimmedLength > MAX_NOTES_LENGTH * 0.9
                    ? 'text-yellow-400'
                    : 'text-muted-foreground'
              }
            >
              {trimmedLength}/{MAX_NOTES_LENGTH}
            </span>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="min-h-[36px] rounded-lg border border-border px-4 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isNotesValid || isOverLimit || isLoading}
            className={`min-h-[36px] rounded-lg px-4 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${config.confirmClass}`}
          >
            {isLoading ? 'Processing...' : config.confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
