-- Migration 034: Enhance map_pins view + add search_water_taps_by_radius RPC
-- Story 6.6 — Unified Map Pin Integration
--
-- Replaces the minimal 4-column map_pins view (migration 032) with a full-column
-- version that includes all rendering data needed by PinLayer.tsx and api/pins.ts.
--
-- Also adds search_water_taps_by_radius RPC for viewport-aware water tap queries
-- using the GiST spatial index on water_tap_pins.location (migration 030).
--
-- pin_category discriminator (unchanged from migration 032):
--   'regular'   → pins table (campgrounds, BLM, NPS, Overpass, community stops)
--   'water_tap' → water_tap_pins table (ML-discovered and user-submitted taps)
--
-- badge_state for water_tap rows is computed from verified_date:
--   NULL verified_date        → 'red'
--   verified within 7 days   → 'green'
--   verified within 30 days  → 'yellow'
--   verified >30 days ago     → 'red'
--
-- amenities for water_tap rows: always '{"water": true, ...all others false}'
-- so the existing Water amenity filter chip correctly includes water_tap pins.

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Replace map_pins view with full-column version
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW map_pins AS

  -- Regular stop pins (campgrounds, BLM/USFS/NPS, Overpass, community)
  SELECT
    id,
    location,
    'regular'::TEXT                                  AS pin_category,
    name                                             AS place_name,
    description,
    latitude,
    longitude,
    pin_type,
    source_id,
    max_length_ft,
    max_height_ft,
    website,
    phone,
    elevation_m,
    amenities,
    badge_state,
    last_check_in_at,
    recent_check_in_count,
    is_verified,
    is_flagged,
    created_at,
    updated_at
  FROM pins
  WHERE is_archived = FALSE

  UNION ALL

  -- Water tap pins (ML-discovered + user-submitted)
  SELECT
    id,
    location,
    'water_tap'::TEXT                                AS pin_category,
    place_name,
    NULL::TEXT                                       AS description,
    ST_Y(location::geometry)                         AS latitude,
    ST_X(location::geometry)                         AS longitude,
    'water_tap'::TEXT                                AS pin_type,
    place_ref                                        AS source_id,
    NULL::NUMERIC                                    AS max_length_ft,
    NULL::NUMERIC                                    AS max_height_ft,
    NULL::TEXT                                       AS website,
    NULL::TEXT                                       AS phone,
    NULL::NUMERIC                                    AS elevation_m,
    -- Water tap amenities: water=true, all others false (enables Water filter chip)
    '{"water":true,"dump":false,"electric":false,"shower":false,"fuel":false,
      "propane":false,"overnight":false,"toilets":false,"pets":false,"wifi":false,
      "kitchen":false,"restaurant":false,"big_rig":false,"tent":false,
      "hiking":false,"fishing":false,"swimming":false,"boating":false,
      "biking":false,"ohv":false,"climbing":false,"winter_sports":false,
      "hunting":false,"wildlife":false,"horseback":false,"hot_springs":false}'::JSONB
                                                     AS amenities,
    -- Recency badge computed from verified_date (same thresholds as regular pins)
    -- Threshold: sync with map_pins view if changed
    CASE
      WHEN verified_date IS NULL                            THEN 'red'
      WHEN verified_date >= NOW() - INTERVAL '7 days'      THEN 'green'
      WHEN verified_date >= NOW() - INTERVAL '30 days'     THEN 'yellow'
      ELSE                                                       'red'
    END                                              AS badge_state,
    NULL::TEXT                                       AS last_check_in_at,
    0::INTEGER                                       AS recent_check_in_count,
    FALSE                                            AS is_verified,
    FALSE                                            AS is_flagged,
    created_at,
    updated_at
  FROM water_tap_pins
  WHERE is_active = TRUE;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Grant SELECT on the view to Supabase roles
-- ──────────────────────────────────────────────────────────────────────────────

GRANT SELECT ON map_pins TO anon;
GRANT SELECT ON map_pins TO authenticated;
GRANT SELECT ON map_pins TO service_role;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Add search_water_taps_by_radius RPC (mirrors search_pins_by_radius for taps)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION search_water_taps_by_radius(
  p_lat      DOUBLE PRECISION,
  p_lng      DOUBLE PRECISION,
  p_radius_m INTEGER,
  p_limit    INTEGER          DEFAULT 200,
  p_offset   INTEGER          DEFAULT 0
)
RETURNS TABLE (
  id                    UUID,
  name                  TEXT,
  description           TEXT,
  latitude              DOUBLE PRECISION,
  longitude             DOUBLE PRECISION,
  pin_type              TEXT,
  pin_category          TEXT,
  source_id             TEXT,
  max_length_ft         INTEGER,
  max_height_ft         NUMERIC,
  website               TEXT,
  phone                 TEXT,
  elevation_m           NUMERIC,
  amenities             JSONB,
  badge_state           TEXT,
  last_check_in_at      TIMESTAMPTZ,
  recent_check_in_count INTEGER,
  is_verified           BOOLEAN,
  is_flagged            BOOLEAN,
  location              TEXT,
  created_at            TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ,
  distance_m            DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    wt.id,
    wt.place_name                                              AS name,
    NULL::TEXT                                                 AS description,
    ST_Y(wt.location::geometry)                               AS latitude,
    ST_X(wt.location::geometry)                               AS longitude,
    'water_tap'::TEXT                                         AS pin_type,
    'water_tap'::TEXT                                         AS pin_category,
    wt.place_ref                                              AS source_id,
    NULL::INTEGER                                             AS max_length_ft,
    NULL::NUMERIC                                             AS max_height_ft,
    NULL::TEXT                                                AS website,
    NULL::TEXT                                                AS phone,
    NULL::NUMERIC                                             AS elevation_m,
    '{"water":true,"dump":false,"electric":false,"shower":false,"fuel":false,
      "propane":false,"overnight":false,"toilets":false,"pets":false,"wifi":false,
      "kitchen":false,"restaurant":false,"big_rig":false,"tent":false,
      "hiking":false,"fishing":false,"swimming":false,"boating":false,
      "biking":false,"ohv":false,"climbing":false,"winter_sports":false,
      "hunting":false,"wildlife":false,"horseback":false,"hot_springs":false}'::JSONB
                                                              AS amenities,
    -- Threshold: sync with map_pins view if changed
    CASE
      WHEN wt.verified_date IS NULL                           THEN 'red'
      WHEN wt.verified_date >= NOW() - INTERVAL '7 days'     THEN 'green'
      WHEN wt.verified_date >= NOW() - INTERVAL '30 days'    THEN 'yellow'
      ELSE                                                         'red'
    END                                                       AS badge_state,
    NULL::TIMESTAMPTZ                                         AS last_check_in_at,
    0::INTEGER                                                AS recent_check_in_count,
    FALSE                                                     AS is_verified,
    FALSE                                                     AS is_flagged,
    wt.location::TEXT                                         AS location,
    wt.created_at,
    wt.updated_at,
    ST_Distance(
      wt.location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    )                                                         AS distance_m
  FROM water_tap_pins wt
  WHERE wt.is_active = TRUE
    AND wt.location IS NOT NULL
    AND ST_DWithin(
      wt.location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
  ORDER BY distance_m ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Grant EXECUTE on the RPC to Supabase roles
-- ──────────────────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION search_water_taps_by_radius TO anon, authenticated, service_role;
