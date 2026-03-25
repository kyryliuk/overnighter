import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const { mockRequireUserAuth, mockSelectSingle, mockUpdate, mockCustomersCreate, mockCheckoutSessionsCreate } =
  vi.hoisted(() => {
    const mockSelectSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const mockRequireUserAuth = vi.fn().mockResolvedValue({ id: 'user-1', email: 'test@example.com' })
    const mockCustomersCreate = vi.fn().mockResolvedValue({ id: 'cus_test123' })
    const mockCheckoutSessionsCreate = vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/session123' })

    return { mockRequireUserAuth, mockSelectSingle, mockUpdate, mockCustomersCreate, mockCheckoutSessionsCreate }
  })

vi.mock('../_auth', () => ({
  requireUserAuth: mockRequireUserAuth,
}))

vi.mock('../_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mockSelectSingle })) })),
      update: mockUpdate,
    })),
  })),
}))

vi.mock('stripe', () => {
  class MockStripe {
    customers = { create: mockCustomersCreate }
    checkout = { sessions: { create: mockCheckoutSessionsCreate } }
  }
  return { default: MockStripe }
})

import handler from './checkout'

function mockReq(method = 'POST'): VercelRequest {
  return {
    method,
    body: { returnTo: '/trips?tripId=trip-123' },
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

describe('/api/stripe/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_PRICE_ID_ANNUAL = 'price_annual_123'
    mockRequireUserAuth.mockResolvedValue({ id: 'user-1', email: 'test@example.com' })
    mockSelectSingle.mockResolvedValue({ data: null, error: null })
    mockCustomersCreate.mockResolvedValue({ id: 'cus_test123' })
    mockCheckoutSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session123' })
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

  it('creates a new Stripe customer when none exists', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST'), res)

    expect(ctx.statusCode).toBe(200)
    expect(mockCustomersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com', metadata: { supabase_user_id: 'user-1' } }),
    )
    expect((ctx.body as { url: string }).url).toBe('https://checkout.stripe.com/session123')
  })

  it('reuses existing Stripe customer when one exists', async () => {
    mockSelectSingle.mockResolvedValue({ data: { stripe_customer_id: 'cus_existing' }, error: null })

    const { res, ctx } = mockRes()
    await handler(mockReq('POST'), res)

    expect(ctx.statusCode).toBe(200)
    expect(mockCustomersCreate).not.toHaveBeenCalled()
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_existing' }),
    )
  })

  it('creates checkout session with correct parameters', async () => {
    const { res } = mockRes()
    await handler(mockReq('POST'), res)

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        line_items: [{ price: 'price_annual_123', quantity: 1 }],
        subscription_data: { trial_period_days: 30 },
        success_url: 'https://app.example.com/premium-welcome?session_id={CHECKOUT_SESSION_ID}&returnTo=%2Ftrips%3FtripId%3Dtrip-123',
        cancel_url: 'https://app.example.com/trips?tripId=trip-123',
      }),
    )
  })

  it('returns 500 when Stripe API fails', async () => {
    mockCheckoutSessionsCreate.mockRejectedValue(new Error('Stripe API error'))

    const { res, ctx } = mockRes()
    await handler(mockReq('POST'), res)
    expect(ctx.statusCode).toBe(500)
    expect((ctx.body as { error: string }).error).toBe('INTERNAL_ERROR')
  })
})
