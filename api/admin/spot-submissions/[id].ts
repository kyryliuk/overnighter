import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { requireAdminAuth } from '../../_middleware'
import { createServiceClient } from '../../_supabase'
import type { ApiDbSpotSubmission } from '../../_spot-submissions'
import { notifySubmissionStatusChange } from '../../_submissionNotify'

const ReviewSubmissionSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_changes']),
  admin_notes: z.string().trim().max(1000).optional().nullable(),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'PATCH only', status: 405 })
  }

  if (!requireAdminAuth(req, res)) return

  const parsed = ReviewSubmissionSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_BODY',
      message: parsed.error.errors.map((entry) => entry.message).join(', '),
      status: 400,
    })
  }

  const submissionId = req.query.id
  if (typeof submissionId !== 'string') {
    return res.status(400).json({ error: 'INVALID_ID', message: 'Submission id is required', status: 400 })
  }

  const supabase = createServiceClient()

  try {
    const { data: submission, error: submissionError } = await supabase
      .from('spot_submissions')
      .select('*')
      .eq('id', submissionId)
      .single()

    if (submissionError) throw submissionError
    if (!submission) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Submission not found', status: 404 })
    }

    const record = submission as ApiDbSpotSubmission
    const now = new Date().toISOString()
    let publishedPinId: string | null = null

    // Prevent duplicate actions — only pending/changes_requested can be reviewed
    if (record.status !== 'pending' && record.status !== 'changes_requested') {
      return res.status(409).json({
        error: 'INVALID_STATUS',
        message: `Submission is already ${record.status}`,
        status: 409,
      })
    }

    if (parsed.data.action === 'approve') {
      const { data: pinData, error: pinInsertError } = await supabase
        .from('pins')
        .insert({
          name: record.name,
          description: record.description,
          latitude: record.latitude,
          longitude: record.longitude,
          pin_type: 'community',
          source_id: null,
          max_length_ft: record.max_length_ft,
          max_height_ft: record.max_height_ft,
          website: record.website,
          phone: record.phone,
          elevation_m: null,
          amenities: record.amenities,
          badge_state: 'grey',
          last_check_in_at: null,
          recent_check_in_count: 0,
          is_verified: false,
          is_flagged: false,
          is_archived: false,
          updated_at: now,
        })
        .select('id')
        .single()

      if (pinInsertError) throw pinInsertError
      publishedPinId = pinData.id as string
    }

    const nextStatus =
      parsed.data.action === 'approve'
        ? 'approved'
        : parsed.data.action === 'request_changes'
          ? 'changes_requested'
          : 'rejected'

    const { error: updateError } = await supabase
      .from('spot_submissions')
      .update({
        status: nextStatus,
        admin_notes: parsed.data.admin_notes ?? null,
        reviewed_at: now,
        updated_at: now,
        published_pin_id: publishedPinId,
      })
      .eq('id', submissionId)

    if (updateError) throw updateError

    // Fire-and-forget push notification to submitter
    notifySubmissionStatusChange(supabase, {
      userId: record.user_id,
      submissionName: record.name,
      action: parsed.data.action,
      adminNotes: parsed.data.admin_notes,
      publishedPinId: publishedPinId,
    })

    return res.status(200).json({ id: submissionId, status: nextStatus, publishedPinId })
  } catch (error) {
    console.error('[api/admin/spot-submissions/:id]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
