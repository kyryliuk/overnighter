import './reactRefreshShim'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { inject } from '@vercel/analytics'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
  environment: import.meta.env.MODE,
  // Only enable in production to avoid noise in development
  enabled: import.meta.env.PROD,
})

// Vercel Analytics — no-op in local dev
inject()

if (import.meta.env.PROD) {
  registerSW({ immediate: true })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
