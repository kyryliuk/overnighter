import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock _middleware to control requireAdminAuth behavior
const { mockRequireAdminAuth } = vi.hoisted(() => {
  const mockRequireAdminAuth = vi.fn().mockReturnValue(true)
  return { mockRequireAdminAuth }
})

vi.mock('./_middleware', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}))

// Mock _sagemaker classifyImageUrl
const { mockClassifyImageUrl } = vi.hoisted(() => {
  const mockClassifyImageUrl = vi.fn().mockResolvedValue({ confidence: 0.9 })
  return { mockClassifyImageUrl }
})

vi.mock('./_sagemaker', () => ({
  classifyImageUrl: mockClassifyImageUrl,
}))

// Mock _supabase with chainable query builder
const {
  mockMaybeSingle,
  mockSelectEq,
  mockSelect,
  mockInsertSelectSingle,
  mockInsertSelect,
  mockInsert,
  mockUpdate,
  mockUpdateEq,
} = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
  const mockSelectEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
  const mockSelect = vi.fn().mockReturnValue({ eq: mockSelectEq })

  const mockInsertSelectSingle = vi.fn().mockResolvedValue({ data: { id: 'new-pin-id' }, error: null })
  const mockInsertSelect = vi.fn().mockReturnValue({ single: mockInsertSelectSingle })
  const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect })

  const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })

  return { mockMaybeSingle, mockSelectEq, mockSelect, mockInsertSelectSingle, mockInsertSelect, mockInsert, mockUpdate, mockUpdateEq }
})

vi.mock('./_supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'water_tap_pins') {
        return { select: mockSelect, insert: mockInsert, update: mockUpdate }
      }
      // tap_verification_events
      return { insert: mockInsert }
    }),
  })),
}))

// Stub global fetch for Overpass + Mapillary + Google Places
vi.stubGlobal('fetch', vi.fn())

const mockFetch = vi.mocked(fetch)

// Import handler and utilities AFTER mocks are set up
import handler, {
  buildMlScanOverpassQuery,
  fetchOverpassLocations,
  fetchMapillaryPhotos,
  fetchGooglePlacesPhotos,
  fetchPhotosForLocation,
  delay,
  CONFIDENCE_THRESHOLD,
  RATE_LIMIT_DELAY_MS,
  MAX_PHOTOS_PER_LOCATION,
  MAX_LOCATIONS_PER_INVOCATION,
  ML_BATCH_DEVICE_ID,
  type BBox,
  type OverpassNode,
} from './ml-scan'

// ── Helpers ───────────────────────────────────────────────────────────────────

const ADMIN_TOKEN = 'test-secret-token'

function mockReq(
  method = 'POST',
  options: {
    authorization?: string
    body?: unknown
    noBody?: boolean
    query?: Record<string, string>
  } = {}
): VercelRequest {
  const { authorization = `Bearer ${ADMIN_TOKEN}`, body, noBody = false, query = {} } = options
  return {
    method,
    headers: { authorization },
    body: noBody ? undefined : (body ?? { bbox: { north: 25.7, south: 24.5, east: -80.1, west: -81.8 } }),
    query,
  } as unknown as VercelRequest
}

function mockRes() {
  const ctx = { statusCode: null as number | null, body: null as unknown }
  const res = {
    status(code: number) {
      ctx.statusCode = code
      return res
    },
    json(data: unknown) {
      ctx.body = data
      return res
    },
    get ctx() {
      return ctx
    },
  }
  return res as unknown as VercelResponse & { ctx: typeof ctx }
}

/** Helper: build a minimal valid Overpass response with N nodes */
function overpassResponse(nodes: Partial<OverpassNode>[] = []) {
  const elements = nodes.map((n, i) => ({
    type: 'node',
    id: n.id ?? i + 1,
    lat: n.lat ?? 24.8 + i * 0.001,
    lon: n.lon ?? -81.5 + i * 0.001,
    tags: n.tags ?? { amenity: 'fuel', name: `Station ${i}` },
  }))
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({ elements }),
  }
}

/** Helper: Mapillary response with N photos */
function mapillaryResponse(count: number) {
  const data = Array.from({ length: count }, (_, i) => ({
    id: `img-${i}`,
    thumb_original_url: `https://mapillary.example.com/img-${i}.jpg`,
  }))
  return { ok: true, json: vi.fn().mockResolvedValue({ data }) }
}

