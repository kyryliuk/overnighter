-- Migration: Add submit_issue_report RPC function
-- Wraps insert(issue_reports) + update(pins.badge_state) in a single transaction so that
-- a partial failure cannot produce an orphaned report row with no badge degradation.

CREATE OR REPLACE FUNCTION submit_issue_report(
  p_pin_id      UUID,
  p_device_id   TEXT,
  p_report_type TEXT,
  p_notes       TEXT,
  p_created_at  TIMESTAMPTZ
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO issue_reports (pin_id, device_id, report_type, notes, created_at)
  VALUES (p_pin_id, p_device_id, p_report_type, p_notes, p_created_at);

  UPDATE pins
  SET badge_state = 'red',
      updated_at  = NOW()
  WHERE id = p_pin_id;
END;
$$;
