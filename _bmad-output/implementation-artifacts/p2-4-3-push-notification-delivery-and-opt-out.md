# Story 4.3: Push Notification Delivery & Global Opt-Out

Status: ready-for-dev

## Story

As a **subscribed user**,
I want to receive relevant spot notifications and be able to opt out,
So that push notifications remain valuable and not intrusive.

## Acceptance Criteria

**AC1 — Notification triggered on check-in badge state change**
Given a check-in is submitted that changes a spot's recency badge state
When the check-in write completes in `POST /api/checkin`
Then the endpoint queries `saved_spots` to find all users who saved that spot
And for each user with an active push subscription, `POST /api/push/send` is called internally (server-side) with the spot name and new status
And the notification payload includes: title = spot name, body = status message (e.g., "New check-in — still open"), url = `/pin/<pinId>`
And notification delivery failures do not affect the check-in response (fire-and-forget)

**AC2 — Notification content includes spot name and new status**
Given a push notification is triggered by a check-in
When the notification payload is constructed
Then the title is the spot name (e.g., "Flying J Ocala")
And the body includes the check-in status label (e.g., "New check-in — still open")
And the `data.url` is set to `/pin/<pinId>` so the SW click handler navigates to the spot detail

**AC3 — Clicking notification navigates to spot detail**
Given a push notification is received and the user taps it
When the SW `notificationclick` handler fires
Then the app opens or focuses the window at `/pin/<pinId>` (already implemented in Story 4.1)
And the same-origin URL validation in the existing SW handler applies

**AC4 — Global notification opt-out in account settings**
Given a signed-in user with active push subscriptions navigates to the Account screen
When they view the "Account actions" section
Then a "Disable notifications" button is visible
And tapping it calls the `unsubscribe()` function from `usePushSubscription` (browser `pushManager.unsubscribe()` + `DELETE /api/push/subscribe`)
And after unsubscribe, the button changes to "Notifications disabled" (visually confirmed)
And no further push notifications are delivered to that user

**AC5 — Unsubscribe from PinDetailSheet toggle (already wired)**
Given a signed-in user has notifications enabled (toggle is ON) in a pin detail sheet
When they toggle the `PushNotificationToggle` to off
Then `pushManager.unsubscribe()` is called and `DELETE /api/push/subscribe` removes all subscription records
And no further notifications are sent (already implemented in Story 4.2)

## Tasks / Subtasks

- [ ] Task 1: Add notification delivery logic to `api/checkin.ts` (AC: 1, 2)
  - [ ] 1.1 Modify `api/checkin.ts` — after the successful pin badge update (line 65), add a fire-and-forget notification dispatch block:
    - Read the old `badge_state` of the pin BEFORE the update to detect state change. Add a pre-update query:
      ```typescript
      // Before the pin update — fetch current state
      const { data: currentPin } = await supabase
        .from('pins')
        .select('badge_state, name')
        .eq('id', body.pinId)
        .single()
      ```
    - Move this query to BEFORE the update block (before line 55)
    - After the pin update succeeds, check if badge state actually changed:
      ```typescript
      const oldBadge = currentPin?.badge_state
      const newBadge = 'green' // check-in always sets to green
      ```
    - If `oldBadge !== newBadge` OR always on any check-in (since users opted in to "status changes"), trigger notifications
    - Call a new `notifySubscribers()` helper (Task 2) in a fire-and-forget pattern:
      ```typescript
      // Fire-and-forget — do not await, do not block response
      notifySubscribers(supabase, body.pinId, currentPin?.name ?? 'A spot', body.status).catch(
        (err) => console.error('[api/checkin] notification dispatch failed:', err)
      )
      ```
    - Return `200 { ok: true }` immediately — notification delivery must not delay the check-in response

  - [ ] 1.2 The pin name is needed for the notification title. The pre-update query in 1.1 fetches `name` from the `pins` table alongside `badge_state`.

