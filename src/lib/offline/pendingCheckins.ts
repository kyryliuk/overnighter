import type { CheckInStatus } from '@/hooks/useCheckInMutation'

const PENDING_CHECKINS_KEY = 'pendingCheckins'
export const PENDING_CHECKINS_UPDATED_EVENT = 'pending-checkins-updated'

export interface PendingCheckIn {
  pinId: string
  deviceId: string
  status: CheckInStatus
  note?: string
  timestamp: string
  queuedAt: string
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function isPendingCheckInArray(value: unknown): value is PendingCheckIn[] {
  if (!Array.isArray(value)) return false
  return value.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof item.pinId === 'string' &&
      typeof item.deviceId === 'string' &&
      typeof item.status === 'string' &&
      typeof item.timestamp === 'string' &&
      typeof item.queuedAt === 'string',
  )
}

export function readPendingCheckins(): PendingCheckIn[] {
  if (!canUseStorage()) return []
  const raw = localStorage.getItem(PENDING_CHECKINS_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return isPendingCheckInArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function appendPendingCheckin(checkin: PendingCheckIn): void {
  if (!canUseStorage()) return
  const current = readPendingCheckins()
  current.push(checkin)
  localStorage.setItem(PENDING_CHECKINS_KEY, JSON.stringify(current))
  window.dispatchEvent(new Event(PENDING_CHECKINS_UPDATED_EVENT))
}

export function removePendingCheckin(queuedAt: string): void {
  if (!canUseStorage()) return
  const current = readPendingCheckins()
  const filtered = current.filter((c) => c.queuedAt !== queuedAt)
  localStorage.setItem(PENDING_CHECKINS_KEY, JSON.stringify(filtered))
  window.dispatchEvent(new Event(PENDING_CHECKINS_UPDATED_EVENT))
}

export function clearPendingCheckins(): void {
  if (!canUseStorage()) return
  localStorage.removeItem(PENDING_CHECKINS_KEY)
  window.dispatchEvent(new Event(PENDING_CHECKINS_UPDATED_EVENT))
}
