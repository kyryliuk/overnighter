import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const { mockGetUser } = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  return { mockGetUser }
})

vi.mock('./_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}))

import { requireUserAuth, requirePremiumAuth } from './_auth'

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

describe('requireUserAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for missing authorization header', async () => {
    const req = mockReq()
    const { res, ctx } = mockRes()
    const user = await requireUserAuth(req, res)
    expect(user).toBeNull()
    expect(ctx.statusCode).toBe(401)
  })

  it('returns 401 for invalid token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid') })
    const req = mockReq('Bearer bad-token')
    const { res, ctx } = mockRes()
    const user = await requireUserAuth(req, res)
    expect(user).toBeNull()
    expect(ctx.statusCode).toBe(401)
  })

  it('returns user for valid token', async () => {
    const fakeUser = { id: 'user-1', email: 'test@test.com' }
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })
    const req = mockReq('Bearer valid-token')
    const { res, ctx } = mockRes()
    const user = await requireUserAuth(req, res)
    expect(user).toEqual(fakeUser)
    expect(ctx.statusCode).toBeNull()
  })
})

describe('requirePremiumAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated request', async () => {
    const req = mockReq()
    const { res, ctx } = mockRes()
    const user = await requirePremiumAuth(req, res)
    expect(user).toBeNull()
    expect(ctx.statusCode).toBe(401)
  })

  it('returns 403 for free user', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', app_metadata: { subscription_status: 'free' } } },
      error: null,
    })
    const req = mockReq('Bearer valid-token')
    const { res, ctx } = mockRes()
    const user = await requirePremiumAuth(req, res)
    expect(user).toBeNull()
    expect(ctx.statusCode).toBe(403)
    expect((ctx.body as { error: string }).error).toBe('FORBIDDEN')
    expect((ctx.body as { message: string }).message).toBe('Premium subscription required')
  })

  it('returns 403 for expired user', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', app_metadata: { subscription_status: 'expired' } } },
      error: null,
    })
    const req = mockReq('Bearer valid-token')
    const { res, ctx } = mockRes()
    const user = await requirePremiumAuth(req, res)
    expect(user).toBeNull()
    expect(ctx.statusCode).toBe(403)
  })

  it('returns 403 when subscription_status is missing (defaults to free)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', app_metadata: {} } },
      error: null,
    })
    const req = mockReq('Bearer valid-token')
    const { res, ctx } = mockRes()
    const user = await requirePremiumAuth(req, res)
    expect(user).toBeNull()
    expect(ctx.statusCode).toBe(403)
  })

  it('returns 403 when app_metadata is undefined', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    const req = mockReq('Bearer valid-token')
    const { res, ctx } = mockRes()
    const user = await requirePremiumAuth(req, res)
    expect(user).toBeNull()
    expect(ctx.statusCode).toBe(403)
  })

  it('returns user for premium user', async () => {
    const premiumUser = { id: 'user-1', app_metadata: { subscription_status: 'premium' } }
    mockGetUser.mockResolvedValue({
      data: { user: premiumUser },
      error: null,
    })
    const req = mockReq('Bearer valid-token')
    const { res, ctx } = mockRes()
    const user = await requirePremiumAuth(req, res)
    expect(user).toEqual(premiumUser)
    expect(ctx.statusCode).toBeNull()
  })

  it('returns user for trialing user', async () => {
    const trialingUser = { id: 'user-1', app_metadata: { subscription_status: 'trialing' } }
    mockGetUser.mockResolvedValue({
      data: { user: trialingUser },
      error: null,
    })
    const req = mockReq('Bearer valid-token')
    const { res, ctx } = mockRes()
    const user = await requirePremiumAuth(req, res)
    expect(user).toEqual(trialingUser)
    expect(ctx.statusCode).toBeNull()
  })
})
