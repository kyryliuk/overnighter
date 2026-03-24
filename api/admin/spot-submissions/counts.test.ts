import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const { mockRequireAdminAuth, mockEq } = vi.hoisted(() => {
  const mockEq = vi.fn()
  const mockRequireAdminAuth = vi.fn().mockReturnValue(true)

  return { mockRequireAdminAuth, mockEq }
})

vi.mock('../../_middleware', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}))

vi.mock('../../_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: mockEq,
      })),
    })),
  })),
}))

import countsHandler from './counts'

function mockReq(method = 'GET'): VercelRequest {
  return { method, headers: { authorization: 'Bearer admin' } } as unknown as VercelRequest
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

describe('/api/admin/spot-submissions/counts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdminAuth.mockReturnValue(true)
  })

  it('returns 405 for non-GET methods', async () => {
    const { res, ctx } = mockRes()
    await countsHandler(mockReq('POST'), res)
    expect(ctx.statusCode).toBe(405)
  })

  it('returns 401 when no admin token provided', async () => {
    mockRequireAdminAuth.mockReturnValue(false)
    const { res, ctx } = mockRes()
    await countsHandler(mockReq('GET'), res)
    expect(ctx.statusCode).toBeNull()
  })

  it('returns zero counts when no submissions exist', async () => {
    mockEq.mockResolvedValue({ count: 0, error: null })

    const { res, ctx } = mockRes()
    await countsHandler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(200)

    const body = ctx.body as Record<string, number>
    expect(body).toEqual({
      all: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      changes_requested: 0,
    })
  })

  it('returns correct per-status counts', async () => {
    // Each status is queried independently via .eq('status', statusName)
    mockEq
      .mockResolvedValueOnce({ count: 3, error: null })  // pending
      .mockResolvedValueOnce({ count: 2, error: null })  // approved
      .mockResolvedValueOnce({ count: 1, error: null })  // rejected
      .mockResolvedValueOnce({ count: 1, error: null })  // changes_requested

    const { res, ctx } = mockRes()
    await countsHandler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(200)

    const body = ctx.body as Record<string, number>
    expect(body).toEqual({
      all: 7,
      pending: 3,
      approved: 2,
      rejected: 1,
      changes_requested: 1,
    })
  })

  it('returns 500 on database error', async () => {
    mockEq.mockResolvedValue({ count: null, error: new Error('DB error') })

    const { res, ctx } = mockRes()
    await countsHandler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(500)
  })
})
