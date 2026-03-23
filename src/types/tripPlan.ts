export interface TripPlanPlace {
  id: string
  name: string
  latitude: number
  longitude: number
}

export interface TripPlan {
  id: string
  title: string
  destination: TripPlanPlace
  stops: TripPlanPlace[]
  createdAt: string
  updatedAt: string
}
