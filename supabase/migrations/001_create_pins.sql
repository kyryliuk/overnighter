-- Migration: Create pins table
-- Stores all campsite/stop pins from BLM, USFS, NPS, Overpass, and community sources

CREATE TABLE pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  pin_type TEXT NOT NULL CHECK (pin_type IN ('blm', 'usfs', 'nps', 'overpass', 'community')),
  source_id TEXT,                    -- Original ID from source system (deduplication)
  max_length_ft INTEGER,             -- NULL = no restriction; used for rig-aware filtering
  max_height_ft DOUBLE PRECISION,    -- NULL = no restriction; used for rig-aware filtering
  amenities JSONB NOT NULL DEFAULT '{"water":false,"dump":false,"electric":false,"shower":false,"fuel":false,"propane":false,"overnight":false}',
  badge_state TEXT NOT NULL DEFAULT 'grey' CHECK (badge_state IN ('green', 'yellow', 'red', 'grey')),
  last_check_in_at TIMESTAMPTZ,
  recent_check_in_count INTEGER NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pins_coordinates ON pins (latitude, longitude);
CREATE INDEX idx_pins_badge_state ON pins (badge_state);
CREATE INDEX idx_pins_pin_type ON pins (pin_type);
CREATE INDEX idx_pins_source_id ON pins (source_id) WHERE source_id IS NOT NULL;
