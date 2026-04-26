import { describe, it, expect } from 'vitest'
import {
  computePrecision,
  PRECISION_THRESHOLD,
  CONFIDENCE_THRESHOLD,
  type ClassificationResult,
} from './validate-model-precision'

describe('computePrecision', () => {
  it('returns 1.0 when all predicted positives are true positives', () => {
    const results: ClassificationResult[] = [
      { predicted_positive: true, actual_positive: true },
      { predicted_positive: true, actual_positive: true },
      { predicted_positive: false, actual_positive: false },
    ]
    expect(computePrecision(results)).toBe(1.0)
  })

  it('returns 0.0 when all predicted positives are false positives', () => {
    const results: ClassificationResult[] = [
      { predicted_positive: true, actual_positive: false },
      { predicted_positive: true, actual_positive: false },
    ]
    expect(computePrecision(results)).toBe(0.0)
  })

  it('calculates correct mixed precision: 3 TP, 1 FP → 0.75', () => {
    const results: ClassificationResult[] = [
      { predicted_positive: true, actual_positive: true },
      { predicted_positive: true, actual_positive: true },
      { predicted_positive: true, actual_positive: true },
      { predicted_positive: true, actual_positive: false },
      { predicted_positive: false, actual_positive: true }, // FN — does not affect precision
    ]
    expect(computePrecision(results)).toBeCloseTo(0.75)
  })

  it('returns exactly 0.8 for 4 TP and 1 FP (at the gate threshold)', () => {
    const results: ClassificationResult[] = [
      { predicted_positive: true, actual_positive: true },
      { predicted_positive: true, actual_positive: true },
      { predicted_positive: true, actual_positive: true },
      { predicted_positive: true, actual_positive: true },
      { predicted_positive: true, actual_positive: false },
    ]
    expect(computePrecision(results)).toBeCloseTo(0.8)
  })

  it('returns 0 when there are no predicted positives (avoids division by zero)', () => {
    const results: ClassificationResult[] = [
      { predicted_positive: false, actual_positive: true },
      { predicted_positive: false, actual_positive: false },
    ]
    expect(computePrecision(results)).toBe(0)
  })

  it('returns 0 for an empty results array', () => {
    expect(computePrecision([])).toBe(0)
  })
})

describe('validation constants', () => {
  it('PRECISION_THRESHOLD is 0.80 (NFR-ML2)', () => {
    expect(PRECISION_THRESHOLD).toBe(0.8)
  })

  it('CONFIDENCE_THRESHOLD is 0.75 (matches production auto-publish threshold)', () => {
    expect(CONFIDENCE_THRESHOLD).toBe(0.75)
  })
})
