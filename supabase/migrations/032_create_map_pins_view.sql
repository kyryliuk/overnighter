-- Migration 032: Create unified map_pins view
-- Story 6.1 — Water Tap Database Schema & Storage Setup
--
-- Provides a single view consumed by PinLayer.tsx and any server-side pin queries
-- that need to iterate all active map pins regardless of category.
--
-- pin_category discriminator:
--   'regular'   → pins table (campgrounds, BLM, NPS, Overpass, community stops)
--   'water_tap' → water_tap_pins table (ML-discovered and user-submitted taps)
--
-- NOTES:
--   - pins uses is_archived (added migration 009); active = is_archived = FALSE
--   - water_tap_pins uses is_active; active = is_active = TRUE
--   - pins.location geography(Point, 4326) was added in migration 026
--   - pins.name is aliased to place_name for a uniform column interface
--
-- PinLayer.tsx routes on pin_category:
--   'regular'   → existing PinDetailSheet (/pin/:id)
--   'water_tap' → TapPinDetailSheet (/tap/:id)  [Story 6.4]

CREATE OR REPLACE VIEW map_pins AS
  -- Regular stop pins (campgrounds, BLM/USFS/NPS, Overpass, community)
  SELECT
    id,
    location,
    'regular'::TEXT  AS pin_category,
    name             AS place_name
  FROM pins
  WHERE is_archived = FALSE

  UNION ALL

  -- Water tap pins (ML-discovered + user-submitted)
  SELECT
    id,
    location,
    'water_tap'::TEXT AS pin_category,
    place_name
  FROM water_tap_pins
  WHERE is_active = TRUE;
