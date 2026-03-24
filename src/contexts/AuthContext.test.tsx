import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { AuthContext, useAuth, type AuthContextValue } from './AuthContext'

describe('contexts/AuthContext', () => {
  it('throws when useAuth is called without provider', () => {
    expect(() => renderHook(() => useAuth())).toThrowError('useAuth must be used within an AuthProvider')
  })

  it('returns context value when provider is present', () => {
    const value: AuthContextValue = {
      session: null as Session | null,
      isLoading: false,
      isAuthenticated: true,
      isSigningUp: false,
      isSyncing: false,
      syncError: null,
      lastSyncedAt: null,
      signUp: async () => {},
      signOut: async () => {},
    }

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.isLoading).toBe(false)
  })
})
