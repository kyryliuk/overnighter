import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type RigProfile, DEFAULT_RIG_PROFILE } from '@/types/rigProfile'

interface RigStore {
  rigProfile: RigProfile
  onboardingDismissed: boolean
  updatedAt: string | null
  hasHydrated: boolean
  setRigProfile: (profile: RigProfile, updatedAt?: string) => void
  clearRigProfile: (updatedAt?: string) => void
  hasRigProfile: () => boolean
  setOnboardingDismissed: (updatedAt?: string) => void
  replaceFromCloud: (profile: RigProfile, onboardingDismissed: boolean, updatedAt: string | null) => void
  markHydrated: () => void
}

export const useRigStore = create<RigStore>()(
  persist(
    (set, get) => ({
      rigProfile: DEFAULT_RIG_PROFILE,
      onboardingDismissed: false,
      updatedAt: null,
      hasHydrated: false,
      setRigProfile: (profile, updatedAt = new Date().toISOString()) => set({ rigProfile: profile, updatedAt }),
      clearRigProfile: (updatedAt = new Date().toISOString()) =>
        set({ rigProfile: DEFAULT_RIG_PROFILE, onboardingDismissed: false, updatedAt }),
      hasRigProfile: () => get().rigProfile.rigType !== null,
      setOnboardingDismissed: (updatedAt = new Date().toISOString()) =>
        set({ onboardingDismissed: true, updatedAt }),
      replaceFromCloud: (profile, onboardingDismissed, updatedAt) =>
        set({ rigProfile: profile, onboardingDismissed, updatedAt }),
      markHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: 'rig-profile',
      partialize: (state) => ({
        rigProfile: state.rigProfile,
        onboardingDismissed: state.onboardingDismissed,
        updatedAt: state.updatedAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated()
      },
    }
  )
)
