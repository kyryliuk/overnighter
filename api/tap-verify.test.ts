import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const {
  mockEventInsert,
  mockConfirmedSelect,
  mockDeniedSelect,
  mockUpdateEq,
} = vi.hoisted(() => {
  const mockEventInsert = vi.fn().mockResolvedValue({ error: null })

  // confirmed events query chain: .select().eq('tap_pin_id').eq('event_type')
  const mockConfirmedSelect = vi.fn().mockResolvedValue({
    data: [],
    error: null,
  })

  // denied events query chain
  const mockDeniedSelect = vi.fn().mockResolvedValue({
    data: [],
    error: null,
  })

  // update chain
  const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })

  return { mockEventInsert, mockConfirmedSelect, mockDeniedSelect, mockUpdateEq }
})

// Track query chains per call sequence
let _confirmedData: Array<{ device_id: string }> = []
let _confirmedError: unknown = null
let _deniedData: Array<{ id: string }> = []
let _deniedError: unknown = null

vi.mock('./_supabase', () => ({
  createServiceClient: vi.fn(() => {
    // Track call count to distinguish confirmed vs denied queries
    let selectCallCount = 0

    return {
      from: vi.fn((table: string) => {
        if (table === 'tap_verification_events') {
          return {
            insert: (...args: unknown[]) => mockEventInsert(...args),
            select: vi.fn((fields?: string) => {
              selectCallCount++
              const callNum = selectCallCount

              const eqChain = {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockImplementation(() => {
                    // callNum 1 = confirmed query (device_id select)
                    // callNum 2 = denied query (id select)
                    if (callNum === 1 || fields === 'device_id') {
                      return Promise.resolve({ data: _confirmedData, error: _confirmedError })
                    }
                    return Promise.resolve({ data: _deniedData, error: _deniedError })
                  }),
                }),
              }
              return eqChain
            }),
          }
        }
        if (table === 'water_tap_pins') {
          return {
            update: vi.fn().mockReturnValue({
              eq: (...args: unknown[]) => mockUpdateEq(...args),
            }),
          }
        }
        return {}
      }),
    }
  }),
}))

import handler from './tap-verify'

// ── Test helpers ──────────────────────────────────────────────────────────────

function mockReq(method = 'POST', body: unknown = {}): VercelRequest {
  return { method, body } as unknown as VercelRequest
}

function mockRes() {
  const ctx = { statusCode: null as number | null, body: null as unknown }
  const res = {
    status(code: number) {
      ctx.statusCode = code
      return res
    },
    json(data: unknown) {
      ctx.body = data
    },
  } as unknown as VercelResponse
  return { res, ctx }
}

