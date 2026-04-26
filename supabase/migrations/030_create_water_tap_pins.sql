-- Migration 030: Create water_tap_pins table
-- Story 6.1 — Water Tap Database Schema & Storage Setup
--
-- Stores ML-discovered and user-submitted water tap pins for the Florida Keys corridor.
-- Requires PostGIS (enabled in migration 026: CREATE EXTENSION IF NOT EXISTS postgis).
--
-- Table: water_tap_pins
-- Indexes: GIST spatial, is_active B-tree, mile_marker partial B-tree

CREATE TABLE IF NOT EXISTS water_tap_pins (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location       geography(POINT, 4326) NOT NULL,
  place_name     TEXT        NOT NULL,
  place_type     TEXT        NOT NULL
                   CHECK (place_type IN ('gas_station', 'campground', 'restaurant')),
  access         TEXT,                               -- nullable: NULL = unclassified
  confidence     NUMERIC(3, 2) NOT NULL
                   CHECK (confidence BETWEEN 0.00 AND 1.00),  -- [0.00, 1.00] ML score range
  source         TEXT        NOT NULL
                   CHECK (source IN ('ml_batch', 'user_submission', 'manual')),
  photos         TEXT[]      NOT NULL DEFAULT '{}',  -- array of public storage URLs
  seasonal_notes TEXT,                               -- nullable: seasonal availability
  mile_marker    NUMERIC(5, 1),                      -- nullable: Florida Keys MM reference
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  verified_date  TIMESTAMPTZ,                        -- nullable: date of last verification
  place_ref      TEXT,                               -- nullable: Google Places ID or OSM node ID
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1. GiST spatial index for ST_DWithin proximity queries (lat/lng search)
CREATE INDEX IF NOT EXISTS idx_water_tap_pins_location
  ON water_tap_pins USING GIST(location);

-- 2. B-tree index on is_active — used in map_pins view WHERE is_active = TRUE
CREATE INDEX IF NOT EXISTS idx_water_tap_pins_is_active
  ON water_tap_pins (is_active);

-- 3. Partial B-tree index on mile_marker — Florida Keys corridor MM reference lookups
CREATE INDEX IF NOT EXISTS idx_water_tap_pins_mile_marker
  ON water_tap_pins (mile_marker)
  WHERE mile_marker IS NOT NULL;
