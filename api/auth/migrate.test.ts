import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const { mockRequireUserAuth, mockUpsertRigProfiles, mockUpsertSavedSpots } = vi.hoisted(() => {
  const mockUpsertRigProfiles = vi.fn().mockResolvedValue({ error: null })
  const mockUpsertSavedSpots = vi.fn().mockResolvedValue({ error: null })
  const mockRequireUserAuth = vi.fn().mockResolvedValue({ id: 'user-1' })

  return { mockRequireUserAuth, mockUpsertRigProfiles, mockUpsertSavedSpots }
})

vi.mock('../_auth', () => ({
  requireUserAuth: mockRequireUserAuth,
}))

vi.mock('../_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'rig_profiles') return { upsert: mockUpsertRigProfiles }
      if (table === 'saved_spots') return { upsert: mockUpsertSavedSpots }
      throw new Error(`Unexpected table ${table}`)
    }),
  })),
}))

import handler from './migrate'

const VALID_BODY = {
  rigProfile: { rigType: 'Class B' as const, lengthFt: 22, heightFt: 10.5 },
  onboardingDismissed: true,
  rigUpdatedAt: '2026-03-24T10:00:00.000Z',
  savedSpots: [
    { id: 'pin-1', name: 'Spot One' },
    { id: 'pin-2', name: 'Spot Two' },
  ],
}

const EMPTY_BODY = {
  rigProfile: null,
  onboardingDismissed: false,
  rigUpdatedAt: null,
  savedSpots: [],
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

describe('/api/auth/migrate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireUserAuth.mockResolvedValue({ id: 'user-1' })
    mockUpsertRigProfiles.mockResolvedValue({ error: null })
    mockUpsertSavedSpots.mockResolvedValue({ error: null })
  })

  it('returns 405 for non-POST methods', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('GET'), res)
    expect(ctx.statusCode).toBe(405)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireUserAuth.mockImplementation(async (_req: VercelRequest, res: VercelResponse) => {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing authenticated user token', status: 401 })
      return null
    })

    const { res, ctx } = mockRes()
    await handler(mockReq('POST'), res)
    expect(ctx.statusCode).toBe(401)
  })

  it('returns 400 for invalid body', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', { rigProfile: 'bad' }), res)
    expect(ctx.statusCode).toBe(400)
    expect((ctx.body as { error: string }).error).toBe('INVALID_BODY')
  })

  it('migrates rig profile and saved spots on success', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(200)

    const body = ctx.body as { migratedRigProfile: boolean; migratedSpotsCount: number }
    expect(body.migratedRigProfile).toBe(true)
    expect(body.migratedSpotsCount).toBe(2)

    expect(mockUpsertRigProfiles).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', rig_type: 'Class B' }),
      { onConflict: 'user_id' },
    )
    expect(mockUpsertSavedSpots).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ user_id: 'user-1', pin_id: 'pin-1' }),
        expect.objectContaining({ user_id: 'user-1', pin_id: 'pin-2' }),
      ]),
      { onConflict: 'user_id,pin_id' },
    )
  })

  it('handles empty payload without errors', async () => {
    const { res, ctx } = mockRes()
    await handler(mockReq('POST', EMPTY_BODY), res)
    expect(ctx.statusCode).toBe(200)

    const body = ctx.body as { migratedRigProfile: boolean; migratedSpotsCount: number }
    expect(body.migratedRigProfile).toBe(false)
    expect(body.migratedSpotsCount).toBe(0)

    expect(mockUpsertRigProfiles).not.toHaveBeenCalled()
    expect(mockUpsertSavedSpots).not.toHaveBeenCalled()
  })

  it('returns 500 when Supabase rig_profiles upsert fails', async () => {
    mockUpsertRigProfiles.mockResolvedValue({ error: { message: 'db error' } })

    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(500)
    expect((ctx.body as { error: string }).error).toBe('INTERNAL_ERROR')
  })

  it('returns 500 when Supabase saved_spots upsert fails', async () => {
    mockUpsertSavedSpots.mockResolvedValue({ error: { message: 'db error' } })

    const { res, ctx } = mockRes()
    await handler(mockReq('POST', VALID_BODY), res)
    expect(ctx.statusCode).toBe(500)
    expect((ctx.body as { error: string }).error).toBe('INTERNAL_ERROR')
  })
})
