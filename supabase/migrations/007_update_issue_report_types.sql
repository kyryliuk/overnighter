-- Migration: Update issue_reports report_type enum to match UI labels
-- Migration 003 defined a generic enum ('closed', 'damaged', 'inaccurate', 'other')
-- that does not match the Story 4.4 UI options. This migration replaces it with
-- values that map directly to the issue type chips in IssueReportSheet.

ALTER TABLE issue_reports DROP CONSTRAINT IF EXISTS issue_reports_report_type_check;

ALTER TABLE issue_reports ADD CONSTRAINT issue_reports_report_type_check
  CHECK (report_type IN ('dump_closed', 'water_unavailable', 'no_overnight', 'access_blocked', 'other'));
