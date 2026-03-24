import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePushSubscription } from './usePushSubscription'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    session: { user: { id: 'user-1' }, access_token: 'test-token' },
  })),
}))

const mockUnsubscribe = vi.fn().mockResolvedValue(true)
const mockGetSubscription = vi.fn().mockResolvedValue(null)
const mockSubscribe = vi.fn().mockResolvedValue({
  endpoint: 'https://push.example.com/sub/123',
  getKey: (name: string) => {
    const keys: Record<string, ArrayBuffer> = {
      p256dh: new Uint8Array([1, 2, 3]).buffer as ArrayBuffer,
      auth: new Uint8Array([4, 5, 6]).buffer as ArrayBuffer,
    }
    return keys[name] ?? null
  },
  unsubscribe: mockUnsubscribe,
})
const mockShowNotification = vi.fn().mockResolvedValue(undefined)

function setupBrowserMocks(options: {
  permission?: NotificationPermission
  hasNotification?: boolean
  hasServiceWorker?: boolean
  existingSubscription?: object | null
}) {
  const {
    permission = 'default',
    hasNotification = true,
    hasServiceWorker = true,
    existingSubscription = null,
  } = options

  if (hasNotification) {
    Object.defineProperty(globalThis, 'Notification', {
      value: {
        permission,
        requestPermission: vi.fn().mockResolvedValue('granted'),
      },
      writable: true,
      configurable: true,
    })
  } else {
    // @ts-expect-error — remove Notification for unsupported test
    delete globalThis.Notification
  }

  mockGetSubscription.mockResolvedValue(existingSubscription)

  if (hasServiceWorker) {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: mockGetSubscription,
            subscribe: mockSubscribe,
          },
          showNotification: mockShowNotification,
        }),
      },
      writable: true,
      configurable: true,
    })
  } else {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      writable: true,
      configurable: true,
    })
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ publicKey: 'BEl62iUYgUivxIkv69yViXuGAzQ8aN5u' }),
  }))
})

describe('usePushSubscription', () => {
  it('returns unsupported when Notification API is missing', async () => {
    setupBrowserMocks({ hasNotification: false, hasServiceWorker: false })

    const { result } = renderHook(() => usePushSubscription())
    expect(result.current.permissionState).toBe('unsupported')
    expect(result.current.isSubscribed).toBe(false)
  })

  it('initializes with default permission and not subscribed', async () => {
    setupBrowserMocks({ permission: 'default' })

    const { result } = renderHook(() => usePushSubscription())

    // Wait for the effect to run
    await act(async () => {})

    expect(result.current.permissionState).toBe('default')
    expect(result.current.isSubscribed).toBe(false)
  })

  it('detects existing subscription on mount', async () => {
    const existingSub = {
      endpoint: 'https://push.example.com/existing',
      getKey: () => new Uint8Array([1]).buffer,
      unsubscribe: mockUnsubscribe,
    }
    setupBrowserMocks({ permission: 'granted', existingSubscription: existingSub })

    const { result } = renderHook(() => usePushSubscription())

    await act(async () => {})

    expect(result.current.isSubscribed).toBe(true)
    expect(result.current.permissionState).toBe('granted')
  })

  it('subscribe() requests permission when default', async () => {
    setupBrowserMocks({ permission: 'default' })

    const { result } = renderHook(() => usePushSubscription())
    await act(async () => {})

    await act(async () => {
      await result.current.subscribe()
    })

    expect(Notification.requestPermission).toHaveBeenCalled()
    expect(result.current.isSubscribed).toBe(true)
    expect(result.current.isLoading).toBe(false)
  })

  it('subscribe() calls pushManager.subscribe with VAPID key', async () => {
    setupBrowserMocks({ permission: 'granted' })

    const { result } = renderHook(() => usePushSubscription())
    await act(async () => {})

    await act(async () => {
      await result.current.subscribe()
    })

    expect(mockSubscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    })
  })

  it('subscribe() calls POST /api/push/subscribe with correct body', async () => {
    setupBrowserMocks({ permission: 'granted' })

    const { result } = renderHook(() => usePushSubscription())
    await act(async () => {})

    await act(async () => {
      await result.current.subscribe()
    })

    const fetchCalls = vi.mocked(fetch).mock.calls
    const subscribeCall = fetchCalls.find(
      (call) => call[0] === '/api/push/subscribe' && (call[1] as RequestInit)?.method === 'POST'
    )
    expect(subscribeCall).toBeDefined()

    const body = JSON.parse((subscribeCall![1] as RequestInit).body as string)
    expect(body).toHaveProperty('endpoint', 'https://push.example.com/sub/123')
    expect(body).toHaveProperty('p256dh')
    expect(body).toHaveProperty('auth')

    const headers = (subscribeCall![1] as RequestInit).headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer test-token')
  })

  it('subscribe() fires test notification via registration.showNotification', async () => {
    setupBrowserMocks({ permission: 'granted' })

    const { result } = renderHook(() => usePushSubscription())
    await act(async () => {})

    await act(async () => {
      await result.current.subscribe()
    })

    expect(mockShowNotification).toHaveBeenCalledWith('Notifications active', {
      body: "You'll be notified when this spot's status changes.",
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
    })
  })

  it('subscribe() does nothing when permission is denied', async () => {
    setupBrowserMocks({ permission: 'denied' })

    const { result } = renderHook(() => usePushSubscription())
    await act(async () => {})

    await act(async () => {
      await result.current.subscribe()
    })

    expect(mockSubscribe).not.toHaveBeenCalled()
    expect(result.current.isSubscribed).toBe(false)
  })

  it('subscribe() handles denied permission result', async () => {
    setupBrowserMocks({ permission: 'default' })
    vi.mocked(Notification.requestPermission).mockResolvedValue('denied')

    const { result } = renderHook(() => usePushSubscription())
    await act(async () => {})

    await act(async () => {
      await result.current.subscribe()
    })

    expect(result.current.permissionState).toBe('denied')
    expect(result.current.isSubscribed).toBe(false)
    expect(mockSubscribe).not.toHaveBeenCalled()
  })

  it('unsubscribe() calls subscription.unsubscribe and DELETE API', async () => {
    const existingSub = {
      endpoint: 'https://push.example.com/existing',
      getKey: () => new Uint8Array([1]).buffer,
      unsubscribe: mockUnsubscribe,
    }
    setupBrowserMocks({ permission: 'granted', existingSubscription: existingSub })

    const { result } = renderHook(() => usePushSubscription())
    await act(async () => {})

    expect(result.current.isSubscribed).toBe(true)

    await act(async () => {
      await result.current.unsubscribe()
    })

    expect(mockUnsubscribe).toHaveBeenCalled()
    expect(result.current.isSubscribed).toBe(false)

    const fetchCalls = vi.mocked(fetch).mock.calls
    const deleteCall = fetchCalls.find(
      (call) => call[0] === '/api/push/subscribe' && (call[1] as RequestInit)?.method === 'DELETE'
    )
    expect(deleteCall).toBeDefined()
  })

  it('reverts state on subscribe error', async () => {
    setupBrowserMocks({ permission: 'granted' })
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ publicKey: 'BEl62iUYgUivxIkv69yViXuGAzQ8aN5u' }) } as Response)
      .mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => usePushSubscription())
    await act(async () => {})

    await act(async () => {
      try { await result.current.subscribe() } catch { /* expected */ }
    })

    expect(result.current.isSubscribed).toBe(false)
    expect(result.current.isLoading).toBe(false)
  })
})
