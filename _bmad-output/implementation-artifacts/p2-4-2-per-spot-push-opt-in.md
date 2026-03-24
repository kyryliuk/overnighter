# Story 4.2: Per-Spot Push Notification Opt-In

Status: ready-for-dev

## Story

As a **signed-in user**,
I want to opt in to push notifications for a specific saved spot from its detail view,
So that I am alerted when that spot's status changes.

## Acceptance Criteria

**AC1 — Toggle visibility in pin detail sheet**
Given a signed-in user opens a pin detail sheet for a saved spot
When they view the detail sheet
Then a `PushNotificationToggle` is visible with label "Notify me when status changes" and the toggle off
And if the user is not signed in OR the spot is not saved, the toggle is not rendered

**AC2 — Permission flow on first toggle-on**
Given the user taps the toggle to enable notifications
When the browser push permission has not been requested yet
Then a description is shown: "You'll get an alert when a new check-in changes this spot's status"
And the browser `Notification.requestPermission()` dialog appears only after the description is visible
And if the user allows, the browser `pushManager.subscribe()` is called with the VAPID public key from `GET /api/push/vapid-key`
And `POST /api/push/subscribe` is called with `{ endpoint, p256dh, auth }` from the push subscription
And a test confirmation push notification is sent via `POST /api/push/send`
And the toggle shows ON

**AC3 — Browser permission previously denied**
Given the browser push permission was previously denied (`Notification.permission === 'denied'`)
When the toggle is tapped
Then the toggle stays off
And shows the message: "Enable notifications in your browser settings"

**AC4 — Already-granted permission flow**
Given the browser push permission was previously granted (`Notification.permission === 'granted'`)
When the user taps the toggle to enable notifications
Then `pushManager.subscribe()` is called directly (no permission dialog)
And `POST /api/push/subscribe` is called with the subscription keys
And a test confirmation push notification is sent
And the toggle shows ON

**AC5 — Toggle off (unsubscribe)**
Given the user has notifications enabled (toggle is ON)
When the user taps the toggle to disable notifications
Then `pushManager.unsubscribe()` is called on the existing subscription
And `DELETE /api/push/subscribe` is called
And the toggle shows OFF

**AC6 — Loading and error states**
Given any push API call is in progress
When the user is waiting for the subscribe/unsubscribe operation
Then the toggle shows a loading state (disabled with spinner)
And if the API call fails, the toggle reverts to its previous state with an error toast

## Tasks / Subtasks

- [ ] Task 1: Create `usePushSubscription` hook (AC: 2, 3, 4, 5, 6)
  - [ ] 1.1 Create file `src/hooks/usePushSubscription.ts`:
    - Export a `usePushSubscription()` hook that returns:
      ```typescript
      interface UsePushSubscriptionReturn {
        /** Current permission state: 'default' | 'granted' | 'denied' | 'unsupported' */
        permissionState: NotificationPermission | 'unsupported'
        /** Whether a push subscription currently exists */
        isSubscribed: boolean
        /** Whether a subscribe/unsubscribe operation is in progress */
        isLoading: boolean
        /** Subscribe: request permission → pushManager.subscribe → POST /api/push/subscribe */
        subscribe: () => Promise<void>
        /** Unsubscribe: pushManager.unsubscribe → DELETE /api/push/subscribe */
        unsubscribe: () => Promise<void>
      }
      ```
    - On mount, check `'Notification' in window` — if not supported, set `permissionState` to `'unsupported'` and return early
    - On mount, read `Notification.permission` to initialize `permissionState`
    - On mount, check if an active push subscription exists via `navigator.serviceWorker.ready` → `registration.pushManager.getSubscription()`
    - Set `isSubscribed` to `true` if a subscription exists
  - [ ] 1.2 Implement `subscribe()` function:
    - Set `isLoading` to `true`
    - If `permissionState === 'denied'`, do nothing (caller handles UI)
    - If `permissionState === 'default'`, call `Notification.requestPermission()` and update `permissionState`
    - If permission result is `'denied'`, update state and return
    - Fetch VAPID key: `const res = await fetch('/api/push/vapid-key'); const { publicKey } = await res.json()`
    - Convert VAPID key to `Uint8Array` with a `urlBase64ToUint8Array()` helper
    - Get SW registration: `const registration = await navigator.serviceWorker.ready`
    - Subscribe: `const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyArray })`
    - Extract keys: `subscription.endpoint`, `btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!)))`, same for `auth`
    - Call `POST /api/push/subscribe` with `{ endpoint, p256dh, auth }` and the user's JWT from the auth session
    - Set `isSubscribed` to `true`
    - Set `isLoading` to `false`
    - On error: revert `isSubscribed`, set `isLoading` to `false`, throw for caller to handle
  - [ ] 1.3 Implement `unsubscribe()` function:
    - Set `isLoading` to `true`
    - Get current subscription: `registration.pushManager.getSubscription()`
    - If subscription exists, call `subscription.unsubscribe()`
    - Call `DELETE /api/push/subscribe` with the user's JWT
    - Set `isSubscribed` to `false`, `isLoading` to `false`
    - On error: revert state, set `isLoading` to `false`, throw
  - [ ] 1.4 Add `urlBase64ToUint8Array` utility:
    - Place in `src/lib/push.ts` as a named export
    - Standard implementation: base64 decode with URL-safe character replacement, convert to Uint8Array
    - This is a well-known utility for VAPID key conversion

