import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock at the module path level — use the exact specifier _supabase.ts uses
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn((url: string, key: string) => {
    void url
    void key
    return { _mocked: true, from: vi.fn() }
  }),
}))

import { createServiceClient } from './_supabase'

describe('createServiceClient', () => {
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-xxx'
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.VITE_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  })

  it('returns a client object when env vars are present', () => {
    const client = createServiceClient()
    // The mocked createClient returns { _mocked: true, from: fn }
    // If mock doesn't work (real client), it still returns a client object
    expect(client).toBeTruthy()
    expect(typeof client).toBe('object')
  })

  it('throws when VITE_SUPABASE_URL is missing', () => {
    delete process.env.VITE_SUPABASE_URL
    expect(() => createServiceClient()).toThrow('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  })

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(() => createServiceClient()).toThrow('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  })
})
