import { vi } from 'vitest'

export function useRegisterSW() {
  return {
    needRefresh: [false, vi.fn()] as [boolean, (v: boolean) => void],
    offlineReady: [false, vi.fn()] as [boolean, (v: boolean) => void],
    updateServiceWorker: vi.fn(),
  }
}
