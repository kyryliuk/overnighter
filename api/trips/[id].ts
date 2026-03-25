import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requirePremiumAuth } from '../_auth'
import { createServiceClient } from '../_supabase'
import {
  getTripRow,
  mapTripRowToApiTrip,
  parseTripIdParam,
  parseTripWriteBody,
  serializeTripWaypointsForRpc,
} from '../_trips'

function respondToRpcError(
  res: VercelResponse,
  error: { code?: string; message?: string },
) {
  if (error.code === 'P0002') {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Trip not found', status: 404 })
  }

  return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'PATCH' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'GET, PATCH, or DELETE only', status: 405 })
  }

  const user = await requirePremiumAuth(req, res)
  if (!user) return

  const parsedTripId = parseTripIdParam(req.query.id)
  if (!parsedTripId.success) {
    return res.status(400).json({ error: 'INVALID_PARAMS', message: parsedTripId.message, status: 400 })
  }

  const supabase = createServiceClient()

  if (req.method === 'GET') {
    try {
      const tripRow = await getTripRow(supabase, user.id, parsedTripId.tripId)
      if (!tripRow) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Trip not found', status: 404 })
      }

      return res.status(200).json({ trip: mapTripRowToApiTrip(tripRow) })
    } catch (error) {
      console.error('[api/trips/[id]][GET]', error)
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
    }
  }

  if (req.method === 'PATCH') {
    const parsedBody = parseTripWriteBody(req.body)
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'INVALID_BODY', message: parsedBody.message, status: 400 })
    }

    try {
      const { error } = await supabase.rpc('upsert_trip_with_stops', {
        p_user_id: user.id,
        p_trip_id: parsedTripId.tripId,
        p_title: parsedBody.data.title,
        p_notes: parsedBody.data.notes,
        p_origin_snapshot: parsedBody.data.origin,
        p_destination_snapshot: parsedBody.data.destination,
        p_route_mode: parsedBody.data.routeMode,
        p_waypoints: serializeTripWaypointsForRpc(parsedBody.data),
      })

      if (error) {
        console.error('[api/trips/[id]][PATCH][rpc]', error)
        return respondToRpcError(res, error)
      }

      const tripRow = await getTripRow(supabase, user.id, parsedTripId.tripId)
      if (!tripRow) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Trip not found', status: 404 })
      }

      return res.status(200).json({ trip: mapTripRowToApiTrip(tripRow) })
    } catch (error) {
      console.error('[api/trips/[id]][PATCH]', error)
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
    }
  }

  try {
    const existingTrip = await getTripRow(supabase, user.id, parsedTripId.tripId)
    if (!existingTrip) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Trip not found', status: 404 })
    }

    if (existingTrip.status === 'archived') {
      return res.status(200).json({ trip: mapTripRowToApiTrip(existingTrip) })
    }

    const { error } = await supabase
      .from('trips')
      .update({
        status: 'archived',
        revision: existingTrip.revision + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsedTripId.tripId)
      .eq('user_id', user.id)
      .eq('status', 'draft')

    if (error) {
      console.error('[api/trips/[id]][DELETE][update]', error)
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
    }

    const tripRow = await getTripRow(supabase, user.id, parsedTripId.tripId)
    if (!tripRow) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Trip not found', status: 404 })
    }

    return res.status(200).json({ trip: mapTripRowToApiTrip(tripRow) })
  } catch (error) {
    console.error('[api/trips/[id]][DELETE]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
