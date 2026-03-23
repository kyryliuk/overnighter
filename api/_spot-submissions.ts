export interface ApiDbSpotSubmission {
  id: string
  user_id: string
  name: string
  description: string | null
  latitude: number
  longitude: number
  amenities: Record<string, boolean>
  max_length_ft: number | null
  max_height_ft: number | null
  website: string | null
  phone: string | null
  status: string
  admin_notes: string | null
  reviewed_at: string | null
  published_pin_id: string | null
  created_at: string
  updated_at: string
}

export function mapSpotSubmission(record: ApiDbSpotSubmission) {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    latitude: record.latitude,
    longitude: record.longitude,
    amenities: record.amenities,
    maxLengthFt: record.max_length_ft,
    maxHeightFt: record.max_height_ft,
    website: record.website,
    phone: record.phone,
    status: record.status,
    adminNotes: record.admin_notes,
    reviewedAt: record.reviewed_at,
    publishedPinId: record.published_pin_id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}
