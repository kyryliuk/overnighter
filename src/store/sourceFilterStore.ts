import { create } from 'zustand'
import type { PinSource } from '@/types/pin'

export type SourceGroup = 'gov' | 'osm' | 'community'

export const GROUP_SOURCES: Record<SourceGroup, PinSource[]> = {
  gov:       ['blm', 'usfs', 'nps'],
  osm:       ['overpass'],
  community: ['community'],
}

interface SourceFilterStore {
  activeGroups: SourceGroup[]
  toggleGroup: (group: SourceGroup) => void
  clearGroups: () => void
  isGroupActive: (group: SourceGroup) => boolean
}

export const useSourceFilterStore = create<SourceFilterStore>()((set, get) => ({
  activeGroups: [],
  toggleGroup: (group) =>
    set((state) => ({
      activeGroups: state.activeGroups.includes(group)
        ? state.activeGroups.filter((g) => g !== group)
        : [...state.activeGroups, group],
    })),
  clearGroups: () => set({ activeGroups: [] }),
  isGroupActive: (group) => get().activeGroups.includes(group),
}))
