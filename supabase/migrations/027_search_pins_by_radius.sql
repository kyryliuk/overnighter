-- Migration 027: Radius-based search RPC functions
-- Depends on: 026_add_postgis_spatial_index.sql (PostGIS extension, location column, GiST index)

-- Search pins within a radius using PostGIS ST_DWithin (GiST-indexed)
CREATE OR REPLACE FUNCTION search_pins_by_radius(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_m INTEGER,
  p_limit INTEGER DEFAULT 200,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  pin_type TEXT,
  source_id TEXT,
  max_length_ft INTEGER,
  max_height_ft NUMERIC,
  website TEXT,
  phone TEXT,
  elevation_m NUMERIC,
  amenities JSONB,
  badge_state TEXT,
  last_check_in_at TIMESTAMPTZ,
  recent_check_in_count INTEGER,
  is_verified BOOLEAN,
  is_flagged BOOLEAN,
  location TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  distance_m DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id, p.name, p.description, p.latitude, p.longitude,
    p.pin_type, p.source_id, p.max_length_ft, p.max_height_ft,
    p.website, p.phone, p.elevation_m, p.amenities, p.badge_state,
    p.last_check_in_at, p.recent_check_in_count,
    p.is_verified, p.is_flagged,
    p.location::text,
    p.created_at, p.updated_at,
    ST_Distance(
      p.location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) AS distance_m
  FROM pins p
  WHERE p.is_archived = false
    AND p.location IS NOT NULL
    AND ST_DWithin(
      p.location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
  ORDER BY distance_m ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Count helper for pagination total (avoids returning all rows just to count)
CREATE OR REPLACE FUNCTION count_pins_by_radius(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_m INTEGER
)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM pins
  WHERE is_archived = false
    AND location IS NOT NULL
    AND ST_DWithin(
      location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    );
$$;
