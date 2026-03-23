import { useState } from 'react'

export const ADMIN_TOKEN_KEY = 'overnighter_admin_token'

interface AdminAuthProps {
  onAuthenticated: () => void
}

export default function AdminAuth({ onAuthenticated }: AdminAuthProps) {
  const [token, setToken] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })

      if (res.ok) {
        sessionStorage.setItem(ADMIN_TOKEN_KEY, token)
        onAuthenticated()
      } else if (res.status === 401) {
        setErrorMsg('Invalid admin token')
      } else {
        setErrorMsg("Couldn't verify token. Check connection.")
      }
    } catch {
      setErrorMsg("Couldn't verify token. Check connection.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Overnighter Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your admin token to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-secondary border border-border rounded-xl p-6 space-y-4">
          <div>
            <label htmlFor="admin-token" className="block text-sm font-medium text-foreground mb-1">
              Admin Token
            </label>
            <input
              id="admin-token"
              type="password"
              aria-label="Admin token"
              placeholder="••••••••••••••••"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]"
            />
          </div>
          {errorMsg && (
            <p role="alert" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}
          <button
            type="submit"
            disabled={!token || isLoading}
            className="w-full min-h-[44px] bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Verifying…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
