import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn() utility', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'skipped', 'included')).toBe('base included')
  })

  it('deduplicates conflicting Tailwind classes — last wins', () => {
    // tailwind-merge resolves conflicts: bg-red overrides bg-blue
    const result = cn('bg-blue-500', 'bg-red-500')
    expect(result).toBe('bg-red-500')
  })

  it('handles undefined and null gracefully', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end')
  })

  it('handles empty input', () => {
    expect(cn()).toBe('')
  })
})