/** Helper: empty Mapillary response */
function emptyMapillaryResponse() {
  return { ok: true, json: vi.fn().mockResolvedValue({ data: [] }) }
}

/** Helper: empty Google Places response */
function emptyGoogleResponse() {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({ results: [] }),
  }
}

/** Helper: Google Places response with photos */
function googlePlacesResponse(photoCount = 2) {
  const photos = Array.from({ length: photoCount }, (_, i) => ({
    photo_reference: `ref-${i}`,
  }))
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({ results: [{ photos }] }),
  }
}

// ── Environment setup ─────────────────────────────────────────────────────────

const ENV_VARS = {
  PRECISION_GATE_PASSED: 'true',
  ADMIN_SECRET: ADMIN_TOKEN,
  MAPILLARY_ACCESS_TOKEN: 'mapillary-token',
  GOOGLE_PLACES_API_KEY: 'google-key',
}

beforeEach(() => {
  vi.clearAllMocks()

  // Re-initialize mock chain implementations after clearAllMocks
  mockRequireAdminAuth.mockReturnValue(true)
  mockClassifyImageUrl.mockResolvedValue({ confidence: 0.9 })

  // Supabase select chain: .select().eq().maybeSingle()
  mockMaybeSingle.mockResolvedValue({ data: null, error: null })
  mockSelectEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
  mockSelect.mockReturnValue({ eq: mockSelectEq })

  // Supabase insert chain: .insert().select().single()
  mockInsertSelectSingle.mockResolvedValue({ data: { id: 'new-pin-id' }, error: null })
  mockInsertSelect.mockReturnValue({ single: mockInsertSelectSingle })
  mockInsert.mockReturnValue({ select: mockInsertSelect })

  // Supabase update chain: .update().eq()
  mockUpdateEq.mockResolvedValue({ error: null })
  mockUpdate.mockReturnValue({ eq: mockUpdateEq })

  // Set env vars
  Object.entries(ENV_VARS).forEach(([k, v]) => (process.env[k] = v))
})

afterEach(() => {
  Object.keys(ENV_VARS).forEach(k => delete process.env[k])
})

// ── Test Suites ───────────────────────────────────────────────────────────────

describe('Constants', () => {
  it('CONFIDENCE_THRESHOLD is 0.75', () => {
    expect(CONFIDENCE_THRESHOLD).toBe(0.75)
  })

  it('RATE_LIMIT_DELAY_MS is 200', () => {
    expect(RATE_LIMIT_DELAY_MS).toBe(200)
  })

  it('MAX_PHOTOS_PER_LOCATION is 5', () => {
    expect(MAX_PHOTOS_PER_LOCATION).toBe(5)
  })

  it('MAX_LOCATIONS_PER_INVOCATION is 200', () => {
    expect(MAX_LOCATIONS_PER_INVOCATION).toBe(200)
  })

  it('ML_BATCH_DEVICE_ID is ml_batch_cron', () => {
    expect(ML_BATCH_DEVICE_ID).toBe('ml_batch_cron')
  })
})

describe('delay()', () => {
  it('resolves after the specified time', async () => {
    const start = Date.now()
    await delay(10)
    expect(Date.now() - start).toBeGreaterThanOrEqual(9)
  })
})

describe('buildMlScanOverpassQuery()', () => {
  const bbox: BBox = { north: 25.7, south: 24.5, east: -80.1, west: -81.8 }

  it('includes amenity=fuel node query', () => {
    const q = buildMlScanOverpassQuery(bbox)
    expect(q).toContain('node["amenity"="fuel"]')
  })

  it('includes amenity=campsite node query', () => {
    const q = buildMlScanOverpassQuery(bbox)
    expect(q).toContain('node["amenity"="campsite"]')
  })

  it('includes tourism=camp_site node query', () => {
    const q = buildMlScanOverpassQuery(bbox)
    expect(q).toContain('node["tourism"="camp_site"]')
  })

  it('embeds correct south,west,north,east coordinate order in bbox', () => {
    const q = buildMlScanOverpassQuery(bbox)
    // Each node filter should include (south,west,north,east)
    expect(q).toContain('(24.5,-81.8,25.7,-80.1)')
  })

  it('uses [out:json] output format', () => {
    const q = buildMlScanOverpassQuery(bbox)
    expect(q).toContain('[out:json]')
  })
})

