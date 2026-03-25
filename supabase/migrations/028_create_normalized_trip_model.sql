-- Migration 028: Create normalized Phase 3 trip model foundation
-- Story p3-1-1 — Normalized Trip Model Foundation

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'archived')),
  origin_snapshot JSONB,
  destination_snapshot JSONB NOT NULL,
  route_mode TEXT NOT NULL DEFAULT 'corridor' CHECK (route_mode IN ('corridor')),
  stop_count INTEGER NOT NULL DEFAULT 1 CHECK (stop_count >= 1 AND stop_count <= 12),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  is_public BOOLEAN NOT NULL DEFAULT false,
  share_token TEXT UNIQUE,
  source_trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  source_share_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS trip_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL CHECK (stop_order >= 0),
  stop_kind TEXT NOT NULL CHECK (stop_kind IN ('waypoint', 'destination')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'saved', 'suggested', 'imported')),
  pin_id TEXT,
  place_snapshot JSONB NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT trip_stops_trip_id_stop_order_key UNIQUE (trip_id, stop_order)
);

CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips (user_id);
CREATE INDEX IF NOT EXISTS idx_trips_updated_at ON trips (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_stops_trip_id_stop_order ON trip_stops (trip_id, stop_order);

CREATE OR REPLACE FUNCTION set_trip_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_trips_updated_at ON trips;
CREATE TRIGGER trg_set_trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW
  EXECUTE FUNCTION set_trip_updated_at();

DROP TRIGGER IF EXISTS trg_set_trip_stops_updated_at ON trip_stops;
CREATE TRIGGER trg_set_trip_stops_updated_at
  BEFORE UPDATE ON trip_stops
  FOR EACH ROW
  EXECUTE FUNCTION set_trip_updated_at();

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_stops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their trips" ON trips;
CREATE POLICY "Users can read their trips"
  ON trips
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their trips" ON trips;
DROP POLICY IF EXISTS "Users can update their trips" ON trips;
DROP POLICY IF EXISTS "Users can delete their trips" ON trips;

DROP POLICY IF EXISTS "Users can read their trip stops" ON trip_stops;
CREATE POLICY "Users can read their trip stops"
  ON trip_stops
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM trips
      WHERE trips.id = trip_stops.trip_id
        AND trips.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their trip stops" ON trip_stops;
DROP POLICY IF EXISTS "Users can update their trip stops" ON trip_stops;
DROP POLICY IF EXISTS "Users can delete their trip stops" ON trip_stops;

CREATE OR REPLACE FUNCTION upsert_trip_with_stops(
  p_user_id UUID,
  p_trip_id UUID DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT '',
  p_origin_snapshot JSONB DEFAULT NULL,
  p_destination_snapshot JSONB DEFAULT NULL,
  p_route_mode TEXT DEFAULT 'corridor',
  p_waypoints JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip_id UUID;
  v_trip_owner UUID;
  v_trip_revision INTEGER;
  v_now TIMESTAMPTZ := timezone('utc', now());
  v_waypoint JSONB;
  v_waypoint_count INTEGER := COALESCE(jsonb_array_length(p_waypoints), 0);
BEGIN
  IF p_destination_snapshot IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23502', MESSAGE = 'Destination snapshot is required';
  END IF;

  IF p_route_mode IS DISTINCT FROM 'corridor' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid route mode';
  END IF;

  IF p_waypoints IS NULL OR jsonb_typeof(p_waypoints) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Waypoints must be a JSON array';
  END IF;

  IF v_waypoint_count + 1 > 12 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Trip exceeds maximum stop count';
  END IF;

  IF p_trip_id IS NULL THEN
    INSERT INTO trips (
      user_id,
      title,
      notes,
      status,
      origin_snapshot,
      destination_snapshot,
      route_mode,
      stop_count,
      revision,
      created_at,
      updated_at
    )
    VALUES (
      p_user_id,
      COALESCE(NULLIF(trim(p_title), ''), 'New Route'),
      COALESCE(p_notes, ''),
      'draft',
      p_origin_snapshot,
      p_destination_snapshot,
      p_route_mode,
      v_waypoint_count + 1,
      1,
      v_now,
      v_now
    )
    RETURNING id INTO v_trip_id;
  ELSE
    SELECT user_id, revision
    INTO v_trip_owner, v_trip_revision
    FROM trips
    WHERE id = p_trip_id
    FOR UPDATE;

    IF NOT FOUND OR v_trip_owner IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Trip not found';
    END IF;

    FOR v_waypoint IN SELECT value FROM jsonb_array_elements(p_waypoints)
    LOOP
      IF NULLIF(v_waypoint->>'id', '') IS NOT NULL THEN
        PERFORM 1
        FROM trip_stops
        WHERE id = (v_waypoint->>'id')::uuid
          AND trip_id = p_trip_id
          AND stop_kind = 'waypoint';

        IF NOT FOUND THEN
          RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Trip not found';
        END IF;
      END IF;
    END LOOP;

    UPDATE trips
    SET title = COALESCE(NULLIF(trim(p_title), ''), title),
        notes = COALESCE(p_notes, ''),
        origin_snapshot = p_origin_snapshot,
        destination_snapshot = p_destination_snapshot,
        route_mode = p_route_mode,
        stop_count = v_waypoint_count + 1,
        revision = v_trip_revision + 1,
        updated_at = v_now
    WHERE id = p_trip_id;

    v_trip_id := p_trip_id;

    DELETE FROM trip_stops WHERE trip_id = v_trip_id;
  END IF;

  FOR v_waypoint IN
    SELECT value
    FROM jsonb_array_elements(p_waypoints)
    ORDER BY (value->>'stop_order')::integer
  LOOP
    INSERT INTO trip_stops (
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
    VALUES (
      COALESCE(NULLIF(v_waypoint->>'id', '')::uuid, gen_random_uuid()),
      v_trip_id,
      (v_waypoint->>'stop_order')::integer,
      'waypoint',
      COALESCE(NULLIF(v_waypoint->>'source', ''), 'manual'),
      NULLIF(v_waypoint->>'pin_id', ''),
      v_waypoint->'place_snapshot',
      COALESCE(v_waypoint->>'notes', ''),
      v_now,
      v_now
    );
  END LOOP;

  INSERT INTO trip_stops (
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
  VALUES (
    v_trip_id,
    v_waypoint_count,
    'destination',
    'manual',
    NULL,
    p_destination_snapshot,
    '',
    v_now,
    v_now
  );

  RETURN v_trip_id;
END;
$$;

REVOKE ALL ON FUNCTION upsert_trip_with_stops(UUID, UUID, TEXT, TEXT, JSONB, JSONB, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION upsert_trip_with_stops(UUID, UUID, TEXT, TEXT, JSONB, JSONB, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION upsert_trip_with_stops(UUID, UUID, TEXT, TEXT, JSONB, JSONB, TEXT, JSONB) TO service_role;
