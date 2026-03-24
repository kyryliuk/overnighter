# Story 3.4: Offline Check-In Queue

Status: done

## Story

As a **user**,
I want my check-ins to be saved and submitted automatically when I regain signal,
So that I can contribute data even in areas with no cellular coverage.

## Acceptance Criteria

**AC1 — Check-in queued when offline**
Given a user submits a check-in while offline
When the check-in write would normally call the API
Then the check-in is appended to `localStorage['pendingCheckins']` array
And the UI shows a success confirmation as if the check-in was submitted

**AC2 — Queued check-ins flush on reconnect**
Given pending check-ins exist in localStorage
When the `window.online` event fires
Then each queued check-in is submitted via the check-in API in sequence
And successfully submitted items are removed from the queue
And if a submission fails after 3 retries, it remains in the queue for next reconnect

**AC3 — Pending check-ins flush on app init when online**
Given the user opens the app while online with pending check-ins
When the app initializes
Then any pending check-ins are flushed automatically without user action

## Tasks / Subtasks

- [ ] Task 1: Create pending check-in storage module (AC: 1, 2, 3)
  - [ ] 1.1 Create `src/lib/offline/pendingCheckins.ts` following the `pinsCache.ts` pattern:
    - `PENDING_CHECKINS_KEY = 'pendingCheckins'`
    - `PENDING_CHECKINS_UPDATED_EVENT = 'pending-checkins-updated'`
    - Interface `PendingCheckIn` with fields: `pinId: string`, `deviceId: string`, `status: CheckInStatus`, `note?: string`, `timestamp: string`, `queuedAt: string`
    - `readPendingCheckins(): PendingCheckIn[]` — reads and validates from localStorage, returns empty array on error
    - `appendPendingCheckin(checkin: PendingCheckIn): void` — appends to array, saves, dispatches custom event
    - `removePendingCheckin(queuedAt: string): void` — removes by queuedAt key, saves, dispatches event
    - `clearPendingCheckins(): void` — clears entire queue
    - Use `canUseStorage()` guard pattern from pinsCache for SSR safety

- [ ] Task 2: Create offline check-in queue flush hook (AC: 2, 3)
  - [ ] 2.1 Create `src/hooks/useOfflineCheckinQueue.ts`:
    - On mount: if online and pending check-ins exist, flush immediately (AC3)
    - Listen for `window.online` event: flush pending check-ins when reconnecting (AC2)
    - `flushQueue()`: iterate pending check-ins sequentially, POST each to `/api/checkin`, remove on success. On failure after 3 retries, leave in queue for next reconnect.
    - Use raw `fetch('/api/checkin', ...)` — not the TanStack mutation hook (avoid optimistic update side effects during flush)
    - Export `pendingCount: number` for UI indication if needed later

- [ ] Task 3: Modify CheckInForm to queue when offline (AC: 1)
  - [ ] 3.1 Update `src/features/check-in/CheckInForm.tsx`:
    - Remove the `if (!isOnline)` early return that shows error message
    - When offline: call `appendPendingCheckin()` instead of `mutation.mutate()`, then call `onClose()` to simulate success
    - Remove the disabled state on submit button for offline — allow submission
    - Keep the amber "Offline mode" note but change text to: "Offline — your check-in will be saved and submitted when you reconnect."

- [ ] Task 4: Integrate flush hook into App shell (AC: 3)
  - [ ] 4.1 Add `useOfflineCheckinQueue()` call in `src/App.tsx` alongside existing hooks
    - This ensures the flush runs on app init and on reconnect regardless of which screen is active

- [ ] Task 5: Add comprehensive tests (AC: 1, 2, 3)
  - [ ] 5.1 Create `src/lib/offline/pendingCheckins.test.ts`:
    - `readPendingCheckins` returns empty array when no data
    - `appendPendingCheckin` adds to localStorage and dispatches event
    - `removePendingCheckin` removes by queuedAt key
    - `clearPendingCheckins` empties the queue
    - Handles corrupt localStorage data gracefully
  - [ ] 5.2 Create `src/hooks/useOfflineCheckinQueue.test.ts`:
    - Flushes pending check-ins on mount when online
    - Flushes on `online` event
    - Removes successfully submitted check-ins from queue
    - Retains failed check-ins in queue after 3 retries
    - Does not flush when offline
  - [ ] 5.3 Update `src/features/check-in/CheckInForm.test.tsx` (if exists) or create:
    - Submitting offline queues the check-in and closes the form
    - Submitting online uses the mutation as before
  - [ ] 5.4 Run `npm run test`, `npm run typecheck:api`, and `npm run lint` — all must pass.

