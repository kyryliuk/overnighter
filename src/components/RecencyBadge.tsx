import type { BadgeColor } from '@/types/pin'

interface RecencyBadgeProps {
  badgeState: BadgeColor
}

const BADGE_CONFIG: Record<BadgeColor, { bg: string; color: string; icon: string; label: string }> = {
  green: {
    bg: 'rgba(34,197,94,0.15)',
    color: '#22c55e',
    icon: '✓',
    label: 'Verified',
  },
  yellow: {
    bg: 'rgba(234,179,8,0.15)',
    color: '#eab308',
    icon: '🕐',
    label: 'Verified 8–30 days ago',
  },
  red: {
    bg: 'rgba(239,68,68,0.15)',
    color: '#ef4444',
    icon: '⚠',
    label: 'Stale — verify before visiting',
  },
  grey: {
    bg: 'rgba(107,114,128,0.15)',
    color: '#6b7280',
    icon: '?',
    label: 'Unknown recency',
  },
}

export default function RecencyBadge({ badgeState }: RecencyBadgeProps) {
  const config = BADGE_CONFIG[badgeState] ?? BADGE_CONFIG.grey
  return (
    <span
      role="status"
      aria-label={config.label}
      style={{ backgroundColor: config.bg, color: config.color }}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium"
    >
      <span aria-hidden="true">{config.icon}</span>
      {config.label}
    </span>
  )
}
