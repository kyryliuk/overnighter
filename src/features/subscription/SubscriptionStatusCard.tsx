import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/hooks/useSubscription'

export function SubscriptionStatusCard() {
  const { isAuthenticated, session } = useAuth()
  const { status, isLoading } = useSubscription()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isAuthenticated) return null

  if (isLoading) {
    return (
      <section
        className="rounded-2xl border border-border bg-secondary p-5 space-y-4"
        data-testid="subscription-card-skeleton"
      >
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-1/3 rounded bg-zinc-700" />
          <div className="h-4 w-2/3 rounded bg-zinc-700" />
          <div className="h-10 w-1/2 rounded bg-zinc-700" />
        </div>
      </section>
    )
  }

  const handleStripeRedirect = async (endpoint: string, errorMsg: string) => {
    setIsRedirecting(true)
    setError(null)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
      })

      if (!response.ok) {
        setError(errorMsg)
        return
      }

      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(errorMsg)
      }
    } catch (err) {
      console.error('Stripe redirect failed', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setIsRedirecting(false)
    }
  }

  const handleManageSubscription = () =>
    handleStripeRedirect('/api/stripe/portal', 'Unable to open subscription management. Please try again.')

  const handleUpgrade = () =>
    handleStripeRedirect('/api/stripe/checkout', 'Unable to start checkout. Please try again.')

  return (
    <section
      className="rounded-2xl border border-border bg-secondary p-5 space-y-4"
      data-testid="subscription-status-card"
    >
      <h2 className="text-lg font-semibold">Subscription</h2>

      {status === 'premium' && (
        <div className="flex items-center gap-2">
          <span className="text-amber-400">✓</span>
          <span className="font-medium text-amber-400">Overnighter Premium</span>
          <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs font-medium text-amber-400">
            Premium
          </span>
        </div>
      )}

      {status === 'trialing' && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-amber-400">✓</span>
            <span className="font-medium text-amber-400">Premium Trial</span>
            <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs font-medium text-amber-400">
              Trial
            </span>
          </div>
          <span className="text-sm text-muted-foreground">Trial active</span>
        </div>
      )}

      {status === 'expired' && (
        <div className="flex items-center gap-2">
          <span className="font-medium text-muted-foreground">Subscription Expired</span>
          <span className="rounded-full bg-zinc-500/10 border border-zinc-500/30 px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Expired
          </span>
        </div>
      )}

      {status === 'free' && (
        <div className="flex items-center gap-2">
          <span className="font-medium text-muted-foreground">Free Plan</span>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-400">{error}</p>
      )}

      {(status === 'premium' || status === 'trialing') && (
        <button
          type="button"
          onClick={handleManageSubscription}
          disabled={isRedirecting}
          className="min-h-[44px] rounded-lg border border-amber-500/30 px-4 text-sm font-medium text-amber-400 disabled:opacity-50"
        >
          {isRedirecting ? 'Redirecting…' : 'Manage subscription'}
        </button>
      )}

      {status === 'expired' && (
        <button
          type="button"
          onClick={handleUpgrade}
          disabled={isRedirecting}
          className="min-h-[44px] rounded-lg bg-amber-500 px-4 text-sm font-medium text-zinc-900 disabled:opacity-50"
        >
          {isRedirecting ? 'Redirecting…' : 'Resubscribe'}
        </button>
      )}

      {status === 'free' && (
        <button
          type="button"
          onClick={handleUpgrade}
          disabled={isRedirecting}
          className="min-h-[44px] rounded-lg bg-amber-500 px-4 text-sm font-medium text-zinc-900 disabled:opacity-50"
        >
          {isRedirecting ? 'Redirecting…' : 'Upgrade to Premium'}
        </button>
      )}
    </section>
  )
}
