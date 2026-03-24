import type { ReactNode } from 'react'
import { PremiumGate } from '@/components/PremiumGate'

interface OfflineDownloadGateProps {
  children?: ReactNode
  className?: string
}

export function OfflineDownloadGate({ children, className }: OfflineDownloadGateProps) {
  return (
    <PremiumGate
      feature="Offline Maps"
      description="Download map areas for offline use when you have no signal."
      className={className}
    >
      {children ?? <div data-testid="offline-download-placeholder">Download area</div>}
    </PremiumGate>
  )
}
