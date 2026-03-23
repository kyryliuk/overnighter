import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const { mockRequireUserAuth, mockOrder, mockInsert, mockSingle } = vi.hoisted(() => {
  const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'submission-1' }, error: null })
  const mockInsert = vi.fn().mockReturnValue({ select: vi.fn(() => ({ single: mockSingle })) })
  const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null })
  const mockSelect = vi.fn().mockReturnValue({ eq: vi.fn(() => ({ order: mockOrder })) })
  const mockRequireUserAuth = vi.fn().mockResolvedValue({ id: 'user-1' })

  return { mockRequireUserAuth, mockOrder, mockInsert, mockSingle, mockSelect }
})

vi.mock('./_auth', () => ({
  requireUserAuth: mockRequireUserAuth,
}))

vi.mock('./_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'spot_submissions') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ order: mockOrder })) })),
          insert: mockInsert,
        }
      }

      throw new Error(`Unexpected table ${table}`)
    }),
  })),
}))

import handler from './spot-submissions'

const VALID_BODY = {
  name: 'Creek pullout',
  description: 'Quiet gravel area near the river',
  latitude: 37.5,
  longitude: -107.5,
  amenities: {
    water: false,
    dump: false,
    electric: false,
    shower: false,
    fuel: false,
    propane: false,
    overnight: true,
    toilets: false,
    pets: true,
    wifi: false,
    kitchen: false,
    restaurant: false,
    big_rig: false,
    tent: true,
    hiking: true,
    fishing: false,
    swimming: false,
    boating: false,
    biking: false,
    ohv: false,
    climbing: false,
    winter_sports: false,
    hunting: false,
    wildlife: true,
    horseback: false,
    hot_springs: false,
  },
  max_length_ft: null,
  max_height_ft: null,
  website: null,
  phone: null,
}

function mockReq(method = 'POST', body: unknown = VALID_BODY): VercelRequest {
  return { method, body, headers: { authorization: 'Bearer token' } } as unknown as VercelRequest
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

describe('/api/spot-submissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireUserAuth.mockResolvedValue({ id: 'user-1' })
    mockOrder.mockResolvedValue({ data: [], error: null })
    mockSingle.mockResolvedValue({ data: { id: 'submission-1' }, error: null })
  })

  it('returns 405 for unsupported methods', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('DELETE'), res)
    expect(ctx.statusCode).toBe(405)
  })

  it('returns 400 for invalid body on POST', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', { ...VALID_BODY, name: '' }), res)
    expect(ctx.statusCode).toBe(400)
    expect((ctx.body as { error: string }).error).toBe('INVALID_BODY')
  })

  it('creates a submission for the authenticated user', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(201)
    expect((ctx.body as { id: string }).id).toBe('submission-1')
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1', status: 'pending' }))
  })

  it('returns the current user submissions on GET', async () => {
    mockOrder.mockResolvedValueOnce({
      data: [{
        id: 'submission-1',
        user_id: 'user-1',
        name: 'Creek pullout',
        description: null,
        latitude: 37.5,
        longitude: -107.5,
        amenities: VALID_BODY.amenities,
        max_length_ft: null,
        max_height_ft: null,
        website: null,
        phone: null,
        status: 'pending',
        admin_notes: null,
        reviewed_at: null,
        published_pin_id: null,
        created_at: '2026-03-23T00:00:00.000Z',
        updated_at: '2026-03-23T00:00:00.000Z',
      }],
      error: null,
    })

    const { res, ctx } = mockRes()
    await handler(mockReq('GET', undefined), res)
    expect(ctx.statusCode).toBe(200)
    expect((ctx.body as Array<{ id: string }>)[0].id).toBe('submission-1')
  })
})
