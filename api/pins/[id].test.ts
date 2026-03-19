import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Mock setup ──────────────────────────────────────────────────────────────

const { mockRequireAdminAuth, mockUpdate, mockEq } = vi.hoisted(() => {
  const mockEq = vi.fn().mockResolvedValue({ error: null })
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
  const mockRequireAdminAuth = vi.fn().mockReturnValue(true)
  return { mockRequireAdminAuth, mockUpdate, mockEq }
})

vi.mock('../_middleware', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}))

vi.mock('../_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({ update: mockUpdate })),
  })),
}))

import handler from './[id]'

// ── Helpers ─────────────────────────────────────────────────────────────────

function mockReq(method = 'DELETE', id = 'pin-abc-123'): VercelRequest {
  return { method, query: { id } } as unknown as VercelRequest
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

describe('DELETE /api/pins/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdminAuth.mockReturnValue(true)
    mockEq.mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
  })

  it('returns 405 for methods that are neither DELETE nor PATCH (9.2)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(405)
    expect((ctx.body as { error: string }).error).toBe('METHOD_NOT_ALLOWED')
  })

  it('returns 401 when unauthorized (9.3)', async () => {
    mockRequireAdminAuth.mockImplementationOnce((req: VercelRequest, res: VercelResponse) => {
      res.status(401).json({ error: 'UNAUTHORIZED', status: 401 })
      return false
    })
    const { res, ctx } = mockRes()
    await handler(mockReq('DELETE'), res)
    expect(ctx.statusCode).toBe(401)
    expect((ctx.body as { error: string }).error).toBe('UNAUTHORIZED')
  })

  it('returns 200 { ok: true } and calls update with is_archived+is_flagged (9.4)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('DELETE', 'pin-abc-123'), res)
    expect(ctx.statusCode).toBe(200)
    expect((ctx.body as { ok: boolean }).ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ is_archived: true, is_flagged: false }),
    )
    expect(mockEq).toHaveBeenCalledWith('id', 'pin-abc-123')
  })

  it('returns 500 on Supabase error (9.5)', async () => {
    mockEq.mockResolvedValueOnce({ error: new Error('DB write failed') })
    const { res, ctx } = mockRes()
    await handler(mockReq('DELETE'), res)
    expect(ctx.statusCode).toBe(500)
    expect((ctx.body as { error: string }).error).toBe('INTERNAL_ERROR')
  })
})

describe('PATCH /api/pins/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdminAuth.mockReturnValue(true)
    mockEq.mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
  })

  it('returns 405 for methods that are neither DELETE nor PATCH (10.1)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST'), res)
    expect(ctx.statusCode).toBe(405)
    expect((ctx.body as { error: string }).error).toBe('METHOD_NOT_ALLOWED')
  })

  it('returns 401 when unauthorized (10.2)', async () => {
    mockRequireAdminAuth.mockImplementationOnce((req: VercelRequest, res: VercelResponse) => {
      res.status(401).json({ error: 'UNAUTHORIZED', status: 401 })
      return false
    })
    const { res, ctx } = mockRes()
    await handler(mockReq('PATCH'), res)
    expect(ctx.statusCode).toBe(401)
    expect((ctx.body as { error: string }).error).toBe('UNAUTHORIZED')
  })

  it('returns 400 for out-of-bounds coordinates (10.3)', async () => {
    const { res, ctx } = mockRes()
    const req = { method: 'PATCH', query: { id: 'pin-abc-123' }, body: { latitude: 0 } } as unknown as VercelRequest
    await handler(req, res)
    expect(ctx.statusCode).toBe(400)
    expect((ctx.body as { error: string }).error).toBe('INVALID_BODY')
  })

  it('returns 400 for invalid pin_type (10.4)', async () => {
    const { res, ctx } = mockRes()
    const req = { method: 'PATCH', query: { id: 'pin-abc-123' }, body: { pin_type: 'invalid' } } as unknown as VercelRequest
    await handler(req, res)
    expect(ctx.statusCode).toBe(400)
    expect((ctx.body as { error: string }).error).toBe('INVALID_BODY')
  })

  it('returns 200 { ok: true } and calls update with body fields + updated_at (10.5)', async () => {
    const { res, ctx } = mockRes()
    const req = { method: 'PATCH', query: { id: 'pin-abc-123' }, body: { name: 'Updated Name' } } as unknown as VercelRequest
    await handler(req, res)
    expect(ctx.statusCode).toBe(200)
    expect((ctx.body as { ok: boolean }).ok).toBe(true)
    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(updateArg.name).toBe('Updated Name')
    expect(typeof updateArg.updated_at).toBe('string')
    expect(mockEq).toHaveBeenCalledWith('id', 'pin-abc-123')
  })

  it('returns 400 for empty PATCH body {} (10.5b)', async () => {
    const { res, ctx } = mockRes()
    const req = { method: 'PATCH', query: { id: 'pin-abc-123' }, body: {} } as unknown as VercelRequest
    await handler(req, res)
    expect(ctx.statusCode).toBe(400)
    expect((ctx.body as { error: string }).error).toBe('INVALID_BODY')
  })

  it('returns 500 when Supabase update returns error (10.6)', async () => {
    mockEq.mockResolvedValueOnce({ error: new Error('DB write failed') })
    const { res, ctx } = mockRes()
    const req = { method: 'PATCH', query: { id: 'pin-abc-123' }, body: { name: 'Updated Name' } } as unknown as VercelRequest
    await handler(req, res)
    expect(ctx.statusCode).toBe(500)
    expect((ctx.body as { error: string }).error).toBe('INTERNAL_ERROR')
  })
})
