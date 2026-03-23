-- Migration: Create contributor spot submission pipeline

CREATE TABLE spot_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  amenities JSONB NOT NULL,
  max_length_ft INTEGER,
  max_height_ft DOUBLE PRECISION,
  website TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  admin_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  published_pin_id UUID REFERENCES pins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_spot_submissions_user_id ON spot_submissions (user_id, created_at DESC);
CREATE INDEX idx_spot_submissions_status ON spot_submissions (status, created_at ASC);

ALTER TABLE spot_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own spot submissions"
  ON spot_submissions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own spot submissions"
  ON spot_submissions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