describe('fetchOverpassLocations()', () => {
  const bbox: BBox = { north: 25.7, south: 24.5, east: -80.1, west: -81.8 }

  it('POSTs to Overpass interpreter URL with encoded query', async () => {
    mockFetch.mockResolvedValueOnce(overpassResponse([{ id: 1, lat: 24.8, lon: -81.5 }]) as unknown as Response)
    const nodes = await fetchOverpassLocations(bbox)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://overpass-api.de/api/interpreter',
      expect.objectContaining({ method: 'POST' })
    )
    expect(nodes).toHaveLength(1)
  })

  it('filters out non-node elements', async () => {
    const elements = [
      { type: 'node', id: 1, lat: 24.8, lon: -81.5 },
      { type: 'way', id: 2 }, // should be filtered
      { type: 'relation', id: 3 }, // should be filtered
    ]
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ elements }),
    } as unknown as Response)
    const nodes = await fetchOverpassLocations(bbox)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe(1)
  })

  it('throws on non-ok Overpass response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    } as unknown as Response)
    await expect(fetchOverpassLocations(bbox)).rejects.toThrow('Overpass API error: 503')
  })

  it('returns empty array when elements is missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response)
    const nodes = await fetchOverpassLocations(bbox)
    expect(nodes).toHaveLength(0)
  })
})

describe('fetchMapillaryPhotos()', () => {
  it('returns empty array when MAPILLARY_ACCESS_TOKEN is not set', async () => {
    delete process.env.MAPILLARY_ACCESS_TOKEN
    const photos = await fetchMapillaryPhotos(24.8, -81.5)
    expect(photos).toHaveLength(0)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns photo URLs from Mapillary response', async () => {
    mockFetch.mockResolvedValueOnce(mapillaryResponse(3) as unknown as Response)
    const photos = await fetchMapillaryPhotos(24.8, -81.5)
    expect(photos).toHaveLength(3)
    expect(photos[0]).toContain('mapillary.example.com')
  })

  it('caps results at MAX_PHOTOS_PER_LOCATION (5)', async () => {
    mockFetch.mockResolvedValueOnce(mapillaryResponse(10) as unknown as Response)
    const photos = await fetchMapillaryPhotos(24.8, -81.5)
    expect(photos).toHaveLength(5)
  })

  it('returns empty array on 429 rate limit — skip + log (NFR-ML4, AC 9)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 } as unknown as Response)
    const photos = await fetchMapillaryPhotos(24.8, -81.5)
    expect(photos).toHaveLength(0)
  })

  it('returns empty array on other HTTP errors', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 } as unknown as Response)
    const photos = await fetchMapillaryPhotos(24.8, -81.5)
    expect(photos).toHaveLength(0)
  })

  it('returns empty array on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'))
    const photos = await fetchMapillaryPhotos(24.8, -81.5)
    expect(photos).toHaveLength(0)
  })

  it('filters out entries missing thumb_original_url', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: [{ id: '1', thumb_original_url: 'https://example.com/img.jpg' }, { id: '2' }],
      }),
    } as unknown as Response)
    const photos = await fetchMapillaryPhotos(24.8, -81.5)
    expect(photos).toHaveLength(1)
  })
})

describe('fetchGooglePlacesPhotos()', () => {
  it('returns empty array when GOOGLE_PLACES_API_KEY is not set', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY
    const photos = await fetchGooglePlacesPhotos(24.8, -81.5)
    expect(photos).toHaveLength(0)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns photo reference URLs from Places response', async () => {
    mockFetch.mockResolvedValueOnce(googlePlacesResponse(2) as unknown as Response)
    const photos = await fetchGooglePlacesPhotos(24.8, -81.5)
    expect(photos).toHaveLength(2)
    expect(photos[0]).toContain('photo_reference=ref-0')
  })

  it('caps results at MAX_PHOTOS_PER_LOCATION (5)', async () => {
    const manyPhotos = Array.from({ length: 10 }, (_, i) => ({ photo_reference: `ref-${i}` }))
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ results: [{ photos: manyPhotos }] }),
    } as unknown as Response)
    const photos = await fetchGooglePlacesPhotos(24.8, -81.5)
    expect(photos).toHaveLength(5)
  })

  it('returns empty array on 429 rate limit — skip + log (NFR-ML4, AC 9)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 } as unknown as Response)
    const photos = await fetchGooglePlacesPhotos(24.8, -81.5)
    expect(photos).toHaveLength(0)
  })

  it('returns empty array on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'))
    const photos = await fetchGooglePlacesPhotos(24.8, -81.5)
    expect(photos).toHaveLength(0)
  })

  it('returns empty array when Places results is empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ results: [] }),
    } as unknown as Response)
    const photos = await fetchGooglePlacesPhotos(24.8, -81.5)
    expect(photos).toHaveLength(0)
  })
})

