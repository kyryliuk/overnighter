import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockInsertSingle, mockGte, mockSelect, mockUpdateEq, mockUpdate, mockPinSelectSingle, mockRequireUserAuth, mockPhotoInsert } = vi.hoisted(() => {
  const mockInsertSingle = vi.fn().mockResolvedValue({ data: { id: 'generated-check-in-id' }, error: null })
  const mockInsertSelect = vi.fn().mockReturnValue({ single: mockInsertSingle })
  const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect })
  const mockGte = vi.fn().mockResolvedValue({ count: 1, error: null })
  const mockCountEq = vi.fn().mockReturnValue({ gte: mockGte })
  const mockSelect = vi.fn().mockReturnValue({ eq: mockCountEq })
  const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })
  const mockPinSelectSingle = vi.fn().mockResolvedValue({ data: { badge_state: 'grey', name: 'Test Spot' }, error: null })
  const mockPinSelectEq = vi.fn().mockReturnValue({ single: mockPinSelectSingle })
  const mockPinSelect = vi.fn().mockReturnValue({ eq: mockPinSelectEq })
  const mockPhotoInsert = vi.fn().mockResolvedValue({ error: null })
  const mockRequireUserAuth = vi.fn()
  return { mockInsert, mockInsertSingle, mockGte, mockSelect, mockUpdateEq, mockUpdate, mockPinSelectSingle, mockPinSelect, mockRequireUserAuth, mockPhotoInsert }
})

vi.mock('./_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'pins') return { update: mockUpdate, select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockPinSelectSingle }) }) }
      if (table === 'pin_photos') return { insert: mockPhotoInsert }
      // 'check_ins' — supports both insert and select
      return {
        insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockInsertSingle }) }),
        select: mockSelect,
      }
    }),
  })),
}))

vi.mock('./_auth', () => ({
  requireUserAuth: mockRequireUserAuth,
}))

const mockNotifySubscribers = vi.fn().mockResolvedValue(undefined)
vi.mock('./_pushNotify', () => ({
  notifySubscribers: (...args: unknown[]) => mockNotifySubscribers(...args),
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
    mockInsertSingle.mockResolvedValue({ data: { id: 'generated-check-in-id' }, error: null })
    mockGte.mockResolvedValue({ count: 1, error: null })
    mockUpdateEq.mockResolvedValue({ error: null })
    mockPinSelectSingle.mockResolvedValue({ data: { badge_state: 'grey', name: 'Test Spot' }, error: null })
    mockNotifySubscribers.mockResolvedValue(undefined)
    mockRequireUserAuth.mockResolvedValue({ id: 'user-123' })
    mockPhotoInsert.mockResolvedValue({ error: null })
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
    const { deviceId, ...noDeviceId } = VALID_BODY
    void deviceId
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

  it('returns 200 { ok: true } on successful check-in (3.7)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual({ ok: true })
  })

  it('returns 500 when Supabase insert fails (3.8)', async () => {
    mockInsertSingle.mockResolvedValue({ data: null, error: new Error('DB write error') })
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(500)
    expect(ctx.body).toMatchObject({ error: 'INTERNAL_ERROR' })
    consoleSpy.mockRestore()
  })

  it('returns 500 when count query fails — M2 fix', async () => {
    mockGte.mockResolvedValue({ count: null, error: new Error('count query failed') })
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(500)
    expect(ctx.body).toMatchObject({ error: 'INTERNAL_ERROR' })
    consoleSpy.mockRestore()
  })

  it('returns 500 when pins.update fails — H1 fix', async () => {
    mockUpdateEq.mockResolvedValue({ error: new Error('pins update failed') })
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(500)
    expect(ctx.body).toMatchObject({ error: 'INTERNAL_ERROR' })
    consoleSpy.mockRestore()
  })

  it('calls notifySubscribers with correct args on successful check-in (4.3)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(200)
    expect(mockNotifySubscribers).toHaveBeenCalledWith(
      expect.anything(),
      VALID_BODY.pinId,
      'Test Spot',
      'still_open',
    )
  })

  it('uses fallback pin name when pin query returns no data (4.3)', async () => {
    mockPinSelectSingle.mockResolvedValue({ data: null, error: null })
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(200)
    expect(mockNotifySubscribers).toHaveBeenCalledWith(
      expect.anything(),
      VALID_BODY.pinId,
      'A spot',
      'still_open',
    )
  })

  it('returns 200 even when notifySubscribers throws (fire-and-forget) (4.3)', async () => {
    mockNotifySubscribers.mockRejectedValue(new Error('notification dispatch failed'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual({ ok: true })
    consoleSpy.mockRestore()
  })

  // ── Photo field tests ───────────────────────────────────────────────────

  it('accepts optional checkInId, photoCdnUrl, photoStoragePath fields', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', {
      ...VALID_BODY,
      checkInId: 'a47ac10b-58cc-4372-a567-0e02b2c3d479',
      photoCdnUrl: 'https://cdn.example.com/photo.jpg',
      photoStoragePath: 'pin-id/ci-id/uuid.jpg',
    }), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual({ ok: true })
  })

  it('inserts into pin_photos when photo fields are provided', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', {
      ...VALID_BODY,
      checkInId: 'a47ac10b-58cc-4372-a567-0e02b2c3d479',
      photoCdnUrl: 'https://cdn.example.com/photo.jpg',
      photoStoragePath: 'pin-id/ci-id/uuid.jpg',
    }), res)
    expect(ctx.statusCode).toBe(200)
    expect(mockPhotoInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        check_in_id: 'generated-check-in-id',
        user_id: 'user-123',
        storage_path: 'pin-id/ci-id/uuid.jpg',
        cdn_url: 'https://cdn.example.com/photo.jpg',
      }),
    )
  })

  it('check-in succeeds even if pin_photos insert fails (best-effort)', async () => {
    mockPhotoInsert.mockResolvedValue({ error: new Error('pin_photos insert failed') })
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', {
      ...VALID_BODY,
      checkInId: 'a47ac10b-58cc-4372-a567-0e02b2c3d479',
      photoCdnUrl: 'https://cdn.example.com/photo.jpg',
      photoStoragePath: 'pin-id/ci-id/uuid.jpg',
    }), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual({ ok: true })
    consoleSpy.mockRestore()
  })

  it('existing check-in behavior is unchanged when photo fields are absent', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual({ ok: true })
    expect(mockPhotoInsert).not.toHaveBeenCalled()
  })
})
