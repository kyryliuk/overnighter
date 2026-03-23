import type { User } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServiceClient } from './_supabase'

export async function requireUserAuth(req: VercelRequest, res: VercelResponse): Promise<User | null> {
  const authHeader = req.headers['authorization']
  const parts = authHeader?.split(' ')
  const scheme = parts?.[0]
  const token = parts?.[1]?.trim()

  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing authenticated user token',
      status: 401,
    })
    return null
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid authenticated user token',
      status: 401,
    })
    return null
  }

  return data.user
}
