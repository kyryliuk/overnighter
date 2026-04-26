export type PinSource = 'blm' | 'usfs' | 'nps' | 'overpass' | 'community' | 'water_tap'

export type BadgeColor = 'green' | 'yellow' | 'red' | 'grey'

export interface RigConstraints {
  maxLengthFt: number | null
  maxHeightFt: number | null
}

export interface PinAmenities {
  // Infrastructure
  water: boolean
  dump: boolean
  electric: boolean
  shower: boolean
  fuel: boolean
  propane: boolean
  overnight: boolean
  toilets: boolean
  pets: boolean
  wifi: boolean
  kitchen: boolean
  restaurant: boolean
  big_rig: boolean
  tent: boolean
  // Entertainment / outdoor activities
  hiking: boolean
  fishing: boolean
  swimming: boolean
  boating: boolean
  biking: boolean
  ohv: boolean
  climbing: boolean
  winter_sports: boolean
  hunting: boolean
  wildlife: boolean
  horseback: boolean
  hot_springs: boolean
}

export interface Pin {
  id: string
  name: string
  /** Optional discriminator — 'water_tap' routes to /tap/:id instead of /pin/:id */
  pinCategory?: string
  description: string | null
  latitude: number
  longitude: number
  pinType: PinSource
  sourceId: string | null
  maxLengthFt: number | null
  maxHeightFt: number | null
  website: string | null
  phone: string | null
  elevationM: number | null
  amenities: PinAmenities
  badgeState: BadgeColor
  lastCheckInAt: string | null
  recentCheckInCount: number
  isVerified: boolean
  isFlagged: boolean
  createdAt: string
  updatedAt: string
}
