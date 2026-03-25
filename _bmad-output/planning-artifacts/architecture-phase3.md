# Overnighter Phase 3.0 Architecture — Route Corridor / Multi-Stop Trip Planning

## Purpose

Phase 3.0 is the first executable Phase 3 slice. It turns the current lightweight `/plan-route` draft flow into a premium, authenticated, map-native trip planning system centered on route corridor planning and repeatable multi-stop trips.

This document is intentionally implementation-oriented. It assumes the existing stack and project rules remain in place: Vite SPA, React Router, TanStack Query, Zustand `persist`, Supabase, Vercel serverless endpoints, `AuthRequired`, `PremiumGate`, and offline-first local queues.

## Scope

### In Scope

- Signed-in premium users can create, edit, duplicate, archive, and delete route plans
- A route plan has:
  - trip metadata (`title`, `notes`, status)
  - optional origin snapshot
  - destination snapshot
  - ordered intermediate stops
- Map-native corridor planning:
  - numbered stop markers
  - simple corridor overlay/polyline
  - fit-to-route behavior
  - add/remove/reorder stops from saved spots and corridor suggestions
- New **My Routes** entry point for resuming and managing trips
- Offline-safe local drafting with queued cloud sync on reconnect
- Backward-compatible migration from current `trip_plans` snapshot storage
- Future-compatible hooks for route sharing without expanding Phase 3.0 scope

### Non-Goals

- Turn-by-turn navigation inside Overnighter
- External routing/optimization provider integration
- Automatic stop optimization or ETA/day planning
- Collaborative editing, commenting, or social route discovery expansion
- Booking integrations, campground availability, or cost optimization
- Native mobile app-specific trip planning behavior

## Key User Workflows

### 1. Start a Trip From the Map

1. User opens map
2. User taps **My Routes** or a pin CTA such as **Plan route here**
3. App opens route builder sheet over the map
4. User chooses destination, then adds saved spots or suggested corridor stops
5. App previews ordered stops on the map and enables Google Maps handoff
6. Draft autosaves locally; synced copy updates when online

### 2. Resume an Existing Trip

1. User opens **My Routes**
2. User selects a synced trip
3. Map restores route overlay, stop order, and destination context
4. User edits notes/stops and re-hands off to Google Maps

### 3. Offline Edit + Reconnect

1. User loses connectivity after opening the app or from a downloaded area
2. Existing trip drafts remain editable from local persisted state
3. App marks trip as **Saved locally / sync pending**
4. On reconnect, queued mutations flush in order and UI updates to **Synced**

### 4. Premium Upsell Flow

1. Free or signed-out user taps **My Routes**
2. User sees existing `AuthRequired` and `PremiumGate` pattern
3. After sign-in and upgrade, user returns to intended route screen

## Data Model Proposal

### Canonical Server Model

### `trips`

Purpose: one row per owned route plan.

Suggested columns:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `title TEXT NOT NULL`
- `notes TEXT NOT NULL DEFAULT ''`
- `status TEXT NOT NULL DEFAULT 'draft'`  
  Allowed values for 3.0: `draft`, `archived`
- `origin_snapshot JSONB NULL`  
  Shape mirrors frontend `TripPlanPlace`
- `destination_snapshot JSONB NOT NULL`
- `route_mode TEXT NOT NULL DEFAULT 'corridor'`
- `stop_count INTEGER NOT NULL DEFAULT 0`
- `revision INTEGER NOT NULL DEFAULT 1`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Future hooks kept nullable now:

- `is_public BOOLEAN NOT NULL DEFAULT false`
- `share_token TEXT UNIQUE NULL`
- `source_trip_id UUID NULL`
- `source_share_token TEXT NULL`

Notes:

- Keep snapshots, not only foreign keys, because trip stops must survive pin edits, archives, or offline replay.
- `revision` supports simple optimistic concurrency and conflict detection.
- `route_mode` leaves room for later planner types without changing the table shape.

### `trip_stops`

Purpose: ordered stops within a trip.

