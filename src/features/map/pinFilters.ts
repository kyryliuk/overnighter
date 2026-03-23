import type { Pin, PinAmenities } from '@/types/pin'
import { type SourceGroup, GROUP_SOURCES } from '@/store/sourceFilterStore'
import { doesPinFitRig } from '@/lib/pins/doesPinFitRig'

export function doesPinMatchFilters(pin: Pin, activeFilters: Array<keyof PinAmenities>): boolean {
  if (activeFilters.length === 0) return true
  return activeFilters.every((amenity) => pin.amenities[amenity])
}

export function doesPinMatchSourceFilter(pin: Pin, activeGroups: SourceGroup[]): boolean {
  if (activeGroups.length === 0) return true
  return activeGroups.some((group) => GROUP_SOURCES[group].includes(pin.pinType))
}

export { doesPinFitRig }
