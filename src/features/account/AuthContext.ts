import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export interface AuthContextValue {
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  isSendingLink: boolean
  pendingEmail: string | null
  isSyncing: boolean
  syncError: string | null
  lastSyncedAt: string | null
  requestMagicLink: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
