import { describe, it, expect, vi, beforeEach } from 'vitest'
import { formatRelativeTime } from './formatRelativeTime'

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "just now" for times less than 1 minute ago', () => {
    expect(formatRelativeTime('2026-06-15T11:59:30.000Z')).toBe('just now')
    expect(formatRelativeTime('2026-06-15T11:59:59.000Z')).toBe('just now')
  })

  it('returns minutes for times less than 1 hour ago', () => {
    expect(formatRelativeTime('2026-06-15T11:55:00.000Z')).toBe('5 minutes ago')
    expect(formatRelativeTime('2026-06-15T11:59:00.000Z')).toBe('1 minute ago')
    expect(formatRelativeTime('2026-06-15T11:30:00.000Z')).toBe('30 minutes ago')
  })

  it('returns hours for times less than 1 day ago', () => {
    expect(formatRelativeTime('2026-06-15T10:00:00.000Z')).toBe('2 hours ago')
    expect(formatRelativeTime('2026-06-15T11:00:00.000Z')).toBe('1 hour ago')
    expect(formatRelativeTime('2026-06-14T13:00:00.000Z')).toBe('23 hours ago')
  })

  it('returns days for times less than 7 days ago', () => {
    expect(formatRelativeTime('2026-06-14T12:00:00.000Z')).toBe('1 day ago')
    expect(formatRelativeTime('2026-06-12T12:00:00.000Z')).toBe('3 days ago')
    expect(formatRelativeTime('2026-06-09T12:00:00.000Z')).toBe('6 days ago')
  })

  it('returns formatted date for times 7+ days ago', () => {
    const result = formatRelativeTime('2026-06-01T12:00:00.000Z')
    expect(result).toMatch(/^on Jun 1, 2026$/)
  })

  it('handles different year dates', () => {
    const result = formatRelativeTime('2025-12-25T00:00:00.000Z')
    expect(result).toMatch(/^on Dec 25, 2025$/)
  })
})
