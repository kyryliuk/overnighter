import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockSendNotification, mockSetVapidDetails, mockSelectEq, mockDeleteEq } = vi.hoisted(() => {
  const mockSendNotification = vi.fn()
  const mockSetVapidDetails = vi.fn()
  const mockSelectEq = vi.fn()
  const mockDeleteEq = vi.fn()
  return { mockSendNotification, mockSetVapidDetails, mockSelectEq, mockDeleteEq }
})

vi.mock('web-push', () => ({
  sendNotification: mockSendNotification,
  setVapidDetails: mockSetVapidDetails,
}))

vi.mock('../_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: mockSelectEq })),
      delete: vi.fn(() => ({ eq: mockDeleteEq })),
    })),
  })),
}))

import handler from './send'

// ── Helpers ────────────────────────────────────────────────────────────────

function mockReq(method = 'POST', body: unknown = {}, token?: string): VercelRequest {
  return {
    method,
    body,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  } as unknown as VercelRequest
}

function mockRes() {
  const ctx = { statusCode: null as number | null, body: null as unknown }
  const res = {
    status(code: number) { ctx.statusCode = code; return res },
    json(data: unknown) { ctx.body = data },
  } as unknown as VercelResponse
  return { res, ctx }
}

const VALID_BODY = {
  userId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  title: 'New check-in',
  body: 'Someone checked in at your spot',
  url: 'https://overnighter.app/pin/123',
}

const FAKE_SUBS = [
  { id: 'sub-1', user_id: VALID_BODY.userId, endpoint: 'https://push.example.com/1', p256dh: 'key1', auth: 'auth1' },
  { id: 'sub-2', user_id: VALID_BODY.userId, endpoint: 'https://push.example.com/2', p256dh: 'key2', auth: 'auth2' },
]

// ── Tests ──────────────────────────────────────────────────────────────────

describe('api/push/send', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('PUSH_ADMIN_TOKEN', 'admin-secret-token')
    vi.stubEnv('VAPID_PRIVATE_KEY', 'test-private-key')
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'test-public-key')
    vi.stubEnv('VAPID_SUBJECT', 'mailto:admin@overnighter.app')
    mockSelectEq.mockResolvedValue({ data: FAKE_SUBS, error: null })
    mockSendNotification.mockResolvedValue({})
    mockDeleteEq.mockResolvedValue({ error: null })
  })

  it('returns 405 for non-POST methods', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(405)
    expect(ctx.body).toMatchObject({ error: 'METHOD_NOT_ALLOWED' })
  })

  it('returns 401 for missing Bearer token', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(401)
    expect(ctx.body).toMatchObject({ error: 'UNAUTHORIZED' })
  })

  it('returns 401 for wrong Bearer token', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY, 'wrong-token'), res)
    expect(ctx.statusCode).toBe(401)
    expect(ctx.body).toMatchObject({ error: 'UNAUTHORIZED' })
  })

  it('returns 400 for invalid body', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', { title: 'x' }, 'admin-secret-token'), res)
    expect(ctx.statusCode).toBe(400)
    expect(ctx.body).toMatchObject({ error: 'INVALID_BODY' })
  })

  it('returns 500 when VAPID env vars are missing', async () => {
    vi.stubEnv('VAPID_PRIVATE_KEY', '')
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY, 'admin-secret-token'), res)
    expect(ctx.statusCode).toBe(500)
    expect(ctx.body).toMatchObject({ error: 'CONFIGURATION_ERROR' })
  })

  it('returns { sent: 0, failed: 0 } when no subscriptions exist', async () => {
    mockSelectEq.mockResolvedValue({ data: [], error: null })
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY, 'admin-secret-token'), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual({ sent: 0, failed: 0 })
  })

  it('calls webpush.sendNotification for each subscription', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY, 'admin-secret-token'), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual({ sent: 2, failed: 0 })
    expect(mockSendNotification).toHaveBeenCalledTimes(2)
    expect(mockSetVapidDetails).toHaveBeenCalledWith(
      'mailto:admin@overnighter.app',
      'test-public-key',
      'test-private-key',
    )
  })

  it('deletes stale subscriptions on 410 response', async () => {
    mockSendNotification
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ statusCode: 410 })
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY, 'admin-secret-token'), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual({ sent: 1, failed: 1 })
    expect(mockDeleteEq).toHaveBeenCalledWith('endpoint', 'https://push.example.com/2')
  })

  it('deletes stale subscriptions on 404 response', async () => {
    mockSendNotification.mockRejectedValue({ statusCode: 404 })
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY, 'admin-secret-token'), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual({ sent: 0, failed: 2 })
    expect(mockDeleteEq).toHaveBeenCalledTimes(2)
  })

  it('returns correct sent/failed counts on mixed results', async () => {
    mockSendNotification
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('network error'))
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY, 'admin-secret-token'), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual({ sent: 1, failed: 1 })
    // Non-410/404 errors should NOT delete subscriptions
    expect(mockDeleteEq).not.toHaveBeenCalled()
  })
})
