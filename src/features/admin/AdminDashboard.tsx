import { useState } from 'react'
import AdminAuth, { ADMIN_TOKEN_KEY } from './AdminAuth'
import FlaggedPinList from './FlaggedPinList'

export default function AdminDashboard() {
  const [adminToken, setAdminToken] = useState<string | null>(
    () => sessionStorage.getItem(ADMIN_TOKEN_KEY),
  )

  function handleAuthenticated() {
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY)
    setAdminToken(token)
  }

  function handleSignOut() {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY)
    setAdminToken(null)
  }

  if (adminToken === null) {
    return <AdminAuth onAuthenticated={handleAuthenticated} />
  }

  return (
    <div>
      <h1>Admin Dashboard</h1>
      <button onClick={handleSignOut} className="min-h-[44px] min-w-[44px]">
        Sign Out
      </button>
      <FlaggedPinList adminToken={adminToken} />
    </div>
  )
}
