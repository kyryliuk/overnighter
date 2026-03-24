import type { ReactNode } from 'react'
import { PremiumGate } from '@/components/PremiumGate'

interface OfflineDownloadGateProps {
  children?: ReactNode
  onStartPreview?: () => void
  className?: string
}

export function OfflineDownloadGate({ children, onStartPreview, className }: OfflineDownloadGateProps) {
  return (
    <PremiumGate
      feature="Offline Maps"
      description="Download map areas for offline use when you have no signal."
      className={className}
    >
      {children ?? (
        <button
          type="button"
          onClick={onStartPreview}
          className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 min-h-11 text-sm font-medium"
          data-testid="offline-download-button"
          aria-label="Download area for offline use"
        >
          <span className="text-blue-500" aria-hidden="true">📥</span>
          <span>Download area</span>
        </button>
      )}
    </PremiumGate>
  )
}
