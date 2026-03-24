import type { PinAmenities } from '@/types/pin'

export type SpotSubmissionStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested'

export interface SpotSubmission {
  id: string
  userId: string
  name: string
  description: string | null
  latitude: number
  longitude: number
  amenities: PinAmenities
  maxLengthFt: number | null
  maxHeightFt: number | null
  website: string | null
  phone: string | null
  status: SpotSubmissionStatus
  adminNotes: string | null
  reviewedAt: string | null
  publishedPinId: string | null
  createdAt: string
  updatedAt: string
}
