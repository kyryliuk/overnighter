import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'GET only', status: 405 })
  }

  const publicKey = process.env.VITE_VAPID_PUBLIC_KEY
  if (!publicKey) {
    return res.status(500).json({ error: 'CONFIGURATION_ERROR', message: 'Server misconfigured', status: 500 })
  }

  return res.status(200).json({ publicKey })
}
