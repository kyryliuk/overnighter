import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockInsert, mockGte, mockSelect, mockUpdateEq, mockUpdate } = vi.hoisted(() => {
  const mockInsert = vi.fn().mockResolvedValue({ error: null })
  const mockGte = vi.fn().mockResolvedValue({ count: 1, error: null })
  const mockCountEq = vi.fn().mockReturnValue({ gte: mockGte })
  const mockSelect = vi.fn().mockReturnValue({ eq: mockCountEq })
  const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })
  return { mockInsert, mockGte, mockSelect, mockUpdateEq, mockUpdate }
})

vi.mock('./_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'pins') return { update: mockUpdate }
      // 'check_ins' — supports both insert and select
      return { insert: mockInsert, select: mockSelect }
    }),
  })),
}))

import handler from './checkin'

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
  status: 'still_open',
  timestamp: new Date().toISOString(),
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('api/checkin handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockResolvedValue({ error: null })
    mockGte.mockResolvedValue({ count: 1, error: null })
    mockUpdateEq.mockResolvedValue({ error: null })
  })

  it('returns 405 for non-POST methods (3.2)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(405)
    expect(ctx.body).toMatchObject({ error: 'METHOD_NOT_ALLOWED' })
  })

  it('returns 400 for missing required fields — pinId and status absent (3.3)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', { deviceId: 'x', timestamp: new Date().toISOString() }), res)
    expect(ctx.statusCode).toBe(400)
    expect(ctx.body).toMatchObject({ error: 'INVALID_BODY' })
  })

  it('returns 400 when deviceId is missing (M3)', async () => {
    const { res, ctx } = mockRes()
    const { deviceId: _, ...noDeviceId } = VALID_BODY
    await handler(mockReq('POST', noDeviceId), res)
    expect(ctx.statusCode).toBe(400)
    expect(ctx.body).toMatchObject({ error: 'INVALID_BODY' })
  })

  it('returns 400 for invalid status value not in enum (3.4)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', { ...VALID_BODY, status: 'maybe_open' }), res)
    expect(ctx.statusCode).toBe(400)
    expect(ctx.body).toMatchObject({ error: 'INVALID_BODY' })
  })

  it('inserts check_in row with correct fields (3.5)', async () => {
    const { res } = mockRes()
    await handler(mockReq('POST', { ...VALID_BODY, note: 'Great spot' }), res)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        pin_id: VALID_BODY.pinId,
        device_id: VALID_BODY.deviceId,
        status: 'still_open',
        notes: 'Great spot',
        checked_in_at: VALID_BODY.timestamp,
      }),
    )
  })

  it('sanitizes HTML tags in note field before storage (3.6)', async () => {
    const { res, ctx } = mockRes()
    // Input: <b>Fee</b> is $12  →  tags stripped  →  "Fee is $12"
    await handler(mockReq('POST', { ...VALID_BODY, note: '<b>Fee</b> is $12' }), res)
    expect(ctx.statusCode).toBe(200)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ notes: 'Fee is $12' }),
    )
  })

  it('returns 200 { ok: true } on successful check-in (3.7)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual({ ok: true })
  })

  it('returns 500 when Supabase insert fails (3.8)', async () => {
    mockInsert.mockResolvedValue({ error: new Error('DB write error') })
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(500)
    expect(ctx.body).toMatchObject({ error: 'INTERNAL_ERROR' })
  })

  it('returns 500 when count query fails — M2 fix', async () => {
    mockGte.mockResolvedValue({ count: null, error: new Error('count query failed') })
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(500)
    expect(ctx.body).toMatchObject({ error: 'INTERNAL_ERROR' })
  })

  it('returns 500 when pins.update fails — H1 fix', async () => {
    mockUpdateEq.mockResolvedValue({ error: new Error('pins update failed') })
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(500)
    expect(ctx.body).toMatchObject({ error: 'INTERNAL_ERROR' })
  })
})
