import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requirePremiumAuth } from './_auth'
import { createServiceClient } from './_supabase'
import {
  getTripRow,
  listTripRows,
  mapTripRowToApiTrip,
  parseTripWriteBody,
  serializeTripWaypointsForRpc,
} from './_trips'

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
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'GET or POST only', status: 405 })
  }

  const user = await requirePremiumAuth(req, res)
  if (!user) return

  const supabase = createServiceClient()

  if (req.method === 'GET') {
    try {
      const rows = await listTripRows(supabase, user.id)
      return res.status(200).json({ trips: rows.map(mapTripRowToApiTrip) })
    } catch (error) {
      console.error('[api/trips][GET]', error)
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
    }
  }

  const parsedBody = parseTripWriteBody(req.body)
  if (!parsedBody.success) {
    return res.status(400).json({ error: 'INVALID_BODY', message: parsedBody.message, status: 400 })
  }

  try {
    const { data, error } = await supabase.rpc('upsert_trip_with_stops', {
      p_user_id: user.id,
      p_trip_id: null,
      p_title: parsedBody.data.title,
      p_notes: parsedBody.data.notes,
      p_origin_snapshot: parsedBody.data.origin,
      p_destination_snapshot: parsedBody.data.destination,
      p_route_mode: parsedBody.data.routeMode,
      p_waypoints: serializeTripWaypointsForRpc(parsedBody.data),
    })

    if (error) {
      console.error('[api/trips][POST][rpc]', error)
      return respondToRpcError(res, error)
    }

    const tripId = typeof data === 'string' ? data : Array.isArray(data) ? data[0] : null
    if (!tripId) {
      console.error('[api/trips][POST] Missing trip id from RPC response', data)
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
    }

    const tripRow = await getTripRow(supabase, user.id, tripId)
    if (!tripRow) {
      console.error('[api/trips][POST] Unable to fetch canonical trip state', { tripId, userId: user.id })
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
    }

    return res.status(201).json({ trip: mapTripRowToApiTrip(tripRow) })
  } catch (error) {
    console.error('[api/trips][POST]', error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
