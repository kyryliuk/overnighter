import { useState } from 'react'

export const DEVICE_ID_KEY = 'device-id'

function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY)
  if (existing) return existing
  const id = crypto.randomUUID()
  localStorage.setItem(DEVICE_ID_KEY, id)
  return id
}

export function useDeviceId(): string {
  const [deviceId] = useState<string>(getOrCreateDeviceId)
  return deviceId
}
