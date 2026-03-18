import { create } from 'zustand'

interface UIStore {
  selectedPinId: string | null
  isAdminPanelOpen: boolean
  setSelectedPin: (pinId: string | null) => void
  openAdminPanel: () => void
  closeAdminPanel: () => void
}

export const useUIStore = create<UIStore>()((set) => ({
  selectedPinId: null,
  isAdminPanelOpen: false,
  setSelectedPin: (pinId) => set({ selectedPinId: pinId }),
  openAdminPanel: () => set({ isAdminPanelOpen: true }),
  closeAdminPanel: () => set({ isAdminPanelOpen: false }),
}))
