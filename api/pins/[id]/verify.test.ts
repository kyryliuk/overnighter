import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Mock setup ──────────────────────────────────────────────────────────────

const { mockRequireAdminAuth, mockUpdate, mockEq } = vi.hoisted(() => {
  const mockEq = vi.fn().mockResolvedValue({ error: null })
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
  const mockRequireAdminAuth = vi.fn().mockReturnValue(true)
  return { mockRequireAdminAuth, mockUpdate, mockEq }
})

vi.mock('../../_middleware', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}))

vi.mock('../../_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({ update: mockUpdate })),
  })),
}))

import handler from './verify'

// ── Helpers ─────────────────────────────────────────────────────────────────

function mockReq(method = 'PATCH', body: unknown = { action: 'verify' }, id = 'pin-abc-123'): VercelRequest {
  return { method, body, query: { id } } as unknown as VercelRequest
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

describe('PATCH /api/pins/:id/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdminAuth.mockReturnValue(true)
    mockEq.mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
  })

  it('returns 405 for non-PATCH methods (11.2)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(405)
    expect((ctx.body as { error: string }).error).toBe('METHOD_NOT_ALLOWED')
  })

  it('returns 401 when unauthorized (11.3)', async () => {
    mockRequireAdminAuth.mockImplementationOnce((req: VercelRequest, res: VercelResponse) => {
      res.status(401).json({ error: 'UNAUTHORIZED', status: 401 })
      return false
    })
    const { res, ctx } = mockRes()
    await handler(mockReq('PATCH'), res)
    expect(ctx.statusCode).toBe(401)
  })

  it('returns 400 for missing action field (11.4)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('PATCH', {}), res)
    expect(ctx.statusCode).toBe(400)
    expect((ctx.body as { error: string }).error).toBe('INVALID_BODY')
  })

  it('returns 400 for invalid action value (11.4)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('PATCH', { action: 'delete_everything' }), res)
    expect(ctx.statusCode).toBe(400)
    expect((ctx.body as { error: string }).error).toBe('INVALID_BODY')
  })

  it('returns 200 for verify action — update includes is_verified, badge_state green, is_flagged false (11.5)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('PATCH', { action: 'verify' }, 'pin-xyz'), res)
    expect(ctx.statusCode).toBe(200)
    expect((ctx.body as { ok: boolean }).ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ is_verified: true, badge_state: 'green', is_flagged: false }),
    )
    expect(mockEq).toHaveBeenCalledWith('id', 'pin-xyz')
  })

  it('returns 200 for dismiss action — update only sets is_flagged false, no badge change (11.6)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('PATCH', { action: 'dismiss' }, 'pin-xyz'), res)
    expect(ctx.statusCode).toBe(200)
    expect((ctx.body as { ok: boolean }).ok).toBe(true)
    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(updateArg.is_flagged).toBe(false)
    expect(updateArg.is_verified).toBeUndefined()
    expect(updateArg.badge_state).toBeUndefined()
  })

  it('returns 500 on Supabase error (11.7)', async () => {
    mockEq.mockResolvedValueOnce({ error: new Error('DB write failed') })
    const { res, ctx } = mockRes()
    await handler(mockReq('PATCH', { action: 'verify' }), res)
    expect(ctx.statusCode).toBe(500)
    expect((ctx.body as { error: string }).error).toBe('INTERNAL_ERROR')
  })
})
