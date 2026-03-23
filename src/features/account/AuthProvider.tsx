import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getCurrentSession, onAuthSessionChange, requestMagicLink as sendMagicLink, signOut as signOutAuth } from '@/lib/supabase/auth'
import { getRigProfile, upsertRigProfile, deleteRigProfile } from '@/lib/supabase/rigProfiles'
import { getSavedSpots, replaceSavedSpots as syncSavedSpots } from '@/lib/supabase/savedSpots'
import { getTripPlans, replaceTripPlans as syncTripPlans } from '@/lib/supabase/tripPlans'
import { mergeRigProfileState, mergeSavedSpots, mergeTripPlans } from '@/lib/sync/mergeCloudState'
import { useRigStore } from '@/store/rigStore'
import { useSpotsStore } from '@/store/spotsStore'
import { useTripPlansStore } from '@/store/tripPlansStore'
import { AuthContext, type AuthContextValue } from './AuthContext'

function getRigSignature() {
  const state = useRigStore.getState()
  return JSON.stringify({
    rigProfile: state.rigProfile,
    onboardingDismissed: state.onboardingDismissed,
    updatedAt: state.updatedAt,
  })
}

function getSavedSpotsSignature() {
  return JSON.stringify(useSpotsStore.getState().savedSpots)
}

