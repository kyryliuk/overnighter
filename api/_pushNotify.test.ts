import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { notifySubscribers } from './_pushNotify'

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockSupabase(savedSpots: { user_id: string }[] | null, subscriptions: { user_id: string }[] | null, savedErr: Error | null = null) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'saved_spots') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: savedSpots, error: savedErr }),
          }),
        }
      }
      if (table === 'push_subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: subscriptions, error: null }),
          }),
        }
      }
      return {}
    }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

const PIN_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
const PIN_NAME = 'Flying J Ocala'

// ── Tests ──────────────────────────────────────────────────────────────────

describe('notifySubscribers', () => {
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

  it('returns without calling fetch when no saved spots exist', async () => {
    const supabase = mockSupabase([], null)
    await notifySubscribers(supabase, PIN_ID, PIN_NAME, 'still_open')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns without calling fetch when saved spots query errors', async () => {
    const supabase = mockSupabase(null, null, new Error('db error'))
    await notifySubscribers(supabase, PIN_ID, PIN_NAME, 'still_open')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns without calling fetch when no push subscriptions exist', async () => {
    const supabase = mockSupabase(
      [{ user_id: 'user-1' }, { user_id: 'user-2' }],
      [],
    )
    await notifySubscribers(supabase, PIN_ID, PIN_NAME, 'still_open')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('calls fetch with correct payload for each subscribed user', async () => {
    const supabase = mockSupabase(
      [{ user_id: 'user-1' }, { user_id: 'user-2' }],
      [{ user_id: 'user-1' }, { user_id: 'user-2' }],
    )
    await notifySubscribers(supabase, PIN_ID, PIN_NAME, 'still_open')

    expect(mockFetch).toHaveBeenCalledTimes(2)
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
          title: PIN_NAME,
          body: 'New check-in — still open',
          url: `/pin/${PIN_ID}`,
        }),
      }),
    )
  })

  it('deduplicates user IDs from saved spots', async () => {
    const supabase = mockSupabase(
      [{ user_id: 'user-1' }, { user_id: 'user-1' }],
      [{ user_id: 'user-1' }],
    )
    await notifySubscribers(supabase, PIN_ID, PIN_NAME, 'still_open')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('maps still_open status to "still open" label', async () => {
    const supabase = mockSupabase(
      [{ user_id: 'user-1' }],
      [{ user_id: 'user-1' }],
    )
    await notifySubscribers(supabase, PIN_ID, PIN_NAME, 'still_open')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.body).toBe('New check-in — still open')
  })

  it('maps closed status to "reported closed" label', async () => {
    const supabase = mockSupabase(
      [{ user_id: 'user-1' }],
      [{ user_id: 'user-1' }],
    )
    await notifySubscribers(supabase, PIN_ID, PIN_NAME, 'closed')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.body).toBe('New check-in — reported closed')
  })

  it('maps changed status to "conditions changed" label', async () => {
    const supabase = mockSupabase(
      [{ user_id: 'user-1' }],
      [{ user_id: 'user-1' }],
    )
    await notifySubscribers(supabase, PIN_ID, PIN_NAME, 'changed')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.body).toBe('New check-in — conditions changed')
  })

  it('falls back to raw status for unknown values', async () => {
    const supabase = mockSupabase(
      [{ user_id: 'user-1' }],
      [{ user_id: 'user-1' }],
    )
    await notifySubscribers(supabase, PIN_ID, PIN_NAME, 'unknown_status')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.body).toBe('New check-in — unknown_status')
  })

  it('includes correct url in payload', async () => {
    const supabase = mockSupabase(
      [{ user_id: 'user-1' }],
      [{ user_id: 'user-1' }],
    )
    await notifySubscribers(supabase, PIN_ID, PIN_NAME, 'still_open')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.url).toBe(`/pin/${PIN_ID}`)
  })

  it('handles partial fetch failures gracefully with Promise.allSettled', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('network error'))

    const supabase = mockSupabase(
      [{ user_id: 'user-1' }, { user_id: 'user-2' }],
      [{ user_id: 'user-1' }, { user_id: 'user-2' }],
    )
    // Should not throw
    await expect(notifySubscribers(supabase, PIN_ID, PIN_NAME, 'still_open')).resolves.toBeUndefined()
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('returns without calling fetch when PUSH_ADMIN_TOKEN is missing', async () => {
    delete process.env.PUSH_ADMIN_TOKEN
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = mockSupabase(
      [{ user_id: 'user-1' }],
      [{ user_id: 'user-1' }],
    )
    await notifySubscribers(supabase, PIN_ID, PIN_NAME, 'still_open')
    expect(mockFetch).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith('[_pushNotify] PUSH_ADMIN_TOKEN not configured')
    consoleSpy.mockRestore()
  })

  it('uses VERCEL_URL for send endpoint when available', async () => {
    process.env.VERCEL_URL = 'my-app.vercel.app'
    const supabase = mockSupabase(
      [{ user_id: 'user-1' }],
      [{ user_id: 'user-1' }],
    )
    await notifySubscribers(supabase, PIN_ID, PIN_NAME, 'still_open')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://my-app.vercel.app/api/push/send',
      expect.anything(),
    )
  })
})
