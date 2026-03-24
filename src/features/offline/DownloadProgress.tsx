import { useEffect } from 'react'

interface DownloadProgressProps {
  progress: number
  total: number
  status: 'downloading' | 'complete' | 'error'
  onRetry: () => void
  onDismiss: () => void
}

export function DownloadProgress({
  progress,
  total,
  status,
  onRetry,
  onDismiss,
}: DownloadProgressProps) {
  useEffect(() => {
    if (status === 'complete') {
      const timer = setTimeout(onDismiss, 3000)
      return () => clearTimeout(timer)
    }
  }, [status, onDismiss])

  const pct = total > 0 ? Math.round((progress / total) * 100) : 0

  if (status === 'error') {
    return (
      <div
        className="bg-background/95 border border-border rounded-lg px-4 py-2 flex items-center gap-3"
        data-testid="download-progress"
      >
        <span className="text-sm text-red-500 flex-1">Download failed</span>
        <button
          type="button"
          onClick={onRetry}
          className="text-sm text-blue-500 font-medium min-h-11 min-w-11"
        >
          Retry
        </button>
      </div>
    )
  }

  if (status === 'complete') {
    return (
      <div
        className="bg-background/95 border border-border rounded-lg px-4 py-2 flex items-center gap-2"
        data-testid="download-progress"
      >
        <span className="text-green-500">✓</span>
        <span className="text-sm text-foreground">Offline ready</span>
      </div>
    )
  }

  return (
    <div
      className="bg-background/95 border border-border rounded-lg px-4 py-2"
      data-testid="download-progress"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-foreground">Downloading tiles…</span>
        <span className="text-sm text-muted-foreground">{pct}%</span>
      </div>
      <div
        className="h-1.5 bg-muted rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
