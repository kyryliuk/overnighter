import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { requireAdminAuth } from '../_middleware'
import { createServiceClient } from '../_supabase'

const CreatePinSchema = z.object({
  name: z.string().min(1),
  pin_type: z.enum(['blm', 'usfs', 'nps', 'overpass', 'community']),
  latitude: z.number().min(24).max(49),
  longitude: z.number().min(-125).max(-66),
  amenities: z.object({
    water: z.boolean(),
    dump: z.boolean(),
    electric: z.boolean(),
    shower: z.boolean(),
    fuel: z.boolean(),
    propane: z.boolean(),
    overnight: z.boolean(),
  }),
  max_length_ft: z.number().int().positive().optional().nullable(),
  max_height_ft: z.number().positive().optional().nullable(),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only', status: 405 })
  }

  if (!requireAdminAuth(req, res)) return

  const parsed = CreatePinSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_BODY',
      message: parsed.error.errors.map((e) => e.message).join(', '),
      status: 400,
    })
  }

  const supabase = createServiceClient()

  try {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('pins')
      .insert({
        ...parsed.data,
        badge_state: 'green',
        is_verified: true,
        is_flagged: false,
        is_archived: false,
        last_check_in_at: now,
        updated_at: now,
      })
      .select('id')
      .single()

    if (error) throw error

    return res.status(201).json({ id: data.id })
  } catch (error) {
    console.error('[api/admin/pins]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
