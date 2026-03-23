import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Mocks ──────────────────────────────────────────────────────────────────

// Mock _supabase to avoid real Supabase client creation
const { mockUpsert, mockUpdate, mockLt, mockEq } = vi.hoisted(() => {
  const mockEq = vi.fn().mockResolvedValue({ error: null })
  const mockLt = vi.fn().mockReturnValue({ eq: mockEq })
  const mockUpdate = vi.fn().mockReturnValue({ lt: mockLt })
  const mockUpsert = vi.fn().mockResolvedValue({ error: null })
  return { mockUpsert, mockUpdate, mockLt, mockEq }
})

vi.mock('./_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({ upsert: mockUpsert, update: mockUpdate })),
  })),
}))

vi.stubGlobal('fetch', vi.fn())

import handler from './sync-gov'

// ── Helpers ────────────────────────────────────────────────────────────────

const SECRET = 'test-admin-secret'

function mockReq(
  method = 'POST',
  extra: { authorization?: string } = { authorization: `Bearer ${SECRET}` }
): VercelRequest {
  return { method, headers: extra } as unknown as VercelRequest
}

function mockRes() {
  const ctx = { statusCode: null as number | null, body: null as unknown }
  const res = {
    status(code: number) { ctx.statusCode = code; return res },
    json(data: unknown) { ctx.body = data },
  } as unknown as VercelResponse
  return { res, ctx }
}

function ridbPage(count: number, currentCount = count) {
  const RECDATA = Array.from({ length: count }, (_, i) => ({
    FacilityID: `F${i}`,
    FacilityName: `Camp ${i}`,
    FacilityLatitude: 37.5 + i * 0.01,
    FacilityLongitude: -107.5,
    ParentOrgID: '128', // USFS
    ACTIVITY: [{ ActivityName: 'Camping' }],
  }))
  return {
    RECDATA,
    METADATA: { RESULTS: { CURRENT_COUNT: currentCount, TOTAL_COUNT: count } },
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/sync', () => {
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    process.env.ADMIN_SECRET = SECRET
    process.env.RIDB_API_KEY = 'ridb-key'
    vi.clearAllMocks()
    mockEq.mockResolvedValue({ error: null })
    mockLt.mockReturnValue({ eq: mockEq })
    mockUpdate.mockReturnValue({ lt: mockLt })
    mockUpsert.mockResolvedValue({ error: null })
  })

  afterEach(() => {
    delete process.env.VITE_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.ADMIN_SECRET
    delete process.env.RIDB_API_KEY
  })

  it('returns 405 for non-POST requests', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(405)
    expect((ctx.body as { error: string }).error).toBe('METHOD_NOT_ALLOWED')
  })

  it('returns 401 when Authorization header is missing', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', {}), res)
    expect(ctx.statusCode).toBe(401)
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('returns 401 when Bearer token is wrong', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', { authorization: 'Bearer wrong-token' }), res)
    expect(ctx.statusCode).toBe(401)
  })

  it('fetches one page, upserts normalized rows, returns synced count', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ridbPage(3),
    } as Response)

    const { res, ctx } = mockRes()
    await handler(mockReq(), res)

    expect(vi.mocked(fetch)).toHaveBeenCalledOnce()
    expect(mockUpsert).toHaveBeenCalledOnce()
    expect(ctx.statusCode).toBe(200)
    expect((ctx.body as { synced: number }).synced).toBe(3)
  })

  it('upsert rows preserve publish fields and include updated_at (AC2/H2/H3)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ridbPage(1),
    } as Response)

    const { res } = mockRes()
    await handler(mockReq(), res)

    const upsertArg = mockUpsert.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(upsertArg[0]).toHaveProperty('badge_state')
    expect(upsertArg[0]).not.toHaveProperty('last_check_in_at')
    expect(upsertArg[0]).not.toHaveProperty('recent_check_in_count')
    expect(upsertArg[0]).toHaveProperty('is_verified')
    expect(upsertArg[0]).not.toHaveProperty('is_flagged')
    expect(upsertArg[0]).toHaveProperty('updated_at')
    expect(typeof upsertArg[0].updated_at).toBe('string')
  })

  it('calls stale-pin update after sync (AC2 — NFR-I1)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ridbPage(1),
    } as Response)

    const { res } = mockRes()
    const before = Date.now()
    await handler(mockReq(), res)
    const after = Date.now()

    expect(mockUpdate).toHaveBeenCalledWith({ badge_state: 'red' })
    expect(mockLt).toHaveBeenCalledOnce()
    const cutoffArg = mockLt.mock.calls[0][1] as string
    const cutoffMs = new Date(cutoffArg).getTime()
    const expectedCutoff48h = before - 48 * 60 * 60 * 1000
    expect(cutoffMs).toBeGreaterThanOrEqual(expectedCutoff48h - 100)
    expect(cutoffMs).toBeLessThanOrEqual(after - 48 * 60 * 60 * 1000 + 100)
    expect(mockEq).toHaveBeenCalledWith('badge_state', 'grey')
  })

  it('paginates when CURRENT_COUNT equals PAGE_SIZE (50)', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ridbPage(50, 50), // full page — will fetch next
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ridbPage(10, 10), // last page
      } as Response)

    const { res, ctx } = mockRes()
    await handler(mockReq(), res)

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)
    expect((ctx.body as { synced: number }).synced).toBe(60)
  })

  it('returns 500 when RIDB fetch fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable',
    } as Response)

    const { res, ctx } = mockRes()
    await handler(mockReq(), res)

    expect(ctx.statusCode).toBe(500)
    expect((ctx.body as { error: string }).error).toBe('INTERNAL_ERROR')
  })

  it('returns 500 when Supabase upsert fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ridbPage(1),
    } as Response)
    mockUpsert.mockResolvedValueOnce({ error: { message: 'constraint violation' } })

    const { res, ctx } = mockRes()
    await handler(mockReq(), res)

    expect(ctx.statusCode).toBe(500)
  })
})
