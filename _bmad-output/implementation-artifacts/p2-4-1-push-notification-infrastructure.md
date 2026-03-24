# Story 4.1: Push Notification Infrastructure

Status: done

## Story

As a **developer**,
I want the push notification backend infrastructure in place,
So that authenticated users can subscribe and the system can send targeted notifications.

## Acceptance Criteria

**AC1 — VAPID key endpoint**
Given VAPID keys are generated and stored as environment variables (`VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`)
When a client sends `GET /api/push/vapid-key`
Then the response is `200 { publicKey: "<VITE_VAPID_PUBLIC_KEY>" }`
And no authentication is required (public endpoint)
And a missing `VITE_VAPID_PUBLIC_KEY` env var returns `500 { error: "CONFIGURATION_ERROR" }`

**AC2 — Subscribe endpoint**
Given an authenticated user with a valid JWT
When the client sends `POST /api/push/subscribe` with body `{ endpoint, p256dh, auth }`
Then a row is inserted into `push_subscriptions` with the user's `user_id`, `endpoint`, `p256dh`, and `auth`
And if the endpoint already exists, it is upserted (updated with new keys + user_id)
And the response is `200 { ok: true }`
And invalid/missing body fields return `400 { error: "INVALID_BODY" }`
And missing/invalid JWT returns `401 { error: "UNAUTHORIZED" }`

**AC3 — Unsubscribe endpoint**
Given an authenticated user with a valid JWT
When the client sends `DELETE /api/push/subscribe`
Then all `push_subscriptions` rows for that user are deleted
And the response is `200 { ok: true }`
And the endpoint is idempotent (returns 200 even if no rows existed)
And missing/invalid JWT returns `401 { error: "UNAUTHORIZED" }`

**AC4 — Send notification endpoint**
Given a system/admin caller with a valid Bearer token matching `PUSH_ADMIN_TOKEN` env var
When the client sends `POST /api/push/send` with body `{ userId, title, body, url? }`
Then all `push_subscriptions` for that `userId` are fetched
And `web-push.sendNotification()` is called for each subscription with the given title/body/url
And expired/invalid subscriptions (410 Gone) are deleted from the table
And the response is `200 { sent: <count>, failed: <count> }`
And invalid Bearer token returns `401 { error: "UNAUTHORIZED" }`

**AC5 — Service worker push event handler**
Given the service worker in `src/sw.ts` receives a `push` event
When the event fires with a JSON payload `{ title, options }`
Then `self.registration.showNotification(data.title, data.options)` is called via `event.waitUntil`

**AC6 — Service worker notification click handler**
Given a user clicks a push notification
When the notification has a `data.url` property
Then the service worker opens that URL via `clients.openWindow(data.url)` or focuses an existing window
And the notification is closed

## Tasks / Subtasks

- [ ] Task 1: Create `GET /api/push/vapid-key` endpoint (AC: 1)
  - [ ] 1.1 Create file `api/push/vapid-key.ts`:
    - Export default async handler with `VercelRequest`/`VercelResponse` types
    - Only allow `GET` method; return `405 METHOD_NOT_ALLOWED` for others
    - Read `process.env.VITE_VAPID_PUBLIC_KEY`
    - If missing, return `500 { error: "CONFIGURATION_ERROR", message: "Server misconfigured", status: 500 }`
    - Return `200 { publicKey: "<value>" }`
    - No auth required — this is a public endpoint

- [ ] Task 2: Create `POST /api/push/subscribe` endpoint (AC: 2)
  - [ ] 2.1 Create file `api/push/subscribe.ts`:
    - Export default async handler
    - Route on `req.method`:
      - `POST` → subscribe flow (Task 2)
      - `DELETE` → unsubscribe flow (Task 3)
      - Otherwise → `405 METHOD_NOT_ALLOWED`
    - **POST flow:**
      - Call `requireUserAuth(req, res)` from `../_auth` — return early if null
      - Validate body with Zod schema: `{ endpoint: z.string().url(), p256dh: z.string().min(1), auth: z.string().min(1) }`
      - On validation failure, return `400 { error: "INVALID_BODY", message: "<details>", status: 400 }`
      - Call `createServiceClient()` from `../_supabase`
      - Upsert into `push_subscriptions`: insert with `onConflict: 'endpoint'` to handle re-subscriptions
        ```typescript
        supabase.from('push_subscriptions').upsert({
          user_id: user.id,
          endpoint: body.endpoint,
          p256dh: body.p256dh,
          auth: body.auth,
        }, { onConflict: 'endpoint' })
        ```
      - On DB error, log and return `500 INTERNAL_ERROR`
      - Return `200 { ok: true }`

- [ ] Task 3: Handle `DELETE /api/push/subscribe` in same file (AC: 3)
  - [ ] 3.1 In `api/push/subscribe.ts` DELETE branch:
    - Call `requireUserAuth(req, res)` — return early if null
    - Call `createServiceClient()`
    - Delete all rows: `supabase.from('push_subscriptions').delete().eq('user_id', user.id)`
    - On DB error, log and return `500 INTERNAL_ERROR`
    - Return `200 { ok: true }` (idempotent — no error if zero rows deleted)

