import { useMemo, useState, type PropsWithChildren } from 'react'
import type { Trip } from '@/types/trip'
import { TripCorridorPreviewContext } from './TripCorridorPreviewContext'

export function TripCorridorPreviewProvider({ children }: PropsWithChildren) {
  const [previewTrip, setPreviewTrip] = useState<Trip | null>(null)
  const value = useMemo(() => ({ previewTrip, setPreviewTrip }), [previewTrip])

  return (
    <TripCorridorPreviewContext.Provider value={value}>
      {children}
    </TripCorridorPreviewContext.Provider>
  )
}
