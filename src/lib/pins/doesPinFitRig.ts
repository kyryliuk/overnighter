import type { Pin } from '@/types/pin'
import type { RigProfile } from '@/types/rigProfile'

export function doesPinFitRig(pin: Pin, rigProfile: RigProfile): boolean {
  if (!rigProfile.rigType) return true

  const lengthOk =
    pin.maxLengthFt === null ||
    rigProfile.lengthFt === null ||
    rigProfile.lengthFt <= pin.maxLengthFt

  const heightOk =
    pin.maxHeightFt === null ||
    rigProfile.heightFt === null ||
    rigProfile.heightFt <= pin.maxHeightFt

  return lengthOk && heightOk
}
