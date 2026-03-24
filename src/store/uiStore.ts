import { create } from 'zustand'

interface UIStore {
  selectedPinId: string | null
  isAdminPanelOpen: boolean
  pendingMapCenter: { lat: number; lng: number } | null
  pendingCheckIn: { pinId: string } | null
  pendingReport: { pinId: string } | null
  updateAvailable: boolean
  setSelectedPin: (pinId: string | null) => void
  openAdminPanel: () => void
  closeAdminPanel: () => void
  setPendingMapCenter: (center: { lat: number; lng: number } | null) => void
  setPendingCheckIn: (state: { pinId: string } | null) => void
  setPendingReport: (state: { pinId: string } | null) => void
  setUpdateAvailable: (available: boolean) => void
}

export const useUIStore = create<UIStore>()((set) => ({
  selectedPinId: null,
  isAdminPanelOpen: false,
  pendingMapCenter: null,
  pendingCheckIn: null,
  pendingReport: null,
  updateAvailable: false,
  setSelectedPin: (pinId) => set({ selectedPinId: pinId }),
  openAdminPanel: () => set({ isAdminPanelOpen: true }),
  closeAdminPanel: () => set({ isAdminPanelOpen: false }),
  setPendingMapCenter: (center) => set({ pendingMapCenter: center }),
  setPendingCheckIn: (state) => set({ pendingCheckIn: state }),
  setPendingReport: (state) => set({ pendingReport: state }),
  setUpdateAvailable: (available) => set({ updateAvailable: available }),
}))
