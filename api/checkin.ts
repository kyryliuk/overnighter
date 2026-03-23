import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { createServiceClient } from './_supabase'

const CheckInSchema = z.object({
  pinId: z.string().uuid(),
  deviceId: z.string().min(1),
  status: z.enum(['still_open', 'closed', 'changed']),
  note: z.string().max(500).optional(),
  timestamp: z.string().datetime(),
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

    const { error: insertError } = await supabase.from('check_ins').insert({
      pin_id: body.pinId,
      device_id: body.deviceId,
      status: body.status,
      notes: body.note ? sanitize(body.note) : null,
      checked_in_at: body.timestamp,
    })

    if (insertError) throw insertError

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { count, error: countError } = await supabase
      .from('check_ins')
      .select('*', { count: 'exact', head: true })
      .eq('pin_id', body.pinId)
      .gte('checked_in_at', thirtyDaysAgo)

    if (countError) throw countError

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

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('[api/checkin]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
