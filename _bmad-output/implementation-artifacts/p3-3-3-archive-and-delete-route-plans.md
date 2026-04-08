# Story 3.3: Archive and Delete Route Plans

Status: done

## Story

As a **premium user**,
I want to archive trips I am done with and permanently delete unwanted drafts,
So that my route library stays useful instead of cluttered.

## Context

Epic 3 Stories 3.1 and 3.2 enhanced `MyRoutesScreen` with `TripListItem` cards (with `StatusBadge` + `SyncIndicator`), sort/filter controls, archived-trip toggle, and a Duplicate action. The trip list is rendered in `MyRoutesContent` using `TripListItem` cards, each with action buttons in the card footer.

This story adds **Archive**, **Unarchive**, and **Delete permanently** actions to trip cards. Archive is a non-destructive soft-delete that sets `trip.status` to `'archived'`. Unarchive restores an archived trip to `'draft'`. Permanent delete removes the trip and its stops from the database entirely. Both archive and delete must gracefully handle the case where the affected trip is the currently active trip open in the builder.

### What Already Works

- `TripListItem` renders trip cards with `StatusBadge` showing "Draft" or "Archived" and a footer action area
- `MyRoutesContent` has an `includeArchived` toggle that reveals archived trips in the list
- The `DELETE /api/trips/:id` endpoint exists — but it currently **soft-deletes** (sets `status = 'archived'`), it does NOT hard-delete
- The `PATCH /api/trips/:id` endpoint exists for full trip updates via `upsert_trip_with_stops` RPC
- `TripWriteBodySchema` already accepts an optional `status` field, but `parseTripWriteBody` drops it from the returned data
- `TripStatus = 'draft' | 'archived'` type already exists
- `trips.trip_stops` has `ON DELETE CASCADE` — deleting a trip row automatically removes its stops
- `closeBuilder()` in `MyRoutesContent` clears builder state, preview, and URL params
- There is **no** `deleteTrip()` function in the frontend `api.ts` — only `fetchTrips`, `fetchTrip`, `createTrip`, `updateTrip`
- The existing `useUpdateTripMutation` sends full `TripWritePayload` through the RPC — it is NOT suitable for status-only changes (the RPC would re-process all stops)

### What This Story Adds

- **Status-only PATCH short-circuit on the server:** When the PATCH body contains only `{ status }`, bypass the full `parseTripWriteBody` + RPC flow and do a lightweight `.update({ status })` directly
- **Hard-delete via DELETE:** Modify the existing DELETE handler to permanently remove the trip from the database instead of archiving it
- **Frontend API functions:** `updateTripStatus()` for archive/unarchive, `deleteTrip()` for permanent delete
- **New mutation hooks:** `useTripStatusMutation()` for archive/unarchive, `useDeleteTripMutation()` for permanent delete
- **Action buttons on trip cards:** Archive on draft cards, Unarchive + Delete permanently on archived cards
- **Delete confirmation dialog:** Modal confirming the destructive permanent delete action
- **Active trip safety:** When the currently active trip is archived or deleted, the builder state clears and the user returns to the library

### What This Story Must NOT Add

- Offline draft store or sync queue (Epic 4)
- Shared trip import flow (Epic 5)
- New database migrations — existing schema supports all needed operations
- Bulk archive/delete — single-trip actions only
- Archive/delete from within the RouteBuilderSheet — keep actions on the library card only

---

## Acceptance Criteria

### AC 1 — Archive sets trip status to 'archived' and removes it from default view

**Given** a premium user has completed or abandoned a trip
**When** they choose **Archive** from the trip card actions
**Then** the route is soft-deleted by setting trip status to `archived`
**And** it disappears from the default **My Routes** list without destroying the stored route data.

### AC 2 — Delete permanently removes trip and stops from the database

**Given** a premium user is viewing an archived trip
**When** they choose **Delete permanently** and confirm the destructive action
**Then** the trip and associated `trip_stops` rows are removed from normalized storage
**And** the library refreshes without requiring a full app reload.

### AC 3 — Archiving or deleting the active trip clears the builder safely

