import { describe, it, expect } from 'vitest'
import { urlBase64ToUint8Array, arrayBufferToBase64 } from './push'

describe('urlBase64ToUint8Array', () => {
  it('converts a base64url string to Uint8Array', () => {
    // Known VAPID-style base64url key (65 bytes unpadded)
    const base64url = 'BEl62iUYgUivxIkv69yViXuGAzQ8aN5u'
    const result = urlBase64ToUint8Array(base64url)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBeGreaterThan(0)
  })

  it('handles URL-safe characters (- and _)', () => {
    // base64url with - and _ chars
    const input = 'abc-def_ghi'
    const result = urlBase64ToUint8Array(input)
    expect(result).toBeInstanceOf(Uint8Array)
  })

  it('adds correct padding', () => {
    // 1 char => needs 3 padding
    const result1 = urlBase64ToUint8Array('QQ')
    expect(result1[0]).toBe(65) // 'A'

    // 2 chars
    const result2 = urlBase64ToUint8Array('QUI')
    expect(result2[0]).toBe(65) // 'A'
    expect(result2[1]).toBe(66) // 'B'
  })
})

describe('arrayBufferToBase64', () => {
  it('converts an ArrayBuffer to a base64 string', () => {
    const data = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
    const result = arrayBufferToBase64(data.buffer as ArrayBuffer)
    expect(result).toBe(btoa('Hello'))
  })

  it('round-trips with atob', () => {
    const original = new Uint8Array([1, 2, 3, 255, 0, 128])
    const b64 = arrayBufferToBase64(original.buffer as ArrayBuffer)
    const decoded = atob(b64)
    const roundTripped = new Uint8Array(decoded.length)
    for (let i = 0; i < decoded.length; i++) {
      roundTripped[i] = decoded.charCodeAt(i)
    }
    expect(roundTripped).toEqual(original)
  })

  it('handles empty buffer', () => {
    const empty = new ArrayBuffer(0)
    const result = arrayBufferToBase64(empty)
    expect(result).toBe('')
  })
})
