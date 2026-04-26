import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { createServiceClient } from './_supabase'

// ── Schema ────────────────────────────────────────────────────────────────────

const TapVerifySchema = z.object({
  tapPinId: z.string().uuid(),
  eventType: z.enum(['confirmed', 'denied']),
  deviceId: z.string().min(1),
})

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip HTML tags and trim — NFR-S4 server-side sanitization */
function sanitize(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim()
}

/** Minimum unique confirmed-device count required to promote source to 'verified' (FR47) */
const VERIFIED_THRESHOLD = 2

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * POST /api/tap-verify
 *
 * Public endpoint — no Authorization header required.
 * Identity is provided via `deviceId` in the JSON body.
 *
 * Accepts JSON body:
 *   tapPinId  — UUID of the water tap pin being verified
 *   eventType — 'confirmed' | 'denied'
 *   deviceId  — device identifier string
 *
 * Flow:
 *  1. Validate body
 *  2. Append tap_verification_events row (append-only)
 *  3. If ≥2 unique devices confirmed → promote water_tap_pins.source to 'verified'
 *  4. Return { confirmed: n, denied: n }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only', status: 405 })
  }

  // ── Step 1: Validate body ─────────────────────────────────────────────────
  const parsed = TapVerifySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_BODY',
      message: parsed.error.errors.map((e) => e.message).join(', '),
      status: 400,
    })
  }

  const { tapPinId, eventType, deviceId: rawDeviceId } = parsed.data
  const deviceId = sanitize(rawDeviceId)

  const supabase = createServiceClient()

  try {
    // ── Step 2: Append verification event (append-only) ───────────────────
    const { error: insertError } = await supabase.from('tap_verification_events').insert({
      tap_pin_id: tapPinId,
      device_id: deviceId,
      event_type: eventType,
      created_at: new Date().toISOString(),
    })

    if (insertError) throw insertError

    // ── Step 3: Count unique confirmed-device events for FR47 promotion ───
    const { data: confirmedEvents, error: confirmedError } = await supabase
      .from('tap_verification_events')
      .select('device_id')
      .eq('tap_pin_id', tapPinId)
      .eq('event_type', 'confirmed')

    if (confirmedError) throw confirmedError

    // Unique device_id count (Set deduplication)
    const uniqueConfirmedDevices = new Set(
      (confirmedEvents ?? []).map((e: { device_id: string }) => e.device_id),
    ).size

    if (uniqueConfirmedDevices >= VERIFIED_THRESHOLD) {
      // FR47: Promote pin to verified status.
      // The verified_date is the canonical "community verified" signal.
      // (The DB CHECK constraint for source does not include 'verified', so we
      // use verified_date IS NOT NULL as the verified state instead.)
      const { error: promoteError } = await supabase
        .from('water_tap_pins')
        .update({
          verified_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', tapPinId)

      if (promoteError) throw promoteError
    }

    // ── Step 4: Return updated counts ─────────────────────────────────────
    const { data: deniedEvents, error: deniedError } = await supabase
      .from('tap_verification_events')
      .select('id')
      .eq('tap_pin_id', tapPinId)
      .eq('event_type', 'denied')

    if (deniedError) throw deniedError

    return res.status(200).json({
      confirmed: uniqueConfirmedDevices,
      denied: (deniedEvents ?? []).length,
    })
  } catch (error) {
    console.error('[api/tap-verify]', error)
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Something went wrong',
      status: 500,
    })
  }
}
