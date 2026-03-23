import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type Pin } from '@/types/pin'

interface SpotsStore {
  savedSpots: Pin[]
  saveSpot: (pin: Pin) => void
  removeSpot: (pinId: string) => void
  isSaved: (pinId: string) => boolean
}

export const useSpotsStore = create<SpotsStore>()(
  persist(
    (set, get) => ({
      savedSpots: [],
      saveSpot: (pin) =>
        set((state) => ({
          savedSpots: [...state.savedSpots.filter((s) => s.id !== pin.id), pin],
        })),
      removeSpot: (pinId) =>
        set((state) => ({
          savedSpots: state.savedSpots.filter((s) => s.id !== pinId),
        })),
      isSaved: (pinId) => get().savedSpots.some((s) => s.id === pinId),
    }),
    { name: 'saved-spots' }
  )
)