describe('fetchPhotosForLocation()', () => {
  it('returns Mapillary photos when sufficient (≥5)', async () => {
    mockFetch
      .mockResolvedValueOnce(mapillaryResponse(5) as unknown as Response) // Mapillary
    const photos = await fetchPhotosForLocation(24.8, -81.5)
    expect(photos).toHaveLength(5)
    expect(mockFetch).toHaveBeenCalledTimes(1) // Google Places NOT called
  })

  it('falls back to Google Places when Mapillary returns fewer than 5 photos', async () => {
    mockFetch
      .mockResolvedValueOnce(mapillaryResponse(2) as unknown as Response) // Mapillary: 2
      .mockResolvedValueOnce(googlePlacesResponse(3) as unknown as Response) // Google: 3
    const photos = await fetchPhotosForLocation(24.8, -81.5)
    expect(photos).toHaveLength(5) // 2 + 3
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('combines Mapillary + Google Photos up to MAX_PHOTOS_PER_LOCATION', async () => {
    mockFetch
      .mockResolvedValueOnce(mapillaryResponse(3) as unknown as Response) // Mapillary: 3
      .mockResolvedValueOnce(googlePlacesResponse(5) as unknown as Response) // Google: 5 (only 2 used)
    const photos = await fetchPhotosForLocation(24.8, -81.5)
    expect(photos).toHaveLength(5) // 3 + 2 (capped)
  })

  it('returns empty when both providers return nothing', async () => {
    mockFetch
      .mockResolvedValueOnce(emptyMapillaryResponse() as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ results: [] }),
      } as unknown as Response)
    const photos = await fetchPhotosForLocation(24.8, -81.5)
    expect(photos).toHaveLength(0)
  })
})

describe('POST /api/ml-scan — AC 1: Bearer token authorization', () => {
  it('returns 401 when requireAdminAuth returns false (missing/invalid token)', async () => {
    mockRequireAdminAuth.mockReturnValue(false)
    const req = mockReq('POST', { authorization: 'Bearer wrong' })
    const res = mockRes()
    await handler(req, res)
    // Auth middleware writes 401 directly; handler returns early
    expect(mockRequireAdminAuth).toHaveBeenCalled()
    // No further processing (Overpass not called)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns 405 for non-POST requests before auth check', async () => {
    const req = mockReq('GET')
    const res = mockRes()
    await handler(req, res)
    expect(res.ctx.statusCode).toBe(405)
    expect((res.ctx.body as Record<string, unknown>).error).toBe('METHOD_NOT_ALLOWED')
  })
})

describe('POST /api/ml-scan — AC 10: Precision gate', () => {
  beforeEach(() => {
    delete process.env.PRECISION_GATE_PASSED
  })

  it('returns 403 PRECISION_GATE_BLOCKED when env var not set', async () => {
    const req = mockReq()
    const res = mockRes()
    await handler(req, res)
    expect(res.ctx.statusCode).toBe(403)
    expect((res.ctx.body as Record<string, unknown>).error).toBe('PRECISION_GATE_BLOCKED')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns 403 when PRECISION_GATE_PASSED is "false"', async () => {
    process.env.PRECISION_GATE_PASSED = 'false'
    const req = mockReq()
    const res = mockRes()
    await handler(req, res)
    expect(res.ctx.statusCode).toBe(403)
  })

  it('returns 403 when PRECISION_GATE_PASSED is "1" (not exactly "true")', async () => {
    process.env.PRECISION_GATE_PASSED = '1'
    const req = mockReq()
    const res = mockRes()
    await handler(req, res)
    expect(res.ctx.statusCode).toBe(403)
  })
})

