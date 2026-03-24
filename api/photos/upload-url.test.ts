import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockRequireUserAuth, mockCreateSignedUploadUrl } = vi.hoisted(() => {
  const mockRequireUserAuth = vi.fn()
  const mockCreateSignedUploadUrl = vi.fn()
  return { mockRequireUserAuth, mockCreateSignedUploadUrl }
})

vi.mock('../_auth', () => ({
  requireUserAuth: mockRequireUserAuth,
}))

vi.mock('../_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        createSignedUploadUrl: mockCreateSignedUploadUrl,
      })),
    },
  })),
}))

import handler from './upload-url'

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

const VALID_BODY = {
  pinId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  checkInId: 'a47ac10b-58cc-4372-a567-0e02b2c3d479',
  fileType: 'image/jpeg',
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('api/photos/upload-url handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
    mockRequireUserAuth.mockResolvedValue({ id: 'user-123', email: 'test@test.com' })
    mockCreateSignedUploadUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.supabase.co/signed-upload-url' },
      error: null,
    })
  })

  it('returns 405 for GET method', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(405)
    expect(ctx.body).toMatchObject({ error: 'METHOD_NOT_ALLOWED' })
  })

  it('returns 405 for PUT method', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('PUT'), res)
    expect(ctx.statusCode).toBe(405)
    expect(ctx.body).toMatchObject({ error: 'METHOD_NOT_ALLOWED' })
  })

  it('returns 405 for DELETE method', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('DELETE'), res)
    expect(ctx.statusCode).toBe(405)
    expect(ctx.body).toMatchObject({ error: 'METHOD_NOT_ALLOWED' })
  })

  it('returns 401 when requireUserAuth returns null', async () => {
    mockRequireUserAuth.mockImplementation((_req: VercelRequest, res: VercelResponse) => {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing authenticated user token', status: 401 })
      return null
    })
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(401)
    expect(ctx.body).toMatchObject({ error: 'UNAUTHORIZED' })
  })

  it('returns 400 for missing pinId', async () => {
    const { res, ctx } = mockRes()
    const { pinId, ...noPinId } = VALID_BODY
    void pinId
    await handler(mockReq('POST', noPinId), res)
    expect(ctx.statusCode).toBe(400)
    expect(ctx.body).toMatchObject({ error: 'INVALID_BODY' })
  })

  it('returns 400 for missing checkInId', async () => {
    const { res, ctx } = mockRes()
    const { checkInId, ...noCheckInId } = VALID_BODY
    void checkInId
    await handler(mockReq('POST', noCheckInId), res)
    expect(ctx.statusCode).toBe(400)
    expect(ctx.body).toMatchObject({ error: 'INVALID_BODY' })
  })

  it('returns 400 for missing fileType', async () => {
    const { res, ctx } = mockRes()
    const { fileType, ...noFileType } = VALID_BODY
    void fileType
    await handler(mockReq('POST', noFileType), res)
    expect(ctx.statusCode).toBe(400)
    expect(ctx.body).toMatchObject({ error: 'INVALID_BODY' })
  })

  it('returns 400 for invalid fileType (image/gif)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', { ...VALID_BODY, fileType: 'image/gif' }), res)
    expect(ctx.statusCode).toBe(400)
    expect(ctx.body).toMatchObject({ error: 'INVALID_BODY' })
  })

  it('returns 400 for non-UUID pinId', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', { ...VALID_BODY, pinId: 'not-a-uuid' }), res)
    expect(ctx.statusCode).toBe(400)
    expect(ctx.body).toMatchObject({ error: 'INVALID_BODY' })
  })

  it('returns 400 for non-UUID checkInId', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', { ...VALID_BODY, checkInId: 'not-a-uuid' }), res)
    expect(ctx.statusCode).toBe(400)
    expect(ctx.body).toMatchObject({ error: 'INVALID_BODY' })
  })

  it('returns 200 with uploadUrl, cdnUrl, storagePath on valid request', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(200)
    const body = ctx.body as { uploadUrl: string; cdnUrl: string; storagePath: string }
    expect(body.uploadUrl).toBe('https://storage.supabase.co/signed-upload-url')
    expect(body.cdnUrl).toContain('pin-photos/')
    expect(body.storagePath).toMatch(new RegExp(`^${VALID_BODY.pinId}/${VALID_BODY.checkInId}/`))
  })

  it('storagePath follows pattern {pinId}/{checkInId}/{uuid}.{ext}', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    const body = ctx.body as { storagePath: string }
    expect(body.storagePath).toMatch(
      /^[0-9a-f-]+\/[0-9a-f-]+\/[0-9a-f-]+\.jpg$/,
    )
  })

  it('storagePath uses png ext for image/png', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', { ...VALID_BODY, fileType: 'image/png' }), res)
    const body = ctx.body as { storagePath: string }
    expect(body.storagePath).toMatch(/\.png$/)
  })

  it('cdnUrl includes the bucket name and storage path', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    const body = ctx.body as { cdnUrl: string; storagePath: string }
    expect(body.cdnUrl).toBe(`https://test.supabase.co/storage/v1/object/public/pin-photos/${body.storagePath}`)
  })

  it('returns 500 on Supabase Storage error', async () => {
    mockCreateSignedUploadUrl.mockResolvedValue({
      data: null,
      error: new Error('Storage bucket not found'),
    })
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(500)
    expect(ctx.body).toMatchObject({ error: 'INTERNAL_ERROR' })
    consoleSpy.mockRestore()
  })
})
