import { create } from 'zustand'

interface UIStore {
  selectedPinId: string | null
  isAdminPanelOpen: boolean
  pendingMapCenter: { lat: number; lng: number } | null
  setSelectedPin: (pinId: string | null) => void
  openAdminPanel: () => void
  closeAdminPanel: () => void
  setPendingMapCenter: (center: { lat: number; lng: number } | null) => void
}

export const useUIStore = create<UIStore>()((set) => ({
  selectedPinId: null,
  isAdminPanelOpen: false,
  pendingMapCenter: null,
  setSelectedPin: (pinId) => set({ selectedPinId: pinId }),
  openAdminPanel: () => set({ isAdminPanelOpen: true }),
  closeAdminPanel: () => set({ isAdminPanelOpen: false }),
  setPendingMapCenter: (center) => set({ pendingMapCenter: center }),
}))
