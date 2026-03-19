-- Migration: Add get_flagged_pins() RPC for admin flag review queue (AC2, Story 5.2)
-- Returns all active flagged pins (is_flagged=true AND is_archived=false) with
-- aggregated flag_count and latest report type for the admin dashboard.

CREATE OR REPLACE FUNCTION get_flagged_pins()
RETURNS TABLE(
  id                  UUID,
  name                TEXT,
  latitude            DOUBLE PRECISION,
  longitude           DOUBLE PRECISION,
  badge_state         TEXT,
  flag_count          BIGINT,
  latest_report_type  TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    p.id,
    p.name,
    p.latitude,
    p.longitude,
    p.badge_state,
    COUNT(ir.id) AS flag_count,
    (
      SELECT report_type
      FROM issue_reports
      WHERE pin_id = p.id
      ORDER BY created_at DESC
      LIMIT 1
    ) AS latest_report_type
  FROM pins p
  LEFT JOIN issue_reports ir ON ir.pin_id = p.id
  WHERE p.is_flagged = true
    AND p.is_archived = false
  GROUP BY p.id;
$$;
