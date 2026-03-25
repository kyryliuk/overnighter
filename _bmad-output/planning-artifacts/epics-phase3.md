---
stepsCompleted: [1, 2, 3, 4]
workflow_completed: true
inputDocuments:
  - 'prd.md'
  - 'architecture-phase3.md'
  - 'epics-phase2.md'
  - 'phase-2-retro-2026-03-25.md'
---

# Overnighter Phase 3.0 - Epic Breakdown

## Overview

This document provides the Phase 3.0-only epic and story breakdown for Overnighter, decomposing the approved route corridor / multi-stop trip planning scope from the PRD, the implementation architecture in `architecture-phase3.md`, the existing Phase 2 planning format, and the Phase 2 retrospective into implementable stories.

Phase 3.0 deliberately extends the existing route planning baseline instead of replacing it wholesale. It reuses the current route planning screen patterns, trip sharing baseline, Zustand persistence, TanStack Query, Supabase sync, `AuthRequired`, `PremiumGate`, and offline queue architecture while normalizing the trip model for premium, authenticated, map-native multi-stop planning.

## Requirements Inventory

### Functional Requirements

FR-P3-01: An authenticated user can access a dedicated **My Routes** route-planning workspace from the existing map experience.
FR-P3-02: A signed-out user who attempts to access route planning is redirected through the existing `AuthRequired` flow and returned to their intended planner context after sign-in.
FR-P3-03: A signed-in free user who attempts to use route planning sees the existing `PremiumGate` upsell pattern instead of trip-planning CRUD functionality.
FR-P3-04: A premium user can create a route plan with title, notes, required destination snapshot, and optional origin snapshot.
FR-P3-05: A premium user can view their saved non-archived route plans and resume a selected trip with its route context restored.
FR-P3-06: A premium user can add, remove, and reorder intermediate stops using saved spots, existing map pins, and manually selected places already supported by the route planning baseline.
FR-P3-07: The planner renders numbered stop markers, a simple corridor/polyline overlay, and fit-to-route behavior for the active trip.
FR-P3-08: A premium user can hand off the active trip to Google Maps / native maps using the ordered stop sequence.
FR-P3-09: A premium user can duplicate, archive, and permanently delete route plans from **My Routes**.
FR-P3-10: The system stores Phase 3 route plans in a normalized `trips` + `trip_stops` model while preserving place snapshots required for offline editing and pin survivability.
FR-P3-11: Existing legacy `trip_plans` records are backfilled into the normalized model without losing route content or share-related metadata needed for future compatibility.
FR-P3-12: The existing `/plan-route` entry point redirects to the new planner and legacy local/cloud route data remains accessible during the cutover.
FR-P3-13: Existing public shared-trip pages remain readable, and importing a shared trip into the premium planner creates a private copy while preserving source attribution.
FR-P3-14: Route drafts remain editable offline through persisted local draft state.
FR-P3-15: Create, edit, reorder, duplicate, archive, and delete trip mutations queue locally when offline and sync automatically on reconnect with visible per-trip sync status.
FR-P3-16: The server rejects invalid trip payloads (missing destination, duplicate stop order, too many stops, ownership mismatch, or non-premium access) and returns canonical revision metadata for successful writes.

### Non-Functional Requirements

NFR-P3-P1: The `/trips` planner route must remain lazy-loaded, and the initial planner shell must appear within 200ms on a warmed client.
NFR-P3-P2: Route overlay and stop-order updates must avoid full map pin re-rendering through memoized overlay calculations.
NFR-P3-P3: Phase 3.0 must enforce a maximum of 12 total stops per trip, including destination, to bound UI and sync complexity.

NFR-P3-S1: All trip mutation payloads must be validated server-side with Zod; client guards alone are insufficient.
NFR-P3-S2: Every `/api/trips*` endpoint must enforce ownership and premium authorization server-side, supported by RLS on `trips` and `trip_stops`.
NFR-P3-S3: Any retained share hooks (for example `share_token` lineage fields) remain disabled by default and use cryptographically strong tokens when generated.

