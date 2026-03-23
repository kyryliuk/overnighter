import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { requireAdminAuth } from '../_middleware'
import { createServiceClient } from '../_supabase'

const UpdatePinSchema = z.object({
  name: z.string().min(1).optional(),
  pin_type: z.enum(['blm', 'usfs', 'nps', 'overpass', 'community']).optional(),
  latitude: z.number().min(24).max(49).optional(),
  longitude: z.number().min(-125).max(-66).optional(),
  amenities: z.object({
    water: z.boolean(),
    dump: z.boolean(),
    electric: z.boolean(),
    shower: z.boolean(),
    fuel: z.boolean(),
    propane: z.boolean(),
    overnight: z.boolean(),
  }).optional(),
  max_length_ft: z.number().int().positive().optional().nullable(),
  max_height_ft: z.number().positive().optional().nullable(),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'DELETE or PATCH only', status: 405 })
  }

  if (!requireAdminAuth(req, res)) return

  const pinId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id
  const supabase = createServiceClient()

  if (req.method === 'DELETE') {
    try {
      const { error } = await supabase
        .from('pins')
        .update({ is_archived: true, is_flagged: false, updated_at: new Date().toISOString() })
        .eq('id', pinId)

      if (error) throw error

      return res.status(200).json({ ok: true })
    } catch (error) {
      console.error('[api/pins/[id]]', error)
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
    }
  }

  if (req.method === 'PATCH') {
    const parsed = UpdatePinSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'INVALID_BODY', message: parsed.error.errors.map(e => e.message).join(', '), status: 400 })
    }
    if (Object.keys(parsed.data).length === 0) {
      return res.status(400).json({ error: 'INVALID_BODY', message: 'At least one field must be provided', status: 400 })
    }

    try {
      const payload = { ...parsed.data, updated_at: new Date().toISOString() }
      const { error } = await supabase
        .from('pins')
        .update(payload)
        .eq('id', pinId)

      if (error) throw error

      return res.status(200).json({ ok: true })
    } catch (error) {
      console.error('[api/pins/[id]]', error)
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
    }
  }
}
