import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const {
  mockRequirePremiumAuth,
  mockRpc,
  mockFrom,
} = vi.hoisted(() => {
  const mockRequirePremiumAuth = vi.fn()
  const mockRpc = vi.fn()
  const mockFrom = vi.fn()
  return { mockRequirePremiumAuth, mockRpc, mockFrom }
})

vi.mock('../_auth', () => ({
  requirePremiumAuth: mockRequirePremiumAuth,
}))

vi.mock('../_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}))

import handler from './[id]'

function mockReq(method = 'GET', body: unknown = {}, id = '0f48c8f0-66fb-49de-9b2d-b3efd9a7d835'): VercelRequest {
  return { method, body, query: { id } } as unknown as VercelRequest
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

const DESTINATION = {
  id: 'destination-1',
  name: 'Moab',
  latitude: 38.5733,
  longitude: -109.5498,
}

const WAYPOINT = {
  id: 'waypoint-1',
  name: 'Fruita',
  latitude: 39.1589,
  longitude: -108.7289,
}

const DB_TRIP_ROW = {
  id: '0f48c8f0-66fb-49de-9b2d-b3efd9a7d835',
  user_id: 'user-1',
  title: 'Canyon trip',
  notes: 'Bring snacks',
  status: 'draft',
  origin_snapshot: null,
  destination_snapshot: DESTINATION,
  route_mode: 'corridor',
  stop_count: 2,
  revision: 2,
  is_public: false,
  share_token: null,
  source_trip_id: null,
  source_share_token: null,
  created_at: '2026-03-25T00:00:00.000Z',
  updated_at: '2026-03-25T02:00:00.000Z',
  trip_stops: [
    {
      id: '851af4fc-39f7-4ab4-b2b2-66aff4afdef0',
      trip_id: '0f48c8f0-66fb-49de-9b2d-b3efd9a7d835',
      stop_order: 0,
      stop_kind: 'waypoint',
      source: 'saved',
      pin_id: 'pin-1',
      place_snapshot: WAYPOINT,
      notes: 'quick overnight',
      created_at: '2026-03-25T00:00:00.000Z',
      updated_at: '2026-03-25T01:00:00.000Z',
    },
    {
      id: '2de87903-df8b-4407-b52d-a89df0c87fa2',
      trip_id: '0f48c8f0-66fb-49de-9b2d-b3efd9a7d835',
      stop_order: 1,
      stop_kind: 'destination',
      source: 'manual',
      pin_id: null,
      place_snapshot: DESTINATION,
      notes: '',
      created_at: '2026-03-25T00:00:00.000Z',
      updated_at: '2026-03-25T01:00:00.000Z',
    },
  ],
}

function setGetTripResult(row: unknown | null) {
  mockFrom.mockImplementation((table: string) => {
    if (table !== 'trips') {
      throw new Error(`Unexpected table ${table}`)
    }

    return {
      select: vi.fn(() => ({
        eq: vi.fn((column: string) => {
          if (column !== 'id') {
            throw new Error(`Unexpected eq column ${column}`)
          }

          return {
            eq: vi.fn((nextColumn: string) => {
              if (nextColumn !== 'user_id') {
                throw new Error(`Unexpected nested eq column ${nextColumn}`)
              }

              return {
                maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
              }
            }),
          }
        }),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
              })),
            })),
          })),
        })),
      })),
    }
  })
}

function setDeleteTripResult(row: unknown | null) {
  mockFrom.mockImplementation((table: string) => {
    if (table !== 'trips') {
      throw new Error(`Unexpected table ${table}`)
    }

    return {
      select: vi.fn(() => ({
        eq: vi.fn((column: string) => {
          if (column !== 'id') {
            throw new Error(`Unexpected eq column ${column}`)
          }

          return {
            eq: vi.fn((nextColumn: string) => {
              if (nextColumn !== 'user_id') {
                throw new Error(`Unexpected nested eq column ${nextColumn}`)
              }

              return {
                maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
              }
            }),
          }
        }),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
              })),
            })),
          })),
        })),
      })),
    }
  })
}

describe('/api/trips/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequirePremiumAuth.mockResolvedValue({ id: 'user-1' })
    mockRpc.mockResolvedValue({ data: DB_TRIP_ROW.id, error: null })
    setGetTripResult(DB_TRIP_ROW)
  })

  it('returns 405 for unsupported methods', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST'), res)
    expect(ctx.statusCode).toBe(405)
    expect(ctx.body).toMatchObject({ error: 'METHOD_NOT_ALLOWED' })
  })

  it('returns 404 when the trip does not belong to the current user', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'P0002', message: 'Trip not found' } })
    const { res, ctx } = mockRes()
    await handler(
      mockReq('PATCH', {
        destination: DESTINATION,
        stops: [],
      }),
      res,
    )

    expect(ctx.statusCode).toBe(404)
    expect(ctx.body).toMatchObject({ error: 'NOT_FOUND' })
  })

  it('returns 400 when patch destination is missing', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('PATCH', { stops: [] }), res)

    expect(ctx.statusCode).toBe(400)
    expect(ctx.body).toMatchObject({ error: 'INVALID_BODY' })
  })

  it('returns 200 with canonical trip payload after patch', async () => {
    const { res, ctx } = mockRes()
    await handler(
      mockReq('PATCH', {
        title: 'Updated canyon trip',
        destination: DESTINATION,
        stops: [{ id: '851af4fc-39f7-4ab4-b2b2-66aff4afdef0', stopOrder: 0, source: 'saved', pinId: 'pin-1', place: WAYPOINT }],
      }),
      res,
    )

    expect(ctx.statusCode).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith(
      'upsert_trip_with_stops',
      expect.objectContaining({
        p_trip_id: DB_TRIP_ROW.id,
        p_user_id: 'user-1',
      }),
    )
    expect(ctx.body).toEqual({
      trip: expect.objectContaining({
        revision: 2,
        updatedAt: DB_TRIP_ROW.updated_at,
        stops: [
          expect.objectContaining({ stopOrder: 0, stopKind: 'waypoint' }),
          expect.objectContaining({ stopOrder: 1, stopKind: 'destination' }),
        ],
      }),
    })
  })

  it('returns 200 with archived trip payload on delete', async () => {
    setDeleteTripResult({
      ...DB_TRIP_ROW,
      status: 'archived',
      updated_at: '2026-03-25T03:00:00.000Z',
    })

    const { res, ctx } = mockRes()
    await handler(mockReq('DELETE'), res)

    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual({
      trip: expect.objectContaining({
        status: 'archived',
        updatedAt: '2026-03-25T03:00:00.000Z',
      }),
    })
  })
})