NFR-P3-R1: Offline trip mutations must be retained in a FIFO local queue and must never be silently lost.
NFR-P3-R2: Migration to the normalized model must be backward-compatible, with `trip_plans` kept available for rollback / dual-read during the transition.
NFR-P3-R3: Successful reconnect flushes must update local draft state with canonical `revision` and `updated_at` values from the server.

NFR-P3-A1: All planner actions, stop controls, and sync indicators must preserve 44x44 touch targets and WCAG AA-compliant contrast.
NFR-P3-A2: Reorder controls must support keyboard and screen-reader labeling, and sync status changes must announce through `aria-live="polite"`.
NFR-P3-A3: Route overlays, numbered stops, and sync states must not rely on color alone for meaning.

### Additional Requirements

**Architecture / data model requirements:**
- Introduce normalized `trips` and `trip_stops` tables with owner-scoped RLS, indexes on `user_id`, `updated_at`, and `(trip_id, stop_order)`, while preserving snapshot-based place data for durability across pin edits, archives, and offline replay.
- Add dedicated helpers in `src/lib/supabase/trips.ts` and corresponding `DbTrip` / `DbTripStop` types instead of continuing to grow legacy `tripPlans.ts` for all new Phase 3 writes.
- Keep database snake_case confined to Supabase helpers and map clean frontend models into the feature layer.

**Frontend / UX requirements:**
- Preserve the project UX rule: **map -> sheet -> action**. On mobile, the planner remains map-native with bottom-sheet interactions; desktop uses a split-view panel.
- Add `/trips` as the primary planner route and deep-link support via `?tripId=`; redirect `/plan-route` to `/trips` once dual-read is in place.
- Reuse the existing route planning baseline rather than replacing it wholesale: `RoutePlanningScreen`, `useTripPlansStore`, Google Maps handoff logic, and shared-trip flows should be extended or adapted where practical.
- Reuse existing project patterns exactly: `AuthRequired`, `PremiumGate`, Zustand `persist`, TanStack Query, `useOnlineStatus()`, and the local queue/event approach already used for offline check-ins.

**Compatibility / rollout requirements:**
- Treat `trip_plans` as legacy compatibility data during the transition; Phase 3.0 uses dual-read / single-write before final cleanup.
- Existing shared-trip pages remain readable; importing into the Phase 3.0 planner requires authenticated premium access and preserves `sourceTrip` lineage.
- Do not expand social route discovery, collaboration, or external routing-provider integration in Phase 3.0.

**Retrospective-driven guardrails from Phase 2:**
- Avoid client-only state assumptions: every state-mutating trip endpoint must have server-side validation and status guards.
- Reuse proven security patterns when rendering route links or user-supplied fields; do not rely on permissive URL validation alone.
- Keep stories incremental and avoid big upfront technical-only work; foundation changes should create only the tables, endpoints, and UI hooks needed by the story being delivered.
- Count new Vercel functions during implementation and watch query efficiency / N+1 patterns in route lists, stop counts, and migration helpers.

### FR Coverage Map

FR-P3-01: Epic 1 - Premium users can enter **My Routes** from the existing map experience.
FR-P3-02: Epic 1 - Signed-out users are routed through `AuthRequired` and returned to planner context.
FR-P3-03: Epic 1 - Free users see `PremiumGate` instead of planner CRUD.
FR-P3-04: Epic 1 - Premium users can create a route plan with required metadata and destination.
FR-P3-05: Epic 1 - Premium users can resume a saved trip from **My Routes**.
FR-P3-06: Epic 2 - Premium users can add, remove, and reorder intermediate stops.
FR-P3-07: Epic 2 - Active trips show numbered markers, corridor overlay, and fit-to-route behavior.
FR-P3-08: Epic 2 - Ordered trips can be handed off to Google Maps / native maps.
FR-P3-09: Epic 3 - Premium users can duplicate, archive, and delete route plans.
FR-P3-10: Epic 1 - New planner writes to normalized `trips` and `trip_stops`.
FR-P3-11: Epic 5 - Legacy `trip_plans` data is backfilled into normalized storage.
FR-P3-12: Epic 5 - `/plan-route` redirects to `/trips` and legacy data remains accessible through cutover.
FR-P3-13: Epic 5 - Shared-trip pages remain readable and import creates a private attributed copy.
FR-P3-14: Epic 4 - Route drafts remain editable offline.
FR-P3-15: Epic 4 - Trip mutations queue locally and sync automatically on reconnect with visible status.
FR-P3-16: Epic 1 - Server-side validation, premium enforcement, and canonical revision handling exist for trip writes.

