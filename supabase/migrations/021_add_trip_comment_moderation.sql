-- Migration: Add delete moderation and viewer-specific flags to shared trip comments

CREATE POLICY "Comment authors and trip owners can remove shared trip comments"
  ON trip_plan_comments
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM trip_plans
      WHERE trip_plans.share_token = trip_plan_comments.share_token
        AND trip_plans.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION get_trip_plan_comments(
  target_share_token TEXT,
  current_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  author_label TEXT,
  body TEXT,
  created_at TIMESTAMPTZ,
  can_delete BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    trip_plan_comments.id,
    trip_plan_comments.author_label,
    trip_plan_comments.body,
    trip_plan_comments.created_at,
    (
      trip_plan_comments.user_id = current_user_id
      OR EXISTS (
        SELECT 1
        FROM trip_plans
        WHERE trip_plans.share_token = trip_plan_comments.share_token
          AND trip_plans.user_id = current_user_id
      )
    ) AS can_delete
  FROM trip_plan_comments
  WHERE trip_plan_comments.share_token = target_share_token
  ORDER BY trip_plan_comments.created_at DESC;
$$;

REVOKE ALL ON FUNCTION get_trip_plan_comments(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_trip_plan_comments(TEXT, UUID) TO anon, authenticated;
