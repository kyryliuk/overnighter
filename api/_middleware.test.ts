import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { requireAdminAuth } from './_middleware'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function mockReq(authHeader?: string): VercelRequest {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  } as unknown as VercelRequest
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

describe('requireAdminAuth', () => {
  const REAL_SECRET = 'super-secret-token'

  beforeEach(() => {
    process.env.ADMIN_SECRET = REAL_SECRET
  })

  afterEach(() => {
    delete process.env.ADMIN_SECRET
  })

  it('returns true when Bearer token matches ADMIN_SECRET', () => {
    const req = mockReq(`Bearer ${REAL_SECRET}`)
    const { res } = mockRes()
    expect(requireAdminAuth(req, res)).toBe(true)
  })

  it('returns false and writes 401 when Authorization header is missing', () => {
    const req = mockReq()
    const { res, ctx } = mockRes()
    expect(requireAdminAuth(req, res)).toBe(false)
    expect(ctx.statusCode).toBe(401)
    expect((ctx.body as { error: string }).error).toBe('UNAUTHORIZED')
  })

  it('returns false and writes 401 when token is wrong', () => {
    const req = mockReq('Bearer wrong-token')
    const { res, ctx } = mockRes()
    expect(requireAdminAuth(req, res)).toBe(false)
    expect(ctx.statusCode).toBe(401)
  })

  it('returns false when scheme is not Bearer (e.g. Basic)', () => {
    const req = mockReq(`Basic ${REAL_SECRET}`)
    const { res, ctx } = mockRes()
    expect(requireAdminAuth(req, res)).toBe(false)
    expect(ctx.statusCode).toBe(401)
  })

  it('returns false when token has extra whitespace (double space after Bearer)', () => {
    const req = mockReq(`Bearer  ${REAL_SECRET}`) // double space — split gives ['Bearer', '', 'token']
    const { res, ctx } = mockRes()
    expect(requireAdminAuth(req, res)).toBe(false)
    expect(ctx.statusCode).toBe(401)
  })

  it('returns false when ADMIN_SECRET env var is not set', () => {
    delete process.env.ADMIN_SECRET
    const req = mockReq(`Bearer ${REAL_SECRET}`)
    const { res, ctx } = mockRes()
    expect(requireAdminAuth(req, res)).toBe(false)
    expect(ctx.statusCode).toBe(401)
  })
})
