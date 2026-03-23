import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Mock setup ──────────────────────────────────────────────────────────────

const { mockRequireAdminAuth, mockSingle, mockInsert } = vi.hoisted(() => {
  const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'new-pin-uuid' }, error: null })
  const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
  const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
  const mockRequireAdminAuth = vi.fn().mockReturnValue(true)
  return { mockRequireAdminAuth, mockSingle, mockInsert }
})

vi.mock('../_middleware', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}))

vi.mock('../_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({ insert: mockInsert })),
  })),
}))

import handler from './pins'

// ── Helpers ─────────────────────────────────────────────────────────────────

const VALID_BODY = {
  name: 'Founders Flat',
  pin_type: 'community' as const,
  latitude: 37.5,
  longitude: -107.5,
  amenities: {
    water: true,
    dump: false,
    electric: false,
    shower: false,
    fuel: false,
    propane: false,
    overnight: true,
  },
  max_length_ft: null,
  max_height_ft: null,
}

function mockReq(method = 'POST', body: unknown = VALID_BODY): VercelRequest {
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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/admin/pins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdminAuth.mockReturnValue(true)
    mockSingle.mockResolvedValue({ data: { id: 'new-pin-uuid' }, error: null })
  })

  it('returns 405 for non-POST methods (2.2)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(405)
    expect((ctx.body as { error: string }).error).toBe('METHOD_NOT_ALLOWED')
  })

  it('returns 401 when requireAdminAuth returns false (2.3)', async () => {
    mockRequireAdminAuth.mockImplementationOnce((req: VercelRequest, res: VercelResponse) => {
      res.status(401).json({ error: 'UNAUTHORIZED', status: 401 })
      return false
    })
    const { res, ctx } = mockRes()
    await handler(mockReq('POST'), res)
    expect(ctx.statusCode).toBe(401)
    expect((ctx.body as { error: string }).error).toBe('UNAUTHORIZED')
  })

  it('returns 400 when required field name is missing (2.4)', async () => {
    const { res, ctx } = mockRes()
    const badBody = { ...VALID_BODY, name: '' }
    await handler(mockReq('POST', badBody), res)
    expect(ctx.statusCode).toBe(400)
    expect((ctx.body as { error: string }).error).toBe('INVALID_BODY')
  })

  it('returns 400 when coordinates are out of bounds (2.5)', async () => {
    const { res, ctx } = mockRes()
    const badBody = { ...VALID_BODY, latitude: 0, longitude: 0 }
    await handler(mockReq('POST', badBody), res)
    expect(ctx.statusCode).toBe(400)
    expect((ctx.body as { error: string }).error).toBe('INVALID_BODY')
  })

  it('returns 400 when pin_type is invalid (L2)', async () => {
    const { res, ctx } = mockRes()
    const badBody = { ...VALID_BODY, pin_type: 'invalid-type' }
    await handler(mockReq('POST', badBody), res)
    expect(ctx.statusCode).toBe(400)
    expect((ctx.body as { error: string }).error).toBe('INVALID_BODY')
  })

  it('returns 400 when amenities object is missing (L2)', async () => {
    const { res, ctx } = mockRes()
    const { amenities, ...bodyWithoutAmenities } = VALID_BODY
    void amenities
    await handler(mockReq('POST', bodyWithoutAmenities), res)
    expect(ctx.statusCode).toBe(400)
    expect((ctx.body as { error: string }).error).toBe('INVALID_BODY')
  })

  it('returns 201 with new pin id on valid body and verifies insert payload (2.6)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(201)
    expect((ctx.body as { id: string }).id).toBe('new-pin-uuid')

    // Verify insert was called with admin-set defaults
    const insertArg = mockInsert.mock.calls[0][0] as Record<string, unknown>
    expect(insertArg.badge_state).toBe('green')
    expect(insertArg.is_verified).toBe(true)
    expect(insertArg.is_flagged).toBe(false)
    expect(insertArg.is_archived).toBe(false)
    expect(typeof insertArg.last_check_in_at).toBe('string')
    expect(typeof insertArg.updated_at).toBe('string')
    // Verify caller-provided fields pass through
    expect(insertArg.name).toBe('Founders Flat')
    expect(insertArg.latitude).toBe(37.5)
    expect(insertArg.longitude).toBe(-107.5)
  })

  it('returns 500 when Supabase insert returns error (2.7)', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: new Error('DB error') })
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(500)
    expect((ctx.body as { error: string }).error).toBe('INTERNAL_ERROR')
  })
})
