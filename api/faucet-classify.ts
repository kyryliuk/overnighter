import type { VercelRequest, VercelResponse } from '@vercel/node'
import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime'

type FaucetLabel = 'working' | 'broken' | 'no_faucet'

interface ClassifyResult {
  label: FaucetLabel
  confidence: number
  all_scores: Record<string, number>
  mock?: boolean
}

interface ClassifyRequestBody {
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png'
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'] as const
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

function isFaucetLabel(value: unknown): value is FaucetLabel {
  return value === 'working' || value === 'broken' || value === 'no_faucet'
}

function isClassifyResult(value: unknown): value is ClassifyResult {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    isFaucetLabel(v.label) &&
    typeof v.confidence === 'number' &&
    typeof v.all_scores === 'object' &&
    v.all_scores !== null
  )
}

function parseBody(req: VercelRequest): ClassifyRequestBody | { error: string } {
  const body = req.body as unknown
  if (typeof body !== 'object' || body === null) {
    return { error: 'Request body must be JSON with imageBase64 and mimeType fields' }
  }
  const b = body as Record<string, unknown>

  if (typeof b.imageBase64 !== 'string' || b.imageBase64.length === 0) {
    return { error: 'imageBase64 must be a non-empty string' }
  }
  if (b.mimeType !== 'image/jpeg' && b.mimeType !== 'image/png') {
    return { error: `mimeType must be one of: ${ALLOWED_MIME_TYPES.join(', ')}` }
  }

  return { imageBase64: b.imageBase64, mimeType: b.mimeType }
}

async function runInference(imageBytes: Buffer, mimeType: string): Promise<ClassifyResult> {
  const endpointName = process.env.SAGEMAKER_ENDPOINT_NAME

  if (!endpointName) {
    console.warn('[api/faucet-classify] SAGEMAKER_ENDPOINT_NAME not set, returning mock response')
    return {
      label: 'working',
      confidence: 0.94,
      all_scores: { working: 0.94, broken: 0.04, no_faucet: 0.02 },
      mock: true,
    }
  }

  const client = new SageMakerRuntimeClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
  })

  const command = new InvokeEndpointCommand({
    EndpointName: endpointName,
    Body: imageBytes,
    ContentType: mimeType,
    Accept: 'application/json',
  })

  const response = await client.send(command)

  if (!response.Body) {
    throw new Error('Empty response body from SageMaker endpoint')
  }

  const bodyText = Buffer.from(response.Body).toString('utf-8')
  const parsed: unknown = JSON.parse(bodyText)

  if (!isClassifyResult(parsed)) {
    throw new Error('Unexpected response shape from SageMaker endpoint')
  }

  return parsed
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only', status: 405 })
  }

  const parsed = parseBody(req)
  if ('error' in parsed) {
    return res.status(400).json({ error: 'INVALID_BODY', message: parsed.error, status: 400 })
  }

  let imageBytes: Buffer
  try {
    imageBytes = Buffer.from(parsed.imageBase64, 'base64')
  } catch {
    return res.status(400).json({ error: 'INVALID_BODY', message: 'imageBase64 is not valid base64', status: 400 })
  }

  if (imageBytes.length > MAX_BYTES) {
    return res.status(400).json({
      error: 'INVALID_BODY',
      message: `Image exceeds maximum size of 5MB (got ${(imageBytes.length / 1024 / 1024).toFixed(2)}MB)`,
      status: 400,
    })
  }

  if (imageBytes.length === 0) {
    return res.status(400).json({ error: 'INVALID_BODY', message: 'Image data is empty', status: 400 })
  }

  try {
    const result = await runInference(imageBytes, parsed.mimeType)
    return res.status(200).json(result)
  } catch (error) {
    console.error('[api/faucet-classify] Inference error:', error)
    return res.status(500).json({ error: 'INFERENCE_ERROR', message: 'Failed to classify image', status: 500 })
  }
}