describe('POST /api/ml-scan — AC 2: Bbox validation', () => {
  it('returns 400 when body is missing', async () => {
    const req = mockReq('POST', { noBody: true })
    const res = mockRes()
    await handler(req, res)
    expect(res.ctx.statusCode).toBe(400)
    expect((res.ctx.body as Record<string, unknown>).error).toBe('INVALID_BBOX')
  })

  it('returns 400 when bbox is null', async () => {
    const req = mockReq('POST', { body: { bbox: null } })
    const res = mockRes()
    await handler(req, res)
    expect(res.ctx.statusCode).toBe(400)
  })

  it('returns 400 when bbox has non-numeric values', async () => {
    const req = mockReq('POST', { body: { bbox: { north: 'x', south: 24.5, east: -80.1, west: -81.8 } } })
    const res = mockRes()
    await handler(req, res)
    expect(res.ctx.statusCode).toBe(400)
  })

  it('returns 400 when bbox is missing fields', async () => {
    const req = mockReq('POST', { body: { bbox: { north: 25.7 } } })
    const res = mockRes()
    await handler(req, res)
    expect(res.ctx.statusCode).toBe(400)
  })
})

describe('POST /api/ml-scan — AC 7: Chunked response contract', () => {
  it('applies offset and limit to slice Overpass results', async () => {
    // 3 nodes total; offset=1&limit=2 → windowLocations has 2 nodes
    mockFetch
      .mockResolvedValueOnce(overpassResponse([
        { id: 1 }, { id: 2 }, { id: 3 },
      ]) as unknown as Response)
      // Location 2 (offset=1): Mapillary → empty, Google Places → empty → skipped
      .mockResolvedValueOnce(emptyMapillaryResponse() as unknown as Response)
      .mockResolvedValueOnce(emptyGoogleResponse() as unknown as Response)
      // Location 3 (offset=1+1): Mapillary → empty, Google Places → empty → skipped
      .mockResolvedValueOnce(emptyMapillaryResponse() as unknown as Response)
      .mockResolvedValueOnce(emptyGoogleResponse() as unknown as Response)

    const req = mockReq('POST', { query: { offset: '1', limit: '2' } })
    const res = mockRes()
    await handler(req, res)

    expect(res.ctx.statusCode).toBe(200)
    const body = res.ctx.body as Record<string, unknown>
    expect(body.processed).toBe(2) // 2 in window
    expect(body.nextOffset).toBe(3) // 1 + 2
  })

  it('response includes all required fields: processed, created, updated, skipped, nextOffset', async () => {
    mockFetch.mockResolvedValueOnce(overpassResponse([]) as unknown as Response)
    const req = mockReq()
    const res = mockRes()
    await handler(req, res)
    expect(res.ctx.statusCode).toBe(200)
    const body = res.ctx.body as Record<string, unknown>
    expect(body).toHaveProperty('processed')
    expect(body).toHaveProperty('created')
    expect(body).toHaveProperty('updated')
    expect(body).toHaveProperty('skipped')
    expect(body).toHaveProperty('nextOffset')
  })

  it('processed < limit signals loop termination (empty Overpass result)', async () => {
    mockFetch.mockResolvedValueOnce(overpassResponse([]) as unknown as Response)
    const req = mockReq('POST', { query: { offset: '0', limit: '50' } })
    const res = mockRes()
    await handler(req, res)
    const body = res.ctx.body as Record<string, unknown>
    expect(body.processed).toBe(0)
    expect((body.processed as number) < 50).toBe(true) // loop should break
  })

  it('defaults offset to 0 and limit to 50 when query params missing', async () => {
    mockFetch.mockResolvedValueOnce(overpassResponse([]) as unknown as Response)
    const req = mockReq()
    const res = mockRes()
    await handler(req, res)
    const body = res.ctx.body as Record<string, unknown>
    expect(body.nextOffset).toBe(50) // 0 + 50
  })

  it('caps limit at MAX_LOCATIONS_PER_INVOCATION (200) to prevent runaway requests', async () => {
    mockFetch.mockResolvedValueOnce(overpassResponse([]) as unknown as Response)
    const req = mockReq('POST', { query: { offset: '0', limit: '9999' } })
    const res = mockRes()
    await handler(req, res)
    const body = res.ctx.body as Record<string, unknown>
    // nextOffset = 0 + 200 (capped), not 9999
    expect(body.nextOffset).toBe(200)
  })
})

