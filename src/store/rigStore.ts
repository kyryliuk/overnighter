import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type RigProfile, DEFAULT_RIG_PROFILE } from '@/types/rigProfile'

interface RigStore {
  rigProfile: RigProfile
  setRigProfile: (profile: RigProfile) => void
  clearRigProfile: () => void
  hasRigProfile: () => boolean
}

export const useRigStore = create<RigStore>()(
  persist(
    (set, get) => ({
      rigProfile: DEFAULT_RIG_PROFILE,
      setRigProfile: (profile) => set({ rigProfile: profile }),
      clearRigProfile: () => set({ rigProfile: DEFAULT_RIG_PROFILE }),
      hasRigProfile: () => get().rigProfile.rigType !== null,
    }),
    { name: 'rig-profile' }
  )
)
