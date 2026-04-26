import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime'

export interface SageMakerClassifyResult {
  confidence: number
}

/**
 * Extract the SageMaker endpoint name from a full invocation URL.
 *
 * Expected format:
 *   https://runtime.sagemaker.<region>.amazonaws.com/endpoints/<name>/invocations
 *
 * @throws {Error} If the URL does not match the expected pattern.
 */
export function extractEndpointName(endpointUrl: string): string {
  const match = endpointUrl.match(/\/endpoints\/([^/]+)\/invocations/)
  if (!match) {
    throw new Error(
      `Cannot extract endpoint name from SAGEMAKER_ENDPOINT_URL: "${endpointUrl}". ` +
        'Expected format: https://runtime.sagemaker.<region>.amazonaws.com/endpoints/<name>/invocations',
    )
  }
  return match[1]
}

/**
 * Normalise the SageMaker response body to a single confidence score.
 *
 * Supported response shapes:
 *   1. New interface:    { confidence: number }
 *   2. Legacy faucet classifier (ml/inference.py):
 *      { label: string, confidence: number, all_scores: { working: number, broken: number, no_faucet: number } }
 *      → returns all_scores.working (probability the image is a working water tap)
 *
 * @throws {Error} If the parsed value does not match either expected shape.
 */
export function parseConfidence(parsed: unknown): number {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Unexpected response shape from SageMaker endpoint: not an object')
  }

  const p = parsed as Record<string, unknown>

  // Precedence: legacy faucet-classify format first (ml/inference.py returns
  // { label, confidence, all_scores }).  For water-tap detection we use
  // all_scores.working because "working" == functioning water tap.  This
  // takes priority over the new { confidence } shape so that the existing
  // SageMaker endpoint (which returns all_scores) always produces the correct
  // water-tap probability even if a top-level confidence field is also present.
  if (typeof p.all_scores === 'object' && p.all_scores !== null) {
    const scores = p.all_scores as Record<string, unknown>
    if (typeof scores.working === 'number') {
      return scores.working
    }
  }

  // New interface: { confidence: number }
  if (typeof p.confidence === 'number') {
    return p.confidence
  }

  throw new Error(
    'Unexpected response shape from SageMaker endpoint: ' +
      'expected { confidence } or { label, confidence, all_scores }',
  )
}

/**
 * Classify an image URL using the SageMaker faucet/water-tap classifier.
 *
 * Reads all credentials from server-side process.env — never from VITE_ prefixed vars.
 *
 * Endpoint resolution priority:
 *   1. SAGEMAKER_ENDPOINT_URL  (full HTTPS invocation URL — preferred)
 *   2. SAGEMAKER_ENDPOINT_NAME (endpoint name only — legacy fallback)
 *
 * If neither is set, returns a safe mock value of { confidence: 0.0 } so that
 * development/test environments never accidentally call the real endpoint.
 *
 * @param imageUrl - Publicly accessible URL of the image to classify.
 * @returns { confidence } where 0.0 = definitely not a faucet, 1.0 = definitely a faucet.
 */
export async function classifyImageUrl(imageUrl: string): Promise<SageMakerClassifyResult> {
  // NFR-ML5: read from process.env only — never VITE_* prefixed names
  const endpointUrl = process.env.SAGEMAKER_ENDPOINT_URL
  const endpointName = process.env.SAGEMAKER_ENDPOINT_NAME

  if (!endpointUrl && !endpointName) {
    console.warn('[_sagemaker] No SageMaker endpoint configured — returning mock confidence 0.0')
    return { confidence: 0.0 }
  }

  // Fetch image bytes from the public URL (5s timeout to enforce AC1 latency SLA)
  const imageResponse = await fetch(imageUrl, {
    signal: AbortSignal.timeout(5000),
  })
  if (!imageResponse.ok) {
    throw new Error(
      `Failed to fetch image from "${imageUrl}": HTTP ${imageResponse.status} ${imageResponse.statusText}`,
    )
  }
  const imageBytes = Buffer.from(await imageResponse.arrayBuffer())
  const contentType = imageResponse.headers.get('content-type') ?? 'image/jpeg'

  // Resolve endpoint name
  const resolvedEndpointName = endpointUrl ? extractEndpointName(endpointUrl) : (endpointName as string)

  // Build credentials config — fall back to SDK default chain if explicit creds absent
  const credentialsConfig: { accessKeyId: string; secretAccessKey: string } | undefined =
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined

  const client = new SageMakerRuntimeClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    ...(credentialsConfig ? { credentials: credentialsConfig } : {}),
  })

  const command = new InvokeEndpointCommand({
    EndpointName: resolvedEndpointName,
    Body: imageBytes,
    ContentType: contentType,
    Accept: 'application/json',
  })

  const smResponse = await client.send(command)

  if (!smResponse.Body) {
    throw new Error('Empty response body from SageMaker endpoint')
  }

  const bodyText = Buffer.from(smResponse.Body).toString('utf-8')
  const parsedBody: unknown = JSON.parse(bodyText)
  const confidence = parseConfidence(parsedBody)

  return { confidence }
}
