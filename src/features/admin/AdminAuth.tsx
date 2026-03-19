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
        cache: 'no-store', // prevent cached 200 OK surviving token rotation
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
    <form onSubmit={handleSubmit}>
      <input
        type="password"
        aria-label="Admin token"
        placeholder="Enter admin token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        className="min-h-[44px] min-w-[44px]"
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={!token || isLoading}
        className="min-h-[44px] min-w-[44px]"
      >
        {isLoading ? 'Verifying…' : 'Sign In'}
      </button>
      {errorMsg && <p role="alert">{errorMsg}</p>}
    </form>
  )
}
