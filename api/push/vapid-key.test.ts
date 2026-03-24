import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

import handler from './vapid-key'

function mockReq(method = 'GET'): VercelRequest {
  return { method } as unknown as VercelRequest
}

function mockRes() {
  const ctx = { statusCode: null as number | null, body: null as unknown }
  const res = {
    status(code: number) { ctx.statusCode = code; return res },
    json(data: unknown) { ctx.body = data },
  } as unknown as VercelResponse
  return { res, ctx }
}

describe('api/push/vapid-key', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 405 for non-GET methods', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST'), res)
    expect(ctx.statusCode).toBe(405)
    expect(ctx.body).toMatchObject({ error: 'METHOD_NOT_ALLOWED' })
  })

  it('returns 500 when VITE_VAPID_PUBLIC_KEY is missing', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '')
    const { res, ctx } = mockRes()
    await handler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(500)
    expect(ctx.body).toMatchObject({ error: 'CONFIGURATION_ERROR' })
  })

  it('returns 200 with publicKey when env var is set', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'test-public-key-123')
    const { res, ctx } = mockRes()
    await handler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual({ publicKey: 'test-public-key-123' })
  })
})
