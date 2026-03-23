-- Migration: Create overpass_cache table
-- Server-side cache for Overpass API responses (24h TTL per NFR-SC3)
-- Prevents hitting the 10k req/day Overpass public endpoint limit

CREATE TABLE overpass_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bbox_key TEXT NOT NULL UNIQUE,     -- e.g., "lat1,lng1,lat2,lng2" bounding box string
  payload JSONB NOT NULL,            -- Raw Overpass GeoJSON response
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_overpass_cache_bbox_key ON overpass_cache (bbox_key);
CREATE INDEX idx_overpass_cache_cached_at ON overpass_cache (cached_at);