- [ ] Task 4: Create `POST /api/push/send` endpoint (AC: 4)
  - [ ] 4.1 Create file `api/push/send.ts`:
    - Export default async handler
    - Only allow `POST` method; return `405` for others
    - **Auth check:** Extract Bearer token from `Authorization` header. Compare against `process.env.PUSH_ADMIN_TOKEN`. Return `401 UNAUTHORIZED` if missing or mismatched. Do NOT use `requireUserAuth` — this is system-level auth.
    - Validate body with Zod: `{ userId: z.string().uuid(), title: z.string().min(1), body: z.string().min(1), url: z.string().url().optional() }`
    - On validation failure, return `400 INVALID_BODY`
    - Validate env vars: `VAPID_PRIVATE_KEY`, `VITE_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` — return `500 CONFIGURATION_ERROR` if missing
    - Configure `web-push`:
      ```typescript
      import webpush from 'web-push'
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT!,
        process.env.VITE_VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!
      )
      ```
    - Fetch subscriptions: `supabase.from('push_subscriptions').select('*').eq('user_id', body.userId)`
    - If no subscriptions found, return `200 { sent: 0, failed: 0 }`
    - For each subscription, build the push payload and call `webpush.sendNotification()`:
      ```typescript
      const payload = JSON.stringify({
        title: body.title,
        options: {
          body: body.body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          data: { url: body.url },
        },
      })
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }
      ```
    - Track `sent` and `failed` counts
    - On `410 Gone` or `404` status code errors, delete the stale subscription from DB
    - Return `200 { sent, failed }`

- [ ] Task 5: Implement SW push event handler (AC: 5, 6)
  - [ ] 5.1 In `src/sw.ts`, replace the commented-out push listener (lines 58–61) with:
    ```typescript
    self.addEventListener('push', (event) => {
      const data = event.data?.json() ?? { title: 'Overnighter', options: {} }
      event.waitUntil(
        self.registration.showNotification(data.title, {
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          ...data.options,
        })
      )
    })
    ```
  - [ ] 5.2 Add notification click handler after the push listener:
    ```typescript
    self.addEventListener('notificationclick', (event) => {
      event.notification.close()
      const url = event.notification.data?.url
      if (url) {
        event.waitUntil(
          self.clients.matchAll({ type: 'window' }).then((windowClients) => {
            const existing = windowClients.find((c) => c.url === url && 'focus' in c)
            if (existing) return existing.focus()
            return self.clients.openWindow(url)
          })
        )
      }
    })
    ```

- [ ] Task 6: Create API tests (AC: 1, 2, 3, 4)
  - [ ] 6.1 Create `api/push/vapid-key.test.ts`:
    - Returns 405 for non-GET methods
    - Returns 500 when `VITE_VAPID_PUBLIC_KEY` is missing
    - Returns 200 with `publicKey` when env var is set
  - [ ] 6.2 Create `api/push/subscribe.test.ts`:
    - **POST tests:**
      - Returns 401 for missing/invalid JWT (mock `requireUserAuth` returning null)
      - Returns 400 for invalid body (missing endpoint, p256dh, auth)
      - Returns 200 and upserts subscription on valid request
      - Returns 500 on DB error
    - **DELETE tests:**
      - Returns 401 for missing/invalid JWT
      - Returns 200 and deletes user subscriptions
      - Returns 200 even when no rows exist (idempotent)
    - Returns 405 for unsupported methods (PUT, PATCH)
  - [ ] 6.3 Create `api/push/send.test.ts`:
    - Returns 405 for non-POST methods
    - Returns 401 for missing/wrong Bearer token
    - Returns 400 for invalid body
    - Returns 500 when VAPID env vars missing
    - Returns `{ sent: 0, failed: 0 }` when no subscriptions exist
    - Calls `webpush.sendNotification` for each subscription (mock web-push)
    - Deletes stale subscriptions on 410 response
    - Returns correct sent/failed counts
  - [ ] 6.4 Run `npm run typecheck:api && npm run test -- --reporter=verbose api/push` — all tests must pass.

- [ ] Task 7: Final validation (all ACs)
  - [ ] 7.1 Run `npm run lint` — no new lint errors
  - [ ] 7.2 Run `npm run test` — all existing + new tests pass
  - [ ] 7.3 Run `npm run typecheck:api` — no type errors
  - [ ] 7.4 Run `npm run build` — build succeeds with SW changes

## Dev Notes

### Context Summary

This is the first story in Phase 2 Epic 4 (Push Notifications). It establishes the backend infrastructure: VAPID key endpoint, subscription management (subscribe/unsubscribe), notification sending, and the service worker push/click handlers. Stories 4.2 (Per-Spot Push Opt-In) and 4.3 (Push Notification Delivery & Opt-Out) build the client-side UI on top of this infrastructure.

The `push_subscriptions` table already exists (created in migration `022_create_phase2_foundation_tables.sql`) with RLS policies. The `web-push` npm package and `@types/web-push` are already installed. A commented-out push event listener placeholder exists in `src/sw.ts` at lines 58–61.

### Current Repository Reality