## Epic List

### Epic 1: Premium Trip Workspace
Premium users can enter a dedicated **My Routes** workspace, create a new route plan, and resume a saved trip backed by the normalized Phase 3 trip model. Signed-out users follow the existing auth flow, and free users are upsold through the existing premium gate.
**FRs covered:** FR-P3-01, FR-P3-02, FR-P3-03, FR-P3-04, FR-P3-05, FR-P3-10, FR-P3-16

### Epic 2: Corridor Stop Builder
Premium users can build a true multi-stop route by adding saved spots and map pins as ordered stops, seeing the route directly on the map, and handing the ordered trip off to Google Maps.
**FRs covered:** FR-P3-06, FR-P3-07, FR-P3-08

### Epic 3: Route Library Management
Premium users can manage their growing trip library with route cards, duplicate trips for what-if planning, and archive or delete routes without losing clarity about what is active versus historical.
**FRs covered:** FR-P3-09

### Epic 4: Offline Drafting & Sync Resilience
Premium users can continue editing trips offline, see whether a route is local, pending, synced, or conflicted, and trust that queued trip changes will flush safely when connectivity returns.
**FRs covered:** FR-P3-14, FR-P3-15

### Epic 5: Legacy Migration & Sharing Compatibility
Existing route-planning users keep access to their prior route data and public shared links while the app migrates from the legacy `trip_plans` model to the new normalized planner and redirects `/plan-route` into the new experience.
**FRs covered:** FR-P3-11, FR-P3-12, FR-P3-13

---

## Epic 1: Premium Trip Workspace

Premium users can enter a dedicated **My Routes** workspace, create a new route plan, and resume a saved trip backed by the normalized Phase 3 trip model. Signed-out users follow the existing auth flow, and free users are upsold through the existing premium gate.

### Story 1.1: Normalized Trip Model Foundation

As a **developer**,  
I want the normalized Phase 3 trip schema, API helpers, and premium-protected endpoints in place,  
So that the planner can save route plans in a durable model without extending legacy snapshot storage forever.

**Acceptance Criteria:**

**Given** the current project already stores route plans in legacy `trip_plans.plan_snapshot` rows  
**When** Phase 3 Story 1.1 is implemented  
**Then** new `trips` and `trip_stops` tables exist with owner-scoped RLS and indexes on `user_id`, `updated_at`, and `(trip_id, stop_order)`  
**And** `src/lib/supabase/types.ts` includes `DbTrip` and `DbTripStop` types used by new helpers.

**Given** the new normalized model exists  
**When** the server trip layer is implemented  
**Then** `GET /api/trips`, `POST /api/trips`, `GET /api/trips/:id`, `PATCH /api/trips/:id`, and `DELETE /api/trips/:id` exist  
**And** every endpoint uses `requirePremiumAuth()` and owner validation before reading or mutating data.

**Given** a trip create or update request reaches the server  
**When** the payload is missing a destination, contains duplicate stop order values, exceeds 12 total stops, or belongs to another user  
**Then** the request is rejected with a validation or authorization error  
**And** no partial trip write is committed.

**Given** a valid trip write succeeds  
**When** the transaction completes  
**Then** the response returns canonical `revision`, `updated_at`, and normalized stop data  
**And** the client can use that response without guessing final server state.

### Story 1.2: Gated My Routes Entry Point

As a **traveler**,  
I want a clear **My Routes** entry point that follows existing auth and premium access patterns,  
So that route planning feels like a natural extension of the current map product.

**Acceptance Criteria:**

