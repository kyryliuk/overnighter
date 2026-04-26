/**
 * scripts/backfill-legacy-trip-plans.ts
 *
 * One-time (idempotent) migration script that reads all `trip_plans` rows and
 * backfills them into the normalized `trips` + `trip_stops` tables introduced in
 * Story p3-1-1 (migration 028).
 *
 * Usage:
 *   npx tsx scripts/backfill-legacy-trip-plans.ts
 *
 * Prerequisites:
 *   - VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in the environment
 *     (or in a .env.local file loaded before invocation)
 *
 * Exit codes:
 *   0 — completed (some rows may have been skipped or errored; see summary)
 *   1 — fatal error before processing could begin
 *
 * Rollback:
 *   DELETE FROM trips WHERE legacy_plan_id IS NOT NULL;
 *   (trip_stops rows cascade via ON DELETE CASCADE; trip_plans rows are untouched)
 */

import { createServiceClient } from '../api/_supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LegacyPlace {
  id: string
  name: string
  latitude: number
  longitude: number
}

export interface LegacyTripPlanSnapshot {
  title?: string
  notes?: string
  destination?: unknown
  stops?: unknown[]
  isPublic?: boolean
  shareToken?: string | null
  sourceTrip?: { shareToken?: string; title?: string } | null
  createdAt?: string
  updatedAt?: string
}

export interface LegacyRow {
  user_id: string
  plan_id: string
  plan_snapshot: Record<string, unknown>
  is_public: boolean
  share_token: string | null
  updated_at: string
}

export interface NormalizedTrip {
  user_id: string
  title: string
  notes: string
  status: 'draft'
  origin_snapshot: null
  destination_snapshot: LegacyPlace
  route_mode: 'corridor'
  stop_count: number
  revision: 1
  is_public: boolean
  share_token: string | null
  source_trip_id: null
  source_share_token: string | null
  created_at: string
  updated_at: string
  legacy_plan_id: string
}

export interface NormalizedStop {
  stop_order: number
  stop_kind: 'waypoint' | 'destination'
  source: 'imported'
  pin_id: null
  place_snapshot: LegacyPlace
  notes: ''
  created_at: string
  updated_at: string
}

export interface TransformResult {
  trip: NormalizedTrip
  stops: NormalizedStop[]
}

// ─── Pure transformation ──────────────────────────────────────────────────────

function isValidPlace(value: unknown): value is LegacyPlace {
  if (!value || typeof value !== 'object') return false
  const p = value as Record<string, unknown>
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.latitude === 'number' &&
    typeof p.longitude === 'number'
  )
}

/**
 * Pure function: converts a legacy `trip_plans` row into a normalized trip row
 * plus its stop rows.
 *
 * Returns `null` when the row is malformed and should be skipped.
 */
export function transformLegacyPlan(row: LegacyRow): TransformResult | null {
  const snapshot = row.plan_snapshot as LegacyTripPlanSnapshot

  if (!isValidPlace(snapshot.destination)) return null

  const destination = snapshot.destination as LegacyPlace

  // null/undefined means "no waypoints" (valid); any other non-array is malformed
  if (snapshot.stops !== undefined && snapshot.stops !== null && !Array.isArray(snapshot.stops)) {
    return null
  }
  const rawStops = Array.isArray(snapshot.stops) ? snapshot.stops : []

  const validStops: LegacyPlace[] = []
  for (const s of rawStops) {
    if (isValidPlace(s)) {
      validStops.push(s)
    }
    // silently drop individual malformed waypoints to preserve the trip
  }

  const stopCount = validStops.length + 1
  const ts = row.updated_at

  const trip: NormalizedTrip = {
    user_id: row.user_id,
    title: typeof snapshot.title === 'string' && snapshot.title.trim() !== ''
      ? snapshot.title.trim()
      : 'Imported trip',
    notes: typeof snapshot.notes === 'string' ? snapshot.notes : '',
    status: 'draft',
    origin_snapshot: null,
    destination_snapshot: destination,
    route_mode: 'corridor',
    stop_count: stopCount,
    revision: 1,
    is_public: row.is_public,
    share_token: row.share_token,
    source_trip_id: null,
    source_share_token:
      snapshot.sourceTrip && typeof snapshot.sourceTrip.shareToken === 'string'
        ? snapshot.sourceTrip.shareToken
        : null,
    created_at: ts,
    updated_at: ts,
    legacy_plan_id: row.plan_id,
  }

  const stops: NormalizedStop[] = [
    ...validStops.map((place, i): NormalizedStop => ({
      stop_order: i,
      stop_kind: 'waypoint',
      source: 'imported',
      pin_id: null,
      place_snapshot: place,
      notes: '',
      created_at: ts,
      updated_at: ts,
    })),
    {
      stop_order: validStops.length,
      stop_kind: 'destination',
      source: 'imported',
      pin_id: null,
      place_snapshot: destination,
      notes: '',
      created_at: ts,
      updated_at: ts,
    },
  ]

  return { trip, stops }
}

