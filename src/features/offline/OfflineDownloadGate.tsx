import type { ReactNode } from 'react'

interface OfflineDownloadGateProps {
  children?: ReactNode
  onStartPreview?: () => void
  className?: string
}

export function OfflineDownloadGate({ children, onStartPreview, className }: OfflineDownloadGateProps) {
  return (
    <div className={className}>
      {children ?? (
        <button
          type="button"
          onClick={onStartPreview}
          className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 min-h-11 text-sm font-medium text-foreground"
          data-testid="offline-download-button"
          aria-label="Download area for offline use"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Download area</span>
        </button>
      )}
    </div>
  )
}
