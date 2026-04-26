import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const {
  mockParseTapSubmitForm,
  mockClassifyImageUrl,
  mockStorageUpload,
  mockStorageGetPublicUrl,
  mockInsertSingle,
  mockInsertResult,
  mockEventInsert,
} = vi.hoisted(() => {
  // Storage mock chain
  const mockStorageUpload = vi.fn().mockResolvedValue({ error: null })
  const mockStorageGetPublicUrl = vi.fn().mockReturnValue({
    data: { publicUrl: 'https://supabase.test/storage/v1/object/public/tap-photos/uuid/ts.jpg' },
  })

  // Insert with .select().single() chain
  const mockInsertSingle = vi.fn().mockResolvedValue({ data: { id: 'new-pin-uuid' }, error: null })
  const mockInsertSelect = vi.fn().mockReturnValue({ single: mockInsertSingle })
  const mockInsertResult = vi.fn().mockReturnValue({ select: mockInsertSelect })

  // Event insert
  const mockEventInsert = vi.fn().mockResolvedValue({ error: null })

  // Multipart parser
  const mockParseTapSubmitForm = vi.fn()

  // SageMaker
  const mockClassifyImageUrl = vi.fn().mockResolvedValue({ confidence: 0.85 })

  return {
    mockParseTapSubmitForm,
    mockClassifyImageUrl,
    mockStorageUpload,
    mockStorageGetPublicUrl,
    mockInsertSingle,
    mockInsertResult,
    mockEventInsert,
  }
})

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('./_multipart', () => ({
  parseTapSubmitForm: (...args: unknown[]) => mockParseTapSubmitForm(...args),
}))

vi.mock('./_sagemaker', () => ({
  classifyImageUrl: (...args: unknown[]) => mockClassifyImageUrl(...args),
}))

// Track per-table from() calls
vi.mock('./_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: mockStorageUpload,
        getPublicUrl: mockStorageGetPublicUrl,
      })),
    },
    from: vi.fn((table: string) => {
      if (table === 'water_tap_pins') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              // .select().eq('is_active', true).limit(1000)
              limit: vi.fn().mockImplementation(() =>
                Promise.resolve({ data: _activePinsData, error: _activePinsError }),
              ),
            }),
          }),
          insert: mockInsertResult,
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: _updateError }),
          }),
        }
      }
      // tap_verification_events
      return {
        insert: (...args: unknown[]) => mockEventInsert(...args),
      }
    }),
  })),
}))

// Mutable state for per-test overrides
let _activePinsData: unknown[] = []
let _activePinsError: unknown = null
let _updateError: unknown = null

import handler, { haversineDistance } from './tap-submit'

// ── Test helpers ──────────────────────────────────────────────────────────────

function mockReq(method = 'POST', body: unknown = {}): VercelRequest {
  return { method, body } as unknown as VercelRequest
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

const VALID_FORM = {
  photoBuffer: Buffer.from('fake-image-data'),
  mimeType: 'image/jpeg',
  sizeBytes: 1024,
  originalFilename: 'tap.jpg',
  location: [25.123, -80.456] as [number, number],
  deviceId: 'device-abc-123',
}

// ── haversineDistance unit tests ──────────────────────────────────────────────

describe('haversineDistance', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineDistance(25.0, -80.0, 25.0, -80.0)).toBe(0)
  })

  it('returns approximately 111320m for 1 degree latitude difference', () => {
    const dist = haversineDistance(0, 0, 1, 0)
    expect(dist).toBeGreaterThan(111_000)
    expect(dist).toBeLessThan(112_000)
  })

  it('returns < 50m for two points 40m apart', () => {
    // ~0.00036 degrees ≈ 40m at equator
    const dist = haversineDistance(0, 0, 0.00036, 0)
    expect(dist).toBeLessThan(50)
  })

  it('returns > 50m for two points 60m apart', () => {
    // ~0.00054 degrees ≈ 60m at equator
    const dist = haversineDistance(0, 0, 0.00054, 0)
    expect(dist).toBeGreaterThan(50)
  })
})

