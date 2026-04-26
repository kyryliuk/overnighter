import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockSend, mockFetch } = vi.hoisted(() => {
  const mockSend = vi.fn()
  const mockFetch = vi.fn()
  return { mockSend, mockFetch }
})

vi.mock('@aws-sdk/client-sagemaker-runtime', () => ({
  SageMakerRuntimeClient: vi.fn().mockImplementation(function () {
    return { send: mockSend }
  }),
  InvokeEndpointCommand: vi.fn().mockImplementation(function (args: unknown) {
    return args
  }),
}))

// Override global fetch with the mock
vi.stubGlobal('fetch', mockFetch)

import { extractEndpointName, parseConfidence, classifyImageUrl } from './_sagemaker'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeJsonResponse(body: unknown, status = 200, contentType = 'application/json') {
  const json = JSON.stringify(body)
  const headers = new Map([['content-type', contentType]])
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { get: (k: string) => headers.get(k) ?? null },
    arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode(json).buffer),
  }
}

function makeSageMakerResponse(body: unknown) {
  return {
    Body: Buffer.from(JSON.stringify(body)),
  }
}

// ── extractEndpointName ───────────────────────────────────────────────────────

describe('extractEndpointName', () => {
  it('extracts name from a valid SageMaker invocation URL', () => {
    const url =
      'https://runtime.sagemaker.us-east-1.amazonaws.com/endpoints/faucet-classifier-v1/invocations'
    expect(extractEndpointName(url)).toBe('faucet-classifier-v1')
  })

  it('extracts name with hyphens and numbers', () => {
    const url =
      'https://runtime.sagemaker.us-west-2.amazonaws.com/endpoints/faucet-prod-2024/invocations'
    expect(extractEndpointName(url)).toBe('faucet-prod-2024')
  })

  it('throws when URL does not contain /endpoints/<name>/invocations', () => {
    expect(() => extractEndpointName('https://example.com/wrong-path')).toThrow(
      'Cannot extract endpoint name from SAGEMAKER_ENDPOINT_URL',
    )
  })

  it('throws for a blank string', () => {
    expect(() => extractEndpointName('')).toThrow(
      'Cannot extract endpoint name from SAGEMAKER_ENDPOINT_URL',
    )
  })
})

// ── parseConfidence ───────────────────────────────────────────────────────────

describe('parseConfidence', () => {
  it('parses new { confidence } response shape', () => {
    expect(parseConfidence({ confidence: 0.92 })).toBe(0.92)
  })

  it('returns all_scores.working from legacy faucet-classify response', () => {
    const legacy = {
      label: 'working',
      confidence: 0.94,
      all_scores: { working: 0.94, broken: 0.04, no_faucet: 0.02 },
    }
    expect(parseConfidence(legacy)).toBe(0.94)
  })

  it('uses all_scores.working even when label is broken (working is a low score)', () => {
    const legacy = {
      label: 'broken',
      confidence: 0.85,
      all_scores: { working: 0.10, broken: 0.85, no_faucet: 0.05 },
    }
    expect(parseConfidence(legacy)).toBe(0.10)
  })

  it('prefers all_scores.working over top-level confidence when both exist', () => {
    const response = {
      confidence: 0.99,
      all_scores: { working: 0.12 },
    }
    expect(parseConfidence(response)).toBe(0.12)
  })

  it('falls back to top-level confidence when all_scores is absent', () => {
    expect(parseConfidence({ confidence: 0.77 })).toBe(0.77)
  })

  // AC5: smoke test — non-faucet objects must score below the 0.75 auto-publish threshold
  it('AC5 smoke: a door/fire-hydrant response (all_scores.working near 0) yields confidence < 0.75', () => {
    const nonFaucetResponse = {
      label: 'no_faucet',
      confidence: 0.97,
      all_scores: { working: 0.01, broken: 0.02, no_faucet: 0.97 },
    }
    const confidence = parseConfidence(nonFaucetResponse)
    expect(confidence).toBe(0.01)
    expect(confidence).toBeLessThan(0.75)
  })

  it('AC5 smoke: a broken-faucet response (all_scores.working low) yields confidence < 0.75', () => {
    const brokenFaucet = {
      label: 'broken',
      confidence: 0.80,
      all_scores: { working: 0.05, broken: 0.80, no_faucet: 0.15 },
    }
    const confidence = parseConfidence(brokenFaucet)
    expect(confidence).toBe(0.05)
    expect(confidence).toBeLessThan(0.75)
  })

  it('throws for null input', () => {
    expect(() => parseConfidence(null)).toThrow('Unexpected response shape from SageMaker endpoint')
  })

  it('throws for a plain string', () => {
    expect(() => parseConfidence('0.9')).toThrow('Unexpected response shape from SageMaker endpoint')
  })

  it('throws when object has no usable fields', () => {
    expect(() => parseConfidence({ foo: 'bar' })).toThrow(
      'Unexpected response shape from SageMaker endpoint',
    )
  })
})

