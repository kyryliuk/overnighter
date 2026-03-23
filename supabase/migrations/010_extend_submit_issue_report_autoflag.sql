-- Migration: Extend submit_issue_report to auto-flag pins with ≥3 reports in 48h (AC1, Story 5.2)
-- Replaces migration 008 version. Same signature, same atomic guarantees.
-- Auto-flag is appended AFTER the existing insert + badge degradation logic.

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
DECLARE
  v_report_count INTEGER;
BEGIN
  -- (existing) Insert report row
  INSERT INTO issue_reports (pin_id, device_id, report_type, notes, created_at)
  VALUES (p_pin_id, p_device_id, p_report_type, p_notes, p_created_at);

  -- (existing) Immediately degrade badge to red
  UPDATE pins
  SET badge_state = 'red',
      updated_at  = NOW()
  WHERE id = p_pin_id;

  -- Auto-flag: if this pin has ≥3 reports in the last 48h, set is_flagged = true
  -- Anchor window to p_created_at (not NOW()) so backdated/clock-skewed reports
  -- are counted correctly within the 48h period of the incident being reported.
  SELECT COUNT(*) INTO v_report_count
  FROM issue_reports
  WHERE pin_id = p_pin_id
    AND created_at >= p_created_at - INTERVAL '48 hours';

  IF v_report_count >= 3 THEN
    UPDATE pins SET is_flagged = true, updated_at = NOW() WHERE id = p_pin_id;
  END IF;
END;
$$;
