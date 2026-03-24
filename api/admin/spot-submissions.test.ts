import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const { mockRequireAdminAuth, mockRange, mockSingle, mockInsert, mockUpdateEq } = vi.hoisted(() => {
  const mockRange = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 })
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

  return { mockRequireAdminAuth, mockRange, mockSingle, mockInsert, mockUpdateEq }
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
              order: vi.fn(() => ({
                range: mockRange,
              })),
              single: mockSingle,
            })),
            order: vi.fn(() => ({
              range: mockRange,
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

      if (table === 'push_subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }
      }

      throw new Error(`Unexpected table ${table}`)
    }),
  })),
}))

import listHandler from './spot-submissions'
import reviewHandler from './spot-submissions/[id]'

function mockReq(method = 'GET', body?: unknown, query?: Record<string, string>) {
  return { method, body, query: query ?? {}, headers: { authorization: 'Bearer admin' } } as unknown as VercelRequest
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
    mockRange.mockResolvedValue({ data: [], error: null, count: 0 })
    mockUpdateEq.mockResolvedValue({ error: null })
  })

  it('returns 405 for unsupported list methods', async () => {
    const { res, ctx } = mockRes()
    await listHandler(mockReq('POST'), res)
    expect(ctx.statusCode).toBe(405)
  })

  it('returns 401 when no admin token provided', async () => {
    mockRequireAdminAuth.mockReturnValue(false)
    const { res, ctx } = mockRes()
    await listHandler(mockReq('GET'), res)
    expect(ctx.statusCode).toBeNull()
  })

  it('returns paginated submissions for admins', async () => {
    mockRange.mockResolvedValueOnce({
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
      count: 1,
    })

    const { res, ctx } = mockRes()
    await listHandler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(200)

    const body = ctx.body as { submissions: Array<{ id: string; userId: string }>; total: number; page: number; pageSize: number; hasMore: boolean }
    expect(body.submissions[0].id).toBe('submission-1')
    expect(body.submissions[0].userId).toBe('user-1')
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(20)
    expect(body.hasMore).toBe(false)
  })

  it('filters by status when status query param is provided', async () => {
    mockRange.mockResolvedValueOnce({ data: [], error: null, count: 0 })

    const { res, ctx } = mockRes()
    await listHandler(mockReq('GET', undefined, { status: 'approved' }), res)
    expect(ctx.statusCode).toBe(200)

    const body = ctx.body as { submissions: unknown[]; total: number }
    expect(body.submissions).toEqual([])
    expect(body.total).toBe(0)
  })

  it('defaults to page 1 with 20 results per page', async () => {
    mockRange.mockResolvedValueOnce({ data: [], error: null, count: 0 })

    const { res, ctx } = mockRes()
    await listHandler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(200)

    const body = ctx.body as { page: number; pageSize: number }
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(20)
  })

  it('returns hasMore true when more results exist', async () => {
    mockRange.mockResolvedValueOnce({ data: Array(20).fill({
      id: 'submission-1', user_id: 'user-1', name: 'Spot', description: null,
      latitude: 37.5, longitude: -107.5, amenities: {}, max_length_ft: null,
      max_height_ft: null, website: null, phone: null, status: 'pending',
      admin_notes: null, reviewed_at: null, published_pin_id: null,
      created_at: '2026-03-23T00:00:00.000Z', updated_at: '2026-03-23T00:00:00.000Z',
    }), error: null, count: 25 })

    const { res, ctx } = mockRes()
    await listHandler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(200)

    const body = ctx.body as { hasMore: boolean; total: number }
    expect(body.hasMore).toBe(true)
    expect(body.total).toBe(25)
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
