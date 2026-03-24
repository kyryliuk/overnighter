import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const { mockMaybeSingle, mockGetUserById } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
  const mockGetUserById = vi.fn().mockResolvedValue({
    data: { user: null },
    error: null,
  })
  return { mockMaybeSingle, mockGetUserById }
})

vi.mock('../../_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: mockMaybeSingle,
            }),
          }),
        }),
      }),
    })),
    auth: {
      admin: {
        getUserById: mockGetUserById,
      },
    },
  })),
}))

import handler from './submitter'

function mockReq(method = 'GET', query: Record<string, string> = { id: 'pin-1' }) {
  return { method, query, headers: {} } as unknown as VercelRequest
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

describe('/api/pins/[id]/submitter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockGetUserById.mockResolvedValue({ data: { user: null }, error: null })
  })

  it('returns 405 for non-GET methods', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST'), res)
    expect(ctx.statusCode).toBe(405)
  })

  it('returns 400 when pin id is missing', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('GET', {}), res)
    expect(ctx.statusCode).toBe(400)
  })

  it('returns { submitter: null } when no submission links to pin', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const { res, ctx } = mockRes()
    await handler(mockReq(), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual({ submitter: null })
  })

  it('returns submitter display_name when available', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { user_id: 'user-1' },
      error: null,
    })
    mockGetUserById.mockResolvedValueOnce({
      data: {
        user: {
          id: 'user-1',
          email: 'alice@test.com',
          user_metadata: { display_name: 'Alice' },
        },
      },
      error: null,
    })
    const { res, ctx } = mockRes()
    await handler(mockReq(), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual({ submitter: 'Alice' })
  })

  it('falls back to full_name when display_name is missing', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { user_id: 'user-1' },
      error: null,
    })
    mockGetUserById.mockResolvedValueOnce({
      data: {
        user: {
          id: 'user-1',
          email: 'bob@test.com',
          user_metadata: { full_name: 'Bob Smith' },
        },
      },
      error: null,
    })
    const { res, ctx } = mockRes()
    await handler(mockReq(), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual({ submitter: 'Bob Smith' })
  })

  it('falls back to email prefix when no metadata names', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { user_id: 'user-1' },
      error: null,
    })
    mockGetUserById.mockResolvedValueOnce({
      data: {
        user: {
          id: 'user-1',
          email: 'charlie@test.com',
          user_metadata: {},
        },
      },
      error: null,
    })
    const { res, ctx } = mockRes()
    await handler(mockReq(), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual({ submitter: 'charlie' })
  })

  it('returns { submitter: null } when user lookup fails', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { user_id: 'user-1' },
      error: null,
    })
    mockGetUserById.mockResolvedValueOnce({
      data: { user: null },
      error: new Error('not found'),
    })
    const { res, ctx } = mockRes()
    await handler(mockReq(), res)
    expect(ctx.statusCode).toBe(200)
    expect(ctx.body).toEqual({ submitter: null })
  })
})
