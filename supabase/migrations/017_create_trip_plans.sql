-- Migration: Create authenticated user trip plan sync table

CREATE TABLE trip_plans (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  plan_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, plan_id)
);

CREATE INDEX idx_trip_plans_user_id ON trip_plans (user_id);
CREATE INDEX idx_trip_plans_updated_at ON trip_plans (updated_at DESC);

ALTER TABLE trip_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their trip plans"
  ON trip_plans
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their trip plans"
  ON trip_plans
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their trip plans"
  ON trip_plans
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their trip plans"
  ON trip_plans
  FOR DELETE
  USING (auth.uid() = user_id);
