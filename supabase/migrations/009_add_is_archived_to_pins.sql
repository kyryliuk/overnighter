-- Migration: Add is_archived soft-delete column to pins table
-- Archived pins are hidden from the public map but not hard-deleted (data preservation for audit).
-- Admin can archive flagged pins via DELETE /api/pins/:id (Story 5.2).

ALTER TABLE pins ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false;

-- Partial index: speeds up admin flagged-pin queries (only flagged rows indexed)
CREATE INDEX idx_pins_is_flagged ON pins (is_flagged) WHERE is_flagged = true;

-- Partial index: speeds up public map query which filters is_archived = false
CREATE INDEX idx_pins_is_archived ON pins (is_archived) WHERE is_archived = false;
