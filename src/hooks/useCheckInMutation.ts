import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import type { Pin } from '@/types/pin'

export type CheckInStatus = 'still_open' | 'closed' | 'changed'

export interface CheckInPayload {
  pinId: string
  deviceId: string
  status: CheckInStatus
  note?: string
}

export function useCheckInMutation() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, CheckInPayload, { snapshot: Pin[] | undefined }>({
    mutationFn: async (payload: CheckInPayload) => {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, timestamp: new Date().toISOString() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { message?: string }).message ?? `Check-in failed: ${res.status}`)
      }
    },

    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['pins'] })
      const snapshot = queryClient.getQueryData<Pin[]>(['pins'])
      queryClient.setQueryData<Pin[]>(['pins'], (old = []) =>
        old.map((pin) =>
          pin.id === payload.pinId
            ? { ...pin, badgeState: 'green', lastCheckInAt: new Date().toISOString() }
            : pin,
        ),
      )
      return { snapshot }
    },

    onError: (error, _payload, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(['pins'], context.snapshot)
      }
      Sentry.captureException(error)
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pins'] })
    },
  })
}
