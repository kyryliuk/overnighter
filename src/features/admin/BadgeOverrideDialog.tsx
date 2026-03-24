import { useEffect, useRef, useState } from 'react'

interface BadgeOverrideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pinName: string
  currentOverride: string | null
  onConfirm: (badge: string | null) => void
  isLoading: boolean
}

const BADGE_OPTIONS = ['green', 'yellow', 'red', 'grey'] as const

const BADGE_OPTION_STYLES: Record<string, { base: string; selected: string }> = {
  green: {
    base: 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20',
    selected: 'bg-green-500/30 text-green-300 border-2 border-green-400 ring-2 ring-green-400/30',
  },
  yellow: {
    base: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20',
    selected: 'bg-yellow-500/30 text-yellow-300 border-2 border-yellow-400 ring-2 ring-yellow-400/30',
  },
  red: {
    base: 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20',
    selected: 'bg-red-500/30 text-red-300 border-2 border-red-400 ring-2 ring-red-400/30',
  },
  grey: {
    base: 'bg-gray-500/10 text-gray-400 border border-gray-500/20 hover:bg-gray-500/20',
    selected: 'bg-gray-500/30 text-gray-300 border-2 border-gray-400 ring-2 ring-gray-400/30',
  },
}

export default function BadgeOverrideDialog({
  open,
  onOpenChange,
  pinName,
  currentOverride,
  onConfirm,
  isLoading,
}: BadgeOverrideDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [selectedBadge, setSelectedBadge] = useState<string | null>(currentOverride)

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && dialog && !dialog.open) {
      dialog.showModal()
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    function handleClose() {
      onOpenChange(false)
    }
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onOpenChange])

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      onOpenChange(false)
    }
  }

  function handleApply() {
    if (selectedBadge === null || isLoading) return
    onConfirm(selectedBadge)
  }

  function handleRemoveOverride() {
    if (isLoading) return
    onConfirm(null)
  }

  const canApply = selectedBadge !== null && !isLoading

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      role="dialog"
      aria-label="Override Badge Status"
      onClick={handleBackdropClick}
      className="backdrop:bg-black/60 bg-transparent p-0 m-0 max-w-full open:flex items-center justify-center fixed inset-0 w-full h-full"
    >
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Override Badge Status</h2>
        <p className="text-sm text-muted-foreground">
          Set the badge for &ldquo;{pinName}&rdquo; to a fixed color regardless of check-in recency.
        </p>

        <div role="radiogroup" aria-label="Badge color" className="flex gap-3 flex-wrap">
          {BADGE_OPTIONS.map((badge) => {
            const isSelected = selectedBadge === badge
            const styles = BADGE_OPTION_STYLES[badge]
            return (
              <button
                key={badge}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={badge}
                onClick={() => setSelectedBadge(badge)}
                disabled={isLoading}
                className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all disabled:opacity-50 ${
                  isSelected ? styles.selected : styles.base
                }`}
              >
                {badge}
              </button>
            )
          })}
        </div>

        <div className="flex gap-3 justify-end flex-wrap">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="min-h-[44px] rounded-lg border border-border px-4 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          {currentOverride !== null && (
            <button
              type="button"
              onClick={handleRemoveOverride}
              disabled={isLoading}
              className="min-h-[44px] rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 text-sm text-yellow-400 hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : 'Remove Override'}
            </button>
          )}
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            className="min-h-[44px] rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Processing...' : 'Apply Override'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
