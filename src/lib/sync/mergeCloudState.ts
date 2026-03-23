import type { Pin } from '@/types/pin'
import type { RigProfile } from '@/types/rigProfile'
import type { TripPlan } from '@/types/tripPlan'

export interface LocalRigProfileState {
  rigProfile: RigProfile
  onboardingDismissed: boolean
  updatedAt: string | null
}

export interface CloudRigProfileState {
  rigProfile: RigProfile
  onboardingDismissed: boolean
  updatedAt: string | null
}

export function mergeRigProfileState(
  localState: LocalRigProfileState,
  remoteState: CloudRigProfileState | null,
): CloudRigProfileState {
  if (!remoteState) return localState
  if (!localState.updatedAt) return remoteState

  return Date.parse(remoteState.updatedAt ?? '') > Date.parse(localState.updatedAt)
    ? remoteState
    : localState
}

export function mergeSavedSpots(localSpots: Pin[], remoteSpots: Pin[]): Pin[] {
  const mergedById = new Map<string, Pin>()

  for (const pin of remoteSpots) {
    mergedById.set(pin.id, pin)
  }

  for (const pin of localSpots) {
    mergedById.set(pin.id, pin)
  }

  return Array.from(mergedById.values())
}

export function mergeTripPlans(localPlans: TripPlan[], remotePlans: TripPlan[]): TripPlan[] {
  const mergedById = new Map<string, TripPlan>()

  for (const plan of remotePlans) {
    mergedById.set(plan.id, plan)
  }

  for (const plan of localPlans) {
    const existing = mergedById.get(plan.id)

    if (!existing) {
      mergedById.set(plan.id, plan)
      continue
    }

    mergedById.set(
      plan.id,
      Date.parse(plan.updatedAt) >= Date.parse(existing.updatedAt) ? plan : existing,
    )
  }

  return Array.from(mergedById.values()).sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  )
}
