import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { EventEmitter } from 'events'

const { mockConstructEvent, mockSubscriptionsRetrieve, mockProfileSelect, mockProfileUpdate, mockUpdateUserById } =
  vi.hoisted(() => {
    const mockConstructEvent = vi.fn()
    const mockSubscriptionsRetrieve = vi.fn()
    const mockProfileSelectSingle = vi.fn().mockResolvedValue({ data: { id: 'user-1' }, error: null })
    const mockProfileUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const mockProfileUpdate = vi.fn().mockReturnValue({ eq: mockProfileUpdateEq })
    const mockUpdateUserById = vi.fn().mockResolvedValue({ error: null })

    return {
      mockConstructEvent,
      mockSubscriptionsRetrieve,
      mockProfileSelect: mockProfileSelectSingle,
      mockProfileUpdate,
      mockUpdateUserById,
    }
  })

vi.mock('stripe', () => {
  class MockStripe {
    webhooks = { constructEvent: mockConstructEvent }
    subscriptions = { retrieve: mockSubscriptionsRetrieve }
  }
  return { default: MockStripe }
})

vi.mock('../_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mockProfileSelect })) })),
      update: mockProfileUpdate,
    })),
    auth: {
      admin: { updateUserById: mockUpdateUserById },
    },
  })),
}))

import handler from './webhook'

function createStreamReq(body: string, headers: Record<string, string> = {}): VercelRequest {
  const emitter = new EventEmitter()
  const req = Object.assign(emitter, {
    method: 'POST',
    headers: { 'stripe-signature': 'sig_test', ...headers },
    body: undefined,
  }) as unknown as VercelRequest

  // Emit data/end on next tick to simulate stream
  process.nextTick(() => {
    emitter.emit('data', Buffer.from(body))
    emitter.emit('end')
  })

  return req
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

function makeEvent(type: string, data: Record<string, unknown>) {
  return { type, data: { object: data } }
}

describe('/api/stripe/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123'
    mockProfileSelect.mockResolvedValue({ data: { id: 'user-1' }, error: null })
    mockProfileUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    mockUpdateUserById.mockResolvedValue({ error: null })
  })

  it('returns 405 for non-POST methods', async () => {
    const req = { method: 'GET', headers: {} } as unknown as VercelRequest
    const { res, ctx } = mockRes()
    await handler(req, res)
    expect(ctx.statusCode).toBe(405)
  })

  it('returns 400 when stripe-signature header is missing', async () => {
    const req = { method: 'POST', headers: {} } as unknown as VercelRequest
    const { res, ctx } = mockRes()
    await handler(req, res)
    expect(ctx.statusCode).toBe(400)
    expect((ctx.body as { error: string }).error).toBe('MISSING_SIGNATURE')
  })

  it('returns 400 when signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const req = createStreamReq('{"test":true}')
    const { res, ctx } = mockRes()
    await handler(req, res)
    expect(ctx.statusCode).toBe(400)
    expect((ctx.body as { error: string }).error).toBe('INVALID_SIGNATURE')
  })

  it('handles checkout.session.completed with trialing subscription', async () => {
    mockConstructEvent.mockReturnValue(
      makeEvent('checkout.session.completed', {
        customer: 'cus_test',
        subscription: 'sub_test',
      }),
    )
    mockSubscriptionsRetrieve.mockResolvedValue({ status: 'trialing' })

    const req = createStreamReq('{}')
    const { res, ctx } = mockRes()
    await handler(req, res)

    expect(ctx.statusCode).toBe(200)
    expect(mockProfileUpdate).toHaveBeenCalledWith({ subscription_status: 'trialing' })
    expect(mockUpdateUserById).toHaveBeenCalledWith('user-1', {
      app_metadata: { subscription_status: 'trialing' },
    })
  })

  it('handles checkout.session.completed with active subscription', async () => {
    mockConstructEvent.mockReturnValue(
      makeEvent('checkout.session.completed', {
        customer: 'cus_test',
        subscription: 'sub_test',
      }),
    )
    mockSubscriptionsRetrieve.mockResolvedValue({ status: 'active' })

    const req = createStreamReq('{}')
    const { res, ctx } = mockRes()
    await handler(req, res)

    expect(ctx.statusCode).toBe(200)
    expect(mockProfileUpdate).toHaveBeenCalledWith({ subscription_status: 'premium' })
  })

  it('handles customer.subscription.updated with active status', async () => {
    mockConstructEvent.mockReturnValue(
      makeEvent('customer.subscription.updated', {
        customer: 'cus_test',
        status: 'active',
      }),
    )

    const req = createStreamReq('{}')
    const { res, ctx } = mockRes()
    await handler(req, res)

    expect(ctx.statusCode).toBe(200)
    expect(mockProfileUpdate).toHaveBeenCalledWith({ subscription_status: 'premium' })
  })

  it('handles customer.subscription.updated with trialing status', async () => {
    mockConstructEvent.mockReturnValue(
      makeEvent('customer.subscription.updated', {
        customer: 'cus_test',
        status: 'trialing',
      }),
    )

    const req = createStreamReq('{}')
    const { res, ctx } = mockRes()
    await handler(req, res)

    expect(ctx.statusCode).toBe(200)
    expect(mockProfileUpdate).toHaveBeenCalledWith({ subscription_status: 'trialing' })
  })

  it('handles customer.subscription.updated with canceled status', async () => {
    mockConstructEvent.mockReturnValue(
      makeEvent('customer.subscription.updated', {
        customer: 'cus_test',
        status: 'canceled',
      }),
    )

    const req = createStreamReq('{}')
    const { res, ctx } = mockRes()
    await handler(req, res)

    expect(ctx.statusCode).toBe(200)
    expect(mockProfileUpdate).toHaveBeenCalledWith({ subscription_status: 'expired' })
  })

  it('handles customer.subscription.deleted', async () => {
    mockConstructEvent.mockReturnValue(
      makeEvent('customer.subscription.deleted', {
        customer: 'cus_test',
      }),
    )

    const req = createStreamReq('{}')
    const { res, ctx } = mockRes()
    await handler(req, res)

    expect(ctx.statusCode).toBe(200)
    expect(mockProfileUpdate).toHaveBeenCalledWith({ subscription_status: 'expired' })
  })

  it('handles invoice.payment_failed', async () => {
    mockConstructEvent.mockReturnValue(
      makeEvent('invoice.payment_failed', {
        customer: 'cus_test',
      }),
    )

    const req = createStreamReq('{}')
    const { res, ctx } = mockRes()
    await handler(req, res)

    expect(ctx.statusCode).toBe(200)
    expect(mockProfileUpdate).toHaveBeenCalledWith({ subscription_status: 'expired' })
  })

  it('returns 200 for unhandled event types', async () => {
    mockConstructEvent.mockReturnValue(makeEvent('payment_intent.succeeded', { id: 'pi_test' }))

    const req = createStreamReq('{}')
    const { res, ctx } = mockRes()
    await handler(req, res)

    expect(ctx.statusCode).toBe(200)
    expect(mockProfileUpdate).not.toHaveBeenCalled()
  })

  it('refreshes JWT claims after status update', async () => {
    mockConstructEvent.mockReturnValue(
      makeEvent('customer.subscription.deleted', {
        customer: 'cus_test',
      }),
    )

    const req = createStreamReq('{}')
    const { res } = mockRes()
    await handler(req, res)

    expect(mockUpdateUserById).toHaveBeenCalledWith('user-1', {
      app_metadata: { subscription_status: 'expired' },
    })
  })
})
