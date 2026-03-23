import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { requireUserAuth } from './_auth'
import { createServiceClient } from './_supabase'
import { mapSpotSubmission, type ApiDbSpotSubmission } from './_spot-submissions'

const AmenitiesSchema = z.object({
  water: z.boolean(),
  dump: z.boolean(),
  electric: z.boolean(),
  shower: z.boolean(),
  fuel: z.boolean(),
  propane: z.boolean(),
  overnight: z.boolean(),
  toilets: z.boolean(),
  pets: z.boolean(),
  wifi: z.boolean(),
  kitchen: z.boolean(),
  restaurant: z.boolean(),
  big_rig: z.boolean(),
  tent: z.boolean(),
  hiking: z.boolean(),
  fishing: z.boolean(),
  swimming: z.boolean(),
  boating: z.boolean(),
  biking: z.boolean(),
  ohv: z.boolean(),
  climbing: z.boolean(),
  winter_sports: z.boolean(),
  hunting: z.boolean(),
  wildlife: z.boolean(),
  horseback: z.boolean(),
  hot_springs: z.boolean(),
})

const SpotSubmissionSchema = z.object({
  name: z.string().min(1),
  description: z.string().trim().max(2000).optional().nullable(),
  latitude: z.number().min(24).max(49),
  longitude: z.number().min(-125).max(-66),
  amenities: AmenitiesSchema,
  max_length_ft: z.number().int().positive().optional().nullable(),
  max_height_ft: z.number().positive().optional().nullable(),
  website: z.string().trim().url().optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireUserAuth(req, res)
  if (!user) return

  const supabase = createServiceClient()

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('spot_submissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return res.status(200).json((data as ApiDbSpotSubmission[]).map(mapSpotSubmission))
    } catch (error) {
      console.error('[api/spot-submissions][GET]', error)
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
    }
  }

  if (req.method === 'POST') {
    const parsed = SpotSubmissionSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'INVALID_BODY',
        message: parsed.error.errors.map((entry) => entry.message).join(', '),
        status: 400,
      })
    }

    try {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('spot_submissions')
        .insert({
          user_id: user.id,
          ...parsed.data,
          status: 'pending',
          updated_at: now,
        })
        .select('id')
        .single()

      if (error) throw error
      return res.status(201).json({ id: data.id })
    } catch (error) {
      console.error('[api/spot-submissions][POST]', error)
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
    }
  }

  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'GET and POST only', status: 405 })
}