**Given** a user is browsing the existing map experience  
**When** they tap the new **My Routes** control or a route-planning CTA from a pin detail sheet  
**Then** the app navigates to `/trips` (or `/trips?tripId=...` when relevant)  
**And** the planner shell opens using the existing map-native sheet / panel pattern.

**Given** the user is signed out  
**When** they attempt to access `/trips`  
**Then** the route is wrapped with `AuthRequired` and redirects them through the existing account flow  
**And** after successful sign-in they are returned to the intended planner route.

**Given** the user is signed in but does not have premium access  
**When** `/trips` renders  
**Then** a `PremiumGate` upsell card is shown inline instead of trip CRUD content  
**And** the upsell uses the same pricing / checkout pattern already established in Phase 2.

**Given** the user is premium  
**When** `/trips` loads for the first time with no saved trips  
**Then** an empty-state planner view is shown with CTAs to create a route or start from the map  
**And** the route remains lazy-loaded without regressing the existing map startup experience.

### Story 1.3: Create a New Trip Plan

As a **premium user**,  
I want to create a route plan with title, notes, destination, and optional origin,  
So that I can start planning a corridor trip in Overnighter instead of external notes.

**Acceptance Criteria:**

**Given** a premium user opens **My Routes** with no active trip selected  
**When** they tap **Create route**  
**Then** a new trip draft opens in the route builder sheet  
**And** the form includes editable fields for title, notes, optional origin snapshot, and required destination snapshot.

**Given** the builder is open  
**When** the user selects a destination from existing place / pin search results already supported by the route planning baseline  
**Then** the destination is saved as a snapshot in the draft  
**And** the trip cannot be saved until a destination exists.

**Given** the user enters valid trip metadata  
**When** they save the new trip  
**Then** the planner creates a `trips` row plus a destination entry in `trip_stops` (or equivalent normalized destination representation)  
**And** the saved trip appears in **My Routes** without a full-page reload.

**Given** the user leaves title blank  
**When** the trip is first saved  
**Then** the system assigns a sensible default title such as destination name or "New Route"  
**And** the trip remains editable afterward.

### Story 1.4: Resume an Existing Trip

As a **premium user**,  
I want to reopen an existing trip and restore its planner state,  
So that I can continue working on a route over multiple sessions.

**Acceptance Criteria:**

**Given** a premium user already has one or more saved trips  
**When** they open **My Routes**  
**Then** the app lists their non-archived trips from normalized storage  
**And** selecting a trip loads it into the planner without losing current map context.

**Given** a trip is selected from the list  
**When** the planner restores the route  
**Then** title, notes, origin, destination, and ordered stop data populate the route builder sheet  
**And** the active trip id is reflected in the URL query string.

**Given** a user refreshes `/trips?tripId=:id`  
**When** the page reloads  
**Then** the same trip is reloaded from query + server data  
**And** the planner state is reconstructed without requiring the user to navigate from the list again.

---

## Epic 2: Corridor Stop Builder

Premium users can build a true multi-stop route by adding saved spots and map pins as ordered stops, seeing the route directly on the map, and handing the ordered trip off to Google Maps.

### Story 2.1: Add and Remove Route Stops

As a **premium user**,  
I want to add and remove stops from saved spots and map pins,  
So that I can shape a trip around the overnight, dump, water, and fuel points that matter to me.

**Acceptance Criteria:**

**Given** a premium user has an active trip open in the planner  
**When** they tap **Add to route** from a saved spot card, pin detail sheet, or route planner search result  
**Then** the selected place is appended to the trip as an intermediate stop  
**And** its snapshot is stored in the active draft and persisted through the normalized trip write.

**Given** the same stop is already present in the trip  
**When** the user attempts to add it again  
**Then** the planner blocks the duplicate or clearly prompts the user according to the chosen product rule  
**And** the server also rejects duplicate stop ordering / identifiers on save.

**Given** a trip already contains intermediate stops  
**When** the user removes one from the stop list  
**Then** the stop disappears from the builder and the overlay order recalculates immediately  
**And** the remaining stops keep a valid sequential order.

