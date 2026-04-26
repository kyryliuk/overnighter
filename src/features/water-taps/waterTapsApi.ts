import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WaterTapPin {
  id: string
  location: { type: string; coordinates: [number, number] } | null
  place_name: string
  place_type: string
  access: string | null
  confidence: number
  source: string
  photos: string[] | null
  seasonal_notes: string | null
  mile_marker: number | null
  is_active: boolean
  verified_date: string | null
  place_ref: string | null
}

/** TapDetail adds parsed lat/lng and verification counts on top of the raw DB row */
export interface TapDetail extends WaterTapPin {
  latitude: number
  longitude: number
  confirmedCount: number
  deniedCount: number
}

export interface TapSubmitResponse {
  pinId: string | null
  confidence: number
  status: 'created' | 'confirmed' | 'below_threshold'
}

export interface TapVerifyResponse {
  confirmed: number
  denied: number
}

export interface VerifyPayload {
  tapPinId: string
  eventType: 'confirmed' | 'denied'
  deviceId: string
}

// ---------------------------------------------------------------------------
// Supabase query — single tap pin + verification counts
// ---------------------------------------------------------------------------

export async function fetchWaterTapPin(id: string): Promise<TapDetail | null> {
  // Parallel queries: tap pin data + verification events
  const [tapResult, eventsResult] = await Promise.all([
    supabase.from('water_tap_pins').select('*').eq('id', id).single(),
    supabase.from('tap_verification_events').select('event_type').eq('tap_pin_id', id),
  ])

  const { data: tap, error } = tapResult
  if (error || !tap) return null

  const rawTap = tap as WaterTapPin

  // Parse geography column — Supabase returns GeoJSON: { type: 'Point', coordinates: [lng, lat] }
  let latitude = 0
  let longitude = 0
  if (rawTap.location && typeof rawTap.location === 'object' && rawTap.location.coordinates) {
    longitude = rawTap.location.coordinates[0]
    latitude = rawTap.location.coordinates[1]
  }

  const events = eventsResult.data
  const confirmedCount = events?.filter((e: { event_type: string }) => e.event_type === 'confirmed').length ?? 0
  const deniedCount = events?.filter((e: { event_type: string }) => e.event_type === 'denied').length ?? 0

  return { ...rawTap, latitude, longitude, confirmedCount, deniedCount }
}

// ---------------------------------------------------------------------------
// TanStack Query hook
// ---------------------------------------------------------------------------

export function useWaterTapQuery(id: string | undefined) {
  return useQuery<TapDetail | null>({
    queryKey: id ? ['water-tap', id] : ['water-tap', '__none__'],
    queryFn: () => (id ? fetchWaterTapPin(id) : Promise.resolve(null)),
    enabled: !!id,
    staleTime: 30_000,
  })
}

// ---------------------------------------------------------------------------
// Fetch wrappers — POST endpoints from Story 6.3
// ---------------------------------------------------------------------------

/** POST /api/tap-submit — multipart/form-data */
export async function submitTapPhoto(formData: FormData): Promise<TapSubmitResponse> {
  const res = await fetch('/api/tap-submit', {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? `tap-submit failed: ${res.status}`)
  }
  return res.json() as Promise<TapSubmitResponse>
}

/** POST /api/tap-verify — JSON body */
export async function verifyTap(payload: VerifyPayload): Promise<TapVerifyResponse> {
  const res = await fetch('/api/tap-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? `tap-verify failed: ${res.status}`)
  }
  return res.json() as Promise<TapVerifyResponse>
}

// ---------------------------------------------------------------------------
// useTapSubmitMutation
// ---------------------------------------------------------------------------

export function useTapSubmitMutation(tapPinId: string) {
  const queryClient = useQueryClient()

  return useMutation<TapSubmitResponse, Error, FormData>({
    mutationFn: submitTapPhoto,

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['water-tap', tapPinId] })
    },
  })
}

// ---------------------------------------------------------------------------
// useTapVerifyMutation
// ---------------------------------------------------------------------------

export function useTapVerifyMutation(tapPinId: string) {
  const queryClient = useQueryClient()

  return useMutation<TapVerifyResponse, Error, VerifyPayload, { snapshot: TapDetail | null | undefined }>({
    mutationFn: verifyTap,

    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['water-tap', tapPinId] })
      const snapshot = queryClient.getQueryData<TapDetail | null>(['water-tap', tapPinId])

      // Optimistic update: increment the relevant count
      queryClient.setQueryData<TapDetail | null>(['water-tap', tapPinId], (old) => {
        if (!old) return old
        return payload.eventType === 'confirmed'
          ? { ...old, confirmedCount: old.confirmedCount + 1 }
          : { ...old, deniedCount: old.deniedCount + 1 }
      })

      return { snapshot }
    },

    onError: (_error, _payload, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(['water-tap', tapPinId], context.snapshot)
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['water-tap', tapPinId] })
    },
  })
}
// NOTE (Story 6.6 code review — M2): `useWaterTapViewportQuery` and
// `fetchWaterTapsByViewport` were removed. Water tap pins are already included
// in the unified `map_pins` view queried by `usePinsQuery`, so a separate
// viewport hook was redundant. The `['water-taps', { viewport }]` query key
// documented in AC 2 is satisfied by `usePinsQuery`'s merged result set.
