-- Migration 012: Add toilets and pets to amenities default
-- Extends the amenities JSONB default to include toilets and pets fields.
-- Existing rows are not backfilled (old pins default to false for new keys).

ALTER TABLE pins
  ALTER COLUMN amenities SET DEFAULT
    '{"water":false,"dump":false,"electric":false,"shower":false,"fuel":false,"propane":false,"overnight":false,"toilets":false,"pets":false}';
