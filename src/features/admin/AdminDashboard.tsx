import { useState } from 'react'
import AdminAuth, { ADMIN_TOKEN_KEY } from './AdminAuth'
import FlaggedPinList from './FlaggedPinList'
import CreatePinForm from './CreatePinForm'
import AdminPinList from './AdminPinList'
import EditPinForm from './EditPinForm'
import type { Pin } from '@/types/pin'

export default function AdminDashboard() {
  const [adminToken, setAdminToken] = useState<string | null>(
    () => sessionStorage.getItem(ADMIN_TOKEN_KEY),
  )
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null)
  const [editSuccessMessage, setEditSuccessMessage] = useState('')

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
      <button className="min-h-[44px] min-w-[44px]" onClick={() => setShowCreateForm(true)}>
        Add New Pin
      </button>
      {showCreateForm && (
        <CreatePinForm
          adminToken={adminToken}
          onSuccess={() => setShowCreateForm(false)}
          onCancel={() => setShowCreateForm(false)}
        />
      )}
      {editSuccessMessage && <p role="status">{editSuccessMessage}</p>}
      {selectedPin ? (
        <EditPinForm
          pin={selectedPin}
          adminToken={adminToken}
          onSuccess={() => {
            setEditSuccessMessage('Pin updated successfully')
            setSelectedPin(null)
          }}
          onCancel={() => setSelectedPin(null)}
        />
      ) : (
        <AdminPinList onSelect={(pin) => { setEditSuccessMessage(''); setShowCreateForm(false); setSelectedPin(pin) }} />
      )}
      <FlaggedPinList adminToken={adminToken} />
    </div>
  )
}
