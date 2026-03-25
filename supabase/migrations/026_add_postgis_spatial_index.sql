-- Migration 026: Add PostGIS Spatial Index to pins table
-- Story 7.1 — PostGIS Spatial Index Migration
--
-- Adds a geography(Point, 4326) column with GiST index to the pins table
-- for fast spatial proximity queries (ST_DWithin) at national scale.
-- Keeps existing latitude/longitude columns unchanged.

-- 1. Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Add geography column (nullable for backward compatibility)
ALTER TABLE pins ADD COLUMN IF NOT EXISTS location geography(Point, 4326);

-- 3. Create trigger function to auto-populate location from lat/lng
CREATE OR REPLACE FUNCTION set_pin_location()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Attach trigger to pins table (fires on INSERT and UPDATE of lat/lng)
DROP TRIGGER IF EXISTS trg_set_pin_location ON pins;
CREATE TRIGGER trg_set_pin_location
  BEFORE INSERT OR UPDATE OF latitude, longitude
  ON pins
  FOR EACH ROW
  EXECUTE FUNCTION set_pin_location();

-- 5. Backfill existing data (idempotent — only updates rows with NULL location)
UPDATE pins
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND location IS NULL;

-- 6. Create GiST spatial index for ST_DWithin queries
CREATE INDEX IF NOT EXISTS idx_pins_location_gist ON pins USING GIST(location);
