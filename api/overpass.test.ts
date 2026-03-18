import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockSingle, mockEq, mockSelect, mockUpsert } = vi.hoisted(() => {
  const mockSingle = vi.fn().mockResolvedValue({ data: null })
  const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
  const mockUpsert = vi.fn().mockResolvedValue({ error: null })
  return { mockSingle, mockEq, mockSelect, mockUpsert }
})

vi.mock('./_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({ select: mockSelect, upsert: mockUpsert })),
  })),
}))

vi.stubGlobal('fetch', vi.fn())

import handler from './overpass'

// ── Helpers ─────────────────────────────────────────────────────────────────

function mockReq(
  method = 'GET',
  query: Record<string, string> = {}
): VercelRequest {
  return { method, query } as unknown as VercelRequest
}

function mockRes() {
  const ctx = { statusCode: null as number | null, body: null as unknown }
  const res = {
    status(code: number) { ctx.statusCode = code; return res },
    json(data: unknown) { ctx.body = data },
  } as unknown as VercelResponse
  return { res, ctx }
}

const VALID_BBOX = '37.0,-108.0,38.0,-107.0'
const STUB_PAYLOAD = { elements: [{ type: 'node', id: 1, lat: 37.5, lon: -107.5 }] }

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/overpass', () => {
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    vi.clearAllMocks()
    // Reset default mock implementations after clearAllMocks
    mockSingle.mockResolvedValue({ data: null })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockUpsert.mockResolvedValue({ error: null })
  })

  afterEach(() => {
    delete process.env.VITE_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  })

  it('returns 405 for non-GET requests', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST'), res)
    expect(ctx.statusCode).toBe(405)
    expect((ctx.body as { error: string }).error).toBe('METHOD_NOT_ALLOWED')
  })

  it('returns 400 when bbox param is missing', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('GET', {}), res)
    expect(ctx.statusCode).toBe(400)
    expect((ctx.body as { error: string }).error).toBe('MISSING_BBOX')
  })

  it('returns 400 when bbox has fewer than 4 parts', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('GET', { bbox: '37.0,-108.0' }), res)
    expect(ctx.statusCode).toBe(400)
    expect((ctx.body as { error: string }).error).toBe('INVALID_BBOX')
  })

  it('returns 400 when bbox contains non-numeric values', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('GET', { bbox: '37.0,abc,38.0,-107.0' }), res)
    expect(ctx.statusCode).toBe(400)
    expect((ctx.body as { error: string }).error).toBe('INVALID_BBOX')
  })

  it('returns cached payload when cache is fresh (< 24h)', async () => {
    const cachedAt = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() // 1h ago
    mockSingle.mockResolvedValue({ data: { payload: STUB_PAYLOAD, cached_at: cachedAt } })

    const { res, ctx } = mockRes()
    await handler(mockReq('GET', { bbox: VALID_BBOX }), res)

    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual(STUB_PAYLOAD)
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('fetches from Overpass and caches on cache miss', async () => {
    mockSingle.mockResolvedValue({ data: null }) // cache miss

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => STUB_PAYLOAD,
    } as Response)

    const { res, ctx } = mockRes()
    await handler(mockReq('GET', { bbox: VALID_BBOX }), res)

    expect(vi.mocked(fetch)).toHaveBeenCalledOnce()
    expect(mockUpsert).toHaveBeenCalledOnce()
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual(STUB_PAYLOAD)
  })

  it('fetches from Overpass when cache is stale (> 24h)', async () => {
    const cachedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() // 25h ago
    mockSingle.mockResolvedValue({ data: { payload: { elements: [] }, cached_at: cachedAt } })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => STUB_PAYLOAD,
    } as Response)

    const { res, ctx } = mockRes()
    await handler(mockReq('GET', { bbox: VALID_BBOX }), res)

    expect(vi.mocked(fetch)).toHaveBeenCalledOnce()
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual(STUB_PAYLOAD)
  })

  it('returns 500 when Overpass fetch fails', async () => {
    mockSingle.mockResolvedValue({ data: null })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Too Many Requests',
    } as Response)

    const { res, ctx } = mockRes()
    await handler(mockReq('GET', { bbox: VALID_BBOX }), res)

    expect(ctx.statusCode).toBe(500)
    expect((ctx.body as { error: string }).error).toBe('INTERNAL_ERROR')
  })
})
