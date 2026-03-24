import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { notifySubmissionStatusChange } from './_submissionNotify'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockSupabase(subscriptions: { user_id: string }[] | null) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'push_subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: subscriptions, error: null }),
            }),
          }),
        }
      }
      return {}
    }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('notifySubmissionStatusChange', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true })
    process.env.PUSH_ADMIN_TOKEN = 'test-admin-token'
    delete process.env.VERCEL_URL
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('does not call fetch when user has no push subscriptions', async () => {
    const supabase = mockSupabase([])
    await notifySubmissionStatusChange(supabase, {
      userId: 'user-1',
      submissionName: 'Creek pullout',
      action: 'approve',
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('sends approval notification with correct payload', async () => {
    const supabase = mockSupabase([{ user_id: 'user-1' }])
    await notifySubmissionStatusChange(supabase, {
      userId: 'user-1',
      submissionName: 'Creek pullout',
      action: 'approve',
      publishedPinId: 'pin-42',
    })
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/push/send',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-admin-token',
        },
        body: JSON.stringify({
          userId: 'user-1',
          title: 'Creek pullout',
          body: 'Your spot was approved and is now live on the map!',
          url: '/pin/pin-42',
        }),
      }),
    )
  })

  it('sends approval notification with /suggest-spot url when no publishedPinId', async () => {
    const supabase = mockSupabase([{ user_id: 'user-1' }])
    await notifySubmissionStatusChange(supabase, {
      userId: 'user-1',
      submissionName: 'Creek pullout',
      action: 'approve',
      publishedPinId: null,
    })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.url).toBe('/suggest-spot')
  })

  it('sends rejection notification with admin notes', async () => {
    const supabase = mockSupabase([{ user_id: 'user-1' }])
    await notifySubmissionStatusChange(supabase, {
      userId: 'user-1',
      submissionName: 'Bad spot',
      action: 'reject',
      adminNotes: 'Not a real location',
    })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.title).toBe('Bad spot')
    expect(body.body).toBe('Your submission was not approved. Not a real location')
    expect(body.url).toBe('/suggest-spot')
  })

  it('sends rejection notification without admin notes', async () => {
    const supabase = mockSupabase([{ user_id: 'user-1' }])
    await notifySubmissionStatusChange(supabase, {
      userId: 'user-1',
      submissionName: 'Bad spot',
      action: 'reject',
    })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.body).toBe('Your submission was not approved.')
  })

  it('sends changes requested notification with correct payload', async () => {
    const supabase = mockSupabase([{ user_id: 'user-1' }])
    await notifySubmissionStatusChange(supabase, {
      userId: 'user-1',
      submissionName: 'Needs work',
      action: 'request_changes',
    })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.title).toBe('Needs work')
    expect(body.body).toBe('Changes requested on your submission — check the feedback.')
    expect(body.url).toBe('/suggest-spot')
  })

  it('does not throw if push send fails (fire-and-forget)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = mockSupabase([{ user_id: 'user-1' }])
    await expect(
      notifySubmissionStatusChange(supabase, {
        userId: 'user-1',
        submissionName: 'Test',
        action: 'approve',
        publishedPinId: 'pin-1',
      }),
    ).resolves.toBeUndefined()
    consoleSpy.mockRestore()
  })

  it('returns without calling fetch when PUSH_ADMIN_TOKEN is missing', async () => {
    delete process.env.PUSH_ADMIN_TOKEN
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = mockSupabase([{ user_id: 'user-1' }])
    await notifySubmissionStatusChange(supabase, {
      userId: 'user-1',
      submissionName: 'Test',
      action: 'approve',
    })
    expect(mockFetch).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith('[_submissionNotify] PUSH_ADMIN_TOKEN not configured')
    consoleSpy.mockRestore()
  })

  it('uses VERCEL_URL for send endpoint when available', async () => {
    process.env.VERCEL_URL = 'my-app.vercel.app'
    const supabase = mockSupabase([{ user_id: 'user-1' }])
    await notifySubmissionStatusChange(supabase, {
      userId: 'user-1',
      submissionName: 'Test',
      action: 'approve',
      publishedPinId: 'pin-1',
    })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://my-app.vercel.app/api/push/send',
      expect.anything(),
    )
  })
})