**Given** the user archives or deletes the currently active trip
**When** the mutation completes
**Then** the planner clears the active route state safely
**And** the app returns to a stable empty or next-selected route view rather than a broken builder state.

---

## Tasks / Subtasks

### Task 1 — Add status-only PATCH short-circuit to `api/trips/[id].ts` (AC: 1)

**Primary files:**
- `api/trips/[id].ts`

- [x] 1.1 At the top of the `PATCH` handler block (before calling `parseTripWriteBody`), detect whether the request body is a status-only update: check that `req.body` is an object with exactly one key (`status`)
- [x] 1.2 When a status-only body is detected, validate the `status` value using `z.enum(['draft', 'archived'])`. Return 400 if invalid.
- [x] 1.3 Verify the trip exists and belongs to the user by calling `getTripRow()`. Return 404 if not found.
- [x] 1.4 If the trip already has the requested status, return 200 with the current trip data (noop, idempotent).
- [x] 1.5 Perform a lightweight Supabase update:
  ```typescript
  const { error } = await supabase
    .from('trips')
    .update({
      status: validatedStatus,
      revision: existingTrip.revision + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsedTripId.tripId)
    .eq('user_id', user.id)
  ```
- [x] 1.6 Re-fetch the trip row via `getTripRow()` and return `200 { trip: mapTripRowToApiTrip(tripRow) }`.
- [x] 1.7 If the status-only body check fails (body has other keys besides `status`), fall through to existing `parseTripWriteBody` + RPC flow unchanged.

### Task 2 — Modify DELETE handler to hard-delete (AC: 2)

**Primary files:**
- `api/trips/[id].ts`

- [x] 2.1 Replace the existing soft-delete (archive) logic in the DELETE handler with an actual database delete:
  ```typescript
  const existingTrip = await getTripRow(supabase, user.id, parsedTripId.tripId)
  if (!existingTrip) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Trip not found', status: 404 })
  }

  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', parsedTripId.tripId)
    .eq('user_id', user.id)
  ```
- [x] 2.2 On success, return `200 { deleted: true }`. The `ON DELETE CASCADE` constraint on `trip_stops` ensures stops are automatically removed.
- [x] 2.3 On error, return 500 with `INTERNAL_ERROR`.
- [x] 2.4 Confirm: no frontend code currently calls the DELETE endpoint (verified — `api.ts` has no `deleteTrip` function and no other code references it), so changing its behavior is safe.

### Task 3 — Add `updateTripStatus()` and `deleteTrip()` to frontend `api.ts` (AC: 1, 2)

**Primary files:**
- `src/features/route-planning/api.ts`

