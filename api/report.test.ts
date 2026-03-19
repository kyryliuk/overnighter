import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockMaybeSingle, mockRpc } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
  const mockRpc = vi.fn().mockResolvedValue({ error: null })
  return { mockMaybeSingle, mockRpc }
})

vi.mock('./_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
    })),
    rpc: mockRpc,
  })),
}))

import handler from './report'

// ── Helpers ────────────────────────────────────────────────────────────────

function mockReq(method = 'POST', body: unknown = {}): VercelRequest {
  return { method, body } as unknown as VercelRequest
}

function mockRes() {
  const ctx = { statusCode: null as number | null, body: null as unknown }
  const res = {
    status(code: number) { ctx.statusCode = code; return res },
    json(data: unknown) { ctx.body = data },
  } as unknown as VercelResponse
  return { res, ctx }
}

const VALID_BODY = {
  pinId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  deviceId: 'device-abc-123',
  type: 'dump_closed',
  timestamp: new Date().toISOString(),
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('api/report handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockRpc.mockResolvedValue({ error: null })
  })

  it('returns 405 for non-POST methods', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(405)
    expect(ctx.body).toMatchObject({ error: 'METHOD_NOT_ALLOWED' })
  })

  it('returns 400 for missing required fields — pinId absent', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', { deviceId: 'x', type: 'dump_closed', timestamp: new Date().toISOString() }), res)
    expect(ctx.statusCode).toBe(400)
    expect(ctx.body).toMatchObject({ error: 'INVALID_BODY' })
  })

  it('returns 400 for missing required fields — type absent', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', { pinId: VALID_BODY.pinId, deviceId: 'x', timestamp: new Date().toISOString() }), res)
    expect(ctx.statusCode).toBe(400)
    expect(ctx.body).toMatchObject({ error: 'INVALID_BODY' })
  })

  it('returns 400 for invalid type value not in enum', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', { ...VALID_BODY, type: 'broken_toilet' }), res)
    expect(ctx.statusCode).toBe(400)
    expect(ctx.body).toMatchObject({ error: 'INVALID_BODY' })
  })

  it('returns 429 and skips rpc when device already has a recent report for this pin', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'existing-report-id' }, error: null })
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(429)
    expect(ctx.body).toMatchObject({ error: 'RATE_LIMITED' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('calls rpc submit_issue_report with correct fields', async () => {
    const { res } = mockRes()
    await handler(mockReq('POST', { ...VALID_BODY, note: 'Station is locked' }), res)
    expect(mockRpc).toHaveBeenCalledWith(
      'submit_issue_report',
      expect.objectContaining({
        p_pin_id: VALID_BODY.pinId,
        p_device_id: VALID_BODY.deviceId,
        p_report_type: 'dump_closed',
        p_notes: 'Station is locked',
        p_created_at: VALID_BODY.timestamp,
      }),
    )
  })

  it('sanitizes HTML tags in note field before storage', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', { ...VALID_BODY, note: '<b>Access blocked</b>' }), res)
    expect(ctx.statusCode).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith(
      'submit_issue_report',
      expect.objectContaining({ p_notes: 'Access blocked' }),
    )
  })

  it('returns 200 { ok: true } on successful report', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual({ ok: true })
  })

  it('returns 500 and skips rpc when rate-limit DB query fails', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: new Error('DB read error') })
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(500)
    expect(ctx.body).toMatchObject({ error: 'INTERNAL_ERROR' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns 500 when rpc submit_issue_report fails', async () => {
    mockRpc.mockResolvedValue({ error: new Error('transaction failed') })
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(500)
    expect(ctx.body).toMatchObject({ error: 'INTERNAL_ERROR' })
  })
})
