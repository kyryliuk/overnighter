-- Migration 006: Add status column to check_ins
-- Story 4.3: Check-In Submission & Badge Update
-- The original check_ins table (002) was created without a status column.
-- This migration adds it with a safe default for existing rows.

ALTER TABLE check_ins
ADD COLUMN status TEXT NOT NULL DEFAULT 'still_open'
  CHECK (status IN ('still_open', 'closed', 'changed'));
