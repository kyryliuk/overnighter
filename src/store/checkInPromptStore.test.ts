import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCheckInPromptStore } from './checkInPromptStore'

const STUB_PIN = { id: 'p1', name: 'Test Spot', latitude: 39.7392, longitude: -104.9903 }

describe('useCheckInPromptStore', () => {
  beforeEach(() => {
    useCheckInPromptStore.setState({ visitRecords: [], dismissedKeys: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('recordVisit stores a new VisitRecord with correct fields', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-19'))
    useCheckInPromptStore.getState().recordVisit(STUB_PIN)
    const records = useCheckInPromptStore.getState().visitRecords
    expect(records).toHaveLength(1)
    expect(records[0].pinId).toBe('p1')
    expect(records[0].pinName).toBe('Test Spot')
    expect(records[0].latitude).toBe(39.7392)
    expect(records[0].longitude).toBe(-104.9903)
  })

  it('recordVisit sets visitKey as pinId:YYYY-MM-DD', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-19'))
    useCheckInPromptStore.getState().recordVisit(STUB_PIN)
    const records = useCheckInPromptStore.getState().visitRecords
    expect(records[0].visitKey).toBe('p1:2026-03-19')
  })

  it('recordVisit does not duplicate a record with the same visitKey', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-19'))
    useCheckInPromptStore.getState().recordVisit(STUB_PIN)
    useCheckInPromptStore.getState().recordVisit(STUB_PIN)
    expect(useCheckInPromptStore.getState().visitRecords).toHaveLength(1)
  })

  it('recordVisit adds a second record for same pin on a different date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-19'))
    useCheckInPromptStore.getState().recordVisit(STUB_PIN)
    vi.setSystemTime(new Date('2026-03-20'))
    useCheckInPromptStore.getState().recordVisit(STUB_PIN)
    expect(useCheckInPromptStore.getState().visitRecords).toHaveLength(2)
  })

  it('dismissVisit adds visitKey to dismissedKeys', () => {
    useCheckInPromptStore.getState().dismissVisit('p1:2026-03-19')
    expect(useCheckInPromptStore.getState().dismissedKeys).toContain('p1:2026-03-19')
  })

  it('isDismissed returns true for a dismissed visitKey', () => {
    useCheckInPromptStore.getState().dismissVisit('p1:2026-03-19')
    expect(useCheckInPromptStore.getState().isDismissed('p1:2026-03-19')).toBe(true)
  })

  it('isDismissed returns false for a non-dismissed visitKey', () => {
    expect(useCheckInPromptStore.getState().isDismissed('p1:2026-03-19')).toBe(false)
  })

  it('dismissVisit is idempotent — calling twice does not duplicate dismissedKeys', () => {
    useCheckInPromptStore.getState().dismissVisit('p1:2026-03-19')
    useCheckInPromptStore.getState().dismissVisit('p1:2026-03-19')
    const keys = useCheckInPromptStore.getState().dismissedKeys.filter((k) => k === 'p1:2026-03-19')
    expect(keys).toHaveLength(1)
  })

  it('most recent visit record is first in the array', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-19'))
    useCheckInPromptStore.getState().recordVisit(STUB_PIN)
    vi.setSystemTime(new Date('2026-03-20'))
    const pin2 = { ...STUB_PIN, id: 'p2', name: 'Another Spot' }
    useCheckInPromptStore.getState().recordVisit(pin2)
    const records = useCheckInPromptStore.getState().visitRecords
    expect(records[0].pinId).toBe('p2')
    expect(records[1].pinId).toBe('p1')
  })
})