describe('POST /api/ml-scan — AC 5: DB write when confidence ≥0.75 (new pin)', () => {
  it('creates water_tap_pins and tap_verification_events when confidence ≥0.75', async () => {
    mockFetch
      .mockResolvedValueOnce(overpassResponse([{ id: 42, lat: 24.8, lon: -81.5, tags: { amenity: 'fuel', name: 'Test Station' } }]) as unknown as Response)
      .mockResolvedValueOnce(mapillaryResponse(1) as unknown as Response)
      .mockResolvedValueOnce(emptyGoogleResponse() as unknown as Response) // 1 < 5, Google called

    mockClassifyImageUrl.mockResolvedValueOnce({ confidence: 0.9 })
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null }) // no existing pin
    mockInsertSelectSingle.mockResolvedValueOnce({ data: { id: 'new-pin-id' }, error: null })

    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    expect(res.ctx.statusCode).toBe(200)
    const body = res.ctx.body as Record<string, unknown>
    expect(body.created).toBe(1)
    expect(body.updated).toBe(0)
    expect(body.skipped).toBe(0)
  })

  it('includes access=null, source=ml_batch, place_ref in upsert payload', async () => {
    mockFetch
      .mockResolvedValueOnce(overpassResponse([{ id: 42, lat: 24.8, lon: -81.5, tags: { amenity: 'fuel', name: 'Test Station' } }]) as unknown as Response)
      .mockResolvedValueOnce(mapillaryResponse(1) as unknown as Response)
      .mockResolvedValueOnce(emptyGoogleResponse() as unknown as Response)

    mockClassifyImageUrl.mockResolvedValueOnce({ confidence: 0.9 })
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        access: null,
        source: 'ml_batch',
        place_ref: 'osm:node:42',
        confidence: 0.9,
      })
    )
  })

  it('appends tap_verification_events row with event_type=ml_scan', async () => {
    mockFetch
      .mockResolvedValueOnce(overpassResponse([{ id: 42 }]) as unknown as Response)
      .mockResolvedValueOnce(mapillaryResponse(1) as unknown as Response)
      .mockResolvedValueOnce(emptyGoogleResponse() as unknown as Response)

    mockClassifyImageUrl.mockResolvedValueOnce({ confidence: 0.85 })
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    mockInsertSelectSingle.mockResolvedValueOnce({ data: { id: 'pin-id' }, error: null })

    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    // Second call to insert should be tap_verification_events
    const insertCalls = mockInsert.mock.calls
    const eventInsert = insertCalls.find(call =>
      call[0] && typeof call[0] === 'object' && 'event_type' in call[0]
    )
    expect(eventInsert?.[0]).toMatchObject({
      event_type: 'ml_scan',
      confidence: 0.85,
      device_id: ML_BATCH_DEVICE_ID,
    })
  })
})

describe('POST /api/ml-scan — AC 5: DB write when confidence ≥0.75 (existing pin update)', () => {
  it('updates existing pin and appends verification event when pin already exists', async () => {
    mockFetch
      .mockResolvedValueOnce(overpassResponse([{ id: 42 }]) as unknown as Response)
      .mockResolvedValueOnce(mapillaryResponse(1) as unknown as Response)
      .mockResolvedValueOnce(emptyGoogleResponse() as unknown as Response)

    mockClassifyImageUrl.mockResolvedValueOnce({ confidence: 0.88 })
    // Existing pin found
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'existing-pin-id', photos: ['https://old.photo.com/photo.jpg'] },
      error: null,
    })
    mockUpdateEq.mockResolvedValueOnce({ error: null })

    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    expect(res.ctx.statusCode).toBe(200)
    const body = res.ctx.body as Record<string, unknown>
    expect(body.updated).toBe(1)
    expect(body.created).toBe(0)
    expect(mockUpdate).toHaveBeenCalled()
  })
})

