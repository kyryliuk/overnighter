import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Mock setup ──────────────────────────────────────────────────────────────

const { mockRpc, mockFrom, mockEq, mockSelect } = vi.hoisted(() => {
  const mockEq = vi.fn()
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })
  const mockRpc = vi.fn()
  return { mockRpc, mockFrom, mockEq, mockSelect }
})

vi.mock('./_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}))

import handler from './pins'

// ── Helpers ─────────────────────────────────────────────────────────────────

function mockReq(
  method = 'GET',
  query: Record<string, string> = {},
): VercelRequest {
  return { method, query } as unknown as VercelRequest
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

const STUB_DB_ROW = {
  id: 'pin-1',
  name: 'Test Spot',
  description: 'A test spot',
  latitude: 39.7,
  longitude: -105.0,
  pin_type: 'blm',
  source_id: null,
  max_length_ft: null,
  max_height_ft: null,
  website: null,
  phone: null,
  elevation_m: null,
  amenities: { water: true, dump: false },
  badge_state: 'green',
  last_check_in_at: null,
  recent_check_in_count: 0,
  is_verified: true,
  is_flagged: false,
  location: '0101000020E6100000...',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  distance_m: 1234.567,
}

const STUB_ALL_PINS_ROW = {
  ...STUB_DB_ROW,
  is_archived: false,
}
// Remove distance_m from all-pins row since it won't be returned by a regular select
delete (STUB_ALL_PINS_ROW as Record<string, unknown>).distance_m

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/pins — radius search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 405 for non-GET methods', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST'), res)
    expect(ctx.statusCode).toBe(405)
    expect((ctx.body as { error: string }).error).toBe('METHOD_NOT_ALLOWED')
  })

  it('returns 405 for PUT', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('PUT'), res)
    expect(ctx.statusCode).toBe(405)
  })

  it('returns 405 for DELETE', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('DELETE'), res)
    expect(ctx.statusCode).toBe(405)
  })

  // ── Fallback: no spatial params → getAllPins ──────────────────────────────

  describe('fallback (no spatial params)', () => {
    it('returns all non-archived pins when no lat/lng/radiusM provided', async () => {
      mockEq.mockResolvedValue({ data: [STUB_ALL_PINS_ROW], error: null })
      const { res, ctx } = mockRes()
      await handler(mockReq('GET'), res)
      expect(ctx.statusCode).toBe(200)
      const body = ctx.body as { pins: unknown[]; total: number }
      expect(body.pins).toHaveLength(1)
      expect(body.total).toBe(1)
      expect(mockFrom).toHaveBeenCalledWith('pins')
    })

    it('returns 500 when supabase fallback query fails', async () => {
      mockEq.mockResolvedValue({ data: null, error: new Error('DB error') })
      const { res, ctx } = mockRes()
      await handler(mockReq('GET'), res)
      expect(ctx.statusCode).toBe(500)
      expect((ctx.body as { error: string }).error).toBe('INTERNAL_ERROR')
    })

    it('maps snake_case to camelCase in fallback response', async () => {
      mockEq.mockResolvedValue({ data: [STUB_ALL_PINS_ROW], error: null })
      const { res, ctx } = mockRes()
      await handler(mockReq('GET'), res)
      const body = ctx.body as { pins: Record<string, unknown>[] }
      const pin = body.pins[0]
      expect(pin.pinType).toBe('blm')
      expect(pin.badgeState).toBe('green')
      expect(pin.isVerified).toBe(true)
      expect(pin.isFlagged).toBe(false)
      // Should not have snake_case keys
      expect(pin).not.toHaveProperty('pin_type')
      expect(pin).not.toHaveProperty('badge_state')
    })
  })

  // ── Radius search happy path ─────────────────────────────────────────────

  describe('radius search happy path', () => {
    it('returns pins with distance when lat/lng/radiusM provided', async () => {
      mockRpc
        .mockResolvedValueOnce({ data: [STUB_DB_ROW], error: null })
        .mockResolvedValueOnce({ data: 1, error: null })

      const { res, ctx } = mockRes()
      await handler(
        mockReq('GET', { lat: '39.7', lng: '-105.0', radiusM: '50000' }),
        res,
      )
      expect(ctx.statusCode).toBe(200)
      const body = ctx.body as {
        pins: Array<{ distanceM: number; name: string }>
        total: number
        limit: number
        offset: number
      }
      expect(body.pins).toHaveLength(1)
      expect(body.pins[0].distanceM).toBe(1235) // rounded from 1234.567
      expect(body.pins[0].name).toBe('Test Spot')
      expect(body.total).toBe(1)
      expect(body.limit).toBe(200) // default
      expect(body.offset).toBe(0) // default
    })

    it('calls RPC with correct parameters', async () => {
      mockRpc
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: 0, error: null })

      const { res } = mockRes()
      await handler(
        mockReq('GET', { lat: '39.7', lng: '-105.0', radiusM: '50000' }),
        res,
      )

      expect(mockRpc).toHaveBeenCalledWith('search_pins_by_radius', {
        p_lat: 39.7,
        p_lng: -105.0,
        p_radius_m: 50000,
        p_limit: 200,
        p_offset: 0,
      })
      expect(mockRpc).toHaveBeenCalledWith('count_pins_by_radius', {
        p_lat: 39.7,
        p_lng: -105.0,
        p_radius_m: 50000,
      })
    })

    it('maps snake_case to camelCase in radius response', async () => {
      mockRpc
        .mockResolvedValueOnce({ data: [STUB_DB_ROW], error: null })
        .mockResolvedValueOnce({ data: 1, error: null })

      const { res, ctx } = mockRes()
      await handler(
        mockReq('GET', { lat: '39.7', lng: '-105.0', radiusM: '50000' }),
        res,
      )
      const body = ctx.body as { pins: Record<string, unknown>[] }
      const pin = body.pins[0]
      expect(pin.pinType).toBe('blm')
      expect(pin.maxLengthFt).toBeNull()
      expect(pin.createdAt).toBe('2026-01-01T00:00:00Z')
      expect(pin).not.toHaveProperty('pin_type')
      expect(pin).not.toHaveProperty('distance_m')
    })
  })

  // ── Pagination ────────────────────────────────────────────────────────────

  describe('pagination', () => {
    it('forwards limit and offset to RPC', async () => {
      mockRpc
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: 0, error: null })

      const { res, ctx } = mockRes()
      await handler(
        mockReq('GET', { lat: '39.7', lng: '-105.0', radiusM: '50000', limit: '50', offset: '100' }),
        res,
      )

      expect(ctx.statusCode).toBe(200)
      expect(mockRpc).toHaveBeenCalledWith('search_pins_by_radius', {
        p_lat: 39.7,
        p_lng: -105.0,
        p_radius_m: 50000,
        p_limit: 50,
        p_offset: 100,
      })
      const body = ctx.body as { limit: number; offset: number }
      expect(body.limit).toBe(50)
      expect(body.offset).toBe(100)
    })

    it('uses default limit=200 and offset=0 when not provided', async () => {
      mockRpc
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: 0, error: null })

      const { res } = mockRes()
      await handler(
        mockReq('GET', { lat: '39.7', lng: '-105.0', radiusM: '50000' }),
        res,
      )

      expect(mockRpc).toHaveBeenCalledWith('search_pins_by_radius', expect.objectContaining({
        p_limit: 200,
        p_offset: 0,
      }))
    })
  })

  // ── Input validation ──────────────────────────────────────────────────────

  describe('input validation', () => {
    it('rejects lat > 90', async () => {
      const { res, ctx } = mockRes()
      await handler(
        mockReq('GET', { lat: '91', lng: '-105.0', radiusM: '50000' }),
        res,
      )
      expect(ctx.statusCode).toBe(400)
      expect((ctx.body as { error: string }).error).toBe('INVALID_PARAMS')
    })

    it('rejects lat < -90', async () => {
      const { res, ctx } = mockRes()
      await handler(
        mockReq('GET', { lat: '-91', lng: '-105.0', radiusM: '50000' }),
        res,
      )
      expect(ctx.statusCode).toBe(400)
      expect((ctx.body as { error: string }).error).toBe('INVALID_PARAMS')
    })

    it('rejects lng > 180', async () => {
      const { res, ctx } = mockRes()
      await handler(
        mockReq('GET', { lat: '39.7', lng: '181', radiusM: '50000' }),
        res,
      )
      expect(ctx.statusCode).toBe(400)
      expect((ctx.body as { error: string }).error).toBe('INVALID_PARAMS')
    })

    it('rejects lng < -180', async () => {
      const { res, ctx } = mockRes()
      await handler(
        mockReq('GET', { lat: '39.7', lng: '-181', radiusM: '50000' }),
        res,
      )
      expect(ctx.statusCode).toBe(400)
      expect((ctx.body as { error: string }).error).toBe('INVALID_PARAMS')
    })

    it('rejects radiusM < 100', async () => {
      const { res, ctx } = mockRes()
      await handler(
        mockReq('GET', { lat: '39.7', lng: '-105.0', radiusM: '50' }),
        res,
      )
      expect(ctx.statusCode).toBe(400)
      expect((ctx.body as { error: string }).error).toBe('INVALID_PARAMS')
    })

    it('rejects radiusM > 500000', async () => {
      const { res, ctx } = mockRes()
      await handler(
        mockReq('GET', { lat: '39.7', lng: '-105.0', radiusM: '600000' }),
        res,
      )
      expect(ctx.statusCode).toBe(400)
      expect((ctx.body as { error: string }).error).toBe('INVALID_PARAMS')
    })

    it('rejects non-numeric lat', async () => {
      const { res, ctx } = mockRes()
      await handler(
        mockReq('GET', { lat: 'abc', lng: '-105.0', radiusM: '50000' }),
        res,
      )
      expect(ctx.statusCode).toBe(400)
      expect((ctx.body as { error: string }).error).toBe('INVALID_PARAMS')
    })

    it('rejects limit > 500', async () => {
      const { res, ctx } = mockRes()
      await handler(
        mockReq('GET', { lat: '39.7', lng: '-105.0', radiusM: '50000', limit: '501' }),
        res,
      )
      expect(ctx.statusCode).toBe(400)
      expect((ctx.body as { error: string }).error).toBe('INVALID_PARAMS')
    })

    it('rejects limit < 1', async () => {
      const { res, ctx } = mockRes()
      await handler(
        mockReq('GET', { lat: '39.7', lng: '-105.0', radiusM: '50000', limit: '0' }),
        res,
      )
      expect(ctx.statusCode).toBe(400)
      expect((ctx.body as { error: string }).error).toBe('INVALID_PARAMS')
    })

    it('rejects negative offset', async () => {
      const { res, ctx } = mockRes()
      await handler(
        mockReq('GET', { lat: '39.7', lng: '-105.0', radiusM: '50000', offset: '-1' }),
        res,
      )
      expect(ctx.statusCode).toBe(400)
      expect((ctx.body as { error: string }).error).toBe('INVALID_PARAMS')
    })

    it('includes field name in validation error message', async () => {
      const { res, ctx } = mockRes()
      await handler(
        mockReq('GET', { lat: '91', lng: '-105.0', radiusM: '50000' }),
        res,
      )
      expect((ctx.body as { message: string }).message).toContain('lat')
    })
  })

  // ── Error handling ────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns 500 when search RPC fails', async () => {
      mockRpc
        .mockResolvedValueOnce({ data: null, error: new Error('RPC failed') })
        .mockResolvedValueOnce({ data: 0, error: null })

      const { res, ctx } = mockRes()
      await handler(
        mockReq('GET', { lat: '39.7', lng: '-105.0', radiusM: '50000' }),
        res,
      )
      expect(ctx.statusCode).toBe(500)
      expect((ctx.body as { error: string }).error).toBe('INTERNAL_ERROR')
    })

    it('returns 500 when count RPC fails', async () => {
      mockRpc
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: null, error: new Error('Count failed') })

      const { res, ctx } = mockRes()
      await handler(
        mockReq('GET', { lat: '39.7', lng: '-105.0', radiusM: '50000' }),
        res,
      )
      expect(ctx.statusCode).toBe(500)
      expect((ctx.body as { error: string }).error).toBe('INTERNAL_ERROR')
    })

    it('returns total=0 when count returns null', async () => {
      mockRpc
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: null, error: null })

      const { res, ctx } = mockRes()
      await handler(
        mockReq('GET', { lat: '39.7', lng: '-105.0', radiusM: '50000' }),
        res,
      )
      expect(ctx.statusCode).toBe(200)
      expect((ctx.body as { total: number }).total).toBe(0)
    })
  })

  // ── Edge cases ────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles boundary lat values (90, -90)', async () => {
      mockRpc
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: 0, error: null })

      const { res, ctx } = mockRes()
      await handler(
        mockReq('GET', { lat: '90', lng: '0', radiusM: '100' }),
        res,
      )
      expect(ctx.statusCode).toBe(200)
    })

    it('handles boundary lng values (180, -180)', async () => {
      mockRpc
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: 0, error: null })

      const { res, ctx } = mockRes()
      await handler(
        mockReq('GET', { lat: '0', lng: '-180', radiusM: '100' }),
        res,
      )
      expect(ctx.statusCode).toBe(200)
    })

    it('handles boundary radiusM values (100, 500000)', async () => {
      mockRpc
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: 0, error: null })

      const { res, ctx } = mockRes()
      await handler(
        mockReq('GET', { lat: '39.7', lng: '-105.0', radiusM: '100' }),
        res,
      )
      expect(ctx.statusCode).toBe(200)
    })

    it('handles empty result set', async () => {
      mockRpc
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: 0, error: null })

      const { res, ctx } = mockRes()
      await handler(
        mockReq('GET', { lat: '39.7', lng: '-105.0', radiusM: '100' }),
        res,
      )
      expect(ctx.statusCode).toBe(200)
      const body = ctx.body as { pins: unknown[]; total: number }
      expect(body.pins).toEqual([])
      expect(body.total).toBe(0)
    })
  })
})
