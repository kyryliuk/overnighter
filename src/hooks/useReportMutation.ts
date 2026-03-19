import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import type { Pin } from '@/types/pin'

export type IssueReportType = 'dump_closed' | 'water_unavailable' | 'no_overnight' | 'access_blocked' | 'other'

export interface ReportPayload {
  pinId: string
  deviceId: string
  type: IssueReportType
  note?: string
}

export function useReportMutation() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, ReportPayload, { snapshot: Pin[] | undefined }>({
    mutationFn: async (payload: ReportPayload) => {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, timestamp: new Date().toISOString() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { message?: string }).message ?? `Report failed: ${res.status}`)
      }
    },

    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['pins'] })
      const snapshot = queryClient.getQueryData<Pin[]>(['pins'])
      queryClient.setQueryData<Pin[]>(['pins'], (old = []) =>
        old.map((pin) =>
          pin.id === payload.pinId
            ? { ...pin, badgeState: 'red' }
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
