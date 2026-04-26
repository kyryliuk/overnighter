import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as crypto from 'crypto'
import { createServiceClient } from './_supabase'
import { classifyImageUrl } from './_sagemaker'
import { parseTapSubmitForm } from './_multipart'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum SageMaker confidence required to write a water tap pin (NFR-ML2) */
const CONFIDENCE_THRESHOLD = 0.75

/** 5 MB in bytes — must match the tap-photos Storage bucket policy (migration 033) */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip HTML tags and trim — NFR-S4 server-side sanitization */
function sanitize(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim()
}

/**
 * Calculate the great-circle distance between two coordinate pairs using the
 * Haversine formula.  Returns the distance in metres.
 * Used for the 50m proximity check (no PostGIS RPC needed for the FL Keys dataset).
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000 // Earth radius in metres
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * POST /api/tap-submit
 *
 * Public endpoint — no Authorization header required.
 * Identity is provided via `deviceId` in the multipart form body.
 *
 * Accepts multipart/form-data:
 *   photo     — image file (≤5MB, MIME type must match image/*)
 *   location  — JSON string "[lat, lng]"
 *   deviceId  — device identifier string
 *
 * Flow:
 *  1. Parse multipart form
 *  2. Validate file size + MIME type
 *  3. Upload to Supabase Storage tap-photos bucket
 *  4. Call SageMaker via classifyImageUrl()
 *  5a. confidence < 0.75 → return below_threshold (no DB writes)
 *  5b. confidence ≥ 0.75 → proximity check, upsert water_tap_pins, append event
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only', status: 405 })
  }

  // ── Step 1: Parse multipart form ──────────────────────────────────────────
  let photoBuffer: Buffer
  let mimeType: string
  let sizeBytes: number
  let location: [number, number]
  let deviceId: string

  try {
    const parsed = await parseTapSubmitForm(req)
    photoBuffer = parsed.photoBuffer
    mimeType = parsed.mimeType
    sizeBytes = parsed.sizeBytes
    location = parsed.location
    deviceId = sanitize(parsed.deviceId)
  } catch (parseErr) {
    console.error('[api/tap-submit] multipart parse error:', parseErr)
    return res.status(400).json({
      error: 'INVALID_BODY',
      message: 'Failed to parse multipart form data',
      status: 400,
    })
  }

  // ── Step 2: Validate file ─────────────────────────────────────────────────
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return res.status(400).json({
      error: 'INVALID_FILE',
      message: `File too large: ${sizeBytes} bytes exceeds the 5MB limit`,
      status: 400,
    })
  }
  if (!mimeType.startsWith('image/')) {
    return res.status(400).json({
      error: 'INVALID_FILE',
      message: `Invalid file type: ${mimeType}. Only image/* MIME types are accepted`,
      status: 400,
    })
  }

  const supabase = createServiceClient()
  const [lat, lng] = location

  // ── Step 3: Upload photo to Supabase Storage ──────────────────────────────
  const uuid = crypto.randomUUID()
  const timestamp = Date.now()
  const storagePath = `${uuid}/${timestamp}.jpg`

  const { error: uploadError } = await supabase.storage
    .from('tap-photos')
    .upload(storagePath, photoBuffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (uploadError) {
    console.error('[api/tap-submit] Storage upload error:', uploadError)
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to upload photo to storage',
      status: 500,
    })
  }

  // Build the public URL for the uploaded photo
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? ''
  const photoPublicUrl = `${supabaseUrl}/storage/v1/object/public/tap-photos/${storagePath}`

  // ── Step 4: Call SageMaker classifier ────────────────────────────────────
  let confidence: number
  try {
    const result = await classifyImageUrl(photoPublicUrl)
    confidence = result.confidence
  } catch (smErr) {
    console.error('[api/tap-submit] SageMaker classification error:', smErr)
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to classify photo',
      status: 500,
    })
  }

  // ── Step 5a: Below threshold — no DB writes ───────────────────────────────
  if (confidence < CONFIDENCE_THRESHOLD) {
    return res.status(200).json({
      pinId: null,
      confidence,
      status: 'below_threshold',
    })
  }

  // ── Step 5b: High confidence — upsert pin + append event ─────────────────
  try {
    // Find existing active pins — limit 1000 as a defensive cap (FL Keys dataset is small)
    // GeoJSON geography column → .coordinates = [lng, lat]
    const { data: activePins, error: fetchError } = await supabase
      .from('water_tap_pins')
      .select('id, photos, location')
      .eq('is_active', true)
      .limit(1000)

    if (fetchError) throw fetchError

    // Filter to pins within 50m using Haversine (appropriate for the small FL Keys dataset)
    type PinRow = { id: string; photos: string[]; location: { type: string; coordinates: [number, number] } }
    const nearbyPin = (activePins as PinRow[] | null)?.find((pin) => {
      const coords = pin.location?.coordinates
      if (!coords) return false
      const [pinLng, pinLat] = coords
      return haversineDistance(lat, lng, pinLat, pinLng) <= 50
    })

    let pinId: string
    let status: 'created' | 'confirmed'

    if (nearbyPin) {
      // ── Confirmed: add photo to existing pin ──────────────────────────────
      pinId = nearbyPin.id
      status = 'confirmed'

      const updatedPhotos = [...(nearbyPin.photos ?? []), photoPublicUrl]
      const { error: updateError } = await supabase
        .from('water_tap_pins')
        .update({
          photos: updatedPhotos,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pinId)

      if (updateError) throw updateError
    } else {
      // ── Created: insert new pin ───────────────────────────────────────────
      status = 'created'

      const { data: newPin, error: insertError } = await supabase
        .from('water_tap_pins')
        .insert({
          location: `SRID=4326;POINT(${lng} ${lat})`,
          place_name: 'User Submitted Tap',
          // 'restaurant' is used as a neutral default; the community verify step refines this
          place_type: 'restaurant',
          confidence,
          source: 'user_submission',
          photos: [photoPublicUrl],
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (insertError || !newPin) throw insertError ?? new Error('No pin returned after insert')
      pinId = newPin.id
    }

    // ── Append tap_verification_events row ────────────────────────────────
    const { error: eventError } = await supabase.from('tap_verification_events').insert({
      tap_pin_id: pinId,
      device_id: deviceId,
      event_type: 'user_submission',
      confidence,
      photo_url: photoPublicUrl,
      created_at: new Date().toISOString(),
    })

    if (eventError) throw eventError

    return res.status(200).json({ pinId, confidence, status })
  } catch (error) {
    console.error('[api/tap-submit] DB operation error:', error)
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Database operation failed',
      status: 500,
    })
  }
}