**Given** the trip has reached the 12-stop maximum  
**When** the user attempts to add another stop  
**Then** the planner blocks the action with an inline explanation  
**And** no invalid mutation is queued or sent.

### Story 2.2: Reorder Stops and Render Corridor Overlay

As a **premium user**,  
I want to reorder stops and see the route update on the map,  
So that I can evaluate trip flow visually without leaving the planning experience.

**Acceptance Criteria:**

**Given** an active trip contains at least two stops  
**When** the user moves a stop up or down in the ordered list  
**Then** the stop order updates immediately in the UI  
**And** the underlying trip draft and persisted stop order values stay in sync.

**Given** the ordered stop list changes  
**When** the map overlay re-renders  
**Then** `TripCorridorOverlay` (or equivalent) shows a simple polyline from origin to stops to destination  
**And** each stop marker is numbered according to its current order.

**Given** a trip is opened or reordered  
**When** the planner computes the route bounds  
**Then** the map fits the active route into view  
**And** the implementation memoizes overlay calculations so the full pin layer does not re-render on every stop change.

**Given** a keyboard or screen-reader user is interacting with the stop list  
**When** they focus the reorder controls  
**Then** each control exposes an accessible label such as "Move stop 2 up"  
**And** the interaction remains usable without pointer drag-and-drop.

### Story 2.3: Corridor Suggestions From Existing Route Logic

As a **premium user**,  
I want route suggestions based on the current route-planning baseline,  
So that the first Phase 3 release improves corridor planning without introducing an entirely new routing engine.

**Acceptance Criteria:**

**Given** a trip has an origin or current location plus destination  
**When** the planner requests suggestions  
**Then** it reuses the current route-suggestion scoring logic / helpers already present in the route planning feature  
**And** suggested candidate stops are surfaced in the builder as suggested additions rather than committed stops.

**Given** suggested corridor stops are available  
**When** the user reviews them  
**Then** each suggestion shows enough place context (name, stop type, distance / detour signal, and rig-fit context already available in the baseline)  
**And** the user can add any suggestion to the trip with a single action.

**Given** the planner is offline or cached pin data is insufficient  
**When** corridor suggestions cannot be computed reliably  
**Then** the UI degrades gracefully with a non-blocking message  
**And** manual stop editing remains fully available.

### Story 2.4: Ordered Google Maps Handoff

As a **premium user**,  
I want to send my ordered trip to Google Maps / native maps,  
So that Overnighter remains the planning tool while existing navigation apps handle the drive.

**Acceptance Criteria:**

**Given** an active trip has a destination and optional intermediate stops  
**When** the user taps **Open in Google Maps** (or equivalent handoff CTA)  
**Then** the app builds a directions URL using the active origin / current-location rule, ordered waypoints, and destination  
**And** the external maps app opens with the same order shown in Overnighter.

**Given** the trip contains more waypoints than the handoff URL can support safely  
**When** the user triggers navigation  
**Then** the planner handles the edge case explicitly (for example by truncating with a warning or blocking with guidance)  
**And** it does not silently generate a broken link.

**Given** the active trip is edited and saved  
**When** the user immediately re-triggers the handoff  
**Then** the newly generated directions URL reflects the latest stop order  
**And** no stale cached URL is reused.

---

## Epic 3: Route Library Management

Premium users can manage their growing trip library with route cards, duplicate trips for what-if planning, and archive or delete routes without losing clarity about what is active versus historical.

### Story 3.1: My Routes Library View

As a **premium user**,  
I want a useful route library view,  
So that I can quickly understand which trips are active, recent, and worth reopening.

**Acceptance Criteria:**

**Given** a premium user has multiple saved trips  
**When** they open **My Routes**  
**Then** the route list shows cards with title, destination, stop count, updated-at timestamp, and sync/status indicator  
**And** archived trips are excluded from the default view.

**Given** the user has many trips  
**When** they sort or filter the library  
**Then** they can order by most recently updated and distinguish draft vs. archived states  
**And** the implementation avoids N+1 fetch patterns for stop counts or status summaries.

