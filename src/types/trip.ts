import type { TripPlanPlace } from './tripPlan'

export type TripPlaceSnapshot = TripPlanPlace

export type TripStatus = 'draft' | 'archived'
export type TripRouteMode = 'corridor'
export type TripStopKind = 'waypoint' | 'destination'
export type TripStopSource = 'manual' | 'saved' | 'suggested' | 'imported'

export interface TripStop {
  id: string
  stopOrder: number
  stopKind: TripStopKind
  source: TripStopSource
  pinId: string | null
  place: TripPlaceSnapshot
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Trip {
  id: string
  title: string
  notes: string
  status: TripStatus
  origin: TripPlaceSnapshot | null
  destination: TripPlaceSnapshot
  routeMode: TripRouteMode
  stopCount: number
  revision: number
  isPublic: boolean
  shareToken: string | null
  sourceTripId: string | null
  sourceShareToken: string | null
  createdAt: string
  updatedAt: string
  stops: TripStop[]
}

export interface TripWaypointInput {
  id?: string
  stopOrder: number
  source?: TripStopSource
  pinId?: string | null
  place: TripPlaceSnapshot
  notes?: string
}

export interface TripWritePayload {
  title?: string
  notes?: string
  origin?: TripPlaceSnapshot | null
  destination: TripPlaceSnapshot
  routeMode?: TripRouteMode
  stops?: TripWaypointInput[]
  sourceTripId?: string
}
