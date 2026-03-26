import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useRigStore } from '@/store/rigStore'
import { useSpotsStore } from '@/store/spotsStore'
import { useTripPlansStore } from '@/store/tripPlansStore'
import { SubscriptionStatusCard } from '@/features/subscription/SubscriptionStatusCard'
import { usePushSubscription } from '@/hooks/usePushSubscription'

function formatTimestamp(timestamp: string | null) {
  if (!timestamp) return 'Not synced yet'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function readSafeReturnTo(value: unknown) {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export default function AccountScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, isLoading, isAuthenticated, isSigningIn, isSigningUp, isSyncing, syncError, lastSyncedAt, signIn, signUp, signOut } = useAuth()
  const rigProfile = useRigStore((state) => state.rigProfile)
  const savedSpots = useSpotsStore((state) => state.savedSpots)
  const tripPlans = useTripPlansStore((state) => state.tripPlans)
  const [authMode, setAuthMode] = useState<'sign-up' | 'sign-in'>('sign-up')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { isSubscribed, isLoading: isPushLoading, unsubscribe, permissionState } = usePushSubscription()
  const returnTo = useMemo(() => {
    const queryReturnTo = new URLSearchParams(location.search).get('returnTo')
    const stateFrom = (location.state as { from?: unknown } | null)?.from
    return readSafeReturnTo(queryReturnTo) ?? readSafeReturnTo(stateFrom) ?? null
  }, [location.search, location.state])


  const rigSummary = useMemo(() => {
    if (!rigProfile.rigType) return 'No rig profile saved yet'
    return `${rigProfile.rigType}, ${rigProfile.lengthFt}ft, ${rigProfile.heightFt}ft tall`
  }, [rigProfile])

  const backupPreview = useMemo(() => {
    const parts: string[] = []
    if (rigProfile.rigType) parts.push(`Your ${rigProfile.rigType} profile`)
    if (savedSpots.length > 0) parts.push(`${savedSpots.length} saved spot${savedSpots.length === 1 ? '' : 's'}`)
    if (parts.length === 0) return null
    return `${parts.join(' and ')} will be backed up`
  }, [rigProfile.rigType, savedSpots.length])

  async function handleCreateAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)
    setStatusMessage(null)
    console.log('[AccountScreen] handleCreateAccount: submitting for', email.trim())

    try {
      console.log('[AccountScreen] handleCreateAccount: calling signUp...')
      const result = await signUp(email.trim(), password)
      console.log('[AccountScreen] handleCreateAccount: signUp result', result)

      if (result.status === 'email-confirmation-required') {
        console.log('[AccountScreen] handleCreateAccount: email confirmation required for', result.email)
        setPassword('')
        setStatusMessage(`Account created. Check ${result.email} to confirm your email, then come back to back up your data.`)
        return
      }

      setEmail('')
      setPassword('')

      if (result.migrationError) {
        console.warn('[AccountScreen] handleCreateAccount: migration error', result.migrationError)
        setStatusMessage(result.migrationError)
        return
      }

      const count = result.migrationResult?.spotsCount ?? 0
      console.log('[AccountScreen] handleCreateAccount: success, migrated spots:', count)
      setStatusMessage(count > 0 ? `${count} spot${count === 1 ? '' : 's'} backed up` : 'Account created successfully.')
      if (returnTo) {
        console.log('[AccountScreen] handleCreateAccount: redirecting to', returnTo)
        navigate(returnTo, { replace: true })
      }
    } catch (error) {
      console.error('[AccountScreen] handleCreateAccount: error', error)
      setSubmitError(error instanceof Error ? error.message : 'Failed to create account')
    }
  }

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)
    setStatusMessage(null)
    console.log('[AccountScreen] handleSignIn: submitting for', email.trim())

    try {
      console.log('[AccountScreen] handleSignIn: calling signIn...')
      await signIn(email.trim(), password)
      console.log('[AccountScreen] handleSignIn: success, session established')
      setPassword('')
      if (returnTo) {
        console.log('[AccountScreen] handleSignIn: redirecting to', returnTo)
        navigate(returnTo, { replace: true })
      }
    } catch (error) {
      console.error('[AccountScreen] handleSignIn: error', error)
      setSubmitError(error instanceof Error ? error.message : 'Failed to sign in')
    }
  }

  async function handleSignOut() {
    setSubmitError(null)

    try {
      await signOut()
      navigate('/', { replace: true })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to sign out')
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Account & Sync</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Keep your rig profile, saved spots, and trip drafts available on every laptop.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="min-h-[44px] rounded-lg border border-border px-4 text-sm text-muted-foreground"
          >
            Back to map
          </button>
        </div>

        <section className="rounded-2xl border border-border bg-secondary p-5 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Sync status</h2>
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? 'Checking your current session...'
                : isAuthenticated
                  ? `Signed in as ${session?.user.email ?? 'your account'}`
                  : 'You are currently using the app without an account.'}
            </p>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-background p-3">
              <dt className="text-muted-foreground">Rig profile</dt>
              <dd className="mt-1 font-medium">{rigSummary}</dd>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <dt className="text-muted-foreground">Saved spots</dt>
              <dd className="mt-1 font-medium">{savedSpots.length} spot{savedSpots.length === 1 ? '' : 's'}</dd>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <dt className="text-muted-foreground">Trip drafts</dt>
              <dd className="mt-1 font-medium">{tripPlans.length} draft{tripPlans.length === 1 ? '' : 's'}</dd>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <dt className="text-muted-foreground">Last sync</dt>
              <dd className="mt-1 font-medium">{formatTimestamp(lastSyncedAt)}</dd>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <dt className="text-muted-foreground">Current state</dt>
              <dd className="mt-1 font-medium">{isSyncing ? 'Syncing now...' : isAuthenticated ? 'Ready' : 'Local only'}</dd>
            </div>
          </dl>

          {syncError && (
            <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {syncError}
            </p>
          )}

          {submitError && (
            <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {submitError}
            </p>
          )}

          {statusMessage && (
            <p role="status" className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-sm text-green-300">
              {statusMessage}
            </p>
          )}

        </section>

        {isAuthenticated && <SubscriptionStatusCard />}

        {!isAuthenticated ? (
          <section className="rounded-2xl border border-border bg-secondary p-5 space-y-4">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Account access mode">
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'sign-up'}
                onClick={() => {
                  setAuthMode('sign-up')
                  setSubmitError(null)
                  setStatusMessage(null)
                }}
                className={`min-h-[44px] rounded-lg border px-4 text-sm font-medium ${
                  authMode === 'sign-up' ? 'border-primary bg-background text-foreground' : 'border-border text-muted-foreground'
                }`}
              >
                Create account
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'sign-in'}
                onClick={() => {
                  setAuthMode('sign-in')
                  setSubmitError(null)
                  setStatusMessage(null)
                }}
                className={`min-h-[44px] rounded-lg border px-4 text-sm font-medium ${
                  authMode === 'sign-in' ? 'border-primary bg-background text-foreground' : 'border-border text-muted-foreground'
                }`}
              >
                Sign in
              </button>
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-semibold">
                {authMode === 'sign-up' ? 'Create your account' : 'Sign in to your account'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {authMode === 'sign-up'
                  ? 'Back up your local rig profile, saved spots, and trip drafts with email and password so they can sync across devices.'
                  : 'Sign in with your email and password to restore your cloud-backed rig profile, saved spots, and trip drafts.'}
              </p>
              {authMode === 'sign-up' && backupPreview && (
                <p className="text-sm font-medium text-foreground">{backupPreview}</p>
              )}
            </div>

            <form onSubmit={authMode === 'sign-up' ? handleCreateAccount : handleSignIn} className="space-y-3">
              <label className="block text-sm font-medium" htmlFor="account-email">
                Email
              </label>
              <input
                id="account-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 min-h-[44px]"
              />
              <label className="block text-sm font-medium" htmlFor="account-password">
                Password
              </label>
              <input
                id="account-password"
                type="password"
                autoComplete={authMode === 'sign-up' ? 'new-password' : 'current-password'}
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={authMode === 'sign-up' ? 'Create a password' : 'Enter your password'}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 min-h-[44px]"
              />
              <button
                type="submit"
                disabled={!email.trim() || password.length < 8 || isSigningIn || isSigningUp}
                className="min-h-[44px] w-full rounded-lg bg-primary text-primary-foreground font-semibold disabled:opacity-50"
              >
                {authMode === 'sign-up'
                  ? isSigningUp
                    ? 'Creating account...'
                    : 'Create account and back up'
                  : isSigningIn
                    ? 'Signing in...'
                    : 'Sign in'}
              </button>
            </form>
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-secondary p-5 space-y-3">
            <h2 className="text-lg font-semibold">Account actions</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => navigate('/rig-edit')}
                className="min-h-[44px] rounded-lg border border-border bg-background px-4 text-sm"
              >
                Edit rig
              </button>
              <button
                type="button"
                onClick={() => navigate('/saved')}
                className="min-h-[44px] rounded-lg border border-border bg-background px-4 text-sm"
              >
                Saved spots
              </button>
              <button
                type="button"
                onClick={() => navigate('/suggest-spot')}
                className="min-h-[44px] rounded-lg border border-border bg-background px-4 text-sm"
              >
                Suggest spot
              </button>
              <button
                type="button"
                onClick={() => navigate('/plan-route')}
                className="min-h-[44px] rounded-lg border border-border bg-background px-4 text-sm"
              >
                Trip drafts
              </button>
              {permissionState !== 'unsupported' && (
                isSubscribed ? (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await unsubscribe()
                      } catch {
                        setSubmitError('Failed to disable notifications')
                      }
                    }}
                    disabled={isPushLoading}
                    className="min-h-[44px] rounded-lg border border-border bg-background px-4 text-sm text-amber-300"
                  >
                    {isPushLoading ? 'Disabling...' : 'Disable notifications'}
                  </button>
                ) : (
                  <span className="min-h-[44px] rounded-lg border border-border bg-background px-4 text-sm text-muted-foreground flex items-center justify-center">
                    Notifications disabled
                  </span>
                )
              )}
              <button
                type="button"
                onClick={handleSignOut}
                className="min-h-[44px] rounded-lg border border-border bg-background px-4 text-sm text-red-300"
              >
                Sign out
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
