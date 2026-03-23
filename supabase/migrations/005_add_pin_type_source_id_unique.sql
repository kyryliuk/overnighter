-- Migration: Add unique constraint on (pin_type, source_id) for sync upsert
-- Required by api/sync.ts upsert onConflict: 'pin_type,source_id'
-- Partial index excludes community pins where source_id IS NULL

CREATE UNIQUE INDEX IF NOT EXISTS idx_pins_pin_type_source_id
  ON pins (pin_type, source_id)
  WHERE source_id IS NOT NULL;
