-- Migration 033: Create tap-photos Supabase Storage bucket
-- Story 6.1 — Water Tap Database Schema & Storage Setup
--
-- Bucket: tap-photos
-- Visibility: public (CDN-served, no auth required for reads)
-- Write access: service-role-key ONLY (no INSERT policy = only service role writes)
-- Max file size: 5MB (5,242,880 bytes)
-- Allowed MIME types: image/jpeg, image/png, image/heic, image/webp
-- File path convention: tap-photos/{tap_pin_id}/{timestamp}.jpg
--
-- Security model:
--   READ  — public (anyone can read tap photos via the CDN URL)
--   WRITE — service role only (ML batch pipeline + tap-submit API endpoint)
--           The absence of an INSERT/UPDATE/DELETE storage policy means anonymous
--           and authenticated users cannot upload. The service role key bypasses
--           RLS and storage policies entirely, so it remains the sole writer.
--
-- Alternative bucket creation (if SQL INSERT is not supported in your Supabase tier):
--   Supabase Dashboard → Storage → New Bucket:
--     Name: tap-photos  |  Public: true  |  File size limit: 5242880
--   Or via Supabase CLI:
--     supabase storage create tap-photos --public --file-size-limit 5242880

-- Create the tap-photos bucket (idempotent via ON CONFLICT DO NOTHING)
-- Note: allowed_mime_types is enforced at the application layer (api/tap-submit.ts),
-- not at the storage bucket level — consistent with the pin-photos bucket (migration 024).
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'tap-photos',
  'tap-photos',
  true,          -- public read — objects accessible without auth token
  5242880        -- 5MB maximum file size
)
ON CONFLICT (id) DO NOTHING;

-- Public SELECT policy — allows anyone to read tap photos
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'Public can read tap photos',
  'tap-photos',
  'SELECT',
  'true'
)
ON CONFLICT DO NOTHING;

-- NOTE: No INSERT, UPDATE, or DELETE policies are created.
-- Only the service role key (which bypasses all storage policies) may write.
-- This is the correct Supabase pattern for service-role-only write buckets.
