import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { createServiceClient } from './_supabase'

const ReportSchema = z.object({
  pinId: z.string().uuid(),
  deviceId: z.string().min(1),
  type: z.enum(['dump_closed', 'water_unavailable', 'no_overnight', 'access_blocked', 'other']),
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

  const parsed = ReportSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_BODY',
      message: parsed.error.errors.map((e) => e.message).join(', '),
      status: 400,
    })
  }

  const body = parsed.data
  const supabase = createServiceClient()

  try {
    // Rate limit: reject if same device already has a report for this pin in the last 24h
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: existing, error: rateCheckError } = await supabase
      .from('issue_reports')
      .select('id')
      .eq('pin_id', body.pinId)
      .eq('device_id', body.deviceId)
      .gte('created_at', cutoff)
      .limit(1)
      .maybeSingle()

    if (rateCheckError) throw rateCheckError

    if (existing) {
      return res.status(429).json({
        error: 'RATE_LIMITED',
        message: 'Already reported this spot recently',
        status: 429,
      })
    }

    // Atomic: insert issue_reports row + update pins.badge_state in one transaction
    const { error: rpcError } = await supabase.rpc('submit_issue_report', {
      p_pin_id: body.pinId,
      p_device_id: body.deviceId,
      p_report_type: body.type,
      p_notes: body.note ? sanitize(body.note) : null,
      p_created_at: body.timestamp,
    })

    if (rpcError) throw rpcError

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('[api/report]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
