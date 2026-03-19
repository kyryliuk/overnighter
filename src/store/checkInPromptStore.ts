import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface VisitRecord {
  pinId: string
  pinName: string
  latitude: number
  longitude: number
  visitKey: string // '${pinId}:${YYYY-MM-DD}'
}

interface CheckInPromptStore {
  visitRecords: VisitRecord[]
  dismissedKeys: string[]
  recordVisit: (pin: { id: string; name: string; latitude: number; longitude: number }) => void
  dismissVisit: (visitKey: string) => void
  isDismissed: (visitKey: string) => boolean
}

export const useCheckInPromptStore = create<CheckInPromptStore>()(
  persist(
    (set, get) => ({
      visitRecords: [],
      dismissedKeys: [],
      recordVisit: (pin) => {
        const today = new Date().toISOString().slice(0, 10)
        const visitKey = `${pin.id}:${today}`
        if (get().visitRecords.some((v) => v.visitKey === visitKey)) return
        set((state) => ({
          visitRecords: [
            { pinId: pin.id, pinName: pin.name, latitude: pin.latitude, longitude: pin.longitude, visitKey },
            ...state.visitRecords,
          ],
        }))
      },
      dismissVisit: (visitKey) =>
        set((state) => ({
          dismissedKeys: state.dismissedKeys.includes(visitKey)
            ? state.dismissedKeys
            : [...state.dismissedKeys, visitKey],
        })),
      isDismissed: (visitKey) => get().dismissedKeys.includes(visitKey),
    }),
    { name: 'checkin-prompt' }
  )
)
