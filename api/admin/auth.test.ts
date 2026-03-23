import { describe, it, expect, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Mock setup ──────────────────────────────────────────────────────────────

const { mockRequireAdminAuth } = vi.hoisted(() => {
  const mockRequireAdminAuth = vi.fn().mockReturnValue(true)
  return { mockRequireAdminAuth }
})

vi.mock('../_middleware', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}))

import handler from './auth'

// ── Helpers ─────────────────────────────────────────────────────────────────

function mockReq(method = 'GET'): VercelRequest {
  return { method } as unknown as VercelRequest
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

describe('GET /api/admin/auth', () => {
  it('returns 405 for non-GET methods (2.2)', () => {
    const req = mockReq('POST')
    const { res, ctx } = mockRes()
    handler(req, res)
    expect(ctx.statusCode).toBe(405)
    expect((ctx.body as { error: string }).error).toBe('METHOD_NOT_ALLOWED')
  })

  it('returns 401 when requireAdminAuth returns false (2.3)', () => {
    mockRequireAdminAuth.mockImplementationOnce((req: VercelRequest, res: VercelResponse) => {
      res.status(401).json({ error: 'UNAUTHORIZED', status: 401 })
      return false
    })
    const req = mockReq('GET')
    const { res, ctx } = mockRes()
    handler(req, res)
    expect(ctx.statusCode).toBe(401)
    expect((ctx.body as { error: string }).error).toBe('UNAUTHORIZED')
  })

  it('returns 200 { ok: true } when requireAdminAuth returns true (2.4)', () => {
    mockRequireAdminAuth.mockReturnValueOnce(true)
    const req = mockReq('GET')
    const { res, ctx } = mockRes()
    handler(req, res)
    expect(ctx.statusCode).toBe(200)
    expect((ctx.body as { ok: boolean }).ok).toBe(true)
  })
})
