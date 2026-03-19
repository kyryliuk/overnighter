import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { requireAdminAuth } from '../../_middleware'
import { createServiceClient } from '../../_supabase'

const ActionSchema = z.object({ action: z.enum(['verify', 'dismiss']) })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'PATCH only', status: 405 })
  }

  if (!requireAdminAuth(req, res)) return

  const parsed = ActionSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_BODY',
      message: parsed.error.errors.map((e) => e.message).join(', '),
      status: 400,
    })
  }

  const pinId = req.query.id as string
  const { action } = parsed.data
  const supabase = createServiceClient()

  try {
    const now = new Date().toISOString()
    const updatePayload =
      action === 'verify'
        ? { is_verified: true, is_flagged: false, badge_state: 'green', last_check_in_at: now, updated_at: now }
        : { is_flagged: false, updated_at: now }

    const { error } = await supabase.from('pins').update(updatePayload).eq('id', pinId)

    if (error) throw error

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('[api/pins/[id]/verify]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