// ── classifyImageUrl ──────────────────────────────────────────────────────────

describe('classifyImageUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SAGEMAKER_ENDPOINT_URL
    delete process.env.SAGEMAKER_ENDPOINT_NAME
    delete process.env.AWS_REGION
    delete process.env.AWS_ACCESS_KEY_ID
    delete process.env.AWS_SECRET_ACCESS_KEY
  })

  afterEach(() => {
    delete process.env.SAGEMAKER_ENDPOINT_URL
    delete process.env.SAGEMAKER_ENDPOINT_NAME
    delete process.env.AWS_REGION
    delete process.env.AWS_ACCESS_KEY_ID
    delete process.env.AWS_SECRET_ACCESS_KEY
  })

  it('returns mock { confidence: 0.0 } when no endpoint is configured', async () => {
    const result = await classifyImageUrl('https://example.com/image.jpg')
    expect(result).toEqual({ confidence: 0.0 })
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('fetches image and calls SageMaker with SAGEMAKER_ENDPOINT_URL', async () => {
    process.env.SAGEMAKER_ENDPOINT_URL =
      'https://runtime.sagemaker.us-east-1.amazonaws.com/endpoints/faucet-v1/invocations'
    process.env.AWS_REGION = 'us-east-1'

    const imageUrl = 'https://example.com/tap.jpg'
    mockFetch.mockResolvedValueOnce(makeJsonResponse(null, 200, 'image/jpeg'))
    mockSend.mockResolvedValueOnce(makeSageMakerResponse({ confidence: 0.88 }))

    const result = await classifyImageUrl(imageUrl)

    expect(mockFetch).toHaveBeenCalledWith(imageUrl, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ confidence: 0.88 })
  })

  it('falls back to SAGEMAKER_ENDPOINT_NAME when URL is not set', async () => {
    process.env.SAGEMAKER_ENDPOINT_NAME = 'faucet-fallback'
    process.env.AWS_REGION = 'us-west-2'

    mockFetch.mockResolvedValueOnce(makeJsonResponse(null, 200, 'image/png'))
    mockSend.mockResolvedValueOnce(
      makeSageMakerResponse({
        label: 'working',
        confidence: 0.91,
        all_scores: { working: 0.91, broken: 0.06, no_faucet: 0.03 },
      }),
    )

    const result = await classifyImageUrl('https://example.com/tap.png')
    expect(result).toEqual({ confidence: 0.91 })
  })

  it('throws when the image fetch returns non-OK status', async () => {
    process.env.SAGEMAKER_ENDPOINT_URL =
      'https://runtime.sagemaker.us-east-1.amazonaws.com/endpoints/faucet-v1/invocations'

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: { get: () => null },
    })

    await expect(classifyImageUrl('https://example.com/missing.jpg')).rejects.toThrow(
      'Failed to fetch image from "https://example.com/missing.jpg": HTTP 404',
    )
  })

  it('throws when SageMaker returns empty body', async () => {
    process.env.SAGEMAKER_ENDPOINT_URL =
      'https://runtime.sagemaker.us-east-1.amazonaws.com/endpoints/faucet-v1/invocations'

    mockFetch.mockResolvedValueOnce(makeJsonResponse(null, 200, 'image/jpeg'))
    mockSend.mockResolvedValueOnce({ Body: undefined })

    await expect(classifyImageUrl('https://example.com/tap.jpg')).rejects.toThrow(
      'Empty response body from SageMaker endpoint',
    )
  })

  it('passes explicit AWS credentials when both vars are set', async () => {
    process.env.SAGEMAKER_ENDPOINT_URL =
      'https://runtime.sagemaker.us-east-1.amazonaws.com/endpoints/faucet-v1/invocations'
    process.env.AWS_ACCESS_KEY_ID = 'AKIATEST'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret123'
    process.env.AWS_REGION = 'us-east-1'

    const { SageMakerRuntimeClient } = await import('@aws-sdk/client-sagemaker-runtime')

    mockFetch.mockResolvedValueOnce(makeJsonResponse(null, 200, 'image/jpeg'))
    mockSend.mockResolvedValueOnce(makeSageMakerResponse({ confidence: 0.76 }))

    await classifyImageUrl('https://example.com/tap.jpg')

    expect(SageMakerRuntimeClient).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'AKIATEST',
          secretAccessKey: 'secret123',
        },
      }),
    )
  })

  // NFR-ML5: verify no VITE_-prefixed env var names are used in _sagemaker.ts source
  it('NFR-ML5: source code must not reference any VITE_-prefixed env var names', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const source = fs.readFileSync(path.resolve(process.cwd(), 'api/_sagemaker.ts'), 'utf-8')
    // No occurrence of process.env.VITE_ anywhere in the file
    expect(source).not.toMatch(/process\.env\.VITE_/)
  })
})