- [ ] Task 2: Create `PushNotificationToggle` component (AC: 1, 2, 3, 4, 5, 6)
  - [ ] 2.1 Create file `src/features/push/PushNotificationToggle.tsx`:
    - Accept prop: `pinId: string` (for future per-spot granularity tracking)
    - Use `usePushSubscription()` hook for all push state and actions
    - Render a toggle row with:
      - Label: "Notify me when status changes"
      - A `<button>` styled as a toggle switch (using Tailwind — no shadcn/ui Switch since it's not installed)
      - `role="switch"` and `aria-checked={isSubscribed}` for accessibility
      - `aria-label="Notify me when this spot status changes"`
      - Minimum 44x44px touch target on the toggle
    - When `permissionState === 'denied'`:
      - Show descriptive text below: "Enable notifications in your browser settings"
      - Toggle is visually disabled
    - When `isLoading`:
      - Toggle is disabled, show a small loading indicator
    - When toggle is tapped:
      - If currently off → call `subscribe()`, catch errors → show toast
      - If currently on → call `unsubscribe()`, catch errors → show toast
    - When `permissionState === 'unsupported'`:
      - Do not render the component at all (return `null`)
  - [ ] 2.2 Show description before browser permission:
    - When `permissionState === 'default'` and the user taps the toggle:
      - First show the description text: "You'll get an alert when a new check-in changes this spot's status"
      - Then call `subscribe()` which triggers the browser permission dialog
      - The description is always visible after first interaction regardless of outcome

- [ ] Task 3: Send test confirmation notification on subscribe (AC: 2, 4)
  - [ ] 3.1 In `usePushSubscription.ts`, after successful `POST /api/push/subscribe`:
    - Send a test notification by calling `POST /api/push/send` with:
      ```typescript
      {
        userId: session.user.id,
        title: 'Notifications active',
        body: 'You\'ll be notified when this spot\'s status changes.',
        url: window.location.href
      }
      ```
    - Use the user's JWT session to get `userId` — accept `userId` as a parameter to the hook or read from auth context
    - The test notification call is fire-and-forget — do not block the subscribe flow on it
    - **Note:** `POST /api/push/send` requires Bearer auth with `PUSH_ADMIN_TOKEN`, not user JWT. Instead, send the test notification directly from the client using the service worker:
      ```typescript
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification('Notifications active', {
        body: "You'll be notified when this spot's status changes.",
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
      })
      ```
    - This avoids exposing the admin token to the client and confirms the SW notification pipeline works

- [ ] Task 4: Integrate `PushNotificationToggle` into `PinDetailSheet` (AC: 1)
  - [ ] 4.1 In `src/features/pin-detail/PinDetailSheet.tsx`:
    - Import `PushNotificationToggle` from `@/features/push/PushNotificationToggle`
    - Import `useAuth` from `@/contexts/AuthContext`
    - Add `const { isAuthenticated } = useAuth()` to the component
    - Render `<PushNotificationToggle pinId={pin.id} />` inside the pin detail content area
    - Placement: after the "Navigate" link and before the "Last verified" section — consistent with the UX spec placing it in the saved-spot detail area
    - Conditionally render only when:
      - `isAuthenticated` is `true`
      - `isSaved` is `true` (spot is saved by the user)
    - Wrap in: `{isAuthenticated && isSaved && <PushNotificationToggle pinId={pin.id} />}`

- [ ] Task 5: Create `src/lib/push.ts` utility module (AC: 2)
  - [ ] 5.1 Create file `src/lib/push.ts`:
    - Export `urlBase64ToUint8Array(base64String: string): Uint8Array`:
      ```typescript
      export function urlBase64ToUint8Array(base64String: string): Uint8Array {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
        const rawData = atob(base64)
        const outputArray = new Uint8Array(rawData.length)
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i)
        }
        return outputArray
      }
      ```
    - Export `arrayBufferToBase64(buffer: ArrayBuffer): string`:
      ```typescript
      export function arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        return btoa(binary)
      }
      ```

- [ ] Task 6: Write unit tests (AC: 1, 2, 3, 4, 5, 6)
  - [ ] 6.1 Create `src/lib/push.test.ts`:
    - Test `urlBase64ToUint8Array` produces correct Uint8Array from known VAPID key
    - Test `arrayBufferToBase64` round-trips correctly
  - [ ] 6.2 Create `src/hooks/usePushSubscription.test.ts`:
    - Mock `navigator.serviceWorker`, `Notification`, `fetch`
    - Test initial state when Notification API not supported → `permissionState === 'unsupported'`
    - Test initial state when permission is `'default'` → toggle off
    - Test initial state when existing subscription → `isSubscribed === true`
    - Test `subscribe()` calls `Notification.requestPermission()` when `'default'`
    - Test `subscribe()` calls `pushManager.subscribe()` with VAPID key
    - Test `subscribe()` calls `POST /api/push/subscribe` with correct body
    - Test `subscribe()` fires test notification via `registration.showNotification()`
    - Test `subscribe()` on permission denied → stays unsubscribed
    - Test `unsubscribe()` calls `subscription.unsubscribe()` and `DELETE /api/push/subscribe`
    - Test error handling: API failure reverts state
  - [ ] 6.3 Create `src/features/push/PushNotificationToggle.test.tsx`:
    - Mock `usePushSubscription` hook
    - Test renders toggle with correct label and `role="switch"`
    - Test toggle calls `subscribe()` when clicked while off
    - Test toggle calls `unsubscribe()` when clicked while on
    - Test shows "Enable notifications in your browser settings" when `permissionState === 'denied'`
    - Test returns `null` when `permissionState === 'unsupported'`
    - Test toggle is disabled during loading
    - Test `aria-checked` reflects subscription state
  - [ ] 6.4 Update `src/features/pin-detail/PinDetailSheet.test.tsx`:
    - Mock `@/contexts/AuthContext` to provide `isAuthenticated`
    - Test that `PushNotificationToggle` renders when `isAuthenticated && isSaved`
    - Test that `PushNotificationToggle` does NOT render when not authenticated
    - Test that `PushNotificationToggle` does NOT render when spot is not saved

- [ ] Task 7: Final validation (all ACs)
  - [ ] 7.1 Run `npm run lint` — no new lint errors
  - [ ] 7.2 Run `npm run test` — all existing + new tests pass
  - [ ] 7.3 Run `npm run build` — build succeeds
  - [ ] 7.4 Manual smoke test (if environment available):
    - Open a saved spot detail sheet while signed in → toggle visible
    - Tap toggle → permission dialog appears → allow → test notification received → toggle ON
    - Tap toggle again → unsubscribe → toggle OFF
    - Open unsaved spot → no toggle visible
    - Open saved spot while signed out → no toggle visible

## Dev Notes

### Context Summary

This is the second story in Phase 2 Epic 4 (Push Notifications). Story 4.1 (done) established the backend infrastructure: VAPID key endpoint, subscription management endpoints, notification send endpoint, and service worker push/click handlers. This story builds the client-side UI: a `PushNotificationToggle` component in the pin detail sheet and a `usePushSubscription` hook that manages the browser Push API permission flow and server-side subscription lifecycle.

Story 4.3 (Push Notification Delivery & Opt-Out) will build on this by adding notification delivery triggers when spot status changes, and a global opt-out in account settings.

### Current Repository Reality

**Infrastructure from Story 4.1 (all implemented and tested):**

| Resource | Location | Purpose |
|---|---|---|
| `GET /api/push/vapid-key` | `api/push/vapid-key.ts` | Returns `{ publicKey }` — no auth required |
| `POST /api/push/subscribe` | `api/push/subscribe.ts` | Upserts push subscription — JWT auth required |
| `DELETE /api/push/subscribe` | `api/push/subscribe.ts` | Deletes all user subscriptions — JWT auth required |
| `POST /api/push/send` | `api/push/send.ts` | Sends push to user — Bearer `PUSH_ADMIN_TOKEN` auth |
| SW push handler | `src/sw.ts` (lines 59–68) | `self.addEventListener('push', ...)` — shows notification |
| SW click handler | `src/sw.ts` (lines 70–82) | `self.addEventListener('notificationclick', ...)` — opens URL |

**Database — `push_subscriptions` table (exists via migration 022):**
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
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions (user_id, created_at DESC);
```

**Auth pattern — `useAuth()` hook:**
```typescript
// src/features/account/AuthContext.ts (re-exported from src/contexts/AuthContext.tsx)
import { useAuth } from '@/contexts/AuthContext'
const { session, isAuthenticated } = useAuth()
// session.user.id — current user ID
// session.access_token — JWT for API calls
```

**Saved spots — `useSpotsStore` (Zustand with persist):**
```typescript
// src/store/spotsStore.ts
const isSaved = useSpotsStore((state) => state.isSaved(pinId))
```

**Pin detail sheet — `src/features/pin-detail/PinDetailSheet.tsx`:**
- Currently imports: `useParams`, `useNavigate`, `usePinsQuery`, `useRigStore`, `useUIStore`, `useSpotsStore`, `useCheckInPromptStore`
- Renders: bookmark button, close button, pin name, category, recency badge, amenities, activities, description, navigate link, last verified date
- The `PushNotificationToggle` should be placed after the navigate link section and before the last verified section
- `isSaved` is already computed in the component: `const isSaved = useSpotsStore((state) => state.isSaved(id ?? ''))`

**SW-related hook pattern — `src/hooks/usePWAUpdate.ts`:**
```typescript
import { useRegisterSW } from 'virtual:pwa-register/react'
export function usePWAUpdate() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  // ...
}
```
- Uses `virtual:pwa-register/react` for SW registration — do NOT manually register SW
- The `usePushSubscription` hook accesses the SW via `navigator.serviceWorker.ready` (not registration from vite-plugin-pwa)

**State management patterns:**
- Transient UI state: Zustand without persist (`src/store/uiStore.ts`)
- Persistent data: Zustand with `persist` middleware (`src/store/spotsStore.ts`)
- The push subscription state in `usePushSubscription` is transient (re-derived from browser APIs on mount) — no Zustand store needed

**Feature directory convention:**
- Features are organized in `src/features/<feature-name>/`
- The `PushNotificationToggle` goes in `src/features/push/PushNotificationToggle.tsx`
- No `src/features/push/` directory exists yet — create it

**No shadcn/ui Switch component installed:**
- The project uses shadcn/ui but has not installed the Switch primitive
- Use a custom toggle button with `role="switch"` and `aria-checked` attributes
- Style with Tailwind to match existing UI patterns

**Existing test patterns:**
- Component tests use `@testing-library/react` with `render`, `screen`, `fireEvent`/`userEvent`
- Hook tests use `renderHook` from `@testing-library/react`
- Mocks use `vi.mock()` for modules, `vi.fn()` for functions
- Auth is mocked via `vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn(() => ({ isAuthenticated: true, session: { user: { id: 'user-1' }, access_token: 'token' } })) }))`

### Architecture Guardrails

- **Push notification receipt MUST be handled only in `src/sw.ts` push event listener.** Never intercept push events in React components. [Source: architecture-phase2.md line 641]
- **Push delivery is best-effort.** No product feature should depend on push delivery. The toggle is an enhancement, not a critical interaction. [Source: architecture-phase2.md line 48]
- **SW registration via vite-plugin-pwa only.** Never call `navigator.serviceWorker.register()` manually. Access the ready registration via `navigator.serviceWorker.ready`. [Source: architecture-phase2.md line 625]
- **`web-push` is Node-only.** Never import it in client code. All client-side push interactions go through the browser Push API (`pushManager.subscribe()`) and our API endpoints. [Source: architecture-phase2.md line 962]
- **VAPID public key from API.** Fetch from `GET /api/push/vapid-key` at runtime. Do not hardcode or read from `import.meta.env` on the client. [Source: architecture-phase2.md]
- **Test notification via SW, not via `/api/push/send`.** The send endpoint requires `PUSH_ADMIN_TOKEN` (server secret). Use `registration.showNotification()` directly for the client-side test confirmation. This confirms the SW notification pipeline works end-to-end.
- **Contextual permission ask.** Show description text BEFORE triggering `Notification.requestPermission()` to avoid cold deny risk. [Source: ux-design-phase2 line 372]
- **Vercel Hobby tier — 12 function limit.** This story adds no new API endpoints (all exist from 4.1).

### Implementation Notes For The Dev Agent

- **`usePushSubscription` is a standalone hook**, not a Zustand store. Push subscription state is derived from browser APIs on mount (`Notification.permission`, `pushManager.getSubscription()`). There is no need to persist this state — it can be re-derived each time the component mounts.
- **VAPID key conversion:** The `applicationServerKey` param of `pushManager.subscribe()` expects a `Uint8Array`. The VAPID public key from the API is a base64url-encoded string. Use the `urlBase64ToUint8Array()` helper to convert it.
- **Subscription key extraction:** `PushSubscription.getKey('p256dh')` and `.getKey('auth')` return `ArrayBuffer | null`. Convert to base64 strings with `arrayBufferToBase64()` for the API call.
- **JWT for subscribe/unsubscribe API calls:** Pass the user's access token from `useAuth().session.access_token` as a `Bearer` token in the `Authorization` header. This matches the `requireUserAuth` pattern in `api/_auth.ts`.
- **Test notification approach:** Use `registration.showNotification()` directly instead of `POST /api/push/send`. The send endpoint requires `PUSH_ADMIN_TOKEN` which is a server secret. Direct SW notification confirms the full pipeline (SW → notification display) without exposing secrets.
- **Error handling:** Wrap all async operations in try/catch. On error, revert the toggle state and show an error via `console.error`. The component can optionally show a toast — follow existing toast patterns if the project has a toast system, otherwise a `console.error` is sufficient.
- **Component placement in PinDetailSheet:** Insert after the existing navigate/directions section, before the "Last verified" text. The `isAuthenticated && isSaved` guard ensures it only shows for the target audience.
- **No new API endpoints or database changes** — this story is purely client-side, building on the infrastructure from Story 4.1.

### Testing Requirements

- Minimum validation commands:
  - `npm run test` — all tests pass
  - `npm run lint` — no lint violations
  - `npm run build` — build succeeds
- Mock browser APIs: `Notification`, `navigator.serviceWorker`, `PushManager`, `PushSubscription`
- Mock `fetch` for API calls (`/api/push/vapid-key`, `/api/push/subscribe`)
- Mock `useAuth` for authentication state
- Mock `useSpotsStore` for saved spot state
- Test all permission states: `'default'`, `'granted'`, `'denied'`, unsupported
- Test subscribe and unsubscribe flows end-to-end
- Test conditional rendering in PinDetailSheet (auth + saved gates)
- Test accessibility: `role="switch"`, `aria-checked`, `aria-label`
