import { z } from 'zod'
import type { createServiceClient } from './_supabase'

type ServiceSupabaseClient = ReturnType<typeof createServiceClient>

export const TRIP_MAX_STOPS = 12

const TRIP_STATUS_VALUES = ['draft', 'archived'] as const
const TRIP_ROUTE_MODE_VALUES = ['corridor'] as const
const TRIP_STOP_KIND_VALUES = ['waypoint', 'destination'] as const
const TRIP_STOP_SOURCE_VALUES = ['manual', 'saved', 'suggested', 'imported'] as const

const PlaceSnapshotSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .strict()

const TripWaypointInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    stopOrder: z.number().int().min(0),
    source: z.enum(TRIP_STOP_SOURCE_VALUES).optional(),
    pinId: z.string().trim().min(1).nullable().optional(),
    place: PlaceSnapshotSchema,
    notes: z.string().max(2000).optional(),
  })
  .strict()

const TripWriteBodySchema = z
  .object({
    title: z.string().max(160).optional(),
    notes: z.string().max(4000).optional(),
    origin: PlaceSnapshotSchema.nullable().optional(),
    destination: PlaceSnapshotSchema,
    routeMode: z.enum(TRIP_ROUTE_MODE_VALUES).optional(),
    stops: z.array(TripWaypointInputSchema).optional(),
  })
  .strict()

const TripIdSchema = z.string().uuid()

interface TripPlaceSnapshot {
  id: string
  name: string
  latitude: number
  longitude: number
}

interface TripWaypointInput {
  id: string | null
  stopOrder: number
  source: (typeof TRIP_STOP_SOURCE_VALUES)[number]
  pinId: string | null
  place: TripPlaceSnapshot
  notes: string
}

export interface TripWriteInput {
  title: string
  notes: string
  origin: TripPlaceSnapshot | null
  destination: TripPlaceSnapshot
  routeMode: (typeof TRIP_ROUTE_MODE_VALUES)[number]
  stops: TripWaypointInput[]
}

export interface DbTripStopRow {
  id: string
  trip_id: string
  stop_order: number
  stop_kind: (typeof TRIP_STOP_KIND_VALUES)[number]
  source: (typeof TRIP_STOP_SOURCE_VALUES)[number]
  pin_id: string | null
  place_snapshot: Record<string, unknown>
  notes: string
  created_at: string
  updated_at: string
}

export interface DbTripRow {
  id: string
  user_id: string
  title: string
  notes: string
  status: (typeof TRIP_STATUS_VALUES)[number]
  origin_snapshot: Record<string, unknown> | null
  destination_snapshot: Record<string, unknown>
  route_mode: (typeof TRIP_ROUTE_MODE_VALUES)[number]
  stop_count: number
  revision: number
  is_public: boolean
  share_token: string | null
  source_trip_id: string | null
  source_share_token: string | null
  created_at: string
  updated_at: string
  trip_stops?: DbTripStopRow[] | null
}

export interface ApiTripStop {
  id: string
  stopOrder: number
  stopKind: (typeof TRIP_STOP_KIND_VALUES)[number]
  source: (typeof TRIP_STOP_SOURCE_VALUES)[number]
  pinId: string | null
  place: TripPlaceSnapshot
  notes: string
  createdAt: string
  updatedAt: string
}

export interface ApiTrip {
  id: string
  title: string
  notes: string
  status: (typeof TRIP_STATUS_VALUES)[number]
  origin: TripPlaceSnapshot | null
  destination: TripPlaceSnapshot
  routeMode: (typeof TRIP_ROUTE_MODE_VALUES)[number]
  stopCount: number
  revision: number
  isPublic: boolean
  shareToken: string | null
  sourceTripId: string | null
  sourceShareToken: string | null
  createdAt: string
  updatedAt: string
  stops: ApiTripStop[]
}

export const TRIP_SELECT = `
  id,
  user_id,
  title,
  notes,
  status,
  origin_snapshot,
  destination_snapshot,
  route_mode,
  stop_count,
  revision,
  is_public,
  share_token,
  source_trip_id,
  source_share_token,
  created_at,
  updated_at,
  trip_stops (
    id,
    trip_id,
    stop_order,
    stop_kind,
    source,
    pin_id,
    place_snapshot,
    notes,
    created_at,
    updated_at
  )
`

export function formatZodError(error: z.ZodError) {
  return error.errors
    .map((issue) => {
      const path = issue.path.join('.')
      return path ? `${path}: ${issue.message}` : issue.message
    })
    .join(', ')
}

function toTripPlaceSnapshot(snapshot: Record<string, unknown> | null, label: string): TripPlaceSnapshot | null {
  if (snapshot === null) return null

  const parsed = PlaceSnapshotSchema.safeParse(snapshot)
  if (!parsed.success) {
    throw new Error(`Invalid ${label}`)
  }

  return parsed.data
}

