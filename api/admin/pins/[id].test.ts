import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Mock setup ──────────────────────────────────────────────────────────────

const { mockRequireAdminAuth, mockUpdate, mockEq, mockInsert, mockFrom } = vi.hoisted(() => {
  const mockEq = vi.fn().mockResolvedValue({ error: null })
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
  const mockInsert = vi.fn().mockResolvedValue({ error: null })
  const mockFrom = vi.fn((table: string) => {
    if (table === 'admin_audit_log') return { insert: mockInsert }
    return { update: mockUpdate }
  })
  const mockRequireAdminAuth = vi.fn().mockReturnValue(true)
  return { mockRequireAdminAuth, mockUpdate, mockEq, mockInsert, mockFrom }
})

vi.mock('../../_middleware', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}))

vi.mock('../../_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

import handler from './[id]'

// ── Helpers ─────────────────────────────────────────────────────────────────

function mockReq(method = 'PATCH', body: unknown = {}, id = 'pin-abc-123'): VercelRequest {
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

describe('PATCH /api/admin/pins/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdminAuth.mockReturnValue(true)
    mockEq.mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockInsert.mockResolvedValue({ error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'admin_audit_log') return { insert: mockInsert }
      return { update: mockUpdate }
    })
  })

  it('returns 405 for non-PATCH methods', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(405)
    expect((ctx.body as { error: string }).error).toBe('METHOD_NOT_ALLOWED')
  })

  it('returns 401 without valid Bearer token', async () => {
    mockRequireAdminAuth.mockImplementationOnce((_req: VercelRequest, res: VercelResponse) => {
      res.status(401).json({ error: 'UNAUTHORIZED', status: 401 })
      return false
    })
    const { res, ctx } = mockRes()
    await handler(mockReq('PATCH', { badge_override: 'green' }), res)
    expect(ctx.statusCode).toBe(401)
    expect((ctx.body as { error: string }).error).toBe('UNAUTHORIZED')
  })

  it('returns 400 for empty body', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('PATCH', {}), res)
    expect(ctx.statusCode).toBe(400)
    expect((ctx.body as { error: string }).error).toBe('INVALID_BODY')
  })

  it('sets badge_override to green and inserts audit log', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('PATCH', { badge_override: 'green' }), res)
    expect(ctx.statusCode).toBe(200)
    expect((ctx.body as { ok: boolean }).ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ badge_override: 'green' }),
    )
    expect(mockEq).toHaveBeenCalledWith('id', 'pin-abc-123')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'badge_override', pin_id: 'pin-abc-123' }),
    )
  })

  it('clears badge_override (sets to null) and inserts audit log', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('PATCH', { badge_override: null }), res)
    expect(ctx.statusCode).toBe(200)
    expect((ctx.body as { ok: boolean }).ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ badge_override: null }),
    )
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'badge_override_removed' }),
    )
  })

  it('returns 400 for invalid badge_override value', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('PATCH', { badge_override: 'purple' }), res)
    expect(ctx.statusCode).toBe(400)
    expect((ctx.body as { error: string }).error).toBe('INVALID_BODY')
  })

  it('unarchives pin (is_archived: false) and inserts audit log', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('PATCH', { is_archived: false }), res)
    expect(ctx.statusCode).toBe(200)
    expect((ctx.body as { ok: boolean }).ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ is_archived: false }),
    )
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'unarchive', pin_id: 'pin-abc-123' }),
    )
  })

  it('handles Supabase error gracefully (returns 500)', async () => {
    mockEq.mockResolvedValueOnce({ error: new Error('DB write failed') })
    const { res, ctx } = mockRes()
    await handler(mockReq('PATCH', { badge_override: 'red' }), res)
    expect(ctx.statusCode).toBe(500)
    expect((ctx.body as { error: string }).error).toBe('INTERNAL_ERROR')
  })
})
