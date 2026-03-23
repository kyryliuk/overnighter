import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Mock setup ──────────────────────────────────────────────────────────────

const { mockRequireAdminAuth, mockRpc } = vi.hoisted(() => {
  const mockRequireAdminAuth = vi.fn().mockReturnValue(true)
  const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null })
  return { mockRequireAdminAuth, mockRpc }
})

vi.mock('../_middleware', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}))

vi.mock('../_supabase', () => ({
  createServiceClient: vi.fn(() => ({ rpc: mockRpc })),
}))

import handler from './flagged-pins'

// ── Helpers ─────────────────────────────────────────────────────────────────

function mockReq(method = 'GET'): VercelRequest {
  return { method } as unknown as VercelRequest
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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/admin/flagged-pins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdminAuth.mockReturnValue(true)
    mockRpc.mockResolvedValue({ data: [], error: null })
  })

  it('returns 405 for non-GET methods (7.2)', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST'), res)
    expect(ctx.statusCode).toBe(405)
    expect((ctx.body as { error: string }).error).toBe('METHOD_NOT_ALLOWED')
  })

  it('returns 401 when requireAdminAuth returns false (7.3)', async () => {
    mockRequireAdminAuth.mockImplementationOnce((req: VercelRequest, res: VercelResponse) => {
      res.status(401).json({ error: 'UNAUTHORIZED', status: 401 })
      return false
    })
    const { res, ctx } = mockRes()
    await handler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(401)
    expect((ctx.body as { error: string }).error).toBe('UNAUTHORIZED')
  })

  it('returns 200 with flagged pins data array (7.4)', async () => {
    const pins = [
      { id: 'pin-1', name: 'Spot A', latitude: 37.1, longitude: -107.1, badge_state: 'red', flag_count: 4, latest_report_type: 'dump_closed' },
      { id: 'pin-2', name: 'Spot B', latitude: 38.0, longitude: -108.0, badge_state: 'red', flag_count: 3, latest_report_type: 'no_overnight' },
    ]
    mockRpc.mockResolvedValueOnce({ data: pins, error: null })
    const { res, ctx } = mockRes()
    await handler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual(pins)
  })

  it('returns 500 when rpc returns an error (7.5)', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('DB error') })
    const { res, ctx } = mockRes()
    await handler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(500)
    expect((ctx.body as { error: string }).error).toBe('INTERNAL_ERROR')
  })
})
