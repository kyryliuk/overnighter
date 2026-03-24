import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/hooks/useSubscription'

export interface PremiumGateProps {
  children: ReactNode
  feature: string
  description?: string
  variant?: 'full' | 'compact'
  className?: string
}

export function PremiumGate({ children, feature, description, variant = 'full', className }: PremiumGateProps) {
  const { isPremium, isLoading } = useSubscription()
  const { isAuthenticated, session } = useAuth()
  const navigate = useNavigate()
  const [isRedirecting, setIsRedirecting] = useState(false)

  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-lg bg-zinc-800/50 p-6" data-testid="premium-gate-skeleton">
        <div className="h-4 w-3/4 rounded bg-zinc-700" />
        <div className="mt-2 h-3 w-1/2 rounded bg-zinc-700" />
      </div>
    )
  }

  if (isPremium) {
    return <>{children}</>
  }

  const handleUpgrade = async () => {
    if (!isAuthenticated) {
      navigate('/account?returnTo=' + encodeURIComponent(window.location.pathname + window.location.search + window.location.hash))
      return
    }

    setIsRedirecting(true)
    setCheckoutError(null)
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
      })

      if (!response.ok) {
        setCheckoutError('Unable to start checkout. Please try again.')
        return
      }

      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Failed to create checkout session', error)
      setCheckoutError('Something went wrong. Please try again.')
    } finally {
      setIsRedirecting(false)
    }
  }

  if (variant === 'compact') {
    return (
      <div
        className={`rounded-lg border border-amber-500/30 bg-amber-500/10 p-3${className ? ` ${className}` : ''}`}
        data-testid="premium-gate-upsell"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-amber-400">{feature}</span>
          <span className="text-xs text-zinc-400">$19.99/year</span>
          <button
            onClick={handleUpgrade}
            disabled={isRedirecting}
            className="ml-auto min-h-11 min-w-11 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-zinc-900 transition-colors hover:bg-amber-400 disabled:opacity-50"
          >
            {isRedirecting ? 'Redirecting…' : 'Unlock with Premium'}
          </button>
        </div>
        {checkoutError && (
          <p role="alert" className="mt-1 text-xs text-red-400">{checkoutError}</p>
        )}
        <span className="mt-1 block text-xs text-zinc-500">Cancel anytime</span>
      </div>
    )
  }

  return (
    <div
      className={`rounded-lg border border-amber-500/30 bg-amber-500/10 p-6${className ? ` ${className}` : ''}`}
      data-testid="premium-gate-upsell"
    >
      <h3 className="text-lg font-semibold text-amber-400">{feature}</h3>
      {description && <p className="mt-1 text-sm text-zinc-300">{description}</p>}
      <p className="mt-3 text-sm text-zinc-400">$19.99/year</p>
      {checkoutError && (
        <p role="alert" className="mt-2 text-sm text-red-400">{checkoutError}</p>
      )}
      <button
        onClick={handleUpgrade}
        disabled={isRedirecting}
        className="mt-4 min-h-11 min-w-11 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-amber-400 disabled:opacity-50"
      >
        {isRedirecting ? 'Redirecting…' : 'Unlock with Premium'}
      </button>
      <p className="mt-2 text-xs text-zinc-500">Cancel anytime</p>
    </div>
  )
}
