-- Migration: Create check_ins table
-- Stores anonymous device check-ins for recency badge calculation

CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,           -- crypto.randomUUID() from localStorage — never PII
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT                         -- Optional user notes about the stop
);

CREATE INDEX idx_check_ins_pin_id ON check_ins (pin_id);
CREATE INDEX idx_check_ins_checked_in_at ON check_ins (checked_in_at);
CREATE INDEX idx_check_ins_device_id ON check_ins (device_id);