- [x] 3.1 Add `updateTripStatus()` function:
  ```typescript
  export async function updateTripStatus(accessToken: string, tripId: string, status: 'draft' | 'archived') {
    const response = await fetch(`/api/trips/${encodeURIComponent(tripId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ status }),
    })

    const payload = await response.json().catch(() => ({} satisfies TripResponse)) as TripResponse

    if (!response.ok || !payload.trip) {
      throw new Error(payload.message ?? 'Unable to update this route status.')
    }

    return payload.trip
  }
  ```
- [x] 3.2 Add `deleteTrip()` function:
  ```typescript
  export async function deleteTrip(accessToken: string, tripId: string) {
    const response = await fetch(`/api/trips/${encodeURIComponent(tripId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { message?: string }
      throw new Error(payload.message ?? 'Unable to delete this route.')
    }
  }
  ```

### Task 4 — Create `useTripStatusMutation()` hook (AC: 1, 3)

**Primary files:**
- `src/features/route-planning/useTripStatusMutation.ts` (NEW FILE)

- [x] 4.1 Create the hook following the pattern of `useUpdateTripMutation`:
  ```typescript
  import { useMutation, useQueryClient } from '@tanstack/react-query'
  import { useAuth } from '@/contexts/AuthContext'
  import { updateTripStatus } from './api'
  import { tripQueryKey } from './useTripQuery'

  export function useTripStatusMutation() {
    const queryClient = useQueryClient()
    const { isAuthenticated, session } = useAuth()
    const accessToken = session?.access_token
    const userId = session?.user.id ?? null

    return useMutation({
      mutationFn: async ({ tripId, status }: { tripId: string; status: 'draft' | 'archived' }) => {
        if (!isAuthenticated || !accessToken) {
          throw new Error('Sign in again to update your route.')
        }
        return updateTripStatus(accessToken, tripId, status)
      },
      onSuccess: (updatedTrip) => {
        queryClient.setQueryData(tripQueryKey(userId, updatedTrip.id), updatedTrip)
        void queryClient.invalidateQueries({ queryKey: ['trips', userId] })
      },
    })
  }
  ```
- [x] 4.2 The `onSuccess` updates the single-trip cache and invalidates the trips list query. This causes:
  - Archive: trip disappears from default list (or updates in place if `includeArchived` is on)
  - Unarchive: trip reappears in default list with `'draft'` status

### Task 5 — Create `useDeleteTripMutation()` hook (AC: 2, 3)

**Primary files:**
- `src/features/route-planning/useDeleteTripMutation.ts` (NEW FILE)

- [x] 5.1 Create the hook:
  ```typescript
  import { useMutation, useQueryClient } from '@tanstack/react-query'
  import { useAuth } from '@/contexts/AuthContext'
  import { deleteTrip } from './api'
  import { tripQueryKey } from './useTripQuery'

  export function useDeleteTripMutation() {
    const queryClient = useQueryClient()
    const { isAuthenticated, session } = useAuth()
    const accessToken = session?.access_token
    const userId = session?.user.id ?? null

    return useMutation({
      mutationFn: async (tripId: string) => {
        if (!isAuthenticated || !accessToken) {
          throw new Error('Sign in again to delete your route.')
        }
        return deleteTrip(accessToken, tripId)
      },
      onSuccess: (_, tripId) => {
        queryClient.removeQueries({ queryKey: tripQueryKey(userId, tripId) })
        void queryClient.invalidateQueries({ queryKey: ['trips', userId] })
      },
    })
  }
  ```
- [x] 5.2 `onSuccess` removes the single-trip query from cache and invalidates the trips list. This ensures the deleted trip vanishes from the library immediately.

### Task 6 — Add Archive / Unarchive / Delete buttons to `TripListItem` (AC: 1, 2)

**Primary files:**
- `src/features/route-planning/MyRoutesScreen.tsx`

- [x] 6.1 Extend `TripListItem` props with new callbacks:
  ```typescript
  function TripListItem({
    trip,
    isSelected,
    onOpen,
    onArchive,
    onUnarchive,
    onDelete,
    isArchiving,
    isDeleting,
  }: {
    trip: Trip
    isSelected: boolean
    onOpen: (tripId: string) => void
    onArchive: (tripId: string) => void
    onUnarchive: (tripId: string) => void
    onDelete: (tripId: string) => void
    isArchiving: boolean
    isDeleting: boolean
  })
  ```
- [x] 6.2 In the `TripListItem` footer action area (lines 186-199), render action buttons conditionally based on trip status:
  - **Draft trips (`trip.status === 'draft'`):** Show "Archive" button alongside "Resume route"
  - **Archived trips (`trip.status === 'archived'`):** Show "Unarchive" and "Delete permanently" buttons alongside "Reopen route"
- [x] 6.3 Archive button:
  ```tsx
  {!isArchived && (
    <button
      type="button"
      data-testid="archive-trip-button"
      onClick={() => onArchive(trip.id)}
      disabled={isArchiving}
      className="min-h-[44px] rounded-full border border-border px-4 text-sm font-medium transition hover:border-amber-400 disabled:opacity-50"
    >
      {isArchiving ? 'Archiving…' : 'Archive'}
    </button>
  )}
  ```
- [x] 6.4 Unarchive button (on archived trips only):
  ```tsx
  {isArchived && (
    <button
      type="button"
      data-testid="unarchive-trip-button"
      onClick={() => onUnarchive(trip.id)}
      disabled={isArchiving}
      className="min-h-[44px] rounded-full border border-border px-4 text-sm font-medium transition hover:border-sky-400 disabled:opacity-50"
    >
      {isArchiving ? 'Restoring…' : 'Unarchive'}
    </button>
  )}
  ```
- [x] 6.5 Delete permanently button (on archived trips only):
  ```tsx
  {isArchived && (
    <button
      type="button"
      data-testid="delete-trip-button"
      onClick={() => onDelete(trip.id)}
      disabled={isDeleting}
      className="min-h-[44px] rounded-full border border-red-500/50 px-4 text-sm font-medium text-red-300 transition hover:border-red-400 hover:bg-red-500/10 disabled:opacity-50"
    >
      {isDeleting ? 'Deleting…' : 'Delete permanently'}
    </button>
  )}
  ```
- [x] 6.6 Archive does NOT require a confirmation dialog — it is non-destructive and reversible.
- [x] 6.7 Delete permanently calls `onDelete` which triggers the confirmation dialog in the parent (Task 7).

### Task 7 — Create delete confirmation dialog (AC: 2)

**Primary files:**
- `src/features/route-planning/MyRoutesScreen.tsx`

- [x] 7.1 Add `deletingTrip` state to `MyRoutesContent`: `const [deletingTrip, setDeletingTrip] = useState<Trip | null>(null)` — tracks which trip is pending delete confirmation.
- [x] 7.2 Create an inline `DeleteConfirmDialog` component (or extract to sibling file) rendered inside `MyRoutesContent`:
  ```tsx
  {deletingTrip && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      data-testid="delete-confirm-dialog"
    >
      <div className="mx-4 max-w-sm rounded-2xl border border-border bg-secondary p-6 space-y-4">
        <h2 className="text-lg font-semibold">Delete permanently?</h2>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{deletingTrip.title}</span> and all its stops
          will be permanently removed. This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            data-testid="delete-cancel-button"
            onClick={() => setDeletingTrip(null)}
            className="min-h-[44px] rounded-full border border-border px-4 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="delete-confirm-button"
            onClick={() => handleConfirmDelete(deletingTrip.id)}
            disabled={deleteTripMutation.isPending}
            className="min-h-[44px] rounded-full bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
          >
            {deleteTripMutation.isPending ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  )}
  ```
- [x] 7.3 Clicking backdrop or Cancel closes the dialog via `setDeletingTrip(null)`.
- [x] 7.4 Add `Escape` key handler to close the dialog for accessibility.

### Task 8 — Wire mutations and active trip handling in `MyRoutesContent` (AC: 1, 2, 3)

**Primary files:**
- `src/features/route-planning/MyRoutesScreen.tsx`

- [x] 8.1 Import and initialize the new mutation hooks in `MyRoutesContent`:
  ```typescript
  import { useTripStatusMutation } from './useTripStatusMutation'
  import { useDeleteTripMutation } from './useDeleteTripMutation'
  // ...
  const tripStatusMutation = useTripStatusMutation()
  const deleteTripMutation = useDeleteTripMutation()
  ```
- [x] 8.2 Add `archivingTripId` state to track which trip is being archived/unarchived:
  ```typescript
  const [archivingTripId, setArchivingTripId] = useState<string | null>(null)
  ```
- [x] 8.3 Create `handleArchiveTrip` function:
  ```typescript
  async function handleArchiveTrip(tripId: string) {
    setArchivingTripId(tripId)
    try {
      await tripStatusMutation.mutateAsync({ tripId, status: 'archived' })
      // If the archived trip is the currently active trip, close the builder
      if (tripId === requestedTripId) {
        closeBuilder()
      }
    } finally {
      setArchivingTripId(null)
    }
  }
  ```
- [x] 8.4 Create `handleUnarchiveTrip` function:
  ```typescript
  async function handleUnarchiveTrip(tripId: string) {
    setArchivingTripId(tripId)
    try {
      await tripStatusMutation.mutateAsync({ tripId, status: 'draft' })
    } finally {
      setArchivingTripId(null)
    }
  }
  ```
- [x] 8.5 Create `handleRequestDeleteTrip` function (opens confirmation dialog):
  ```typescript
  function handleRequestDeleteTrip(tripId: string) {
    const tripToDelete = trips.find((t) => t.id === tripId)
    if (tripToDelete) setDeletingTrip(tripToDelete)
  }
  ```
- [x] 8.6 Create `handleConfirmDelete` function:
  ```typescript
  async function handleConfirmDelete(tripId: string) {
    try {
      await deleteTripMutation.mutateAsync(tripId)
      // If the deleted trip is the currently active trip, close the builder
      if (tripId === requestedTripId) {
        closeBuilder()
      }
    } finally {
      setDeletingTrip(null)
    }
  }
  ```
- [x] 8.7 Pass callbacks and state to each `TripListItem` in the trips map:
  ```tsx
  {trips.map((trip) => (
    <TripListItem
      key={trip.id}
      trip={trip}
      isSelected={trip.id === activeTrip?.id}
      onOpen={openTrip}
      onArchive={handleArchiveTrip}
      onUnarchive={handleUnarchiveTrip}
      onDelete={handleRequestDeleteTrip}
      isArchiving={archivingTripId === trip.id}
      isDeleting={deletingTrip?.id === trip.id && deleteTripMutation.isPending}
    />
  ))}
  ```
- [x] 8.8 Verify that after `closeBuilder()`, `setActiveTripId(null)` is called via the existing `useEffect` that syncs `requestedTripId` → `setActiveTripId`. This ensures `uiStore.activeTripId` is cleared and no stale active trip remains.

### Task 9 — Add and extend test coverage (AC: 1, 2, 3)

**Primary files:**
- `src/features/route-planning/MyRoutesScreen.test.tsx`

- [x] 9.1 Add mock for `useTripStatusMutation`:
  ```typescript
  const mockUseTripStatusMutation = vi.fn()
  vi.mock('./useTripStatusMutation', () => ({
    useTripStatusMutation: () => mockUseTripStatusMutation(),
  }))
  ```
- [x] 9.2 Add mock for `useDeleteTripMutation`:
  ```typescript
  const mockUseDeleteTripMutation = vi.fn()
  vi.mock('./useDeleteTripMutation', () => ({
    useDeleteTripMutation: () => mockUseDeleteTripMutation(),
  }))
  ```
- [x] 9.3 Add test: Archive button appears on draft trip cards, NOT on archived trip cards
- [x] 9.4 Add test: Clicking Archive calls `tripStatusMutation.mutateAsync` with `{ tripId, status: 'archived' }`
- [x] 9.5 Add test: Archive button shows "Archiving…" text and is disabled while mutation is pending
- [x] 9.6 Add test: Unarchive button appears on archived trip cards (when `includeArchived` toggle is active), NOT on draft cards
- [x] 9.7 Add test: Clicking Unarchive calls `tripStatusMutation.mutateAsync` with `{ tripId, status: 'draft' }`
- [x] 9.8 Add test: Delete permanently button appears on archived trip cards only
- [x] 9.9 Add test: Clicking Delete permanently opens the confirmation dialog showing the trip title
- [x] 9.10 Add test: Clicking Cancel in the delete dialog closes it without calling the mutation
- [x] 9.11 Add test: Clicking "Delete permanently" in the dialog calls `deleteTripMutation.mutateAsync` with the trip ID
- [x] 9.12 Add test: Pressing Escape closes the delete confirmation dialog
- [x] 9.13 Add test: When archiving the currently active trip (trip open in builder), the builder closes (`tripId` param is removed from URL)
- [x] 9.14 Add test: When deleting the currently active trip, the builder closes

### Task 10 — Validate scope boundaries and project health (AC: 1, 2, 3)

- [x] 10.1 Run `npm run test`, `npm run lint`, `npm run build` after implementation
- [x] 10.2 Confirm this story does **not** add:
  - offline draft store or sync queue
  - new database migrations
  - bulk archive/delete operations
  - archive/delete actions inside RouteBuilderSheet
- [x] 10.3 Confirm the DELETE endpoint returns `{ deleted: true }` for successful hard deletes
- [x] 10.4 Confirm the PATCH status-only short-circuit does NOT trigger the `upsert_trip_with_stops` RPC
- [x] 10.5 Confirm `ON DELETE CASCADE` removes trip_stops when a trip is hard-deleted (verify via manual test or DB check)
- [x] 10.6 Confirm library list refreshes correctly after each mutation (archive hides from default view, unarchive restores to default view, delete removes permanently)

---

## Dev Notes

### Architecture Guardrails

1. **Status changes use a PATCH short-circuit — do NOT run the full RPC for status-only updates.**
   The `upsert_trip_with_stops` RPC replaces all trip stops. Sending a status-only PATCH through the normal flow would wipe stops (since `stops` defaults to `[]` when not provided). The short-circuit detects a status-only body, validates it, and does a lightweight `.update()` directly — bypassing the RPC entirely.

2. **DELETE now means hard delete — archive is done via PATCH.**
   The existing DELETE handler currently archives (soft-deletes). This story changes DELETE to actually remove the row from the database. Archive is handled by `PATCH { status: 'archived' }` through the status-only short-circuit. This is RESTfully correct: PATCH for updating state, DELETE for removing resources.

3. **No changes to `TripWritePayload`, `TripWriteInput`, or `parseTripWriteBody`.**
   The status-only PATCH uses its own inline validation (`z.enum`) and short-circuits before `parseTripWriteBody` is called. The existing full PATCH flow remains untouched. This keeps the scope tight and avoids ripple effects.

4. **New mutation hooks, not extensions of existing ones.**
   `useTripStatusMutation()` and `useDeleteTripMutation()` are separate from `useUpdateTripMutation()` and `useCreateTripMutation()`. Each hook has a single responsibility: status changes, permanent deletion, full updates, and creation respectively. Do NOT extend existing hooks.

5. **Active trip safety uses `closeBuilder()` — not manual state cleanup.**
   When the active trip is archived or deleted, call the existing `closeBuilder()` function which clears URL params, preview trip, and builder state in one shot. The existing `useEffect` that syncs `requestedTripId` → `setActiveTripId(null)` handles clearing the UI store automatically.

6. **Delete confirmation dialog is REQUIRED for permanent delete. Archive and Unarchive do NOT show confirmation.**
   Archive is non-destructive (reversible via Unarchive). Delete is destructive and irreversible. The dialog must show the trip title and require explicit confirmation.

7. **Delete permanently is only available on archived trips.**
   The "Delete permanently" button only appears on cards with `status === 'archived'`. This creates a two-step safety flow: users must first archive, then explicitly delete from the archive view. Draft trips cannot be directly deleted.

### Existing Code Signals

- `MyRoutesScreen.tsx` lines 153-201: `TripListItem` component — extend props with `onArchive`, `onUnarchive`, `onDelete`, `isArchiving`, `isDeleting`. Add action buttons in the footer area (lines 186-199).
- `MyRoutesScreen.tsx` lines 427-435: Trip list map — pass new handlers to each `TripListItem`.
- `MyRoutesScreen.tsx` lines 283-288: `closeBuilder()` function — reuse for clearing builder state when active trip is archived/deleted.
- `MyRoutesScreen.tsx` lines 254-256: `useEffect` syncing `requestedTripId` → `setActiveTripId` — ensures UI store clears automatically when `closeBuilder()` removes `tripId` param.
- `api/trips/[id].ts` lines 52-84: Existing PATCH handler — insert status-only short-circuit BEFORE line 53 (`parseTripWriteBody`).
- `api/trips/[id].ts` lines 87-123: Existing DELETE handler — replace soft-delete logic with actual `.delete()` call.
- `api/_trips.ts` line 41: `TripWriteBodySchema` already accepts `status` — but this doesn't matter for the short-circuit since it validates independently.
- `useUpdateTripMutation.ts` lines 26-31: Cache update pattern in `onSuccess` — replicate this pattern in the new hooks.
- `useCreateTripMutation.ts` lines 21-28: Trips list invalidation pattern — replicate for delete hook.
- `useTripsQuery.ts` lines 6-8: `tripsQueryKey` function — use for cache invalidation in new hooks.
- `useTripQuery.ts` lines 6-8: `tripQueryKey` function — use for single-trip cache operations.

### Scope Boundaries / Anti-Patterns

- Do **not** modify `TripWritePayload` or `TripWriteInput` types — status changes bypass the write payload entirely.
- Do **not** modify `parseTripWriteBody()` — the status-only PATCH short-circuits before it.
- Do **not** modify the `upsert_trip_with_stops` RPC or create new database migrations.
- Do **not** add archive/delete/unarchive actions inside `RouteBuilderSheet` — keep them on the library card.
- Do **not** add optimistic updates — use simple invalidation-based refreshing for correctness. Optimistic removal can be added later if needed.
- Do **not** add a "Delete permanently" button on draft trip cards — require archiving first for safety.

### Dependencies / Sequencing

- **Depends on (all done):**
  - `p3-1-1-normalized-trip-model-foundation` — trips + trip_stops schema, RPC, CASCADE
  - `p3-1-3-create-a-new-trip-plan` — `POST /api/trips`, `useCreateTripMutation`
  - `p3-3-1-my-routes-library-view` — `TripListItem` card, `StatusBadge`, archive filter toggle, `closeBuilder()`

- **Does NOT depend on:**
  - `p3-3-2-duplicate-a-trip-for-what-if-planning` — Duplicate button is independent; if both stories add buttons to `TripListItem`, they can coexist in the footer area. Order of implementation doesn't matter.

### Previous Story Intelligence

- `p3-3-1` confirmed that `TripListItem` is the card component with `StatusBadge` and `SyncIndicator`. The footer area currently has a single "Resume route"/"Reopen route" button — new action buttons fit alongside it.
- `p3-3-1` added the `includeArchived` toggle — this is essential for viewing archived trips so users can unarchive or delete them.
- `p3-3-1` confirmed that `closeBuilder()` properly resets all builder state including URL params, preview trip, and creation mode. Safe to reuse for active-trip-removed scenarios.
- `p3-3-2` spec introduced `onDuplicate` prop on `TripListItem` — this story adds `onArchive`, `onUnarchive`, `onDelete` following the same pattern. If p3-3-2 is implemented first, the dev should add the new props alongside `onDuplicate`.
- Known baseline repo noise remains outside this story:
  - `npm run lint` baseline failures in `api/_trips.ts`, `api/pins.test.ts`
  - `npm run test` baseline noise in `src/features/account/AuthProvider.test.tsx`

### Testing Expectations

1. `npm run test` — all existing tests pass + new tests for archive/unarchive/delete functionality
2. `npm run lint` — no new lint errors on changed files
3. `npm run build` — clean tsc + vite build
4. Focused test coverage in `MyRoutesScreen.test.tsx`:
   - Archive button rendering on draft cards only
   - Unarchive + Delete buttons rendering on archived cards only
   - Archive mutation triggered with correct status
   - Delete confirmation dialog opens, shows trip title, and can be dismissed
   - Delete mutation triggered after confirmation
   - Active trip builder closes when active trip is archived or deleted
   - Escape key dismisses delete dialog
5. No unit tests needed for server-side changes (existing Vitest setup doesn't test API handlers directly)
6. Verify: POST, PATCH (full), and GET endpoints remain unaffected by changes to PATCH (status-only) and DELETE

### Project Structure Notes

- All frontend changes stay within `src/features/route-planning/`
- Two new files: `useTripStatusMutation.ts`, `useDeleteTripMutation.ts`
- API changes are in `api/trips/[id].ts` only — no changes to `api/_trips.ts`, `api/trips.ts`
- No new database migrations
- No changes to `src/types/trip.ts`
- Path alias `@/` → `src/` used throughout

### References

- Source: `_bmad-output/planning-artifacts/epics-phase3.md#Story 3.3` — Epic acceptance criteria
- Source: `_bmad-output/planning-artifacts/architecture-phase3.md` — Trip data model, DELETE = soft-delete design intent, API surface
- Source: `_bmad-output/implementation-artifacts/p3-3-1-my-routes-library-view.md` — Previous story learnings, card component structure, closeBuilder pattern
- Source: `_bmad-output/implementation-artifacts/p3-3-2-duplicate-a-trip-for-what-if-planning.md` — Parallel story, TripListItem prop extension pattern
- Source: `src/features/route-planning/MyRoutesScreen.tsx` — TripListItem card, MyRoutesContent, closeBuilder, builder state management
- Source: `src/features/route-planning/useUpdateTripMutation.ts` — Mutation hook pattern with cache update
- Source: `src/features/route-planning/useCreateTripMutation.ts` — Mutation hook pattern with list invalidation
- Source: `src/features/route-planning/api.ts` — Fetch wrapper pattern (no existing deleteTrip function)
- Source: `api/trips/[id].ts` — GET/PATCH/DELETE handler, current DELETE archives instead of deleting
- Source: `api/_trips.ts` — TripWriteBodySchema (status already accepted), parseTripWriteBody, getTripRow
- Source: `src/types/trip.ts` — Trip, TripStatus = 'draft' | 'archived'
- Source: `src/store/uiStore.ts` — setActiveTripId, activeTripId
- Source: `supabase/migrations/028_create_normalized_trip_model.sql` — ON DELETE CASCADE on trip_stops

## Dev Agent Record

### Agent Model Used

Claude (Sonnet 4) — Amelia Dev Agent

### Debug Log References

- Fixed `setDeleteTripResult` mock in `api/trips/[id].test.ts` to use `.delete()` chain instead of `.update()` chain to match new hard-delete handler behavior
- Fixed test assertions where trip title appeared multiple times in DOM (card + dialog or card + restore banner) by using `getAllByText` or scoped assertions

### Completion Notes List

- Task 1: Status-only PATCH short-circuit added before `parseTripWriteBody` call. Uses `z.enum(['draft', 'archived'])` validation, idempotent 200 on same status, lightweight `.update()` bypassing RPC.
- Task 2: DELETE handler changed from soft-delete (archive) to hard-delete with `supabase.from('trips').delete()`. Returns `{ deleted: true }`. ON DELETE CASCADE handles trip_stops.
- Task 3: `updateTripStatus()` and `deleteTrip()` added to `src/features/route-planning/api.ts`.
- Task 4: `useTripStatusMutation` hook created — `setQueryData` for single trip, `invalidateQueries` for trips list.
- Task 5: `useDeleteTripMutation` hook created — `removeQueries` for single trip, `invalidateQueries` for trips list.
- Task 6: `TripListItem` extended with `onArchive`, `onUnarchive`, `onDelete`, `isArchiving`, `isDeleting` props. Archive on draft, Unarchive + Delete permanently on archived, Duplicate only on draft.
- Task 7: Delete confirmation dialog with backdrop, Cancel, and Delete permanently buttons. Escape key handler via `useEffect` on document.
- Task 8: `handleArchiveTrip`, `handleUnarchiveTrip`, `handleRequestDeleteTrip`, `handleConfirmDelete` wired in `MyRoutesContent`. Active trip safety via `closeBuilder()`.
- Task 9: 12 new tests in `MyRoutesScreen.test.tsx` — all passing. Updated existing DELETE test in `api/trips/[id].test.ts` for hard-delete behavior.
- Task 10: `npm run test` — 1219 tests pass (107 files). `npm run build` — clean. No new lint errors introduced.

### File List

- `api/trips/[id].ts` — Status-only PATCH short-circuit + hard-delete in DELETE handler
- `api/trips/[id].test.ts` — Updated DELETE test for hard-delete, updated mock helper
- `src/features/route-planning/api.ts` — Added `updateTripStatus()`, `deleteTrip()`
- `src/features/route-planning/useTripStatusMutation.ts` — NEW: mutation hook for archive/unarchive
- `src/features/route-planning/useDeleteTripMutation.ts` — NEW: mutation hook for permanent delete
- `src/features/route-planning/MyRoutesScreen.tsx` — Extended `TripListItem`, added delete dialog, wired mutations + active trip handling
- `src/features/route-planning/MyRoutesScreen.test.tsx` — 12 new tests for archive/unarchive/delete flows

