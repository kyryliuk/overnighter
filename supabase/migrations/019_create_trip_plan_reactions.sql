-- Migration: Add lightweight reactions for public shared trips

CREATE TABLE trip_plan_reactions (
  share_token TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reaction TEXT NOT NULL DEFAULT 'helpful' CHECK (reaction = 'helpful'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (share_token, user_id)
);

CREATE INDEX idx_trip_plan_reactions_share_token ON trip_plan_reactions (share_token);

ALTER TABLE trip_plan_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can add their own trip reactions"
  ON trip_plan_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their own trip reactions"
  ON trip_plan_reactions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can remove their own trip reactions"
  ON trip_plan_reactions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION get_trip_plan_reaction_summary(
  target_share_token TEXT,
  current_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  helpful_count BIGINT,
  has_reacted BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::BIGINT AS helpful_count,
    COALESCE(BOOL_OR(user_id = current_user_id), FALSE) AS has_reacted
  FROM trip_plan_reactions
  WHERE share_token = target_share_token
    AND reaction = 'helpful';
$$;

REVOKE ALL ON FUNCTION get_trip_plan_reaction_summary(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_trip_plan_reaction_summary(TEXT, UUID) TO anon, authenticated;
