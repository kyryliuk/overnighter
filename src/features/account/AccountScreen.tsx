import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useRigStore } from '@/store/rigStore'
import { useSpotsStore } from '@/store/spotsStore'
import { useTripPlansStore } from '@/store/tripPlansStore'

function formatTimestamp(timestamp: string | null) {
  if (!timestamp) return 'Not synced yet'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

export default function AccountScreen() {
  const navigate = useNavigate()
  const { session, isLoading, isAuthenticated, isSigningUp, isSyncing, syncError, lastSyncedAt, signUp, signOut } = useAuth()
  const rigProfile = useRigStore((state) => state.rigProfile)
  const savedSpots = useSpotsStore((state) => state.savedSpots)
  const tripPlans = useTripPlansStore((state) => state.tripPlans)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const rigSummary = useMemo(() => {
    if (!rigProfile.rigType) return 'No rig profile saved yet'
    return `${rigProfile.rigType}, ${rigProfile.lengthFt}ft, ${rigProfile.heightFt}ft tall`
  }, [rigProfile])

  async function handleCreateAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)
    setStatusMessage(null)

    try {
      const result = await signUp(email.trim(), password)

      if (result.status === 'email-confirmation-required') {
        setPassword('')
        setStatusMessage(`Account created. Check ${result.email} to confirm your email, then come back to back up your data.`)
        return
      }

      setEmail('')
      setPassword('')
      setStatusMessage('Account created. We are backing up your local data now.')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create account')
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

        {!isAuthenticated ? (
          <section className="rounded-2xl border border-border bg-secondary p-5 space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Create your account</h2>
              <p className="text-sm text-muted-foreground">
                Back up your local rig profile, saved spots, and trip drafts with email and password so they can sync across devices.
              </p>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-3">
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
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Create a password"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 min-h-[44px]"
              />
              <button
                type="submit"
                disabled={!email.trim() || password.length < 8 || isSigningUp}
                className="min-h-[44px] w-full rounded-lg bg-primary text-primary-foreground font-semibold disabled:opacity-50"
              >
                {isSigningUp ? 'Creating account...' : 'Create account and back up'}
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