## Dev Notes

### Context Summary

- Sprint tracking shows `p2-3-4-offline-check-in-queue` as the final story in Phase 2 Epic 3 (Offline PWA).
- Stories 3.1 (PWA Manifest & SW), 3.2 (Offline Map Tile Cache), and 3.3 (Offline Status Banner) are complete.
- No new API endpoints needed — reuses existing `/api/checkin` endpoint.
- No service worker changes needed — the queue is entirely client-side (localStorage + online event).

### Current Repository Reality

**CheckInForm (`src/features/check-in/CheckInForm.tsx` — exists, needs modification):**
- Currently blocks submission when offline with `if (!isOnline)` guard and disabled button
- Uses `useCheckInMutation()` for online submissions with optimistic updates
- Uses `useOnlineStatus()` for connectivity detection
- Shows amber "Offline mode: check-ins require a connection." message

**useCheckInMutation (`src/hooks/useCheckInMutation.ts` — exists, no changes needed):**
```typescript
export interface CheckInPayload {
  pinId: string
  deviceId: string
  status: CheckInStatus // 'still_open' | 'closed' | 'changed'
  note?: string
}
// Uses TanStack Query mutation with optimistic pin badge update
// POST to /api/checkin with { ...payload, timestamp }
```

**Offline pinsCache pattern (`src/lib/offline/pinsCache.ts` — reference for localStorage pattern):**
- Uses `canUseStorage()` SSR guard
- Type-safe read/write with JSON parsing
- Custom event dispatch on writes (`PINS_CACHE_UPDATED_EVENT`)
- Graceful error handling on corrupt data

**useOnlineStatus (`src/hooks/useOnlineStatus.ts` — exists, used by CheckInForm):**
- SSR-safe `navigator.onLine` + `online`/`offline` event listeners
- Returns reactive `isOnline` boolean

**App.tsx — hook integration point:**
- Already imports `useDeviceId()` which runs on mount — same pattern for `useOfflineCheckinQueue()`
- OfflineStatusBanner and UpdateBanner already rendered at app root level

### Architecture Guardrails (Must Follow)

- **No new API endpoints.** Vercel Hobby 12-function limit. Reuse `/api/checkin`. [Source: architecture-phase2.md]
- **localStorage key:** `'pendingCheckins'` per architecture spec. [Source: architecture-phase2.md line 337]
- **Flush on `window.addEventListener('online')`** per architecture spec. [Source: architecture-phase2.md line 338]
- **TanStack Query `retry: 3` already configured** — but for flush, use raw fetch with manual retry since we don't want optimistic updates during background flush. [Source: architecture-phase2.md line 338]
- **Offline as proactive capability, not error state.** Frame queuing as a feature ("saved for later"), not degradation. [Source: ux-design-phase2-specification.md]

### Implementation Notes For The Dev Agent

- **PendingCheckIn interface** should mirror `CheckInPayload` but add `timestamp` (ISO string for the check-in time) and `queuedAt` (ISO string for when it was queued, used as unique key for removal).
- **Flush uses raw fetch, not mutation hook.** The mutation hook does optimistic cache updates which are inappropriate for background queue flush. Use `fetch('/api/checkin', { method: 'POST', ... })` directly.
- **Sequential flush, not parallel.** Process queue items one at a time to avoid overwhelming the API and to maintain ordering.
- **Retry logic in flush:** For each item, retry up to 3 times with a brief delay (e.g., 1 second). If all retries fail, leave the item in the queue.
- **CheckInForm change is minimal:** Replace the offline guard with queue append. The `timestamp` should be set at queue time (when user submits), not at flush time.
- **No visual queue indicator needed in this story.** The existing OfflineStatusBanner covers offline awareness. A pending count badge could be added in a future story.

### Testing Requirements

- Minimum validation commands:
  - `npm run test`
  - `npm run typecheck:api`
  - `npm run lint`
- Mock `fetch` for flush tests, `localStorage` for storage tests
- Use `@testing-library/react` + `vitest` per existing patterns
- Verify CheckInForm behavior change with both online and offline scenarios
