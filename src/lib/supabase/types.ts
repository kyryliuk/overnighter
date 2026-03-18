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
  amenities: Record<string, boolean>
  badge_state: string
  last_check_in_at: string | null
  recent_check_in_count: number
  is_verified: boolean
  is_flagged: boolean
  created_at: string
  updated_at: string
}

export interface DbCheckIn {
  id: string
  pin_id: string
  device_id: string
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
