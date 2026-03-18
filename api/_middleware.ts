import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Validates Bearer token from Authorization header.
 * Returns true if authorized, false if not (and writes 401 response).
 * Used by all admin-protected serverless functions.
 */
export function requireAdminAuth(req: VercelRequest, res: VercelResponse): boolean {
  const authHeader = req.headers['authorization']
  const token = authHeader?.replace('Bearer ', '').trim()

  if (!token || token !== process.env.ADMIN_SECRET) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid or missing Bearer token',
      status: 401,
    })
    return false
  }
  return true
}
