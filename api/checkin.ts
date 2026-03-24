import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { createServiceClient } from './_supabase'
import { notifySubscribers } from './_pushNotify'
import { requireUserAuth } from './_auth'

const CheckInSchema = z.object({
  pinId: z.string().uuid(),
  deviceId: z.string().min(1),
  status: z.enum(['still_open', 'closed', 'changed']),
  note: z.string().max(500).optional(),
  timestamp: z.string().datetime(),
  checkInId: z.string().uuid().optional(),
  photoCdnUrl: z.string().url().optional(),
  photoStoragePath: z.string().min(1).optional(),
})

function sanitize(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only', status: 405 })
  }

  const parsed = CheckInSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_BODY',
      message: parsed.error.errors.map((e) => e.message).join(', '),
      status: 400,
    })
  }

  const body = parsed.data

  try {
    const supabase = createServiceClient()

    const checkInRow: Record<string, unknown> = {
      pin_id: body.pinId,
      device_id: body.deviceId,
      status: body.status,
      notes: body.note ? sanitize(body.note) : null,
      checked_in_at: body.timestamp,
    }
    if (body.checkInId) {
      checkInRow.id = body.checkInId
    }

    const { data: insertedCheckIn, error: insertError } = await supabase.from('check_ins').insert(checkInRow).select('id').single()

    if (insertError) throw insertError

    // Best-effort: insert pin_photos row if photo data is present
    if (body.photoCdnUrl && body.photoStoragePath && insertedCheckIn) {
      const user = await requireUserAuth(req, res)
      if (user) {
        const { error: photoError } = await supabase.from('pin_photos').insert({
          check_in_id: insertedCheckIn.id,
          user_id: user.id,
          storage_path: body.photoStoragePath,
          cdn_url: body.photoCdnUrl,
        })
        if (photoError) {
          console.error('[api/checkin] pin_photos insert failed (best-effort):', photoError)
        }
      }
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { count, error: countError } = await supabase
      .from('check_ins')
      .select('*', { count: 'exact', head: true })
      .eq('pin_id', body.pinId)
      .gte('checked_in_at', thirtyDaysAgo)

    if (countError) throw countError

    const { data: currentPin } = await supabase
      .from('pins')
      .select('badge_state, name')
      .eq('id', body.pinId)
      .single()

    const { error: updateError } = await supabase
      .from('pins')
      .update({
        badge_state: 'green',
        last_check_in_at: body.timestamp,
        recent_check_in_count: count ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.pinId)

    if (updateError) throw updateError

    // Fire-and-forget — do not await, do not block response
    notifySubscribers(supabase, body.pinId, currentPin?.name ?? 'A spot', body.status).catch(
      (err) => console.error('[api/checkin] notification dispatch failed:', err),
    )

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('[api/checkin]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