- [ ] Task 2: Create `notifySubscribers` helper in `api/_pushNotify.ts` (AC: 1, 2)
  - [ ] 2.1 Create file `api/_pushNotify.ts` (underscore prefix = not a route, utility module):
    - Export async function:
      ```typescript
      import type { SupabaseClient } from '@supabase/supabase-js'

      const STATUS_LABELS: Record<string, string> = {
        still_open: 'still open',
        closed: 'reported closed',
        changed: 'conditions changed',
      }

      export async function notifySubscribers(
        supabase: SupabaseClient,
        pinId: string,
        pinName: string,
        checkInStatus: string,
      ): Promise<void>
      ```
    - Query `saved_spots` to find all users who saved this pin:
      ```typescript
      const { data: savedSpotRows, error: savedErr } = await supabase
        .from('saved_spots')
        .select('user_id')
        .eq('pin_id', pinId)
      if (savedErr || !savedSpotRows?.length) return
      ```
    - For each unique `user_id`, check if they have push subscriptions:
      ```typescript
      const userIds = [...new Set(savedSpotRows.map((r) => r.user_id))]
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('user_id')
        .in('user_id', userIds)
      if (!subscriptions?.length) return
      const subscribedUserIds = [...new Set(subscriptions.map((s) => s.user_id))]
      ```
    - For each subscribed user, call `POST /api/push/send` internally:
      ```typescript
      const sendUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}/api/push/send`
        : 'http://localhost:3000/api/push/send'
      const adminToken = process.env.PUSH_ADMIN_TOKEN
      if (!adminToken) {
        console.error('[_pushNotify] PUSH_ADMIN_TOKEN not configured')
        return
      }

      const statusLabel = STATUS_LABELS[checkInStatus] ?? checkInStatus
      const title = pinName
      const body = `New check-in — ${statusLabel}`
      const url = `/pin/${pinId}`

      await Promise.allSettled(
        subscribedUserIds.map((userId) =>
          fetch(sendUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ userId, title, body, url }),
          })
        )
      )
      ```
    - Use `Promise.allSettled` so one user's failure doesn't block others
    - Log errors but never throw — this is best-effort delivery

- [ ] Task 3: Add global notification opt-out button to `AccountScreen.tsx` (AC: 4)
  - [ ] 3.1 In `src/features/account/AccountScreen.tsx`:
    - Import `usePushSubscription` from `@/hooks/usePushSubscription`
    - Inside the component (after existing hooks), add:
      ```typescript
      const { isSubscribed, isLoading: isPushLoading, unsubscribe } = usePushSubscription()
      ```
    - In the "Account actions" section (the `<section>` rendered when `isAuthenticated` is true, around line 268), add a notification control row BEFORE the sign-out button:
      ```tsx
      {isSubscribed ? (
        <button
          type="button"
          onClick={async () => {
            try {
              await unsubscribe()
            } catch {
              setSubmitError('Failed to disable notifications')
            }
          }}
          disabled={isPushLoading}
          className="min-h-[44px] rounded-lg border border-border bg-background px-4 text-sm text-amber-300"
        >
          {isPushLoading ? 'Disabling...' : 'Disable notifications'}
        </button>
      ) : (
        <span className="min-h-[44px] rounded-lg border border-border bg-background px-4 text-sm text-muted-foreground flex items-center justify-center">
          Notifications disabled
        </span>
      )}
      ```
    - Place this button in the existing grid (`grid gap-3 sm:grid-cols-3`) alongside "Edit rig", "Saved spots", etc.
    - When `permissionState === 'unsupported'`, do not render the notification button at all

  - [ ] 3.2 The unsubscribe flow reuses the existing `usePushSubscription().unsubscribe()` which:
    - Calls `pushManager.unsubscribe()` on the browser subscription
    - Calls `DELETE /api/push/subscribe` to remove all server-side subscription rows
    - This is a global opt-out — all subscriptions for the user are removed

- [ ] Task 4: Write API tests for notification delivery in `api/checkin.ts` (AC: 1, 2)
  - [ ] 4.1 Update `api/checkin.test.ts`:
    - Add test: on successful check-in with badge state change, `notifySubscribers` is called with correct args
    - Add test: `notifySubscribers` failure does not cause check-in to fail (fire-and-forget)
    - Add test: check-in response returns before notification delivery completes
    - Mock `../_pushNotify` module:
      ```typescript
      const mockNotifySubscribers = vi.fn().mockResolvedValue(undefined)
      vi.mock('../_pushNotify', () => ({
        notifySubscribers: (...args: unknown[]) => mockNotifySubscribers(...args),
      }))
      ```

  - [ ] 4.2 Create `api/_pushNotify.test.ts`:
    - Mock `_supabase` module and `fetch` (global)
    - Test: no saved spots for pin → returns without calling fetch
    - Test: saved spots exist but no push subscriptions → returns without calling fetch
    - Test: saved spots with subscriptions → calls `fetch` with correct payload for each subscribed user
    - Test: notification payload has correct title (pin name), body (status label), url (`/pin/<pinId>`)
    - Test: `Promise.allSettled` handles partial failures gracefully
    - Test: missing `PUSH_ADMIN_TOKEN` env var → logs error and returns without calling fetch
    - Test: status labels map correctly: `still_open` → "still open", `closed` → "reported closed", `changed` → "conditions changed"

- [ ] Task 5: Write component tests for AccountScreen notification opt-out (AC: 4)
  - [ ] 5.1 Update `src/features/account/AccountScreen.test.tsx`:
    - Mock `usePushSubscription` from `@/hooks/usePushSubscription`
    - Test: when subscribed, "Disable notifications" button is visible
    - Test: clicking "Disable notifications" calls `unsubscribe()`
    - Test: after unsubscribe, "Notifications disabled" label is visible
    - Test: when not subscribed, "Notifications disabled" label is shown (not the button)
    - Test: when push is unsupported (`permissionState === 'unsupported'`), no notification UI is rendered
    - Test: button shows "Disabling..." while `isLoading` is true
    - Test: unsubscribe error shows error message

- [ ] Task 6: Final validation (all ACs)
  - [ ] 6.1 Run `npm run lint` — no new lint errors
  - [ ] 6.2 Run `npm run test` — all existing + new tests pass
  - [ ] 6.3 Run `npm run typecheck:api` — no type errors in API code
  - [ ] 6.4 Run `npm run build` — build succeeds

## Dev Notes

### Context Summary

This is the third and final story in Phase 2 Epic 4 (Push Notifications). It builds on:

- **Story 4.1 (done):** Established backend infrastructure — `GET /api/push/vapid-key`, `POST /api/push/subscribe`, `DELETE /api/push/subscribe`, `POST /api/push/send`, and SW push/notificationclick handlers.
- **Story 4.2 (ready-for-dev):** Created the client-side `PushNotificationToggle` component and `usePushSubscription` hook for per-spot opt-in/out in the pin detail sheet. The toggle calls `subscribe()` / `unsubscribe()` which manage browser push manager subscriptions and server-side `push_subscriptions` records.

This story adds two capabilities:
1. **Server-side notification delivery:** When a check-in is submitted, the `api/checkin.ts` endpoint triggers push notifications to all users who saved that spot and have active push subscriptions.
2. **Global opt-out:** A "Disable notifications" button in the Account screen provides a one-tap way to remove all push subscriptions.

### Current Repository Reality

**Check-in API (`api/checkin.ts`):**
- POST-only endpoint, no auth required (uses `deviceId`)
- Validates body with Zod: `{ pinId, deviceId, status, note?, timestamp }`
- Inserts into `check_ins` table, counts 30-day check-ins, updates `pins.badge_state` to `'green'`
- Currently returns `200 { ok: true }` immediately after pin update — **no notification logic yet**
- Status values: `'still_open'`, `'closed'`, `'changed'`

**Send endpoint (`api/push/send.ts`):**
- Accepts `{ userId, title, body, url? }` with Bearer `PUSH_ADMIN_TOKEN` auth
- Fetches all `push_subscriptions` for the `userId`, sends via `web-push.sendNotification()`
- Handles stale subscriptions (410/404 → delete)
- Uses timing-safe comparison (`crypto.timingSafeEqual`) for admin token validation
- Returns `{ sent, failed }` counts

**Subscribe/Unsubscribe endpoint (`api/push/subscribe.ts`):**
- POST: Upserts push subscription (JWT auth, `{ endpoint, p256dh, auth }`)
- DELETE: Removes **all** subscriptions for the authenticated user (JWT auth)
- DELETE is global — no per-spot granularity at the database level

**Push subscriptions table (`push_subscriptions`):**
```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (endpoint)
);
```
- **No `spot_id` column** — subscriptions are per-user/per-device, not per-spot
- Indexed by `user_id` for fast lookups

**Saved spots table (`saved_spots`):**
```sql
CREATE TABLE saved_spots (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_id UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  pin_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, pin_id)
);
```
- Used to determine which users care about a given spot
- Users who saved a spot AND have push subscriptions → notification recipients

**Pins table (`pins` — relevant columns):**
```sql
badge_state TEXT NOT NULL DEFAULT 'grey' CHECK (badge_state IN ('green', 'yellow', 'red', 'grey'))
name TEXT NOT NULL
last_check_in_at TIMESTAMPTZ
recent_check_in_count INTEGER NOT NULL DEFAULT 0
```

**Service worker (`src/sw.ts`):**
- Push handler (lines 59–68): parses `{ title, options }` payload, calls `showNotification()`
- Click handler (lines 70–88): validates same-origin URL, opens/focuses window at `data.url`
- **No changes needed to SW in this story** — the existing handlers support the notification payload format

**Client-side push hook (`src/hooks/usePushSubscription.ts`):**
- Returns `{ permissionState, isSubscribed, isLoading, subscribe, unsubscribe }`
- `unsubscribe()`: calls `pushManager.unsubscribe()` + `DELETE /api/push/subscribe`
- Used by `PushNotificationToggle` in pin detail — will also be used by AccountScreen

**Account screen (`src/features/account/AccountScreen.tsx`):**
- Shows sync status, rig profile, saved spots, trip drafts
- "Account actions" section has buttons: Edit rig, Saved spots, Suggest spot, Trip drafts, Sign out
- **No push notification controls yet** — this story adds a "Disable notifications" button

**Check-in client flow (`src/features/check-in/CheckInForm.tsx`):**
- Calls `useCheckInMutation()` which POSTs to `/api/checkin`
- Optimistic update sets `badgeState: 'green'` in the TanStack Query cache
- **No client-side notification trigger logic needed** — notifications are sent server-side

**Pin detail route:** `/pin/:id` → `PinDetailSheet` component (lazy-loaded)

**Test patterns:**
- API tests: `vi.mock('./_supabase', ...)`, `mockReq()`/`mockRes()` helpers, test auth/validation/success/error paths
- Component tests: `@testing-library/react`, `render`, `screen`, `fireEvent`, `vi.mock()` for hooks
- Existing tests: `api/checkin.test.ts`, `src/features/account/AccountScreen.test.ts`

### Architecture Guardrails

- **Push delivery is best-effort.** No product feature should depend on push delivery — it is an enhancement, not a primary interaction path. The check-in response MUST NOT be delayed by notification delivery. [Source: architecture-phase2.md line 48]
- **Push notification receipt MUST be handled only in `src/sw.ts` push event listener.** No changes to SW needed for this story — existing handlers suffice. [Source: architecture-phase2.md line 641]
- **`web-push` is Node-only.** The notification dispatch helper (`_pushNotify.ts`) runs server-side only. [Source: architecture-phase2.md line 962]
- **API error response format** — follow existing pattern: `{ error: "ERROR_CODE", message: "human-readable", status: <number> }`.
- **Vercel Hobby tier — 12 function limit.** The `_pushNotify.ts` file uses an underscore prefix so it is NOT deployed as a serverless function. It is imported by `checkin.ts` as a utility module. No new API routes are created.
- **`POST /api/push/send` uses Bearer `PUSH_ADMIN_TOKEN`**, not user JWT. The server-side `notifySubscribers` helper uses this token to call the send endpoint internally.

### Implementation Notes For The Dev Agent

- **Fire-and-forget pattern:** Call `notifySubscribers()` without `await` in the check-in handler. Use `.catch()` to log errors. The check-in response must return immediately regardless of notification delivery outcome.
- **`api/_pushNotify.ts` underscore prefix:** Vercel treats files starting with `_` as non-route modules. This file will be bundled with `checkin.ts` at deploy time but will NOT create a separate serverless function endpoint.
- **Internal HTTP call to `/api/push/send`:** The `notifySubscribers` helper calls the existing send endpoint via `fetch`. This reuses all existing logic (VAPID config, web-push, stale subscription cleanup) without duplicating it. Use `process.env.VERCEL_URL` for the base URL in production; fall back to `localhost:3000` for local dev.
- **Recipient determination:** Users who (a) have the pin in `saved_spots` AND (b) have rows in `push_subscriptions` are notification recipients. The `saved_spots` JOIN determines "interest"; the `push_subscriptions` check determines "reachability".
- **Notification content:** Title = pin name (e.g., "Flying J Ocala"). Body = "New check-in — still open" using the status label map. URL = `/pin/<pinId>` (relative path — the SW click handler resolves it against `self.location.origin`).
- **Status label mapping:** `still_open` → "still open", `closed` → "reported closed", `changed` → "conditions changed". Fallback to raw status string for unknown values.
- **Global opt-out in AccountScreen:** Reuse `usePushSubscription().unsubscribe()`. This calls browser `pushManager.unsubscribe()` + `DELETE /api/push/subscribe`, removing all server-side subscriptions. The existing DELETE handler already removes ALL rows for the user (not per-spot).
- **No new database migration needed.** The `push_subscriptions`, `saved_spots`, and `pins` tables already exist with the required schema.
- **No SW changes needed.** The existing push and notificationclick handlers in `src/sw.ts` already support the `{ title, options: { body, data: { url } } }` payload structure and same-origin URL validation.
- **`useCheckInMutation` is client-side only** — it calls `POST /api/checkin`. The notification delivery happens inside the API endpoint, not in the React hook.
- **Badge state change detection:** The check-in endpoint always sets `badge_state` to `'green'`. To detect a change, fetch the current `badge_state` BEFORE the update. If it was already `'green'`, you may still want to notify (a new check-in is still valuable information to subscribed users). Consider notifying on ALL check-ins where the spot has subscribers, not just on state transitions — the UX spec says "new check-in — still open" which implies notification on every check-in.
- **Error in AccountScreen:** Use the existing `setSubmitError()` state setter for unsubscribe errors — it already renders an error alert.

### Testing Requirements

- Minimum validation commands:
  - `npm run test` — all tests pass
  - `npm run typecheck:api` — no type errors in API code
  - `npm run lint` — no lint violations
  - `npm run build` — build succeeds
- **API tests (`api/checkin.test.ts`):**
  - Mock `../_pushNotify` module to verify `notifySubscribers` is called with `(supabase, pinId, pinName, status)`
  - Verify check-in still returns `200 { ok: true }` even when `notifySubscribers` throws
  - Verify the pre-update pin query fetches `badge_state` and `name`
- **Unit tests (`api/_pushNotify.test.ts`):**
  - Mock `fetch` globally and Supabase client
  - Test all branches: no saved spots, no subscriptions, successful dispatch, partial failures
  - Test notification payload structure: `{ userId, title, body, url }`
  - Test status label mapping for all 3 status values
  - Test missing `PUSH_ADMIN_TOKEN` early return
- **Component tests (`AccountScreen.test.tsx`):**
  - Mock `usePushSubscription` to control `isSubscribed` / `isLoading` / `unsubscribe`
  - Test button visibility and state transitions
  - Test error handling on unsubscribe failure
- Use existing mock patterns from `api/_auth.test.ts` and `api/checkin.test.ts`
