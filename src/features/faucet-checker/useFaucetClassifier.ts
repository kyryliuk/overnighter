import { useMutation } from '@tanstack/react-query'

export type FaucetLabel = 'working' | 'broken' | 'no_faucet'

export interface FaucetClassifyResult {
  label: FaucetLabel
  confidence: number
}

export function useFaucetClassifier() {
  return useMutation<FaucetClassifyResult, Error, File>({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('image', file)

      const res = await fetch('/api/faucet-classify', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { message?: string }).message ?? `Classification failed: ${res.status}`)
      }

      const data = await res.json() as FaucetClassifyResult
      return data
    },
  })
}