**Database — `push_subscriptions` table (already exists via migration 022):**
```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (endpoint)
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions (user_id, created_at DESC);
-- RLS enabled with per-user CRUD policies
```

**Auth middleware (`api/_auth.ts` — use for JWT validation):**
```typescript
export async function requireUserAuth(req: VercelRequest, res: VercelResponse): Promise<User | null> {
  // Extracts Bearer token, validates via supabase.auth.getUser()
  // Returns User on success, sends 401 and returns null on failure
}
```

**Supabase client (`api/_supabase.ts`):**
```typescript
export function createServiceClient() {
  // Uses process.env.VITE_SUPABASE_URL + process.env.SUPABASE_SERVICE_ROLE_KEY
  return createClient(url, key)
}
```

**Service worker (`src/sw.ts` — push placeholder at lines 58–61):**
```typescript
// Push notification listener — implemented in Epic 4 Story 4.1
// self.addEventListener('push', (event) => {
//   // TODO: Handle push notifications (Story 4.1)
// })
```

**Existing API subdirectory pattern (`api/stripe/`):**
- `checkout.ts`, `portal.ts`, `webhook.ts` — each exports a default handler
- Uses `requireUserAuth` from `../_auth`
- Uses `createServiceClient` from `../_supabase`
- Method checking: `if (req.method !== 'POST') return res.status(405).json(...)`

**API test patterns (`api/_auth.test.ts`, `api/checkin.test.ts`):**
- Uses `vi.mock('./_supabase', ...)` with hoisted mock functions
- `mockReq()` / `mockRes()` helpers for VercelRequest/VercelResponse
- Tests cover auth failures, validation failures, success paths, and DB errors

**NPM packages (already installed):**
- `web-push@3.6.7` (production dependency)
- `@types/web-push@^3.6.4` (dev dependency)
- `zod` (already used in `api/checkin.ts` for body validation)

### Architecture Guardrails

- **Push notification receipt MUST be handled only in `src/sw.ts` push event listener.** Never intercept push events in React components. [Source: architecture-phase2.md line 641]
- **Push delivery is best-effort.** No product feature should depend on push delivery — it is an enhancement, not a primary interaction path. [Source: architecture-phase2.md line 48]
- **VAPID keys are generated once per environment** via `npx web-push generate-vapid-keys` and stored as Vercel env vars. Do NOT generate keys in code. [Source: architecture-phase2.md line 946]
- **`web-push` is Node-only** — only import in serverless functions (`api/`), never in client code. [Source: architecture-phase2.md line 962]
- **Vercel Hobby tier** — 12 serverless function limit. The `api/push/` directory creates files that map to routes. `vapid-key.ts` → `/api/push/vapid-key`, `subscribe.ts` → `/api/push/subscribe`, `send.ts` → `/api/push/send`. Combine POST/DELETE into one file (`subscribe.ts`) to minimize function count.
- **API error response format** — follow existing pattern: `{ error: "ERROR_CODE", message: "human-readable", status: <number> }`.

### Implementation Notes For The Dev Agent

- **`api/push/subscribe.ts` handles both POST and DELETE.** This matches the Vercel routing model (one file = one route path) and keeps function count low. Route on `req.method`.
- **Upsert for subscribe:** Use Supabase `.upsert({...}, { onConflict: 'endpoint' })` because a user might re-subscribe from the same browser (same endpoint, new keys).
- **`POST /api/push/send` uses a simple Bearer token (`PUSH_ADMIN_TOKEN`)**, NOT `requireUserAuth`. This endpoint is for system/cron use, not end-user calls. The token is a shared secret stored as an env var.
- **Stale subscription cleanup:** When `webpush.sendNotification()` throws with a `statusCode` of `410` or `404`, delete that subscription row. This prevents accumulating dead subscriptions.
- **Push payload structure:** The SW expects `{ title: string, options: NotificationOptions }`. The `options.data.url` field enables the `notificationclick` handler to open the relevant page (e.g., `/pin/<id>`).
- **Icon paths:** Use `/pwa-192x192.png` for both `icon` and `badge` — this file already exists in the `public/` directory.
- **The `notificationclick` handler** should try to focus an existing window with the same URL before opening a new one, following the standard PWA pattern.
- **Test mocking for `web-push`:** Use `vi.mock('web-push', ...)` to mock `setVapidDetails` and `sendNotification`. Test both success and 410 error scenarios.
- **No migration needed** — the `push_subscriptions` table, indexes, and RLS policies already exist from migration 022.

### Testing Requirements

- Minimum validation commands:
  - `npm run test` — all tests pass
  - `npm run typecheck:api` — no type errors in API code
  - `npm run lint` — no lint violations
  - `npm run build` — build succeeds (validates SW compilation)
- Use `vitest` + existing mock patterns from `api/_auth.test.ts`
- Mock `web-push` module in send endpoint tests
- Mock `_supabase` and `_auth` per existing patterns
- Test all HTTP method guards (405 responses)
- Test auth failure paths (401 responses)
- Test validation failure paths (400 responses)
- Test DB error paths (500 responses)
- Test happy paths with expected return values
