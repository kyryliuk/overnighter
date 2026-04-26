import { useState, useEffect, useRef } from 'react'

const VISIT_COUNT_KEY = 'pwa-visit-count'
const DISMISSED_KEY = 'pwa-install-dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function hasEngagementCriteria(): boolean {
  // Must have visited at least twice
  const visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10)
  if (visitCount < 2) return false

  // Must have saved at least one spot
  try {
    const raw = localStorage.getItem('saved-spots')
    if (!raw) return false
    const parsed = JSON.parse(raw)
    const spots = parsed?.state?.savedSpots
    if (!Array.isArray(spots) || spots.length === 0) return false
  } catch {
    return false
  }

  return true
}

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 768px)').matches
}

function isAlreadyInstalled(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
}

export default function PWAInstallPrompt() {
  const [visible, setVisible] = useState(false)
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Increment visit counter only on mobile, non-installed
    if (!isMobileDevice() || isAlreadyInstalled()) return
    const count = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10)
    localStorage.setItem(VISIT_COUNT_KEY, String(count + 1))
  }, [])

  useEffect(() => {
    // Don't set up listener on desktop or if already installed
    if (!isMobileDevice() || isAlreadyInstalled()) return

    function handleBeforeInstall(e: Event) {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent

      // Check engagement criteria and session dismissal
      const dismissed = sessionStorage.getItem(DISMISSED_KEY) === 'true'
      if (!dismissed && hasEngagementCriteria()) {
        setVisible(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  async function handleInstall() {
    const prompt = deferredPrompt.current
    if (!prompt) return

    try {
      await prompt.prompt()
      await prompt.userChoice
    } catch { /* browser cancelled */ }
    deferredPrompt.current = null
    setVisible(false)
  }

  function handleDismiss() {
    sessionStorage.setItem(DISMISSED_KEY, 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Install Overnighter"
        className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border rounded-t-2xl p-6"
      >
        <div className="flex flex-col items-center gap-4">
          <img
            src="/pwa-icon.svg"
            alt="Overnighter"
            className="h-16 w-16"
          />
          <div className="text-center">
            <h2 className="text-lg font-semibold">Overnighter</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Install for a faster, app-like experience with offline access.
            </p>
          </div>
          <div className="flex w-full gap-3">
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-1 min-h-11 min-w-11 rounded-lg border border-border px-4 py-2 text-sm font-medium"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={handleInstall}
              className="flex-1 min-h-11 min-w-11 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white"
            >
              Add to Home Screen
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
