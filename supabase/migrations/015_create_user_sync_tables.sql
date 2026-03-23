-- Migration: Create authenticated user sync tables for rig profiles and saved spots

CREATE TABLE rig_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rig_type TEXT CHECK (rig_type IN ('Class A', 'Class B', 'Class C', 'Travel Trailer', '5th Wheel')),
  length_ft INTEGER,
  height_ft DOUBLE PRECISION,
  onboarding_dismissed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE saved_spots (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_id UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  pin_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, pin_id)
);

CREATE INDEX idx_saved_spots_user_id ON saved_spots (user_id);
CREATE INDEX idx_saved_spots_updated_at ON saved_spots (updated_at DESC);

ALTER TABLE rig_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_spots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their rig profile"
  ON rig_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their rig profile"
  ON rig_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their rig profile"
  ON rig_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their rig profile"
  ON rig_profiles
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read their saved spots"
  ON saved_spots
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their saved spots"
  ON saved_spots
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their saved spots"
  ON saved_spots
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their saved spots"
  ON saved_spots
  FOR DELETE
  USING (auth.uid() = user_id);
