import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type SignUpResult =
  | { status: 'authenticated' }
  | { status: 'email-confirmation-required'; email: string }

export interface AuthContextValue {
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  isSigningUp: boolean
  isSyncing: boolean
  syncError: string | null
  lastSyncedAt: string | null
  signUp: (email: string, password: string) => Promise<SignUpResult>
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
