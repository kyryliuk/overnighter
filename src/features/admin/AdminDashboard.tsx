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

  const formOpen = showCreateForm || selectedPin !== null

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border px-6 py-3 flex items-center justify-between">
        <h1 className="text-base font-bold tracking-tight">Overnighter Admin</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowCreateForm(true); setSelectedPin(null); setEditSuccessMessage('') }}
            className="min-h-[44px] px-4 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            + Add Pin
          </button>
          <button
            onClick={handleSignOut}
            className="min-h-[44px] px-4 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {editSuccessMessage && (
          <p role="status" className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3">
            ✓ {editSuccessMessage}
          </p>
        )}

        {showCreateForm && (
          <CreatePinForm
            adminToken={adminToken}
            onSuccess={() => setShowCreateForm(false)}
            onCancel={() => setShowCreateForm(false)}
          />
        )}

        {selectedPin && (
          <EditPinForm
            pin={selectedPin}
            adminToken={adminToken}
            onSuccess={() => {
              setEditSuccessMessage('Pin updated successfully')
              setSelectedPin(null)
            }}
            onCancel={() => setSelectedPin(null)}
          />
        )}

        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Flagged Pins
          </h2>
          <FlaggedPinList adminToken={adminToken} />
        </section>

        {!formOpen && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              All Pins
            </h2>
            <AdminPinList onSelect={(pin) => { setEditSuccessMessage(''); setShowCreateForm(false); setSelectedPin(pin) }} />
          </section>
        )}
      </div>
    </div>
  )
}
