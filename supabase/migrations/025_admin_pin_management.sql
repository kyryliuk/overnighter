-- Migration: Story 6.3 — Pin Management: badge_override, audit log, flagged pins RPC update
-- Adds badge_override column, admin_audit_log table, and updates get_flagged_pins() RPC.

-- 1. Add badge_override column to pins
ALTER TABLE pins ADD COLUMN badge_override TEXT
  CHECK (badge_override IN ('green', 'yellow', 'red', 'grey'));

-- 2. Create admin_audit_log table
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  pin_id UUID REFERENCES pins(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_log_pin_id ON admin_audit_log (pin_id);
CREATE INDEX idx_audit_log_action ON admin_audit_log (action);
CREATE INDEX idx_audit_log_created_at ON admin_audit_log (created_at DESC);

-- 3. Update get_flagged_pins() to include badge_override and is_archived
--    Remove is_archived = false filter so admins can see archived flagged pins via toggle.
CREATE OR REPLACE FUNCTION get_flagged_pins()
RETURNS TABLE(
  id                  UUID,
  name                TEXT,
  latitude            DOUBLE PRECISION,
  longitude           DOUBLE PRECISION,
  badge_state         TEXT,
  badge_override      TEXT,
  is_archived         BOOLEAN,
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
    p.badge_override,
    p.is_archived,
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
  GROUP BY p.id;
$$;