function getTripPlansSignature() {
  return JSON.stringify(useTripPlansStore.getState().tripPlans)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSendingLink, setIsSendingLink] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [hasCompletedInitialSync, setHasCompletedInitialSync] = useState(false)

  const rigProfile = useRigStore((state) => state.rigProfile)
  const onboardingDismissed = useRigStore((state) => state.onboardingDismissed)
  const rigUpdatedAt = useRigStore((state) => state.updatedAt)
  const rigHydrated = useRigStore((state) => state.hasHydrated)
  const savedSpots = useSpotsStore((state) => state.savedSpots)
  const spotsHydrated = useSpotsStore((state) => state.hasHydrated)
  const tripPlans = useTripPlansStore((state) => state.tripPlans)
  const tripPlansHydrated = useTripPlansStore((state) => state.hasHydrated)

  const applyingRemoteStateRef = useRef(false)
  const activeUserIdRef = useRef<string | null>(null)
  const lastRigSignatureRef = useRef('')
  const lastSavedSpotsSignatureRef = useRef('')
  const lastTripPlansSignatureRef = useRef('')

  useEffect(() => {
    let cancelled = false

    void getCurrentSession()
      .then((currentSession) => {
        if (cancelled) return
        setSession(currentSession)
        setIsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setSession(null)
        setIsLoading(false)
      })

    const {
      data: { subscription },
    } = onAuthSessionChange((nextSession) => {
      setSession(nextSession)
      setPendingEmail(null)
      setIsLoading(false)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const userId = session?.user.id ?? null

    if (activeUserIdRef.current === userId) return

    activeUserIdRef.current = userId
    setHasCompletedInitialSync(false)
    setSyncError(null)
    setLastSyncedAt(null)
    lastRigSignatureRef.current = ''
    lastSavedSpotsSignatureRef.current = ''
    lastTripPlansSignatureRef.current = ''
  }, [session?.user.id])

  useEffect(() => {
    if (!session?.user || !rigHydrated || !spotsHydrated || !tripPlansHydrated || hasCompletedInitialSync) return

    let cancelled = false
    const userId = session.user.id

    async function runInitialSync() {
      setIsSyncing(true)
      setSyncError(null)

      try {
        const [remoteRigProfile, remoteSavedSpots, remoteTripPlans] = await Promise.all([
          getRigProfile(userId),
          getSavedSpots(userId),
          getTripPlans(userId),
        ])

        if (cancelled) return

        const mergedRigState = mergeRigProfileState(
          {
            rigProfile: useRigStore.getState().rigProfile,
            onboardingDismissed: useRigStore.getState().onboardingDismissed,
            updatedAt: useRigStore.getState().updatedAt,
          },
          remoteRigProfile,
        )
        const mergedSavedSpots = mergeSavedSpots(useSpotsStore.getState().savedSpots, remoteSavedSpots)
        const mergedTripPlans = mergeTripPlans(useTripPlansStore.getState().tripPlans, remoteTripPlans)

        applyingRemoteStateRef.current = true
        useRigStore.getState().replaceFromCloud(
          mergedRigState.rigProfile,
          mergedRigState.onboardingDismissed,
          mergedRigState.updatedAt,
        )
        useSpotsStore.getState().replaceSavedSpots(mergedSavedSpots)
        useTripPlansStore.getState().replaceTripPlans(mergedTripPlans)
        applyingRemoteStateRef.current = false

        if (mergedRigState.rigProfile.rigType || mergedRigState.onboardingDismissed) {
          await upsertRigProfile(userId, mergedRigState)
        } else {
          await deleteRigProfile(userId)
        }

        await syncSavedSpots(userId, mergedSavedSpots)
        await syncTripPlans(userId, mergedTripPlans)

        if (cancelled) return

        lastRigSignatureRef.current = getRigSignature()
        lastSavedSpotsSignatureRef.current = JSON.stringify(mergedSavedSpots)
        lastTripPlansSignatureRef.current = JSON.stringify(mergedTripPlans)
        setLastSyncedAt(new Date().toISOString())
      } catch (error) {
        applyingRemoteStateRef.current = false
        setSyncError(error instanceof Error ? error.message : 'Failed to sync account data')
      } finally {
        if (!cancelled) {
          setIsSyncing(false)
          setHasCompletedInitialSync(true)
        }
      }
    }

    void runInitialSync()

    return () => {
      cancelled = true
    }
  }, [session?.user, rigHydrated, spotsHydrated, tripPlansHydrated, hasCompletedInitialSync])

  useEffect(() => {
    if (!session?.user || !hasCompletedInitialSync || !rigHydrated || !spotsHydrated || !tripPlansHydrated) return
    if (applyingRemoteStateRef.current) return

    const nextRigSignature = JSON.stringify({
      rigProfile,
      onboardingDismissed,
      updatedAt: rigUpdatedAt,
    })
    const nextSavedSpotsSignature = JSON.stringify(savedSpots)
    const nextTripPlansSignature = JSON.stringify(tripPlans)

    if (
      nextRigSignature === lastRigSignatureRef.current &&
      nextSavedSpotsSignature === lastSavedSpotsSignatureRef.current &&
      nextTripPlansSignature === lastTripPlansSignatureRef.current
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        setIsSyncing(true)
        setSyncError(null)

        try {
          const userId = session.user.id
          const rigState = useRigStore.getState()

          if (rigState.rigProfile.rigType || rigState.onboardingDismissed) {
            await upsertRigProfile(userId, {
              rigProfile: rigState.rigProfile,
              onboardingDismissed: rigState.onboardingDismissed,
              updatedAt: rigState.updatedAt,
            })
          } else {
            await deleteRigProfile(userId)
          }

          await syncSavedSpots(userId, useSpotsStore.getState().savedSpots)
          await syncTripPlans(userId, useTripPlansStore.getState().tripPlans)
          lastRigSignatureRef.current = getRigSignature()
          lastSavedSpotsSignatureRef.current = getSavedSpotsSignature()
          lastTripPlansSignatureRef.current = getTripPlansSignature()
          setLastSyncedAt(new Date().toISOString())
        } catch (error) {
          setSyncError(error instanceof Error ? error.message : 'Failed to sync account data')
        } finally {
          setIsSyncing(false)
        }
      })()
    }, 400)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    session?.user,
    hasCompletedInitialSync,
    rigHydrated,
    spotsHydrated,
    tripPlansHydrated,
    rigProfile,
    onboardingDismissed,
    rigUpdatedAt,
    savedSpots,
    tripPlans,
  ])

  async function requestMagicLink(email: string) {
    setIsSendingLink(true)
    setSyncError(null)

    try {
      await sendMagicLink(email)
      setPendingEmail(email)
    } finally {
      setIsSendingLink(false)
    }
  }

  async function signOut() {
    setSyncError(null)
    await signOutAuth()
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      isAuthenticated: Boolean(session?.user),
      isSendingLink,
      pendingEmail,
      isSyncing,
      syncError,
      lastSyncedAt,
      requestMagicLink,
      signOut,
    }),
    [session, isLoading, isSendingLink, pendingEmail, isSyncing, syncError, lastSyncedAt],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
