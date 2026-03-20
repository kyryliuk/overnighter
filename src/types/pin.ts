export type PinSource = 'blm' | 'usfs' | 'nps' | 'overpass' | 'community'

export type BadgeColor = 'green' | 'yellow' | 'red' | 'grey'

export interface RigConstraints {
  maxLengthFt: number | null
  maxHeightFt: number | null
}

export interface PinAmenities {
  water: boolean
  dump: boolean
  electric: boolean
  shower: boolean
  fuel: boolean
  propane: boolean
  overnight: boolean
  toilets: boolean
  pets: boolean
}

export interface Pin {
  id: string
  name: string
  description: string | null
  latitude: number
  longitude: number
  pinType: PinSource
  sourceId: string | null
  maxLengthFt: number | null
  maxHeightFt: number | null
  amenities: PinAmenities
  badgeState: BadgeColor
  lastCheckInAt: string | null
  recentCheckInCount: number
  isVerified: boolean
  isFlagged: boolean
  createdAt: string
  updatedAt: string
}
