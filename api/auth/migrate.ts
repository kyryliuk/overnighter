import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { requireUserAuth } from '../_auth'
import { createServiceClient } from '../_supabase'

const RigProfileSchema = z.object({
  rigType: z.enum(['Class A', 'Class B', 'Class C', 'Travel Trailer', '5th Wheel']).nullable(),
  lengthFt: z.number().nullable(),
  heightFt: z.number().nullable(),
})

const SavedSpotSchema = z.object({ id: z.string().min(1) }).passthrough()

const MigrationSchema = z.object({
  rigProfile: RigProfileSchema.nullable(),
  onboardingDismissed: z.boolean(),
  rigUpdatedAt: z.string().nullable(),
  savedSpots: z.array(SavedSpotSchema),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only', status: 405 })
  }

  const user = await requireUserAuth(req, res)
  if (!user) return

  const parsed = MigrationSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_BODY',
      message: parsed.error.errors.map((entry) => entry.message).join(', '),
      status: 400,
    })
  }

  const supabase = createServiceClient()
  const { rigProfile, onboardingDismissed, rigUpdatedAt, savedSpots } = parsed.data
  const now = new Date().toISOString()

  try {
    let migratedRigProfile = false

    if (rigProfile?.rigType || onboardingDismissed) {
      const { error } = await supabase.from('rig_profiles').upsert(
        {
          user_id: user.id,
          rig_type: rigProfile?.rigType ?? null,
          length_ft: rigProfile?.lengthFt ?? null,
          height_ft: rigProfile?.heightFt ?? null,
          onboarding_dismissed: onboardingDismissed,
          updated_at: rigUpdatedAt ?? now,
        },
        { onConflict: 'user_id' },
      )

      if (error) throw error
      migratedRigProfile = true
    }

    let migratedSpotsCount = 0

    if (savedSpots.length > 0) {
      const { error } = await supabase.from('saved_spots').upsert(
        savedSpots.map((spot) => ({
          user_id: user.id,
          pin_id: spot.id,
          pin_snapshot: spot,
          updated_at: now,
        })),
        { onConflict: 'user_id,pin_id' },
      )

      if (error) throw error
      migratedSpotsCount = savedSpots.length
    }

    return res.status(200).json({ migratedRigProfile, migratedSpotsCount })
  } catch (error) {
    console.error('[api/auth/migrate][POST]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
