interface BadgeTooltipProps {
  onDismiss: () => void
}

/**
 * First-session onboarding tooltip explaining the recency ring color system.
 * Renders a full-screen transparent overlay that intercepts all taps — any
 * tap anywhere dismisses the tooltip. Shown once; caller tracks visibility
 * via localStorage key 'badge_tooltip_seen'.
 */
export default function BadgeTooltip({ onDismiss }: BadgeTooltipProps) {
  return (
    // Full-screen overlay captures all taps — any tap dismisses tooltip (AC7)
    // z-[1001]: above map wrapper (z-0) and SearchBar overlay (z-10)
    <div
      className="absolute inset-0 z-[1001] cursor-pointer"
      role="button"
      tabIndex={0}
      aria-label="Dismiss badge tooltip"
      onClick={onDismiss}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDismiss() }}
    >
      {/* Tooltip card — pointer-events-none so clicks bubble to parent overlay */}
      <div className="absolute bottom-24 left-0 right-0 flex justify-center pointer-events-none">
        <div className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 mx-4 shadow-lg text-sm text-slate-100">
          🟢 Green = verified this week. Tap any pin to see when.
        </div>
      </div>
    </div>
  )
}