describe('POST /api/ml-scan — AC 6: Skip when confidence <0.75', () => {
  it('skips location and writes no DB rows when all photos score below threshold', async () => {
    mockFetch
      .mockResolvedValueOnce(overpassResponse([{ id: 42 }]) as unknown as Response)
      .mockResolvedValueOnce(mapillaryResponse(2) as unknown as Response)
      .mockResolvedValueOnce(emptyGoogleResponse() as unknown as Response)

    // Both photos below threshold
    mockClassifyImageUrl.mockResolvedValue({ confidence: 0.5 })

    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    expect(res.ctx.statusCode).toBe(200)
    const body = res.ctx.body as Record<string, unknown>
    expect(body.skipped).toBe(1)
    expect(body.created).toBe(0)
    expect(body.updated).toBe(0)
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('tracks highest confidence across all photos for a location', async () => {
    mockFetch
      .mockResolvedValueOnce(overpassResponse([{ id: 42, tags: { amenity: 'fuel', name: 'Test' } }]) as unknown as Response)
      .mockResolvedValueOnce(mapillaryResponse(3) as unknown as Response)
      .mockResolvedValueOnce(emptyGoogleResponse() as unknown as Response) // 3 < 5, Google called

    // Progressively higher confidences; 3rd photo is highest at 0.95
    mockClassifyImageUrl
      .mockResolvedValueOnce({ confidence: 0.6 })
      .mockResolvedValueOnce({ confidence: 0.8 })
      .mockResolvedValueOnce({ confidence: 0.95 })
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    // Should create pin with highest confidence (0.95) and photo from 3rd image
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ confidence: 0.95 })
    )
  })
})

describe('POST /api/ml-scan — AC 9: Error resilience', () => {
  it('skips location on Overpass per-location error and continues other locations', async () => {
    mockFetch
      .mockResolvedValueOnce(overpassResponse([{ id: 1 }, { id: 2 }]) as unknown as Response)
      // Location 1: Mapillary throws (caught → []), Google Places → empty (both fail → skipped)
      .mockRejectedValueOnce(new Error('photo fetch crash'))        // Location 1 Mapillary
      .mockResolvedValueOnce(emptyGoogleResponse() as unknown as Response)  // Location 1 Google
      // Location 2: Mapillary → 1 photo, Google Places → empty (1 < 5 so Google called)
      .mockResolvedValueOnce(mapillaryResponse(1) as unknown as Response)  // Location 2 Mapillary
      .mockResolvedValueOnce(emptyGoogleResponse() as unknown as Response)  // Location 2 Google

    mockClassifyImageUrl.mockResolvedValueOnce({ confidence: 0.9 })
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    // Location 1 skipped (no photos after error), location 2 created
    expect(res.ctx.statusCode).toBe(200)
    const body = res.ctx.body as Record<string, unknown>
    expect(body.processed).toBe(2) // both were in window
    expect(body.created).toBe(1)   // location 2 succeeded
    expect(body.skipped).toBe(1)   // location 1 skipped (no photos)
  })

  it('skips location when SageMaker classify throws for all photos', async () => {
    mockFetch
      .mockResolvedValueOnce(overpassResponse([{ id: 42 }]) as unknown as Response)
      .mockResolvedValueOnce(mapillaryResponse(1) as unknown as Response)   // Mapillary: 1 photo
      .mockResolvedValueOnce(emptyGoogleResponse() as unknown as Response)  // Google: empty (1 < 5)

    mockClassifyImageUrl.mockRejectedValueOnce(new Error('SageMaker timeout'))

    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    const body = res.ctx.body as Record<string, unknown>
    expect(body.skipped).toBe(1)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns 500 when Overpass fetch itself fails (pipeline-level error)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Overpass is down'))
    const req = mockReq()
    const res = mockRes()
    await handler(req, res)
    expect(res.ctx.statusCode).toBe(500)
    expect((res.ctx.body as Record<string, unknown>).error).toBe('INTERNAL_ERROR')
  })
})

