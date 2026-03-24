import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockRequireUserAuth, mockUpsert, mockDeleteEq } = vi.hoisted(() => {
  const mockRequireUserAuth = vi.fn()
  const mockUpsert = vi.fn()
  const mockDeleteEq = vi.fn()
  return { mockRequireUserAuth, mockUpsert, mockDeleteEq }
})

vi.mock('../_auth', () => ({
  requireUserAuth: mockRequireUserAuth,
}))

vi.mock('../_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: mockUpsert,
      delete: vi.fn(() => ({ eq: mockDeleteEq })),
    })),
  })),
}))

import handler from './subscribe'

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

const VALID_SUBSCRIBE_BODY = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
  p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8p8REfW0A',
  auth: 'tBHItJI5svbpC7ZDFAnbXg',
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('api/push/subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireUserAuth.mockResolvedValue({ id: 'user-1', email: 'test@test.com' })
    mockUpsert.mockResolvedValue({ error: null })
    mockDeleteEq.mockResolvedValue({ error: null })
  })

  it('returns 405 for unsupported methods', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('PUT'), res)
    expect(ctx.statusCode).toBe(405)
    expect(ctx.body).toMatchObject({ error: 'METHOD_NOT_ALLOWED' })
  })

  it('returns 405 for PATCH', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('PATCH'), res)
    expect(ctx.statusCode).toBe(405)
  })

  // ── POST (subscribe) ────────────────────────────────────────────────────

  describe('POST', () => {
    it('returns 401 for missing/invalid JWT', async () => {
      mockRequireUserAuth.mockImplementation(async (_req: VercelRequest, res: VercelResponse) => {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing authenticated user token', status: 401 })
        return null
      })
      const { res, ctx } = mockRes()
      await handler(mockReq('POST', VALID_SUBSCRIBE_BODY), res)
      expect(ctx.statusCode).toBe(401)
    })

    it('returns 400 for invalid body — missing endpoint', async () => {
      const { res, ctx } = mockRes()
      const { endpoint, ...noEndpoint } = VALID_SUBSCRIBE_BODY
      void endpoint
      await handler(mockReq('POST', noEndpoint), res)
      expect(ctx.statusCode).toBe(400)
      expect(ctx.body).toMatchObject({ error: 'INVALID_BODY' })
    })

    it('returns 400 for invalid body — missing p256dh', async () => {
      const { res, ctx } = mockRes()
      await handler(mockReq('POST', { ...VALID_SUBSCRIBE_BODY, p256dh: '' }), res)
      expect(ctx.statusCode).toBe(400)
      expect(ctx.body).toMatchObject({ error: 'INVALID_BODY' })
    })

    it('returns 400 for invalid body — missing auth', async () => {
      const { res, ctx } = mockRes()
      await handler(mockReq('POST', { ...VALID_SUBSCRIBE_BODY, auth: '' }), res)
      expect(ctx.statusCode).toBe(400)
      expect(ctx.body).toMatchObject({ error: 'INVALID_BODY' })
    })

    it('returns 200 and upserts subscription on valid request', async () => {
      const { res, ctx } = mockRes()
      await handler(mockReq('POST', VALID_SUBSCRIBE_BODY), res)
      expect(ctx.statusCode).toBe(200)
      expect(ctx.body).toEqual({ ok: true })
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          user_id: 'user-1',
          endpoint: VALID_SUBSCRIBE_BODY.endpoint,
          p256dh: VALID_SUBSCRIBE_BODY.p256dh,
          auth: VALID_SUBSCRIBE_BODY.auth,
        },
        { onConflict: 'endpoint' },
      )
    })

    it('returns 500 on DB error', async () => {
      mockUpsert.mockResolvedValue({ error: new Error('DB write error') })
      const { res, ctx } = mockRes()
      await handler(mockReq('POST', VALID_SUBSCRIBE_BODY), res)
      expect(ctx.statusCode).toBe(500)
      expect(ctx.body).toMatchObject({ error: 'INTERNAL_ERROR' })
    })
  })

  // ── DELETE (unsubscribe) ─────────────────────────────────────────────────

  describe('DELETE', () => {
    it('returns 401 for missing/invalid JWT', async () => {
      mockRequireUserAuth.mockImplementation(async (_req: VercelRequest, res: VercelResponse) => {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing authenticated user token', status: 401 })
        return null
      })
      const { res, ctx } = mockRes()
      await handler(mockReq('DELETE'), res)
      expect(ctx.statusCode).toBe(401)
    })

    it('returns 200 and deletes user subscriptions', async () => {
      const { res, ctx } = mockRes()
      await handler(mockReq('DELETE'), res)
      expect(ctx.statusCode).toBe(200)
      expect(ctx.body).toEqual({ ok: true })
      expect(mockDeleteEq).toHaveBeenCalledWith('user_id', 'user-1')
    })

    it('returns 200 even when no rows exist (idempotent)', async () => {
      mockDeleteEq.mockResolvedValue({ error: null, count: 0 })
      const { res, ctx } = mockRes()
      await handler(mockReq('DELETE'), res)
      expect(ctx.statusCode).toBe(200)
      expect(ctx.body).toEqual({ ok: true })
    })

    it('returns 500 on DB error', async () => {
      mockDeleteEq.mockResolvedValue({ error: new Error('DB delete error') })
      const { res, ctx } = mockRes()
      await handler(mockReq('DELETE'), res)
      expect(ctx.statusCode).toBe(500)
      expect(ctx.body).toMatchObject({ error: 'INTERNAL_ERROR' })
    })
  })
})
