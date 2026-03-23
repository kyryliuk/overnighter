export interface TripPlanPlace {
  id: string
  name: string
  latitude: number
  longitude: number
}

export interface TripPlanSource {
  shareToken: string
  title: string
}

export interface TripPlan {
  id: string
  title: string
  notes: string
  destination: TripPlanPlace
  stops: TripPlanPlace[]
  isPublic: boolean
  shareToken: string | null
  sourceTrip: TripPlanSource | null
  createdAt: string
  updatedAt: string
}
