import { describe, it, expect } from 'vitest'
import { computeBadgeState, BADGE_THRESHOLDS } from './badgeState'

// ---------------------------------------------------------------------------
// Helper — build an ISO date string N days ago from now
// ---------------------------------------------------------------------------
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

// ---------------------------------------------------------------------------
// BADGE_THRESHOLDS constant
// ---------------------------------------------------------------------------
describe('BADGE_THRESHOLDS', () => {
  it('FRESH_DAYS is 7', () => {
    expect(BADGE_THRESHOLDS.FRESH_DAYS).toBe(7)
  })

  it('RECENT_DAYS is 30', () => {
    expect(BADGE_THRESHOLDS.RECENT_DAYS).toBe(30)
  })
})

// ---------------------------------------------------------------------------
// computeBadgeState — null / missing input
// ---------------------------------------------------------------------------
describe('computeBadgeState — null input', () => {
  it('returns "grey" when lastCheckInAt is null', () => {
    expect(computeBadgeState(null)).toBe('grey')
  })
})

// ---------------------------------------------------------------------------
// computeBadgeState — green (fresh: < 7 days)
// ---------------------------------------------------------------------------
describe('computeBadgeState — green (fresh)', () => {
  it('returns "green" for a check-in 0 days ago (just now)', () => {
    expect(computeBadgeState(new Date().toISOString())).toBe('green')
  })

  it('returns "green" for a check-in 1 day ago', () => {
    expect(computeBadgeState(daysAgo(1))).toBe('green')
  })

  it('returns "green" for a check-in 6 days ago', () => {
    expect(computeBadgeState(daysAgo(6))).toBe('green')
  })

  it('returns "green" for a check-in 6.9 days ago (just under threshold)', () => {
    const almostSevenDays = new Date(Date.now() - 6.9 * 24 * 60 * 60 * 1000).toISOString()
    expect(computeBadgeState(almostSevenDays)).toBe('green')
  })
})

// ---------------------------------------------------------------------------
// computeBadgeState — yellow (recent: 7–30 days)
// ---------------------------------------------------------------------------
describe('computeBadgeState — yellow (recent)', () => {
  it('returns "yellow" for a check-in exactly 7 days ago', () => {
    expect(computeBadgeState(daysAgo(7))).toBe('yellow')
  })

  it('returns "yellow" for a check-in 8 days ago', () => {
    expect(computeBadgeState(daysAgo(8))).toBe('yellow')
  })

  it('returns "yellow" for a check-in 15 days ago', () => {
    expect(computeBadgeState(daysAgo(15))).toBe('yellow')
  })

  it('returns "yellow" for a check-in exactly 30 days ago', () => {
    expect(computeBadgeState(daysAgo(30))).toBe('yellow')
  })
})

// ---------------------------------------------------------------------------
// computeBadgeState — red (stale: > 30 days)
// ---------------------------------------------------------------------------
describe('computeBadgeState — red (stale)', () => {
  it('returns "red" for a check-in 31 days ago', () => {
    expect(computeBadgeState(daysAgo(31))).toBe('red')
  })

  it('returns "red" for a check-in 60 days ago', () => {
    expect(computeBadgeState(daysAgo(60))).toBe('red')
  })

  it('returns "red" for a check-in 365 days ago', () => {
    expect(computeBadgeState(daysAgo(365))).toBe('red')
  })

  it('returns "red" for a very old ISO date string', () => {
    expect(computeBadgeState('2020-01-01T00:00:00Z')).toBe('red')
  })
})

// ---------------------------------------------------------------------------
// computeBadgeState — malformed input
// ---------------------------------------------------------------------------
describe('computeBadgeState — malformed input', () => {
  it('returns "red" for an invalid date string (NaN guard)', () => {
    expect(computeBadgeState('not-a-date')).toBe('red')
  })

  it('returns "red" for a partially valid date string', () => {
    expect(computeBadgeState('2024-99-99')).toBe('red')
  })
})

// ---------------------------------------------------------------------------
// computeBadgeState — boundary precision
// ---------------------------------------------------------------------------
describe('computeBadgeState — boundary precision', () => {
  it('exactly at 7-day boundary returns "yellow" not "green"', () => {
    const exactly7 = daysAgo(7)
    expect(computeBadgeState(exactly7)).toBe('yellow')
  })

  it('just under 7 days returns "green"', () => {
    const justUnder7 = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000 - 1000)).toISOString()
    expect(computeBadgeState(justUnder7)).toBe('green')
  })

  it('exactly at 30-day boundary returns "yellow" not "red"', () => {
    expect(computeBadgeState(daysAgo(30))).toBe('yellow')
  })

  it('just over 30 days returns "red"', () => {
    const justOver30 = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000 + 1000)).toISOString()
    expect(computeBadgeState(justOver30)).toBe('red')
  })
})
