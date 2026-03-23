interface DeparturePromptProps {
  pinName: string
  rigType: string | null
  onSkip: () => void
  onCheckIn: () => void
}

export default function DeparturePrompt({ pinName, rigType, onSkip, onCheckIn }: DeparturePromptProps) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" aria-hidden="true" />
      {/* Prompt card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Departure check-in prompt"
        className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border rounded-t-2xl p-6"
      >
        <p className="text-base font-semibold text-foreground mb-1">
          How was {pinName}
          {rigType ? ` for your ${rigType}` : ''}?
        </p>
        <p className="text-sm text-muted-foreground mb-6">Help the next traveler.</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 min-h-[44px] rounded-lg border border-border text-foreground text-sm font-medium"
            aria-label="Skip check-in"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={onCheckIn}
            className="flex-1 min-h-[44px] rounded-lg text-white text-sm font-medium"
            style={{ backgroundColor: '#0ea5e9' }}
            aria-label="Submit check-in"
          >
            Check In
          </button>
        </div>
      </div>
    </>
  )
}