export function parseTripIdParam(rawTripId: string | string[] | undefined) {
  const tripId = Array.isArray(rawTripId) ? rawTripId[0] : rawTripId
  const parsed = TripIdSchema.safeParse(tripId)

  if (!parsed.success) {
    return { success: false as const, message: formatZodError(parsed.error) }
  }

  return { success: true as const, tripId: parsed.data }
}

export function parseTripWriteBody(rawBody: unknown) {
  const parsed = TripWriteBodySchema.safeParse(rawBody)

  if (!parsed.success) {
    return { success: false as const, message: formatZodError(parsed.error) }
  }

  const stops = parsed.data.stops ?? []
  const stopOrders = stops.map((stop) => stop.stopOrder)
  const uniqueStopOrders = new Set(stopOrders)
  if (uniqueStopOrders.size !== stopOrders.length) {
    return { success: false as const, message: 'stops: stopOrder values must be unique' }
  }

  const sortedStopOrders = [...stopOrders].sort((left, right) => left - right)
  const hasSequentialStopOrders = sortedStopOrders.every((stopOrder, index) => stopOrder === index)
  if (!hasSequentialStopOrders) {
    return { success: false as const, message: 'stops: stopOrder values must be sequential starting at 0' }
  }

  if (stops.length + 1 > TRIP_MAX_STOPS) {
    return {
      success: false as const,
      message: `stops: a trip can contain at most ${TRIP_MAX_STOPS} total stops including the destination`,
    }
  }

  const placeIds = new Set<string>()
  for (const stop of [...stops, { place: parsed.data.destination }]) {
    if (placeIds.has(stop.place.id)) {
      return { success: false as const, message: 'stops: duplicate place ids are not allowed in a trip' }
    }
    placeIds.add(stop.place.id)
  }

  const waypointIds = stops.map((stop) => stop.id).filter((stopId): stopId is string => Boolean(stopId))
  if (new Set(waypointIds).size !== waypointIds.length) {
    return { success: false as const, message: 'stops: duplicate stop ids are not allowed in a trip' }
  }

  const title = parsed.data.title?.trim() || parsed.data.destination.name.trim() || 'New Route'

  return {
    success: true as const,
    data: {
      title,
      notes: parsed.data.notes ?? '',
      origin: parsed.data.origin ?? null,
      destination: parsed.data.destination,
      routeMode: parsed.data.routeMode ?? 'corridor',
      stops: stops.map((stop) => ({
        id: stop.id ?? null,
        stopOrder: stop.stopOrder,
        source: stop.source ?? 'manual',
        pinId: stop.pinId ?? null,
        place: stop.place,
        notes: stop.notes ?? '',
      })),
    } satisfies TripWriteInput,
  }
}

export function serializeTripWaypointsForRpc(input: TripWriteInput) {
  return input.stops.map((stop) => ({
    id: stop.id,
    stop_order: stop.stopOrder,
    source: stop.source,
    pin_id: stop.pinId,
    place_snapshot: stop.place,
    notes: stop.notes,
  }))
}

export async function getTripRow(
  supabase: ServiceSupabaseClient,
  userId: string,
  tripId: string,
): Promise<DbTripRow | null> {
  const { data, error } = await supabase
    .from('trips')
    .select(TRIP_SELECT)
    .eq('id', tripId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as DbTripRow | null) ?? null
}

export async function listTripRows(
  supabase: ServiceSupabaseClient,
  userId: string,
): Promise<DbTripRow[]> {
  const { data, error } = await supabase
    .from('trips')
    .select(TRIP_SELECT)
    .eq('user_id', userId)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data as DbTripRow[]) ?? []
}

export function mapTripRowToApiTrip(row: DbTripRow): ApiTrip {
  const destination = toTripPlaceSnapshot(row.destination_snapshot, 'trip destination snapshot')
  if (!destination) {
    throw new Error('Invalid trip destination snapshot')
  }

  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    status: row.status,
    origin: toTripPlaceSnapshot(row.origin_snapshot, 'trip origin snapshot'),
    destination,
    routeMode: row.route_mode,
    stopCount: row.stop_count,
    revision: row.revision,
    isPublic: row.is_public,
    shareToken: row.share_token,
    sourceTripId: row.source_trip_id,
    sourceShareToken: row.source_share_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stops: [...(row.trip_stops ?? [])]
      .sort((left, right) => left.stop_order - right.stop_order)
      .map((stop) => {
        const place = toTripPlaceSnapshot(stop.place_snapshot, 'trip stop snapshot')
        if (!place) {
          throw new Error('Invalid trip stop snapshot')
        }

        return {
          id: stop.id,
          stopOrder: stop.stop_order,
          stopKind: stop.stop_kind,
          source: stop.source,
          pinId: stop.pin_id,
          place,
          notes: stop.notes,
          createdAt: stop.created_at,
          updatedAt: stop.updated_at,
        }
      }),
  }
}
