-- Migration: Add lightweight public comments for shared trips

CREATE TABLE trip_plan_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_token TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  author_label TEXT NOT NULL CHECK (char_length(author_label) BETWEEN 1 AND 60),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX idx_trip_plan_comments_share_token_created_at
  ON trip_plan_comments (share_token, created_at DESC);

ALTER TABLE trip_plan_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can add shared trip comments"
  ON trip_plan_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION get_trip_plan_comments(target_share_token TEXT)
RETURNS TABLE (
  id UUID,
  author_label TEXT,
  body TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    trip_plan_comments.id,
    trip_plan_comments.author_label,
    trip_plan_comments.body,
    trip_plan_comments.created_at
  FROM trip_plan_comments
  WHERE trip_plan_comments.share_token = target_share_token
  ORDER BY trip_plan_comments.created_at DESC;
$$;

REVOKE ALL ON FUNCTION get_trip_plan_comments(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_trip_plan_comments(TEXT) TO anon, authenticated;