Suggested columns:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE`
- `stop_order INTEGER NOT NULL`
- `stop_kind TEXT NOT NULL`  
  Allowed values for 3.0: `waypoint`, `destination`
- `source TEXT NOT NULL DEFAULT 'manual'`  
  Allowed values for 3.0: `manual`, `saved`, `suggested`, `imported`
- `pin_id TEXT NULL`
- `place_snapshot JSONB NOT NULL`
- `notes TEXT NOT NULL DEFAULT ''`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Constraints:

- unique `(trip_id, stop_order)`
- check `stop_order >= 0`

Notes:

- Destination may stay duplicated in `trips.destination_snapshot` for fast reads; `trip_stops` remains the ordered list used for rendering and future extensibility.
- In 3.0, no dates, dwell windows, or optimization metadata are required.

### Client-Side Draft Model

### `tripDraftStore` (Zustand + persist)

Purpose: fast local editing state decoupled from server fetches.

Suggested client fields:

- `activeTripId: string | null`
- `draftsById`
- `dirtyTripIds`
- `pendingSyncCount`
- `lastSyncedAt`
- `hydrated`

Rules:

- Draft state is always editable offline
- Query data hydrates the store when a trip is opened
- Debounced saves produce mutation payloads, not immediate full-page refetches

### `pendingTripMutations`

Use the existing local queue pattern from `pendingCheckins`:

- localStorage-backed
- append-only mutation queue
- connectivity-triggered flush via `useOnlineStatus()`
- one event name for UI refresh, e.g. `pending-trip-mutations-updated`

### Migration / Legacy Model

Current app already uses:

- `trip_plans` snapshot storage
- `useTripPlansStore`
- `/plan-route`
- `/shared-trip/:shareToken`

Phase 3.0 should treat `trip_plans` as legacy compatibility data and migrate to normalized `trips` + `trip_stops`.

## API Surface Proposal

Phase 3.0 should move route mutations behind premium-authenticated server endpoints. Reads may still use Supabase helpers behind TanStack Query, but state-changing operations should not trust the client alone.

### Server Endpoints

- `GET /api/trips`
  - list current user's non-archived trips
  - requires `requirePremiumAuth()`
- `POST /api/trips`
  - create trip with ordered stops
  - validates payload with Zod
- `GET /api/trips/:id`
  - fetch one owned trip
- `PATCH /api/trips/:id`
  - update metadata, destination, and ordered stops in one transaction
  - rejects invalid order indexes or duplicate stop ids
- `DELETE /api/trips/:id`
  - soft-delete by setting `status = 'archived'`
- `POST /api/trips/:id/duplicate`
  - clones trip for quick what-if planning

### Validation Rules

- owner must match authenticated user
- premium status required for every route mutation and route read
- max trip count per user: configurable, enforced server-side
- max stop count per trip: start with 12 total stops including destination
- no duplicate stop ids in a single trip unless explicitly allowed in the future
- destination must exist
- snapshots must include name + coordinates

### Query / Helper Layer

Add dedicated helpers rather than extending legacy `tripPlans.ts` indefinitely:

- `src/lib/supabase/trips.ts`
- `src/lib/supabase/types.ts` → add `DbTrip`, `DbTripStop`
- `src/features/route-planning/api.ts` for fetch wrappers

## Frontend Architecture Proposal

### Route Structure

- **Primary route:** `/trips`
- **Deep-link form:** `/trips?tripId=:id`
- **Legacy compatibility:** `/plan-route` redirects to `/trips`

Route protection:

- wrap `/trips` in `AuthRequired`
- render planner UI itself inside `PremiumGate`

This preserves the current project pattern: auth at route boundary, premium gating at feature boundary.

### Main Feature Modules

Keep the existing feature folder:

- `src/features/route-planning/`

Recommended additions:

- `MyRoutesScreen.tsx`
- `RouteBuilderSheet.tsx`
- `TripCorridorOverlay.tsx`
- `TripStopList.tsx`
- `tripDraftStore.ts`
- `useTripsQuery.ts`
- `useTripSync.ts`

### UI Composition

### My Routes Entry Point

Primary entry points:

- map-level **My Routes** button near existing floating controls
- pin detail CTA: **Add to route** / **Plan route here**
- shared trip import can deep-link into `/trips` later, but is not expanded in 3.0

### Mobile

- map remains the home screen
- route builder uses a bottom sheet, matching existing UX rules
- route list opens as a sheet first; selecting a trip transitions to builder state within the same overlay

### Tablet/Desktop

- follow existing UX breakpoint guidance
- tablet: centered sheet with more breathing room
- desktop: split view with map left and planner panel right

### Map Overlay Responsibilities

`TripCorridorOverlay` should render:

- polyline connecting origin → stops → destination
- numbered markers for ordered stops
- active trip bounds fitting
- optional highlighted candidate pins when builder is open

Rendering rule:

- use lightweight client polyline only
- do not integrate external routing geometry in 3.0
- final navigation still delegates to `buildDirectionsUrl()` and Google Maps handoff

### State Ownership

- URL owns selected trip id
- TanStack Query owns server data lifecycle
- Zustand draft store owns in-progress edits and pending sync state
- `uiStore` should only hold lightweight UI flags if needed; trip content should not live there

This keeps consistency with existing architecture guidance: router for navigation state, stores for local interaction state, query layer for cloud state.

## Auth / Premium Gating Rules

- Signed-out users:
  - can reach entry CTA
  - are redirected by `AuthRequired` to account flow
- Signed-in free users:
  - can open `/trips`
  - see `PremiumGate` upsell instead of planner content
- Signed-in premium or trialing users:
  - full trip CRUD
  - sync across devices
  - Google Maps handoff from saved trips

Server rule:

- every `/api/trips*` endpoint uses `requirePremiumAuth()`

Compatibility rule:

- existing public shared-trip pages may remain readable if retained, but import into Phase 3.0 planner should require auth + premium

## Offline Behavior and Sync Rules

### Offline Read

- Existing locally persisted trips remain visible and editable
- If cached pins exist, builder can still show saved stop cards and basic map overlay
- Corridor suggestions may be stale or unavailable when required pin data is not cached

### Offline Write

- create/edit/reorder/archive actions write immediately to local draft state
- mutations enqueue to `pendingTripMutations`
- UI shows per-trip sync badge: `Local draft`, `Sync pending`, `Synced`, `Sync error`

### Reconnect Behavior

- flush queue in FIFO order
- group multiple edits to the same trip into latest revision before send where safe
- server returns canonical `revision` and `updated_at`
- client resolves simple conflicts as:
  - if local draft is newer and unsynced, keep local and retry
  - if remote changed and local is clean, replace local
  - if both changed, mark conflict and keep local draft until user resolves

### Sync Triggers

- reconnect event
- tab visibility regain with minimum interval
- manual pull-to-refresh / refresh action in **My Routes**

## Accessibility, Performance, and Security Requirements

### Accessibility

- all interactive controls keep 44px minimum tap targets
- stop reorder controls must support keyboard and screen reader labels
- bottom sheet requires focus management and escape/backdrop dismissal
- route overlay actions must have non-color cues; numbered stops cannot rely on color alone
- sync status changes use `aria-live="polite"`

### Performance

- keep `/trips` lazy-loaded like current heavy routes
- reuse existing map instance when opening builder from map
- memoize route overlay points and avoid re-rendering all pins on every stop change
- initial planner shell should appear in under 200ms after route load on warmed client
- max 12 stops in 3.0 to bound map/UI complexity

### Security

- validate all mutation payloads server-side with Zod
- enforce ownership and premium access server-side
- rely on RLS plus endpoint validation, not UI guards alone
- do not trust client-provided stop order, share state, or revision fields
- if share hooks remain in schema, keep them disabled by default and generate cryptographically strong tokens

## Rollout and Migration Strategy

### Step 1 — Schema Introduction

- add `trips` and `trip_stops` migrations
- add indexes on `user_id`, `updated_at`, `(trip_id, stop_order)`
- add RLS for owner-only access

### Step 2 — Data Backfill

- migrate legacy `trip_plans.plan_snapshot` rows into normalized `trips` + `trip_stops`
- preserve `is_public`, `share_token`, and `sourceTrip` fields as future hooks where available
- keep `trip_plans` read-only during transition for rollback safety

### Step 3 — Dual Read, Single Write

- new UI reads normalized trips first
- if no normalized trip exists but legacy snapshot exists, run one-time import
- all new writes target only `trips` + `trip_stops`

### Step 4 — UI Cutover

- ship `/trips` and **My Routes**
- redirect `/plan-route` to `/trips`
- keep shared-trip compatibility path only if still needed by existing links

### Step 5 — Cleanup

- remove `useTripPlansStore` legacy sync responsibilities
- deprecate direct `trip_plans` CRUD helpers after stability window

## Risks and Deferred Decisions

### Risks

- route preview may feel imprecise if straight-line corridor overlay is mistaken for true road routing
- offline editing plus multi-device sync introduces conflict cases not present in current snapshot model
- migration complexity increases because current trip planning already has partial sharing/social data attached
- premium-only gating may reduce test coverage if free-user paths are not explicitly exercised

### Deferred Beyond Phase 3.0

- real routed geometry from a provider such as Google Directions, Mapbox, or OpenRouteService
- overnight/day sequencing with dates, durations, and arrival windows
- collaboration, comments, reactions, and route discovery as first-class planner features
- route-specific offline pin bundles or trip-pack downloads
- advanced route sharing ownership model (`source_trip_id` lineage, remix analytics, public gallery)
- partner integrations and booking-aware stop recommendations

## Recommended Implementation Notes

- Reuse `PremiumGate`, `AuthRequired`, `useOnlineStatus()`, and local queue patterns exactly; do not introduce a second gating or sync pattern.
- Keep DB snake_case confined to `src/lib/supabase/` helpers.
- Preserve the project UX rule: **map → sheet → action**. The planner should feel like a map feature, not a detached form page.
- Keep Google Maps handoff as the only navigation engine in 3.0; Overnighter is planning, not navigation.
