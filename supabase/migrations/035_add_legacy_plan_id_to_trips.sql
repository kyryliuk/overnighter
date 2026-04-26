-- Migration 035: Add legacy_plan_id to trips for backfill traceability
-- Story p3-5-1 — Backfill Legacy Trip Plans
--
-- Adds a nullable TEXT column that the backfill script populates with the
-- originating trip_plans.plan_id.  The UNIQUE constraint on (user_id, legacy_plan_id)
-- provides a database-level idempotency guard so duplicate runs cannot insert
-- duplicate rows for the same legacy plan.

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS legacy_plan_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trips_user_id_legacy_plan_id_key'
      AND conrelid = 'trips'::regclass
  ) THEN
    ALTER TABLE trips
      ADD CONSTRAINT trips_user_id_legacy_plan_id_key
      UNIQUE (user_id, legacy_plan_id);
  END IF;
END
$$;
