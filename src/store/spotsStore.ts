import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type Pin } from '@/types/pin'

interface SpotsStore {
  savedSpots: Pin[]
  hasHydrated: boolean
  saveSpot: (pin: Pin) => void
  removeSpot: (pinId: string) => void
  isSaved: (pinId: string) => boolean
  replaceSavedSpots: (spots: Pin[]) => void
  markHydrated: () => void
}

export const useSpotsStore = create<SpotsStore>()(
  persist(
    (set, get) => ({
      savedSpots: [],
      hasHydrated: false,
      saveSpot: (pin) =>
        set((state) => ({
          savedSpots: [...state.savedSpots.filter((s) => s.id !== pin.id), pin],
        })),
      removeSpot: (pinId) =>
        set((state) => ({
          savedSpots: state.savedSpots.filter((s) => s.id !== pinId),
        })),
      isSaved: (pinId) => get().savedSpots.some((s) => s.id === pinId),
      replaceSavedSpots: (spots) => set({ savedSpots: spots }),
      markHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: 'saved-spots',
      partialize: (state) => ({ savedSpots: state.savedSpots }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated()
      },
    }
  )
)
