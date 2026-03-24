import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Mock setup ──────────────────────────────────────────────────────────────

const { mockRequireAdminAuth, mockUpdate, mockEq, mockInsert, mockSelect, mockFrom } = vi.hoisted(() => {
  const mockSelect = vi.fn().mockResolvedValue({ data: [{ id: 'report-1' }, { id: 'report-2' }] })
  const mockEqChain2 = vi.fn().mockReturnValue({ select: mockSelect })
  const mockEqChain1 = vi.fn().mockReturnValue({ eq: mockEqChain2 })
  const mockEq = vi.fn().mockResolvedValue({ error: null })
  const mockUpdate = vi.fn().mockImplementation(() => ({ eq: mockEq }))
  const mockInsert = vi.fn().mockResolvedValue({ error: null })

  const mockFrom = vi.fn((table: string) => {
    if (table === 'admin_audit_log') return { insert: mockInsert }
    if (table === 'issue_reports') return { update: vi.fn().mockReturnValue({ eq: mockEqChain1 }) }
    return { update: mockUpdate }
  })

  const mockRequireAdminAuth = vi.fn().mockReturnValue(true)
  return { mockRequireAdminAuth, mockUpdate, mockEq, mockInsert, mockSelect, mockFrom }
})

vi.mock('../../_middleware', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}))

vi.mock('../../_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: mockFrom,
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
    mockUpdate.mockImplementation(() => ({ eq: mockEq }))
    mockInsert.mockResolvedValue({ error: null })
    mockSelect.mockResolvedValue({ data: [{ id: 'report-1' }, { id: 'report-2' }] })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'admin_audit_log') return { insert: mockInsert }
      if (table === 'issue_reports') {
        const mockEqChain2 = vi.fn().mockReturnValue({ select: mockSelect })
        const mockEqChain1 = vi.fn().mockReturnValue({ eq: mockEqChain2 })
        return { update: vi.fn().mockReturnValue({ eq: mockEqChain1 }) }
      }
      return { update: mockUpdate }
    })
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

  it('dismiss action closes all open issue reports', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('PATCH', { action: 'dismiss' }, 'pin-xyz'), res)
    expect(ctx.statusCode).toBe(200)

    // Check that issue_reports table was accessed
    expect(mockFrom).toHaveBeenCalledWith('issue_reports')
  })

  it('dismiss action inserts audit log with flags_cleared count', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('PATCH', { action: 'dismiss' }, 'pin-xyz'), res)
    expect(ctx.statusCode).toBe(200)

    expect(mockFrom).toHaveBeenCalledWith('admin_audit_log')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'dismiss_flags',
        pin_id: 'pin-xyz',
        details: { flags_cleared: 2 },
      }),
    )
  })

  it('verify action closes all open issue reports', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('PATCH', { action: 'verify' }, 'pin-xyz'), res)
    expect(ctx.statusCode).toBe(200)

    expect(mockFrom).toHaveBeenCalledWith('issue_reports')
  })

  it('verify action inserts audit log with action verify', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('PATCH', { action: 'verify' }, 'pin-xyz'), res)
    expect(ctx.statusCode).toBe(200)

    expect(mockFrom).toHaveBeenCalledWith('admin_audit_log')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'verify',
        pin_id: 'pin-xyz',
      }),
    )
  })
})
