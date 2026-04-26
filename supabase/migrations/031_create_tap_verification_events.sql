-- Migration 031: Create tap_verification_events table
-- Story 6.1 — Water Tap Database Schema & Storage Setup
--
-- Append-only event log for water tap pin verification events.
-- Records ML scan results, user photo submissions, and user confirm/deny actions.
--
-- SECURITY: UPDATE and DELETE are explicitly revoked from all non-service roles.
-- Only the service role key (which bypasses RLS) may write to this table.
-- This enforces the append-only contract required by FR46 and Story 6.1 AC 2.

CREATE TABLE IF NOT EXISTS tap_verification_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tap_pin_id  UUID        NOT NULL
                REFERENCES water_tap_pins(id) ON DELETE RESTRICT,
  device_id   TEXT        NOT NULL,
  event_type  TEXT        NOT NULL
                CHECK (event_type IN ('confirmed', 'denied', 'ml_scan', 'user_submission')),
  confidence  NUMERIC(3, 2)
                CHECK (confidence BETWEEN 0.00 AND 1.00),  -- nullable: [0.00,1.00] when present
  photo_url   TEXT,           -- nullable: public storage URL when photo was submitted
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient tap_pin_id lookups (used in verification count queries)
CREATE INDEX IF NOT EXISTS idx_tap_verification_tap_pin_id
  ON tap_verification_events (tap_pin_id);

-- Enforce append-only semantics: revoke UPDATE and DELETE from all non-service roles.
-- The service role bypasses these restrictions and remains the only writer.
REVOKE UPDATE, DELETE ON tap_verification_events FROM PUBLIC;
REVOKE UPDATE, DELETE ON tap_verification_events FROM authenticated;
REVOKE UPDATE, DELETE ON tap_verification_events FROM anon;
