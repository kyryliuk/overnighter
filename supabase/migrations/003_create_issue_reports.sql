-- Migration: Create issue_reports table
-- Stores pin issue reports from anonymous users; ≥3 open reports in 48h triggers badge degradation

CREATE TABLE issue_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,           -- crypto.randomUUID() — never PII
  report_type TEXT NOT NULL CHECK (report_type IN ('closed', 'damaged', 'inaccurate', 'other')),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ            -- Set when admin closes the report
);

CREATE INDEX idx_issue_reports_pin_id ON issue_reports (pin_id);
CREATE INDEX idx_issue_reports_status ON issue_reports (status);
CREATE INDEX idx_issue_reports_created_at ON issue_reports (created_at);
-- Composite index for the ≥3 reports in 48h badge degradation query
CREATE INDEX idx_issue_reports_pin_status_time ON issue_reports (pin_id, status, created_at);