**Given** a trip card is selected  
**When** the route library transitions into builder mode  
**Then** the active trip is highlighted in the list  
**And** the user can still return to the library without losing their current planner context.

### Story 3.2: Duplicate a Trip for What-If Planning

As a **premium user**,  
I want to duplicate an existing trip,  
So that I can explore alternate route ideas without overwriting my original plan.

**Acceptance Criteria:**

**Given** a premium user is viewing a trip card or active trip menu  
**When** they choose **Duplicate trip**  
**Then** the system creates a new trip with copied metadata and stop snapshots  
**And** the duplicated trip opens as a separate editable route.

**Given** the source trip originated from a shared trip import or already contains `sourceTrip` lineage  
**When** the duplicate is created  
**Then** the copied trip preserves the relevant attribution metadata needed for future compatibility  
**And** it does not accidentally inherit public visibility.

**Given** duplication succeeds  
**When** the new trip appears in **My Routes**  
**Then** it has a distinct title such as "{original} (copy)" until the user renames it  
**And** changes to the duplicate do not mutate the original trip.

### Story 3.3: Archive and Delete Route Plans

As a **premium user**,  
I want to archive trips I am done with and permanently delete unwanted drafts,  
So that my route library stays useful instead of cluttered.

**Acceptance Criteria:**

**Given** a premium user has completed or abandoned a trip  
**When** they choose **Archive** from the trip actions menu  
**Then** the route is soft-deleted by setting trip status to `archived`  
**And** it disappears from the default **My Routes** list without destroying the stored route data.

**Given** a premium user is viewing an archived trip  
**When** they choose **Delete permanently** and confirm the destructive action  
**Then** the trip and associated `trip_stops` rows are removed from normalized storage  
**And** the library refreshes without requiring a full app reload.

**Given** the user archives or deletes the currently active trip  
**When** the mutation completes  
**Then** the planner clears the active route state safely  
**And** the app returns to a stable empty or next-selected route view rather than a broken builder state.

---

## Epic 4: Offline Drafting & Sync Resilience

Premium users can continue editing trips offline, see whether a route is local, pending, synced, or conflicted, and trust that queued trip changes will flush safely when connectivity returns.

### Story 4.1: Local Draft Store and Pending Mutation Queue

As a **premium user**,  
I want route edits to save locally first,  
So that I do not lose trip work when connectivity drops or the app reloads.

**Acceptance Criteria:**

**Given** the planner feature is loaded  
**When** Story 4.1 is implemented  
**Then** a dedicated Zustand `tripDraftStore` exists with persisted drafts, active trip id, dirty state, pending sync count, and last-synced metadata  
**And** trip content no longer relies solely on the legacy `useTripPlansStore` for active editing.

**Given** the project already has an offline queue pattern for check-ins  
**When** trip mutation queueing is added  
**Then** a local `pendingTripMutations` queue reuses the same proven localStorage + event-dispatch + reconnect architecture  
**And** queue items are append-only until confirmed by the server.

**Given** a user edits title, notes, origin, destination, or stops  
**When** the draft updates locally  
**Then** the edit is preserved across refreshes and temporary disconnects  
**And** the user does not need to press a manual save button to avoid losing work.

### Story 4.2: Offline Editing and Sync Status UX

As a **premium user**,  
I want clear sync state feedback while editing routes offline or online,  
So that I understand whether my trip is only local, waiting to sync, or safely in the cloud.

**Acceptance Criteria:**

**Given** a route draft exists only locally or has unsent changes  
**When** the planner renders the trip card or builder header  
**Then** it shows a visible sync badge such as `Local draft`, `Sync pending`, `Synced`, or `Sync error`  
**And** the same state is available in **My Routes** and the active builder.

**Given** the device loses connectivity while the user is editing  
**When** they continue making route changes  
**Then** the planner remains editable  
**And** new mutations are queued locally instead of failing the interaction.

**Given** sync status changes while the user remains on the page  
**When** the badge updates  
**Then** the status change is announced through `aria-live="polite"`  
**And** the UI does not rely on color alone to communicate the state.

