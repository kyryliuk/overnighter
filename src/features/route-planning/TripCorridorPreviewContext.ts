import { createContext, useContext } from 'react'
import type { Trip } from '@/types/trip'

export interface TripCorridorPreviewContextValue {
  previewTrip: Trip | null
  setPreviewTrip: (trip: Trip | null) => void
}

const noop = () => {}

export const TripCorridorPreviewContext = createContext<TripCorridorPreviewContextValue>({
  previewTrip: null,
  setPreviewTrip: noop,
})

export function useTripCorridorPreview() {
  return useContext(TripCorridorPreviewContext)
}
