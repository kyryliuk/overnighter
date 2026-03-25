import { supabase } from '@/lib/supabase/client'
import type { DbTrip, DbTripStop } from '@/lib/supabase/types'
import type { Trip, TripPlaceSnapshot, TripStop } from '@/types/trip'

interface DbTripRow extends DbTrip {
  trip_stops?: DbTripStop[] | null
}

const TRIP_SELECT = `
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

function readTripPlaceSnapshot(
  snapshot: Record<string, unknown> | null,
  label: string,
): TripPlaceSnapshot | null {
  if (snapshot === null) return null

  const id = snapshot.id
  const name = snapshot.name
  const latitude = snapshot.latitude
  const longitude = snapshot.longitude

  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    typeof latitude !== 'number' ||
    typeof longitude !== 'number'
  ) {
    throw new Error(`Invalid ${label} snapshot`)
  }

  return { id, name, latitude, longitude }
}

export function dbTripStopToTripStop(dbTripStop: DbTripStop): TripStop {
  const place = readTripPlaceSnapshot(dbTripStop.place_snapshot, 'trip stop')
  if (!place) {
    throw new Error('Trip stop snapshot is required')
  }

  return {
    id: dbTripStop.id,
    stopOrder: dbTripStop.stop_order,
    stopKind: dbTripStop.stop_kind as TripStop['stopKind'],
    source: dbTripStop.source as TripStop['source'],
    pinId: dbTripStop.pin_id,
    place,
    notes: dbTripStop.notes,
    createdAt: dbTripStop.created_at,
    updatedAt: dbTripStop.updated_at,
  }
}

export function dbTripToTrip(dbTrip: DbTripRow): Trip {
  const destination = readTripPlaceSnapshot(dbTrip.destination_snapshot, 'trip destination')
  if (!destination) {
    throw new Error('Trip destination snapshot is required')
  }

  return {
    id: dbTrip.id,
    title: dbTrip.title,
    notes: dbTrip.notes,
    status: dbTrip.status as Trip['status'],
    origin: readTripPlaceSnapshot(dbTrip.origin_snapshot, 'trip origin'),
    destination,
    routeMode: dbTrip.route_mode as Trip['routeMode'],
    stopCount: dbTrip.stop_count,
    revision: dbTrip.revision,
    isPublic: dbTrip.is_public,
    shareToken: dbTrip.share_token,
    sourceTripId: dbTrip.source_trip_id,
    sourceShareToken: dbTrip.source_share_token,
    createdAt: dbTrip.created_at,
    updatedAt: dbTrip.updated_at,
    stops: [...(dbTrip.trip_stops ?? [])]
      .sort((left, right) => left.stop_order - right.stop_order)
      .map(dbTripStopToTripStop),
  }
}

export async function getTrips(userId: string): Promise<Trip[]> {
  const { data, error } = await supabase
    .from('trips')
    .select(TRIP_SELECT)
    .eq('user_id', userId)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch trips: ${error.message}`)
  }

  return (data as DbTripRow[]).map(dbTripToTrip)
}

export async function getTrip(userId: string, tripId: string): Promise<Trip | null> {
  const { data, error } = await supabase
    .from('trips')
    .select(TRIP_SELECT)
    .eq('id', tripId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch trip: ${error.message}`)
  }

  return data ? dbTripToTrip(data as DbTripRow) : null
}