### Story 4.3: Reconnect Flush and Conflict Handling

As a **premium user**,  
I want queued edits to flush safely on reconnect and conflicts to be surfaced clearly,  
So that offline-first behavior stays trustworthy even across multiple devices.

**Acceptance Criteria:**

**Given** one or more trip mutations are queued locally  
**When** the app detects reconnect, regains visibility after the minimum interval, or the user manually refreshes **My Routes**  
**Then** queued mutations flush in FIFO order using the normalized trip APIs  
**And** successfully synced items are removed from the queue.

**Given** the server accepts a queued mutation  
**When** the response returns canonical `revision` and `updated_at` values  
**Then** the local draft store updates to match the server-confirmed metadata  
**And** the trip status changes from pending to synced.

**Given** both local and remote versions changed since the last sync  
**When** the planner detects a revision conflict  
**Then** the trip is marked as conflicted instead of silently overwriting data  
**And** the user can keep the local draft pending until they resolve or retry.

---

## Epic 5: Legacy Migration & Sharing Compatibility

Existing route-planning users keep access to their prior route data and public shared links while the app migrates from the legacy `trip_plans` model to the new normalized planner and redirects `/plan-route` into the new experience.

### Story 5.1: Backfill Legacy Trip Plans

As an **existing route-planning user**,  
I want my earlier trip plans preserved in the new planner,  
So that Phase 3.0 feels like an upgrade instead of a reset.

**Acceptance Criteria:**

**Given** the database already contains legacy `trip_plans.plan_snapshot` rows  
**When** the Phase 3 migration runs  
**Then** each eligible legacy trip is backfilled into `trips` and `trip_stops` with preserved place snapshots  
**And** the migration retains legacy share-related metadata needed for future compatibility.

**Given** the migration is running during the transition window  
**When** backfill completes  
**Then** `trip_plans` remains available as read-only compatibility storage for rollback / verification  
**And** the migration documents any scale assumptions and rollback path per the Phase 2 retro guardrail.

**Given** a legacy row contains malformed or incomplete route data  
**When** the backfill encounters it  
**Then** the migration skips or flags the record safely according to the chosen recovery rule  
**And** one bad legacy trip does not abort the entire migration batch.

### Story 5.2: Dual-Read Cutover and /plan-route Redirect

As a **returning user**,  
I want the old route entry points to keep working while the planner moves to the new model,  
So that I am not stranded by bookmarks, saved links, or partially migrated data.

**Acceptance Criteria:**

**Given** the new `/trips` planner is live  
**When** a user navigates to the old `/plan-route` path  
**Then** the app redirects them to `/trips`  
**And** the intended route context is preserved where possible.

**Given** a user has normalized trips available  
**When** **My Routes** loads  
**Then** the planner reads normalized `trips` first  
**And** all new route writes go only to the normalized model.

**Given** a user does not yet have normalized data but still has legacy route data  
**When** they open the planner during the cutover window  
**Then** the app can import or surface the legacy trip through the new planner experience  
**And** the user is not forced to manually recreate the route.

### Story 5.3: Shared Trip Compatibility and Premium Import

As a **traveler using shared links**,  
I want existing public shared-trip pages to remain useful and import cleanly into the new planner,  
So that current sharing behavior survives Phase 3.0 without expanding the scope into a social rebuild.

**Acceptance Criteria:**

**Given** a public shared trip link already exists at `/shared-trip/:shareToken`  
**When** any user opens that URL after Phase 3.0 ships  
**Then** the shared trip page continues to render read-only route content  
**And** existing comment / reaction behavior is not broken by the new planner cutover.

**Given** a signed-out or free user attempts to import a shared trip into the new planner  
**When** they tap the import CTA  
**Then** the flow routes through the existing auth + premium gating sequence  
**And** they only reach planner import after satisfying those requirements.

**Given** an authenticated premium user imports a shared trip  
**When** the import succeeds  
**Then** a private route copy is created in normalized storage with `sourceTrip` attribution preserved  
**And** the imported trip does not become public automatically.

---
