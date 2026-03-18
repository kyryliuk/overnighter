import { create } from 'zustand'
import type { PinAmenities } from '@/types/pin'

type AmenityKey = keyof PinAmenities

interface AmenityFilterStore {
  activeFilters: AmenityKey[]
  toggleFilter: (amenity: AmenityKey) => void
  clearFilters: () => void
  isFilterActive: (amenity: AmenityKey) => boolean
}

// Plain create() — NOT persisted.
// Filters persist across pan/zoom (same session) via in-memory Zustand state,
// but reset on page reload (UX: user opens fresh, expects all pins visible).
export const useAmenityFilterStore = create<AmenityFilterStore>()((set, get) => ({
  activeFilters: [],
  toggleFilter: (amenity) =>
    set((state) => ({
      activeFilters: state.activeFilters.includes(amenity)
        ? state.activeFilters.filter((a) => a !== amenity)
        : [...state.activeFilters, amenity],
    })),
  clearFilters: () => set({ activeFilters: [] }),
  isFilterActive: (amenity) => get().activeFilters.includes(amenity),
}))
