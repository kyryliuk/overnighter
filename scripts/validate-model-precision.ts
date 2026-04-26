/**
 * scripts/validate-model-precision.ts
 *
 * Offline precision evaluation script for the faucet / water-tap classifier.
 *
 * Runs the SageMaker endpoint against the Florida Keys ground truth test set and
 * reports the precision score along with a pass/fail decision against the ≥80%
 * threshold required by NFR-ML2.
 *
 * Usage:
 *   npx tsx scripts/validate-model-precision.ts
 *   npx tsx scripts/validate-model-precision.ts --dataset path/to/custom-dataset.json
 *
 * Prerequisites:
 *   - SAGEMAKER_ENDPOINT_URL or SAGEMAKER_ENDPOINT_NAME set in the environment
 *   - AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION set in the environment
 *
 * Exit codes:
 *   0 — precision ≥ 80%  (gate passes — you may set PRECISION_GATE_PASSED=true)
 *   1 — precision < 80%  (gate blocked — do NOT set PRECISION_GATE_PASSED=true)
 *   2 — script error     (dataset missing, network failure, etc.)
 */

import { readFileSync } from 'fs'
import { classifyImageUrl } from '../api/_sagemaker'

/** One labelled entry in the ground truth dataset. */
export interface GroundTruthItem {
  image_url: string
  is_faucet: boolean
  description?: string
}

/** Per-sample classification result used for precision calculation. */
export interface ClassificationResult {
  predicted_positive: boolean
  actual_positive: boolean
}

/**
 * Precision-at-threshold calculation.
 *
 * precision = TP / (TP + FP)
 *
 * Returns 0 when there are no predicted positives (avoids division by zero).
 */
export function computePrecision(results: ClassificationResult[]): number {
  const tp = results.filter(r => r.predicted_positive && r.actual_positive).length
  const fp = results.filter(r => r.predicted_positive && !r.actual_positive).length
  const totalPredictedPositive = tp + fp
  if (totalPredictedPositive === 0) return 0
  return tp / totalPredictedPositive
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Minimum precision required before the ML scan pipeline is authorised. */
export const PRECISION_THRESHOLD = 0.8

/** Confidence score at or above which a sample is counted as a predicted positive. */
export const CONFIDENCE_THRESHOLD = 0.75

// ─── Validation runner ───────────────────────────────────────────────────────

async function runValidation(datasetPath: string): Promise<void> {
  let dataset: GroundTruthItem[]
  try {
    dataset = JSON.parse(readFileSync(datasetPath, 'utf-8')) as GroundTruthItem[]
  } catch (err) {
    console.error(`❌ Failed to load dataset from "${datasetPath}":`, err)
    process.exit(2)
  }

  // Validate each item has the required fields
  const validItems = dataset.filter(
    item =>
      typeof item.image_url === 'string' &&
      item.image_url.length > 0 &&
      typeof item.is_faucet === 'boolean',
  )
  if (validItems.length < dataset.length) {
    const invalid = dataset.length - validItems.length
    console.warn(`⚠️  Skipping ${invalid} malformed dataset entries (missing image_url or is_faucet).`)
  }
  console.log(`\n📊 Faucet Classifier — Precision Validation (NFR-ML2)`)
  console.log(`   Dataset  : ${datasetPath} (${dataset.length} samples)`)
  console.log(`   Required : ≥${(PRECISION_THRESHOLD * 100).toFixed(0)}% precision @ confidence threshold ${CONFIDENCE_THRESHOLD}`)
  console.log(``)

  const results: ClassificationResult[] = []

  for (const [i, item] of validItems.entries()) {
    const label = String(i + 1).padStart(3, ' ')
    const totalStr = String(validItems.length)
    try {
      const { confidence } = await classifyImageUrl(item.image_url)
      const predicted_positive = confidence >= CONFIDENCE_THRESHOLD
      results.push({ predicted_positive, actual_positive: item.is_faucet })

      const tag = predicted_positive ? '🟢 POSITIVE' : '⚪ negative'
      const shortUrl = item.image_url.length > 60 ? `…${item.image_url.slice(-57)}` : item.image_url
      console.log(`   [${label}/${totalStr}] ${tag}  conf=${confidence.toFixed(3)}  ${shortUrl}`)
    } catch (err) {
      console.error(`   [${label}/${totalStr}] ❌ ERROR — ${String(err)}`)
      // Count as predicted negative on error (conservative)
      results.push({ predicted_positive: false, actual_positive: item.is_faucet })
    }
  }

  const precision = computePrecision(results)
  const passed = precision >= PRECISION_THRESHOLD
  const tp = results.filter(r => r.predicted_positive && r.actual_positive).length
  const fp = results.filter(r => r.predicted_positive && !r.actual_positive).length
  const fn = results.filter(r => !r.predicted_positive && r.actual_positive).length

  console.log(``)
  console.log(`═══════════════════════════════════════════════════`)
  console.log(`   Precision : ${(precision * 100).toFixed(1)}%  (TP=${tp}, FP=${fp}, FN=${fn})`)
  console.log(`   Threshold : ${(PRECISION_THRESHOLD * 100).toFixed(0)}%`)
  console.log(`   Result    : ${passed ? '✅ PASSED' : '❌ BLOCKED'}`)
  console.log(`═══════════════════════════════════════════════════`)
  console.log(``)

  if (passed) {
    console.log(`✅ Precision gate PASSED.`)
    console.log(`   → Set  PRECISION_GATE_PASSED=true  in your Vercel / .env environment`)
    console.log(`   → This authorises the /api/ml-scan production pipeline.`)
    process.exit(0)
  } else {
    console.error(`❌ Precision gate BLOCKED — precision ${(precision * 100).toFixed(1)}% < ${(PRECISION_THRESHOLD * 100).toFixed(0)}%.`)
    console.error(`   → Do NOT set PRECISION_GATE_PASSED=true.`)
    console.error(`   → Review the model or test set before re-running validation.`)
    process.exit(1)
  }
}

// ─── CLI entry point ─────────────────────────────────────────────────────────
// Guard: only run the validation when this script is invoked directly from the
// command line, NOT when it is imported by a test runner (vitest) or another module.

const _argv1 = process.argv[1] ?? ''
const _isDirectInvocation =
  _argv1.endsWith('validate-model-precision.ts') ||
  _argv1.endsWith('validate-model-precision.js')

if (_isDirectInvocation) {
  const args = process.argv.slice(2)
  const datasetFlagIndex = args.indexOf('--dataset')
  const datasetPath =
    datasetFlagIndex >= 0 && args[datasetFlagIndex + 1]
      ? args[datasetFlagIndex + 1]
      : 'scripts/ground-truth-fl-keys.json'

  runValidation(datasetPath).catch(err => {
    console.error('Validation script failed with unexpected error:', err)
    process.exit(2)
  })
}
