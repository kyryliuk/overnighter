import type { TripWritePayload, TripStatus } from '@/types/trip'

export type PendingTripMutationKind = 'create' | 'update' | 'updateStatus' | 'delete'

export interface PendingTripMutation {
  id: string
  kind: PendingTripMutationKind
  tripId: string
  payload?: TripWritePayload | { status: TripStatus }
  queuedAt: string
}

const PENDING_TRIP_MUTATIONS_KEY = 'pendingTripMutations'
export const PENDING_TRIP_MUTATIONS_UPDATED_EVENT = 'pending-trip-mutations-updated'
export const OFFLINE_QUEUED_ERROR = 'OFFLINE_QUEUED'

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function isPendingTripMutationArray(value: unknown): value is PendingTripMutation[] {
  if (!Array.isArray(value)) return false
  return value.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof item.id === 'string' &&
      typeof item.kind === 'string' &&
      typeof item.tripId === 'string' &&
      typeof item.queuedAt === 'string',
  )
}

export function readPendingTripMutations(): PendingTripMutation[] {
  if (!canUseStorage()) return []
  const raw = localStorage.getItem(PENDING_TRIP_MUTATIONS_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return isPendingTripMutationArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function appendPendingTripMutation(mutation: PendingTripMutation): void {
  if (!canUseStorage()) return
  const current = readPendingTripMutations()
  current.push(mutation)
  localStorage.setItem(PENDING_TRIP_MUTATIONS_KEY, JSON.stringify(current))
  window.dispatchEvent(new Event(PENDING_TRIP_MUTATIONS_UPDATED_EVENT))
}

export function removePendingTripMutation(id: string): void {
  if (!canUseStorage()) return
  const current = readPendingTripMutations()
  const filtered = current.filter((m) => m.id !== id)
  if (filtered.length === current.length) return
  localStorage.setItem(PENDING_TRIP_MUTATIONS_KEY, JSON.stringify(filtered))
  window.dispatchEvent(new Event(PENDING_TRIP_MUTATIONS_UPDATED_EVENT))
}

export function clearPendingTripMutations(): void {
  if (!canUseStorage()) return
  localStorage.removeItem(PENDING_TRIP_MUTATIONS_KEY)
  window.dispatchEvent(new Event(PENDING_TRIP_MUTATIONS_UPDATED_EVENT))
}