const VALID_BODY = {
  tapPinId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  eventType: 'confirmed',
  deviceId: 'device-abc-123',
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('api/tap-verify handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEventInsert.mockResolvedValue({ error: null })
    mockUpdateEq.mockResolvedValue({ error: null })
    _confirmedData = []
    _confirmedError = null
    _deniedData = []
    _deniedError = null
  })

  // AC 7: method guard
  it('returns 405 for non-POST methods (AC 7)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(405)
    expect(ctx.body).toMatchObject({ error: 'METHOD_NOT_ALLOWED' })
  })

  it('returns 405 for PUT method (AC 7)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('PUT'), res)
    expect(ctx.statusCode).toBe(405)
  })

  // AC 7: body validation
  it('returns 400 when tapPinId is missing (AC 7)', async () => {
    const { res, ctx } = mockRes()
    const { tapPinId, ...noId } = VALID_BODY
    void tapPinId
    await handler(mockReq('POST', noId), res)
    expect(ctx.statusCode).toBe(400)
    expect(ctx.body).toMatchObject({ error: 'INVALID_BODY' })
  })

  it('returns 400 when tapPinId is not a UUID (AC 7)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', { ...VALID_BODY, tapPinId: 'not-a-uuid' }), res)
    expect(ctx.statusCode).toBe(400)
    expect(ctx.body).toMatchObject({ error: 'INVALID_BODY' })
  })

  it('returns 400 when eventType is not confirmed|denied (AC 7)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', { ...VALID_BODY, eventType: 'maybe' }), res)
    expect(ctx.statusCode).toBe(400)
    expect(ctx.body).toMatchObject({ error: 'INVALID_BODY' })
  })

  it('returns 400 when deviceId is missing (AC 7)', async () => {
    const { res, ctx } = mockRes()
    const { deviceId, ...noDevice } = VALID_BODY
    void deviceId
    await handler(mockReq('POST', noDevice), res)
    expect(ctx.statusCode).toBe(400)
    expect(ctx.body).toMatchObject({ error: 'INVALID_BODY' })
  })

  // AC 7: happy path — inserts event and returns counts
  it('inserts verification event and returns counts (AC 7)', async () => {
    _confirmedData = [{ device_id: 'device-abc-123' }]
    _deniedData = []

    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toMatchObject({ confirmed: 1, denied: 0 })
    expect(mockEventInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tap_pin_id: VALID_BODY.tapPinId,
        device_id: VALID_BODY.deviceId,
        event_type: 'confirmed',
      }),
    )
  })

  it('handles denied event type (AC 7)', async () => {
    _confirmedData = []
    _deniedData = [{ id: 'event-1' }]

    const { res, ctx } = mockRes()
    await handler(mockReq('POST', { ...VALID_BODY, eventType: 'denied' }), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toMatchObject({ confirmed: 0, denied: 1 })
    expect(mockEventInsert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'denied' }),
    )
  })

  // AC 8: FR47 verified promotion at ≥ 2 unique confirmed devices
  it('promotes to verified when ≥2 unique confirmed devices (AC 8)', async () => {
    _confirmedData = [
      { device_id: 'device-A' },
      { device_id: 'device-B' }, // 2 unique devices
    ]
    _deniedData = []

    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toMatchObject({ confirmed: 2, denied: 0 })
    // FR47: water_tap_pins.update should have been called
    expect(mockUpdateEq).toHaveBeenCalledWith('id', VALID_BODY.tapPinId)
  })

  it('does NOT promote when < 2 unique confirmed devices (AC 8)', async () => {
    _confirmedData = [{ device_id: 'device-A' }] // only 1 unique device

    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(200)
    // update should NOT have been called
    expect(mockUpdateEq).not.toHaveBeenCalled()
  })

  it('counts unique devices (deduplication) for promotion (AC 8)', async () => {
    // Same device confirmed 3 times — still only 1 unique device
    _confirmedData = [
      { device_id: 'device-A' },
      { device_id: 'device-A' },
      { device_id: 'device-A' },
    ]
    _deniedData = []

    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toMatchObject({ confirmed: 1 }) // 1 unique, not 3
    expect(mockUpdateEq).not.toHaveBeenCalled() // no promotion since < 2 unique
  })

  // AC 9: no auth required
  it('processes request without Authorization header (AC 9)', async () => {
    _confirmedData = [{ device_id: VALID_BODY.deviceId }]
    const req = { method: 'POST', headers: {}, body: VALID_BODY } as unknown as VercelRequest
    const { res, ctx } = mockRes()
    await handler(req, res)
    expect(ctx.statusCode).not.toBe(401)
    expect(ctx.statusCode).not.toBe(403)
  })

  // AC 10: NFR-S4 sanitization
  it('NFR-S4: strips HTML from deviceId before storage (AC 10)', async () => {
    const maliciousBody = {
      ...VALID_BODY,
      deviceId: '<script>xss</script>device-safe',
    }
    _confirmedData = [{ device_id: 'device-safe' }]

    let capturedInsert: unknown = null
    mockEventInsert.mockImplementation((...args: unknown[]) => {
      capturedInsert = args[0]
      return Promise.resolve({ error: null })
    })

    const { res, ctx } = mockRes()
    await handler(mockReq('POST', maliciousBody), res)
    expect(ctx.statusCode).toBe(200)
    const row = capturedInsert as { device_id: string }
    expect(row?.device_id).not.toMatch(/</)
    expect(row?.device_id).not.toMatch(/>/)
    expect(row?.device_id).toContain('device-safe')
  })

  // Error handling
  it('returns 500 when event insert fails (AC 7)', async () => {
    mockEventInsert.mockResolvedValue({ error: new Error('DB write error') })
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(500)
    expect(ctx.body).toMatchObject({ error: 'INTERNAL_ERROR' })
    consoleSpy.mockRestore()
  })

  it('returns 500 when confirmed-events count query fails (M2 fix)', async () => {
    _confirmedError = new Error('DB count query failed')
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(500)
    expect(ctx.body).toMatchObject({ error: 'INTERNAL_ERROR' })
    consoleSpy.mockRestore()
  })
})
