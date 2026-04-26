/**
 * TapConfidenceBadge — displays the trust signal for a water tap pin (FR47)
 *
 * Priority (highest → lowest):
 * 1. verified_date IS NOT NULL → "Community Verified" (replaces all other indicators)
 * 2. confirmedCount >= 1 (but not yet verified) → "N traveler(s) confirmed" + ML confidence if source='ml_batch'
 * 3. Default → "ML Confidence: X%" + "ML Discovered" label
 *
 * Dev Note: Use `verifiedDate IS NOT NULL` — NOT `source === 'verified'` — as the verified
 * signal. Story 6.3 promoted verified taps via `verified_date = now()` because the DB CHECK
 * constraint on `water_tap_pins.source` does not include 'verified'.
 */

interface TapConfidenceBadgeProps {
  source: string
  confidence: number
  verifiedDate: string | null
  confirmedCount: number
}

export default function TapConfidenceBadge({
  source,
  confidence,
  verifiedDate,
  confirmedCount,
}: TapConfidenceBadgeProps) {
  // ── Highest trust: community verified ──────────────────────────────────────
  if (verifiedDate !== null) {
    return (
      <div
        data-testid="tap-confidence-badge"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/15 border border-green-500/40 text-green-400 text-xs font-semibold"
      >
        <span aria-hidden="true">✓</span>
        Community Verified
      </div>
    )
  }

  // ── Community confirmation count (not yet fully verified) ──────────────────
  if (confirmedCount >= 1) {
    return (
      <div data-testid="tap-confidence-badge" className="flex flex-col gap-1">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/15 border border-sky-500/40 text-sky-400 text-xs font-semibold">
          <span aria-hidden="true">👥</span>
          {confirmedCount === 1 ? '1 traveler confirmed' : `${confirmedCount} travelers confirmed`}
        </div>
        {source === 'ml_batch' && (
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-muted-foreground">
            <span aria-hidden="true">🤖</span>
            ML Confidence: {Math.round(confidence * 100)}%
          </div>
        )}
      </div>
    )
  }

  // ── Default: ML discovered ─────────────────────────────────────────────────
  return (
    <div data-testid="tap-confidence-badge" className="flex flex-col gap-1">
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/40 text-purple-400 text-xs font-semibold">
        <span aria-hidden="true">🤖</span>
        ML Confidence: {Math.round(confidence * 100)}%
      </div>
      <span className="text-xs text-muted-foreground pl-1">ML Discovered</span>
    </div>
  )
}
