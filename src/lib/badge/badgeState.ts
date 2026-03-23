import type { BadgeColor } from '@/types/pin'

// ---------------------------------------------------------------------------
// Badge freshness thresholds (days)
// ---------------------------------------------------------------------------
export const BADGE_THRESHOLDS = {
  FRESH_DAYS: 7,   // < 7 days → green
  RECENT_DAYS: 30, // 7–30 days → yellow; > 30 days → red
} as const

/**
 * Derives the client-side badge color from a last-check-in timestamp.
 * This is the canonical freshness calculation — used for optimistic badge
 * updates in check-in (Story 4.3) and as the reference threshold definition.
 *
 * Note: pin.badgeState is computed server-side and stored in Supabase.
 * This function is the client-side equivalent for optimistic mutations.
 */
export function computeBadgeState(lastCheckInAt: string | null): BadgeColor {
  if (!lastCheckInAt) return 'grey'

  const date = new Date(lastCheckInAt)
  // Malformed timestamp (NaN) treated as maximally stale — 'red' is the safest fallback
  if (isNaN(date.getTime())) return 'red'
  const ageMs = Date.now() - date.getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)

  if (ageDays < BADGE_THRESHOLDS.FRESH_DAYS)  return 'green'
  if (ageDays <= BADGE_THRESHOLDS.RECENT_DAYS) return 'yellow'
  return 'red'
}
