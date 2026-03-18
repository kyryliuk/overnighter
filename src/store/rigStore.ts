import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type RigProfile, DEFAULT_RIG_PROFILE } from '@/types/rigProfile'

interface RigStore {
  rigProfile: RigProfile
  onboardingDismissed: boolean
  setRigProfile: (profile: RigProfile) => void
  clearRigProfile: () => void
  hasRigProfile: () => boolean
  setOnboardingDismissed: () => void
}

export const useRigStore = create<RigStore>()(
  persist(
    (set, get) => ({
      rigProfile: DEFAULT_RIG_PROFILE,
      onboardingDismissed: false,
      setRigProfile: (profile) => set({ rigProfile: profile }),
      clearRigProfile: () => set({ rigProfile: DEFAULT_RIG_PROFILE, onboardingDismissed: false }),
      hasRigProfile: () => get().rigProfile.rigType !== null,
      setOnboardingDismissed: () => set({ onboardingDismissed: true }),
    }),
    { name: 'rig-profile' }
  )
)
