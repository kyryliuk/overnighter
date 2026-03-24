// Supabase-generated database types (snake_case)
// These types are ONLY used inside src/lib/supabase/ helpers.
// Never let these snake_case types leak into components or stores.

export interface DbPin {
  id: string
  name: string
  description: string | null
  latitude: number
  longitude: number
  pin_type: string
  source_id: string | null
  max_length_ft: number | null
  max_height_ft: number | null
  website: string | null
  phone: string | null
  elevation_m: number | null
  amenities: Record<string, boolean>
  badge_state: string
  last_check_in_at: string | null
  recent_check_in_count: number
  is_verified: boolean
  is_flagged: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface DbCheckIn {
  id: string
  pin_id: string
  device_id: string
  status: string
  checked_in_at: string
  notes: string | null
}

export interface DbIssueReport {
  id: string
  pin_id: string
  device_id: string
  report_type: string
  notes: string | null
  status: string
  created_at: string
  resolved_at: string | null
}

export interface DbRigProfile {
  user_id: string
  rig_type: string | null
  length_ft: number | null
  height_ft: number | null
  onboarding_dismissed: boolean
  updated_at: string
}

export interface DbSavedSpot {
  user_id: string
  pin_id: string
  pin_snapshot: Record<string, unknown>
  updated_at: string
}

export interface DbTripPlan {
  user_id: string
  plan_id: string
  plan_snapshot: Record<string, unknown>
  is_public: boolean
  share_token: string | null
  updated_at: string
}

export interface DbTripPlanReaction {
  share_token: string
  user_id: string
  reaction: string
  created_at: string
  updated_at: string
}

export interface DbTripPlanComment {
  id: string
  share_token: string
  user_id: string
  author_label: string
  body: string
  created_at: string
}

export interface DbPinPhoto {
  id: string
  check_in_id: string
  user_id: string
  storage_path: string
  cdn_url: string
  created_at: string
}

export interface DbSpotSubmission {
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
