export type RigType = 'Class A' | 'Class B' | 'Class C' | 'Travel Trailer' | '5th Wheel'

export interface RigProfile {
  rigType: RigType | null
  lengthFt: number | null
  heightFt: number | null
}

export const DEFAULT_RIG_PROFILE: RigProfile = {
  rigType: null,
  lengthFt: null,
  heightFt: null,
}