describe('POST /api/ml-scan — place_type mapping', () => {
  it('maps amenity=campsite to placeType=campground', async () => {
    mockFetch
      .mockResolvedValueOnce(overpassResponse([{ id: 1, tags: { amenity: 'campsite', name: 'Camp A' } }]) as unknown as Response)
      .mockResolvedValueOnce(mapillaryResponse(1) as unknown as Response)
      .mockResolvedValueOnce(emptyGoogleResponse() as unknown as Response)

    mockClassifyImageUrl.mockResolvedValueOnce({ confidence: 0.9 })
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ place_type: 'campground' })
    )
  })

  it('maps tourism=camp_site to placeType=campground', async () => {
    mockFetch
      .mockResolvedValueOnce(overpassResponse([{ id: 1, tags: { tourism: 'camp_site', name: 'Camp B' } }]) as unknown as Response)
      .mockResolvedValueOnce(mapillaryResponse(1) as unknown as Response)
      .mockResolvedValueOnce(emptyGoogleResponse() as unknown as Response)

    mockClassifyImageUrl.mockResolvedValueOnce({ confidence: 0.9 })
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ place_type: 'campground' })
    )
  })

  it('maps amenity=fuel to placeType=gas_station', async () => {
    mockFetch
      .mockResolvedValueOnce(overpassResponse([{ id: 1, tags: { amenity: 'fuel', name: 'Shell' } }]) as unknown as Response)
      .mockResolvedValueOnce(mapillaryResponse(1) as unknown as Response)
      .mockResolvedValueOnce(emptyGoogleResponse() as unknown as Response)

    mockClassifyImageUrl.mockResolvedValueOnce({ confidence: 0.9 })
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ place_type: 'gas_station' })
    )
  })
})

describe('Security: Google Places API key not persisted in DB (CR-6.5-1)', () => {
  it('stores empty photos array when highest-confidence photo is from Google Places', async () => {
    // No Mapillary photos — force Google Places fallback
    delete process.env.MAPILLARY_ACCESS_TOKEN

    mockFetch
      .mockResolvedValueOnce(overpassResponse([{ id: 1, tags: { amenity: 'fuel', name: 'Shell' } }]) as unknown as Response)
      .mockResolvedValueOnce(googlePlacesResponse(1) as unknown as Response) // Google: 1 photo with API key in URL

    mockClassifyImageUrl.mockResolvedValueOnce({ confidence: 0.9 })
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    expect(res.ctx.statusCode).toBe(200)
    const body = res.ctx.body as Record<string, unknown>
    expect(body.created).toBe(1)

    // DB insert must NOT store a Google Places URL (which would contain API key)
    const pinInsert = mockInsert.mock.calls.find(call =>
      call[0] && typeof call[0] === 'object' && 'place_name' in call[0]
    )
    const photos = pinInsert?.[0]?.photos as string[]
    expect(photos).toEqual([])
  })

  it('stores Mapillary URL normally — only Google Places URLs are blocked', async () => {
    mockFetch
      .mockResolvedValueOnce(overpassResponse([{ id: 1, tags: { amenity: 'fuel', name: 'Shell' } }]) as unknown as Response)
      .mockResolvedValueOnce(mapillaryResponse(1) as unknown as Response)
      .mockResolvedValueOnce(emptyGoogleResponse() as unknown as Response)

    mockClassifyImageUrl.mockResolvedValueOnce({ confidence: 0.9 })
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    const pinInsert = mockInsert.mock.calls.find(call =>
      call[0] && typeof call[0] === 'object' && 'place_name' in call[0]
    )
    const photos = pinInsert?.[0]?.photos as string[]
    expect(photos).toHaveLength(1)
    expect(photos[0]).toContain('mapillary.example.com')
  })
})

describe('Confidence clamping before DB write', () => {
  it('clamps confidence >1.0 to 1.0 before upsert', async () => {
    mockFetch
      .mockResolvedValueOnce(overpassResponse([{ id: 1, tags: { amenity: 'fuel', name: 'Shell' } }]) as unknown as Response)
      .mockResolvedValueOnce(mapillaryResponse(1) as unknown as Response)
      .mockResolvedValueOnce(emptyGoogleResponse() as unknown as Response)

    // SageMaker returns value outside [0,1] range
    mockClassifyImageUrl.mockResolvedValueOnce({ confidence: 1.5 })
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    expect(res.ctx.statusCode).toBe(200)
    const pinInsert = mockInsert.mock.calls.find(call =>
      call[0] && typeof call[0] === 'object' && 'place_name' in call[0]
    )
    // confidence clamped to 1.0 — DB NUMERIC(3,2) constraint satisfied
    expect(pinInsert?.[0]?.confidence).toBe(1.0)
  })
})


describe('NFR-ML5: No VITE_ prefix in source file', () => {
  it('api/ml-scan.ts contains no VITE_ prefixed env var accesses', async () => {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    const src = readFileSync(resolve(__dirname, 'ml-scan.ts'), 'utf-8')
    expect(src).not.toMatch(/process\.env\.VITE_/)
    expect(src).not.toMatch(/import\.meta\.env\.VITE_/)
  })
})
