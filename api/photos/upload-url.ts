import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { requireUserAuth } from '../_auth'
import { createServiceClient } from '../_supabase'
import * as crypto from 'crypto'

const UploadUrlBody = z.object({
  pinId: z.string().uuid(),
  checkInId: z.string().uuid(),
  fileType: z.enum(['image/jpeg', 'image/png', 'image/heic']),
})

const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only', status: 405 })
  }

  const user = await requireUserAuth(req, res)
  if (!user) return

  const parsed = UploadUrlBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_BODY',
      message: 'Photo must be JPEG, PNG, or HEIC and under 5MB',
      status: 400,
    })
  }

  const { pinId, checkInId, fileType } = parsed.data
  const ext = EXT_MAP[fileType]
  const storagePath = `${pinId}/${checkInId}/${crypto.randomUUID()}.${ext}`

  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase.storage
      .from('pin-photos')
      .createSignedUploadUrl(storagePath)

    if (error || !data) {
      console.error('[api/photos/upload-url] Storage error:', error)
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create upload URL', status: 500 })
    }

    const cdnUrl = `${process.env.VITE_SUPABASE_URL}/storage/v1/object/public/pin-photos/${storagePath}`

    return res.status(200).json({
      uploadUrl: data.signedUrl,
      cdnUrl,
      storagePath,
    })
  } catch (error) {
    console.error('[api/photos/upload-url]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
