import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const { mockRequireUserAuth, mockSelectSingle, mockPortalSessionsCreate } = vi.hoisted(() => {
  const mockSelectSingle = vi.fn().mockResolvedValue({ data: { stripe_customer_id: 'cus_test123' }, error: null })
  const mockRequireUserAuth = vi.fn().mockResolvedValue({ id: 'user-1', email: 'test@example.com' })
  const mockPortalSessionsCreate = vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/portal123' })

  return { mockRequireUserAuth, mockSelectSingle, mockPortalSessionsCreate }
})

vi.mock('../_auth', () => ({
  requireUserAuth: mockRequireUserAuth,
}))

vi.mock('../_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mockSelectSingle })) })),
    })),
  })),
}))

vi.mock('stripe', () => {
  class MockStripe {
    billingPortal = { sessions: { create: mockPortalSessionsCreate } }
  }
  return { default: MockStripe }
})

import handler from './portal'

function mockReq(method = 'POST'): VercelRequest {
  return {
    method,
    body: {},
    headers: { authorization: 'Bearer token', origin: 'https://app.example.com' },
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

describe('/api/stripe/portal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    mockRequireUserAuth.mockResolvedValue({ id: 'user-1', email: 'test@example.com' })
    mockSelectSingle.mockResolvedValue({ data: { stripe_customer_id: 'cus_test123' }, error: null })
    mockPortalSessionsCreate.mockResolvedValue({ url: 'https://billing.stripe.com/portal123' })
  })

  it('returns 405 for non-POST methods', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(405)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireUserAuth.mockImplementation(async (_req: VercelRequest, res: VercelResponse) => {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing authenticated user token', status: 401 })
      return null
    })

    const { res, ctx } = mockRes()
    await handler(mockReq('POST'), res)
    expect(ctx.statusCode).toBe(401)
  })

  it('returns 400 when no stripe_customer_id exists', async () => {
    mockSelectSingle.mockResolvedValue({ data: { stripe_customer_id: null }, error: null })

    const { res, ctx } = mockRes()
    await handler(mockReq('POST'), res)
    expect(ctx.statusCode).toBe(400)
    expect((ctx.body as { error: string }).error).toBe('NO_SUBSCRIPTION')
  })

  it('creates portal session and returns URL', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST'), res)

    expect(ctx.statusCode).toBe(200)
    expect((ctx.body as { url: string }).url).toBe('https://billing.stripe.com/portal123')
    expect(mockPortalSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_test123',
        return_url: 'https://app.example.com/account',
      }),
    )
  })

  it('returns 500 when Stripe API fails', async () => {
    mockPortalSessionsCreate.mockRejectedValue(new Error('Stripe API error'))

    const { res, ctx } = mockRes()
    await handler(mockReq('POST'), res)
    expect(ctx.statusCode).toBe(500)
    expect((ctx.body as { error: string }).error).toBe('INTERNAL_ERROR')
  })
})
