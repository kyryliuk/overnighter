import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  getCurrentSession,
  onAuthSessionChange,
  signInWithPassword,
  signOut as signOutAuth,
  signUpWithPassword,
} from '@/lib/supabase/auth'
import { ensureProfile } from '@/lib/supabase/profiles'
import { migrateLocalData } from '@/lib/supabase/migrate'
import { getRigProfile, upsertRigProfile, deleteRigProfile } from '@/lib/supabase/rigProfiles'
import { getSavedSpots, replaceSavedSpots as syncSavedSpots } from '@/lib/supabase/savedSpots'
import { getTripPlans, replaceTripPlans as syncTripPlans } from '@/lib/supabase/tripPlans'
import { mergeRigProfileState, mergeSavedSpots, mergeTripPlans } from '@/lib/sync/mergeCloudState'
import { useRigStore } from '@/store/rigStore'
import { useSpotsStore } from '@/store/spotsStore'
import { useTripPlansStore } from '@/store/tripPlansStore'
import { AuthContext, type AuthContextValue, type SignUpResult } from './AuthContext'

export const VISIBILITY_SYNC_INTERVAL_MS = 30_000

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
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isSigningUp, setIsSigningUp] = useState(false)
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
  const migrationCompletedRef = useRef(false)
  const lastRigSignatureRef = useRef('')
  const lastSavedSpotsSignatureRef = useRef('')
  const lastTripPlansSignatureRef = useRef('')
  const lastSyncTimestampRef = useRef(0)

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

  const syncWithCloud = useCallback(async (userId: string) => {
    const [remoteRigProfile, remoteSavedSpots, remoteTripPlans] = await Promise.all([
      getRigProfile(userId),
      getSavedSpots(userId),
      getTripPlans(userId),
    ])

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

    try {
      applyingRemoteStateRef.current = true
      useRigStore.getState().replaceFromCloud(
        mergedRigState.rigProfile,
        mergedRigState.onboardingDismissed,
        mergedRigState.updatedAt,
      )
      useSpotsStore.getState().replaceSavedSpots(mergedSavedSpots)
      useTripPlansStore.getState().replaceTripPlans(mergedTripPlans)

      lastRigSignatureRef.current = getRigSignature()
      lastSavedSpotsSignatureRef.current = JSON.stringify(mergedSavedSpots)
      lastTripPlansSignatureRef.current = JSON.stringify(mergedTripPlans)
    } finally {
      applyingRemoteStateRef.current = false
    }

    if (mergedRigState.rigProfile.rigType || mergedRigState.onboardingDismissed) {
      await upsertRigProfile(userId, mergedRigState)
    } else {
      await deleteRigProfile(userId)
    }

    await syncSavedSpots(userId, mergedSavedSpots)
    await syncTripPlans(userId, mergedTripPlans)

    setLastSyncedAt(new Date().toISOString())
    lastSyncTimestampRef.current = Date.now()
  }, [])

  useEffect(() => {
    if (!session?.user || !rigHydrated || !spotsHydrated || !tripPlansHydrated || hasCompletedInitialSync) return

    if (migrationCompletedRef.current) {
      migrationCompletedRef.current = false
      lastRigSignatureRef.current = getRigSignature()
      lastSavedSpotsSignatureRef.current = getSavedSpotsSignature()
      lastTripPlansSignatureRef.current = getTripPlansSignature()
      setLastSyncedAt(new Date().toISOString())
      lastSyncTimestampRef.current = Date.now()
      setHasCompletedInitialSync(true)
      return
    }

    let cancelled = false
    const userId = session.user.id

    async function runInitialSync() {
      setIsSyncing(true)
      setSyncError(null)

      try {
        await syncWithCloud(userId)

        if (cancelled) return
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
  }, [session?.user, rigHydrated, spotsHydrated, tripPlansHydrated, hasCompletedInitialSync, syncWithCloud])

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

  useEffect(() => {
    if (!session?.user || !hasCompletedInitialSync) return

    const userId = session.user.id

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastSyncTimestampRef.current < VISIBILITY_SYNC_INTERVAL_MS) return

      void (async () => {
        try {
          await syncWithCloud(userId)
        } catch (error) {
          console.warn('Visibility-triggered sync failed:', error)
        }
      })()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [session?.user, hasCompletedInitialSync, syncWithCloud])

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    setIsSigningUp(true)
    setSyncError(null)

    try {
      const result = await signUpWithPassword(email, password)

      if (result.needsEmailConfirmation) {
        return {
          status: 'email-confirmation-required',
          email,
        }
      }

      try {
        await ensureProfile(result.session.user.id)
      } catch (error) {
        try {
          await signOutAuth()
          setSession(null)
        } catch (rollbackError) {
          const profileMessage = error instanceof Error ? error.message : 'Failed to initialize profile'
          const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : 'Failed to roll back session'
          throw new Error(`${profileMessage}. Cleanup sign-out also failed: ${rollbackMessage}`)
        }

        if (error instanceof Error) {
          throw error
        }

        throw new Error('Failed to initialize profile')
      }

      const rigState = useRigStore.getState()
      const spots = useSpotsStore.getState().savedSpots

      let migrationError: string | null = null
      let migratedSpotsCount = 0

      try {
        const migrationResult = await migrateLocalData(result.session.access_token, {
          rigProfile: rigState.rigProfile,
          onboardingDismissed: rigState.onboardingDismissed,
          rigUpdatedAt: rigState.updatedAt,
          savedSpots: spots,
        })
        migratedSpotsCount = migrationResult.migratedSpotsCount
        migrationCompletedRef.current = true
      } catch {
        migrationError = 'Account created. Data sync failed — will retry on next sign-in.'
      }

      setSession(result.session)

      if (migrationError) {
        return { status: 'authenticated', migrationError }
      }

      return { status: 'authenticated', migrationResult: { spotsCount: migratedSpotsCount } }
    } finally {
      setIsSigningUp(false)
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    setIsSigningIn(true)
    setSyncError(null)

    try {
      const result = await signInWithPassword(email, password)
      setSession(result.session)
    } finally {
      setIsSigningIn(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    setSyncError(null)
    await signOutAuth()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      isSigningIn,
      isAuthenticated: Boolean(session?.user),
      isSigningUp,
      isSyncing,
      syncError,
      lastSyncedAt,
      signIn,
      signUp,
      signOut,
    }),
    [session, isLoading, isSigningIn, isSigningUp, isSyncing, syncError, lastSyncedAt, signIn, signUp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
