import { createClient } from '@supabase/supabase-js'

/**
 * Service role Supabase client for Vercel serverless functions.
 * Uses process.env (not import.meta.env — that's Vite browser convention).
 * Vercel makes ALL env vars (including VITE_ prefixed) available via process.env
 * in serverless function runtimes.
 */
export function createServiceClient() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key)
}