// ── tap-submit handler tests ──────────────────────────────────────────────────

describe('api/tap-submit handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockParseTapSubmitForm.mockResolvedValue(VALID_FORM)
    mockClassifyImageUrl.mockResolvedValue({ confidence: 0.85 })
    mockStorageUpload.mockResolvedValue({ error: null })
    mockInsertSingle.mockResolvedValue({ data: { id: 'new-pin-uuid' }, error: null })
    mockEventInsert.mockResolvedValue({ error: null })
    _activePinsData = []
    _activePinsError = null
    _updateError = null
    process.env.VITE_SUPABASE_URL = 'https://supabase.test'
  })

  // AC 1: method guard
  it('returns 405 for non-POST methods (AC 1)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(405)
    expect(ctx.body).toMatchObject({ error: 'METHOD_NOT_ALLOWED' })
  })

  it('returns 405 for DELETE method (AC 1)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('DELETE'), res)
    expect(ctx.statusCode).toBe(405)
  })

  // AC 2: file validation
  it('returns 400 when file size exceeds 5MB (AC 2)', async () => {
    mockParseTapSubmitForm.mockResolvedValue({
      ...VALID_FORM,
      sizeBytes: 6 * 1024 * 1024, // 6 MB
    })
    const { res, ctx } = mockRes()
    await handler(mockReq(), res)
    expect(ctx.statusCode).toBe(400)
    expect(ctx.body).toMatchObject({ error: 'INVALID_FILE' })
    expect((ctx.body as { message: string }).message).toContain('5MB')
  })

  it('returns 400 when MIME type is not image/* (AC 2)', async () => {
    mockParseTapSubmitForm.mockResolvedValue({
      ...VALID_FORM,
      mimeType: 'application/pdf',
    })
    const { res, ctx } = mockRes()
    await handler(mockReq(), res)
    expect(ctx.statusCode).toBe(400)
    expect(ctx.body).toMatchObject({ error: 'INVALID_FILE' })
    expect((ctx.body as { message: string }).message).toContain('image/*')
  })

  it('returns 400 when multipart parse fails (AC 1)', async () => {
    mockParseTapSubmitForm.mockRejectedValue(new Error('parse error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { res, ctx } = mockRes()
    await handler(mockReq(), res)
    expect(ctx.statusCode).toBe(400)
    expect(ctx.body).toMatchObject({ error: 'INVALID_BODY' })
    consoleSpy.mockRestore()
  })

  // AC 3 & 4: storage upload + classifier call
  it('returns 500 when Supabase storage upload fails (AC 3)', async () => {
    mockStorageUpload.mockResolvedValue({ error: new Error('storage error') })
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { res, ctx } = mockRes()
    await handler(mockReq(), res)
    expect(ctx.statusCode).toBe(500)
    expect(ctx.body).toMatchObject({ error: 'INTERNAL_ERROR' })
    consoleSpy.mockRestore()
  })

  it('returns 500 when SageMaker classifyImageUrl throws (AC 4)', async () => {
    mockClassifyImageUrl.mockRejectedValue(new Error('sagemaker error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { res, ctx } = mockRes()
    await handler(mockReq(), res)
    expect(ctx.statusCode).toBe(500)
    expect(ctx.body).toMatchObject({ error: 'INTERNAL_ERROR' })
    expect((ctx.body as { message: string }).message).toContain('classify')
    consoleSpy.mockRestore()
  })

  // AC 6: below threshold
  it('returns below_threshold when confidence < 0.75 — no DB writes (AC 6)', async () => {
    mockClassifyImageUrl.mockResolvedValue({ confidence: 0.5 })
    const { res, ctx } = mockRes()
    await handler(mockReq(), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toMatchObject({ pinId: null, confidence: 0.5, status: 'below_threshold' })
    // No DB writes: insert and event insert should not have been called
    expect(mockInsertResult).not.toHaveBeenCalled()
    expect(mockEventInsert).not.toHaveBeenCalled()
  })

  it('returns below_threshold at exactly 0.749 confidence (AC 6 boundary)', async () => {
    mockClassifyImageUrl.mockResolvedValue({ confidence: 0.749 })
    const { res, ctx } = mockRes()
    await handler(mockReq(), res)
    expect(ctx.body).toMatchObject({ status: 'below_threshold' })
  })

  // AC 5: created status (no nearby pin)
  it('returns created status when confidence ≥ 0.75 and no nearby pin (AC 5)', async () => {
    _activePinsData = [] // no pins in DB
    mockClassifyImageUrl.mockResolvedValue({ confidence: 0.85 })
    const { res, ctx } = mockRes()
    await handler(mockReq(), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toMatchObject({ status: 'created', confidence: 0.85 })
    expect((ctx.body as { pinId: string }).pinId).toBeTruthy()
  })

  // AC 5: confirmed status (nearby pin found)
  it('returns confirmed status when nearby pin within 50m exists (AC 5)', async () => {
    // Pin at the same location as the submitted photo
    _activePinsData = [
      {
        id: 'existing-pin-uuid',
        photos: ['https://cdn.example.com/old-photo.jpg'],
        location: { type: 'Point', coordinates: [-80.456, 25.123] }, // same as VALID_FORM.location
      },
    ]
    mockClassifyImageUrl.mockResolvedValue({ confidence: 0.9 })
    const { res, ctx } = mockRes()
    await handler(mockReq(), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toMatchObject({
      pinId: 'existing-pin-uuid',
      status: 'confirmed',
      confidence: 0.9,
    })
  })

  it('creates new pin when nearest pin is > 50m away (AC 5)', async () => {
    // Pin very far away (~1km)
    _activePinsData = [
      {
        id: 'far-pin-uuid',
        photos: [],
        location: { type: 'Point', coordinates: [-80.456, 25.133] }, // ~1.1km north
      },
    ]
    mockClassifyImageUrl.mockResolvedValue({ confidence: 0.8 })
    const { res, ctx } = mockRes()
    await handler(mockReq(), res)
    expect(ctx.body).toMatchObject({ status: 'created' })
  })

  // AC 9: no auth required — public endpoint
  it('processes request without Authorization header (AC 9)', async () => {
    const req = { method: 'POST', headers: {}, body: {} } as unknown as VercelRequest
    const { res, ctx } = mockRes()
    await handler(req, res)
    // Should not return 401/403
    expect(ctx.statusCode).not.toBe(401)
    expect(ctx.statusCode).not.toBe(403)
  })

  // AC 10: NFR-S4 deviceId sanitization
  it('NFR-S4: strips HTML from deviceId before storage (AC 10)', async () => {
    const maliciousDeviceId = '<script>alert("xss")</script>device-123'
    mockParseTapSubmitForm.mockResolvedValue({
      ...VALID_FORM,
      deviceId: maliciousDeviceId,
    })
    mockClassifyImageUrl.mockResolvedValue({ confidence: 0.85 })
    // Capture what gets inserted into tap_verification_events
    let capturedInsertArgs: unknown[] = []
    mockEventInsert.mockImplementation((...args: unknown[]) => {
      capturedInsertArgs = args
      return Promise.resolve({ error: null })
    })
    _activePinsData = []

    const { res, ctx } = mockRes()
    await handler(mockReq(), res)
    expect(ctx.statusCode).toBe(200)
    // The inserted device_id must not contain HTML tags
    const insertedRow = capturedInsertArgs[0] as { device_id: string }
    expect(insertedRow?.device_id).not.toMatch(/</)
    expect(insertedRow?.device_id).not.toMatch(/>/)
    expect(insertedRow?.device_id).toContain('device-123')
  })

  // Storage path pattern (AC 3)
  it('uploads photo to tap-photos bucket with correct path pattern (AC 3)', async () => {
    _activePinsData = []
    const { res, ctx } = mockRes()
    await handler(mockReq(), res)
    expect(ctx.statusCode).toBe(200)
    // Verify upload was called with the correct bucket structure
    expect(mockStorageUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f-]{36}\/\d+\.jpg$/),
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'image/jpeg' }),
    )
  })
})
