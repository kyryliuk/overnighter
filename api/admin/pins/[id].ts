import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { requireAdminAuth } from '../../_middleware'
import { createServiceClient } from '../../_supabase'

const AdminPinUpdateSchema = z
  .object({
    badge_override: z.enum(['green', 'yellow', 'red', 'grey']).nullable().optional(),
    is_archived: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'PATCH only', status: 405 })
  }

  if (!requireAdminAuth(req, res)) return

  const pinId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id
  if (!pinId) {
    return res.status(400).json({ error: 'INVALID_PARAMS', message: 'Missing pin id', status: 400 })
  }

  const parsed = AdminPinUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_BODY',
      message: parsed.error.errors.map((e) => e.message).join(', '),
      status: 400,
    })
  }

  const supabase = createServiceClient()

  try {
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    const auditEntries: Array<{ action: string; pin_id: string; details: Record<string, unknown> }> = []

    if ('badge_override' in parsed.data) {
      updatePayload.badge_override = parsed.data.badge_override
      auditEntries.push({
        action: parsed.data.badge_override === null ? 'badge_override_removed' : 'badge_override',
        pin_id: pinId,
        details: { badge_override: parsed.data.badge_override },
      })
    }

    if (parsed.data.is_archived === false) {
      updatePayload.is_archived = false
      auditEntries.push({
        action: 'unarchive',
        pin_id: pinId,
        details: {},
      })
    }

    const { error } = await supabase.from('pins').update(updatePayload).eq('id', pinId)
    if (error) throw error

    for (const entry of auditEntries) {
      const { error: auditError } = await supabase.from('admin_audit_log').insert(entry)
      if (auditError) throw auditError
    }

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('[api/admin/pins/[id]]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
