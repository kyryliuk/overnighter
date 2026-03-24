import { useRegisterSW } from 'virtual:pwa-register/react'
import { useEffect } from 'react'
import { useUIStore } from '@/store/uiStore'

export function usePWAUpdate() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  const setUpdateAvailable = useUIStore((state) => state.setUpdateAvailable)

  useEffect(() => {
    setUpdateAvailable(needRefresh)
  }, [needRefresh, setUpdateAvailable])

  return { needRefresh, updateServiceWorker }
}
