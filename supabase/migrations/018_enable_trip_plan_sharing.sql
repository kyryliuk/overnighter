-- Migration: Enable public sharing links for trip plans

ALTER TABLE trip_plans
  ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN share_token TEXT UNIQUE;

CREATE INDEX idx_trip_plans_share_token ON trip_plans (share_token) WHERE share_token IS NOT NULL;

CREATE POLICY "Anyone can read public trip plans"
  ON trip_plans
  FOR SELECT
  USING (is_public = true);
