import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const { mockRequireAdminAuth, mockOrder, mockSingle, mockInsert, mockUpdateEq } = vi.hoisted(() => {
  const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null })
  const mockSingle = vi.fn().mockResolvedValue({
    data: {
      id: 'submission-1',
      user_id: 'user-1',
      name: 'Creek pullout',
      description: 'Quiet pullout',
      latitude: 37.5,
      longitude: -107.5,
      amenities: { overnight: true },
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
    },
    error: null,
  })
  const mockInsert = vi.fn().mockReturnValue({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: 'pin-1' }, error: null }) })) })
  const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
  const mockRequireAdminAuth = vi.fn().mockReturnValue(true)

  return { mockRequireAdminAuth, mockOrder, mockSingle, mockInsert, mockUpdateEq }
})

vi.mock('../_middleware', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}))

vi.mock('../_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'spot_submissions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: mockOrder,
              single: mockSingle,
            })),
          })),
          update: vi.fn(() => ({ eq: mockUpdateEq })),
        }
      }

      if (table === 'pins') {
        return {
          insert: mockInsert,
        }
      }

      throw new Error(`Unexpected table ${table}`)
    }),
  })),
}))

import listHandler from './spot-submissions'
import reviewHandler from './spot-submissions/[id]'

function mockReq(method = 'GET', body?: unknown, query?: Record<string, string>) {
  return { method, body, query, headers: { authorization: 'Bearer admin' } } as unknown as VercelRequest
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

describe('/api/admin/spot-submissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdminAuth.mockReturnValue(true)
    mockOrder.mockResolvedValue({ data: [], error: null })
    mockUpdateEq.mockResolvedValue({ error: null })
  })

  it('returns 405 for unsupported list methods', async () => {
    const { res, ctx } = mockRes()
    await listHandler(mockReq('POST'), res)
    expect(ctx.statusCode).toBe(405)
  })

  it('returns pending submissions for admins', async () => {
    mockOrder.mockResolvedValueOnce({
      data: [{
        id: 'submission-1',
        user_id: 'user-1',
        name: 'Creek pullout',
        description: null,
        latitude: 37.5,
        longitude: -107.5,
        amenities: { overnight: true },
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
    await listHandler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(200)
    expect((ctx.body as Array<{ id: string }>)[0].id).toBe('submission-1')
  })

  it('approves a submission and publishes a pin', async () => {
    const { res, ctx } = mockRes()
    await reviewHandler(mockReq('PATCH', { action: 'approve', admin_notes: 'Looks good' }, { id: 'submission-1' }), res)
    expect(ctx.statusCode).toBe(200)
    expect(mockInsert).toHaveBeenCalled()
    expect(mockUpdateEq).toHaveBeenCalled()
  })

  it('returns 400 for invalid review body', async () => {
    const { res, ctx } = mockRes()
    await reviewHandler(mockReq('PATCH', { action: 'not-real' }, { id: 'submission-1' }), res)
    expect(ctx.statusCode).toBe(400)
  })
})
