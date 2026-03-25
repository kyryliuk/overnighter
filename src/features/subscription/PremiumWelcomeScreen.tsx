import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/hooks/useSubscription'
import { supabase } from '@/lib/supabase/client'

const MAX_POLL_ATTEMPTS = 5
const POLL_INTERVAL_MS = 1_000

type WelcomeState = 'polling' | 'confirmed' | 'pending'

export default function PremiumWelcomeScreen() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const { isPremium } = useSubscription()

  const sessionId = searchParams.get('session_id')
  const returnTo = searchParams.get('returnTo') || '/'
  const userId = session?.user?.id

  const [internalState, setInternalState] = useState<'polling' | 'confirmed' | 'pending'>(
    isPremium ? 'confirmed' : 'polling',
  )
  const pollCountRef = useRef(0)
  const hasStartedRef = useRef(false)

  // Derive effective state: isPremium from hook always wins
  const welcomeState: WelcomeState = isPremium ? 'confirmed' : internalState

  const refreshAndCheck = useCallback(async (): Promise<boolean> => {
    try {
      await supabase.auth.refreshSession()
    } catch {
      // refresh failed, continue polling
    }

    if (userId) {
      // Invalidate and refetch subscription via useSubscription/TanStack Query
      await queryClient.invalidateQueries({ queryKey: ['subscription', userId] })
      await queryClient.refetchQueries({ queryKey: ['subscription', userId] })

      const cachedData = queryClient.getQueryData<{ subscription_status: string }>(['subscription', userId])
      const status = cachedData?.subscription_status
      return status === 'premium' || status === 'trialing'
    }

    return false
  }, [userId, queryClient])

  useEffect(() => {
    if (hasStartedRef.current || isPremium) return
    hasStartedRef.current = true

    let cancelled = false

    async function poll() {
      while (pollCountRef.current < MAX_POLL_ATTEMPTS && !cancelled) {
        pollCountRef.current += 1
        const confirmed = await refreshAndCheck()

        if (cancelled) return

        if (confirmed) {
          setInternalState('confirmed')
          return
        }

        if (pollCountRef.current < MAX_POLL_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
        }
      }

      if (!cancelled) {
        setInternalState('pending')
      }
    }

    void poll()

    return () => {
      cancelled = true
    }
  }, [isPremium, refreshAndCheck])

  if (welcomeState === 'polling') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4" data-testid="premium-welcome-polling">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent" />
        <p className="mt-4 text-sm text-zinc-400">Confirming your subscription…</p>
      </div>
    )
  }

  if (welcomeState === 'pending') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4" data-testid="premium-welcome-pending">
        <div className="mx-auto max-w-sm text-center">
          <h1 className="text-2xl font-bold text-white">Payment Processing</h1>
          <p className="mt-3 text-sm text-zinc-400">
            Your payment is being processed. This usually takes just a moment — check back shortly.
          </p>
          {sessionId && (
            <p className="mt-2 text-xs text-zinc-600">Session: {sessionId.slice(0, 8)}…</p>
          )}
          <button
            onClick={() => navigate(returnTo)}
            className="mt-6 rounded-md bg-zinc-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-600"
          >
            Back to Map
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4" data-testid="premium-welcome-confirmed">
      <div className="mx-auto max-w-sm text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
          <span className="text-3xl" role="img" aria-label="celebration">🎉</span>
        </div>
        <h1 className="mt-6 text-2xl font-bold text-white">
          You're now an Overnighter Premium member
        </h1>
        <p className="mt-3 text-sm text-zinc-400">
          Welcome to Premium! Here's what you've unlocked:
        </p>
        <ul className="mt-4 space-y-2 text-left text-sm text-zinc-300">
          <li className="flex items-center gap-2">
            <span className="text-amber-400">✓</span> Offline maps for trips without signal
          </li>
          <li className="flex items-center gap-2">
            <span className="text-amber-400">✓</span> Advanced route planning
          </li>
          <li className="flex items-center gap-2">
            <span className="text-amber-400">✓</span> Priority support
          </li>
        </ul>
        <button
          onClick={() => navigate(returnTo)}
          data-testid="premium-welcome-cta"
          className="mt-8 w-full rounded-md bg-amber-500 px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
        >
          Start Exploring
        </button>
      </div>
    </div>
  )
}
