import type { Pin } from '@/types/pin'

const PINS_CACHE_KEY = 'pins-cache-v1'
export const PINS_CACHE_UPDATED_EVENT = 'pins-cache-updated'

export interface PinsCacheSnapshot {
  pins: Pin[]
  cachedAt: string
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function isPinsCacheSnapshot(value: unknown): value is PinsCacheSnapshot {
  if (!value || typeof value !== 'object') return false

  const snapshot = value as Partial<PinsCacheSnapshot>
  return Array.isArray(snapshot.pins) && typeof snapshot.cachedAt === 'string'
}

export function readPinsCacheSnapshot(): PinsCacheSnapshot | null {
  if (!canUseStorage()) return null

  const rawValue = localStorage.getItem(PINS_CACHE_KEY)
  if (!rawValue) return null

  try {
    const parsedValue = JSON.parse(rawValue) as unknown
    return isPinsCacheSnapshot(parsedValue) ? parsedValue : null
  } catch {
    return null
  }
}

export function savePinsCacheSnapshot(pins: Pin[]): PinsCacheSnapshot | null {
  if (!canUseStorage()) return null

  const snapshot: PinsCacheSnapshot = {
    pins,
    cachedAt: new Date().toISOString(),
  }

  localStorage.setItem(PINS_CACHE_KEY, JSON.stringify(snapshot))
  window.dispatchEvent(new Event(PINS_CACHE_UPDATED_EVENT))
  return snapshot
}