// ─── Main runner ─────────────────────────────────────────────────────────────

const BATCH_SIZE = 100

async function main(): Promise<void> {
  const supabase = createServiceClient()

  let processed = 0
  let inserted = 0
  let skipped = 0
  let errors = 0
  let offset = 0

  console.log('🚀 Backfill: legacy trip_plans → normalized trips + trip_stops')
  console.log(`   Batch size : ${BATCH_SIZE}`)
  console.log('')

  for (;;) {
    const { data, error } = await supabase
      .from('trip_plans')
      .select('user_id, plan_id, plan_snapshot, is_public, share_token, updated_at')
      .range(offset, offset + BATCH_SIZE - 1)
      .order('updated_at', { ascending: true })
      .order('plan_id', { ascending: true })

    if (error) {
      console.error('❌ Fatal: failed to read trip_plans:', error.message)
      process.exit(1)
    }

    const rows = (data ?? []) as LegacyRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      processed++
      try {
        const result = transformLegacyPlan(row)
        if (!result) {
          console.warn(`[SKIP] plan_id=${row.plan_id} reason=malformed destination snapshot`)
          skipped++
          continue
        }

  // Idempotency + partial repair check
        const { data: existing } = await supabase
          .from('trips')
          .select('id, stop_count')
          .eq('user_id', row.user_id)
          .eq('legacy_plan_id', row.plan_id)
          .maybeSingle()

        if (existing) {
          // Verify the trip has the expected number of stop rows (guards partial backfill)
          const { count: stopCount } = await supabase
            .from('trip_stops')
            .select('id', { count: 'exact', head: true })
            .eq('trip_id', existing.id)

          if (stopCount === existing.stop_count) {
            console.log(`[SKIP] plan_id=${row.plan_id} reason=already backfilled`)
            skipped++
            continue
          }

          // Partial backfill detected — delete incomplete trip and re-insert
          console.warn(`[REPAIR] plan_id=${row.plan_id} trip_id=${existing.id} has ${stopCount ?? 0}/${existing.stop_count} stops — deleting and re-inserting`)
          await supabase.from('trips').delete().eq('id', existing.id)
          // trip_stops rows cascade via ON DELETE CASCADE
        }

        // Insert trip row
        const { data: tripData, error: tripError } = await supabase
          .from('trips')
          .insert(result.trip)
          .select('id')
          .single()

        if (tripError || !tripData) {
          // Could be a race-condition duplicate insert (unique constraint)
          if (tripError?.code === '23505') {
            console.log(`[SKIP] plan_id=${row.plan_id} reason=idempotency constraint (concurrent run)`)
            skipped++
          } else {
            console.error(`[ERROR] plan_id=${row.plan_id} trips insert: ${tripError?.message ?? 'no data'}`)
            errors++
          }
          continue
        }

        // Insert stop rows
        if (result.stops.length > 0) {
          const stopsWithTripId = result.stops.map(stop => ({
            ...stop,
            trip_id: tripData.id,
          }))

          const { error: stopsError } = await supabase
            .from('trip_stops')
            .insert(stopsWithTripId)

          if (stopsError) {
            console.error(`[ERROR] plan_id=${row.plan_id} trip_stops insert: ${stopsError.message}`)
            // Trip row is inserted but stops failed — count as error; trip_stops
            // can be repaired by running the script again (trip already exists so
            // idempotency check would block re-insert of the trip row, but stops
            // failed so the plan_id row won't match). Log for operator follow-up.
            errors++
            continue
          }
        }

        inserted++
        console.log(`[OK]   plan_id=${row.plan_id} → trip_id=${tripData.id} (${result.stops.length} stops)`)
      } catch (err) {
        console.error(`[ERROR] plan_id=${row.plan_id} unexpected: ${String(err)}`)
        errors++
      }
    }

    offset += BATCH_SIZE
    if (rows.length < BATCH_SIZE) break
  }

  console.log('')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`   Processed : ${processed}`)
  console.log(`   Inserted  : ${inserted}`)
  console.log(`   Skipped   : ${skipped}`)
  console.log(`   Errors    : ${errors}`)
  console.log('═══════════════════════════════════════════════════════════')
  console.log('')
  console.log('📋 Rollback command (if needed):')
  console.log('   DELETE FROM trips WHERE legacy_plan_id IS NOT NULL;')
  console.log('   (trip_stops cascade; trip_plans rows untouched)')
  console.log('')

  if (errors > 0) {
    console.warn(`⚠️  ${errors} row(s) failed — review [ERROR] lines above.`)
  } else {
    console.log('✅ Backfill complete.')
  }
}

// ─── CLI entry guard ─────────────────────────────────────────────────────────

const _argv1 = process.argv[1] ?? ''
const _isDirectInvocation =
  _argv1.endsWith('backfill-legacy-trip-plans.ts') ||
  _argv1.endsWith('backfill-legacy-trip-plans.js')

if (_isDirectInvocation) {
  main().catch(err => {
    console.error('Script failed with unexpected error:', err)
    process.exit(1)
  })
}
