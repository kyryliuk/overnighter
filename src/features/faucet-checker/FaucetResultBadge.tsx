import type { FaucetLabel } from './useFaucetClassifier'

interface FaucetResultBadgeProps {
  label: FaucetLabel | null
  confidence: number | null
  isLoading: boolean
}

const BADGE_CONFIG: Record<FaucetLabel, { bg: string; text: string; icon: string; description: string }> = {
  working: {
    bg: 'bg-green-500/15 border-green-500/40',
    text: 'text-green-600 dark:text-green-400',
    icon: '💧',
    description: 'Working',
  },
  broken: {
    bg: 'bg-red-500/15 border-red-500/40',
    text: 'text-red-600 dark:text-red-400',
    icon: '⚠️',
    description: 'Broken',
  },
  no_faucet: {
    bg: 'bg-muted border-border',
    text: 'text-muted-foreground',
    icon: '❌',
    description: 'No Faucet Detected',
  },
}

export default function FaucetResultBadge({ label, confidence, isLoading }: FaucetResultBadgeProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-muted/40 animate-pulse">
        <div className="w-8 h-8 rounded-full bg-muted" />
        <div className="flex flex-col gap-1.5">
          <div className="h-4 w-28 rounded bg-muted" />
          <div className="h-3 w-20 rounded bg-muted" />
        </div>
      </div>
    )
  }

  if (!label || confidence === null) return null

  const config = BADGE_CONFIG[label]

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${config.bg}`}
    >
      <span className="text-2xl leading-none" aria-hidden="true">{config.icon}</span>
      <div className="flex flex-col">
        <span className={`font-semibold text-base ${config.text}`}>{config.description}</span>
        <span className="text-sm text-muted-foreground">
          {Math.round(confidence * 100)}% confident
        </span>
      </div>
    </div>
  )
}
