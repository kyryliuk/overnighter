-- Migration: Add website, phone, elevation fields and new amenities to pins

ALTER TABLE pins
  ADD COLUMN website TEXT,
  ADD COLUMN phone TEXT,
  ADD COLUMN elevation_m DOUBLE PRECISION;

-- Update amenities default to include new keys
ALTER TABLE pins
  ALTER COLUMN amenities SET DEFAULT
    '{"water":false,"dump":false,"electric":false,"shower":false,"fuel":false,"propane":false,"overnight":false,"toilets":false,"pets":false,"wifi":false,"kitchen":false,"restaurant":false,"big_rig":false,"tent":false}';
