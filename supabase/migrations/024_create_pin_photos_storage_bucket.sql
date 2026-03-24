-- Bucket: pin-photos
-- Visibility: public (CDN-served, no auth required for reads)
-- Max file size: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/heic
-- File path convention: {pin_id}/{check_in_id}/{uuid}.jpg
--
-- Create via Supabase Dashboard > Storage > New Bucket:
--   Name: pin-photos
--   Public: true
--   File size limit: 5242880 (5MB)
--   Allowed MIME types: image/jpeg, image/png, image/heic
--
-- Or via Supabase CLI:
--   supabase storage create pin-photos --public --file-size-limit 5242880
--
-- Storage policies (applied via Dashboard or API):
-- Allow authenticated users to upload:
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'Authenticated users can upload pin photos',
  'pin-photos',
  'INSERT',
  '(auth.role() = ''authenticated'')'
) ON CONFLICT DO NOTHING;
-- Allow public reads:
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'Public can read pin photos',
  'pin-photos',
  'SELECT',
  'true'
) ON CONFLICT DO NOTHING;
