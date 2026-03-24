---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-03-24'
inputDocuments:
  - 'prd.md'
  - 'architecture.md'
  - 'ux-design-specification.md'
workflowType: 'architecture'
project_name: 'Overnighter'
user_name: 'Kyryl'
date: '2026-03-24'
---

# Architecture Decision Document — Phase 2

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (Phase 2 — 8 new capability areas):**
- User accounts + cloud sync: Supabase Auth replaces anonymous localStorage for rig profile
  and saved spots. Check-ins gain user attribution (optional — anonymous path preserved).
- Premium subscription: $19.99/year, 30-day free trial. Requires payment provider integration
  and server-side subscription state. Feature gating across UI and API.
- Offline PWA: vite-plugin-pwa + Workbox service worker for tile caching and stale pin reads.
  Pre-planned in MVP architecture — no stack change required.
- Route corridor planning: New multi-stop Trip entity. New tables: trips, trip_stops.
  New UI feature with significant state complexity (ordered stop list, route rendering).
- Push notifications: Web Push API (opt-in). Requires service worker (already needed for PWA),
  push subscription storage, and server-side push sending endpoint.
- Photo uploads: Supabase Storage buckets. Client-side file selection + upload, CDN URL storage
  on check_ins table. Server-side image validation and size limits.
- Crowd-sourced spot submissions: New pin lifecycle — pending -> approved/rejected.
  Moderation queue in admin UI. Community-submitted pins never auto-publish to map.
- Admin UI: Web-based dashboard replacing direct DB access. Covers: flagged pins, spot
  submission moderation, badge overrides, pin CRUD, user management (Phase 2 admin scope).

**Non-Functional Requirements (Phase 2 additions):**
- Anonymous/authenticated coexistence: No forced login at any point. Feature gating degrades
  gracefully — free-tier users see upsell prompts, not broken UI.
- Subscription state: Must be server-authoritative — client cannot self-report premium status.
- Offline capability: Tile cache + last-fetched pin viewport must be accessible without network.
  Pin write operations (check-ins) must queue when offline and flush on reconnect.
- Push delivery: Best-effort (Web Push is not guaranteed). No product feature should depend
  on push delivery — it is an enhancement, not a primary interaction path.
- Photo constraints: Max 5MB upload, JPEG/PNG/HEIC only. CDN serving (not DB reads) for all
  photos. No photo moderation at Phase 2 — community flagging only.
- Data scale: National expansion requires PostGIS spatial indexing on pins.coordinates.
  Viewport queries must use spatial bounding box indexes, not full table scans.

**Scale & Complexity:**
- Primary domain: Full-stack SPA + PWA + Auth + Payments + Storage + Push Notifications
- Complexity level: Medium-High
- New architectural components: 6-7 (Auth, Payments/Stripe, Service Worker/Workbox,
  Web Push, Supabase Storage, Pin Moderation Workflow, Expanded Admin UI)

### Technical Constraints & Dependencies

- **Stack continuity**: Phase 2 builds on Vite 8 + React 19 + TypeScript + Supabase + Vercel.
  No stack replacement — additive changes only.
- **Supabase free tier limits**: 500MB DB, 50k MAU, 1GB Storage. At 5,000 MAU Phase 2 target,
  the Pro tier ($25/month) will likely be needed for storage + MAU headroom.
- **Stripe**: De facto standard for SaaS subscriptions. Webhook endpoint required for
  subscription lifecycle events (trial end, payment failure, cancellation).
- **Service worker constraint**: A single service worker file manages tile cache, pin cache,
  AND push. Workbox (included with vite-plugin-pwa) handles cache strategies; push handler
  added manually. SW scope must not conflict with Vercel serverless function paths.
- **Solo founder**: Phase 2 still no dedicated ops. Managed services only — no self-hosted
  push server, no custom image CDN, no custom queue service.
- **Migration sensitivity**: Existing MVP users have data in localStorage. Cloud sync must
  offer opt-in migration, not forced overwrite.

### Cross-Cutting Concerns Identified

1. **Auth/anonymous coexistence**: JWT sessions and anonymous deviceId must work in parallel
   throughout the app. Auth state is now a global context — every feature must handle both states.
2. **localStorage -> cloud migration**: Rig profile and saved spots must be migrated on
   opt-in account creation without data loss.
3. **Feature gating**: Premium status touches UI components, API endpoints, and subscription
   checks globally. A single `useSubscription` hook and server-side middleware pattern needed.
4. **Service worker scope**: One SW handles tile caching (Workbox), pin offline data, and
   push notification receipt. Cache strategies must be defined per resource type.
5. **New pin lifecycle**: Crowd-submitted pins enter a pending state; moderation workflow
   affects badge state logic, map rendering (pending pins not shown to public), and admin queue.
6. **Spatial scaling**: National expansion requires PostGIS indexing. All viewport pin queries
   must use spatial indexes from Phase 2 — retrofitting later is costly.

## Starter Template Evaluation

### Primary Technology Domain

Existing SPA/PWA extension — Phase 2 adds to the MVP stack rather than replacing it.
No new starter template needed. Stack continuity is a Phase 2 constraint.

### Existing Stack (Unchanged from MVP)

Vite 8 + React 19 + TypeScript + Tailwind CSS + shadcn/ui + Zustand v5 +
TanStack Query v5 + React Router v7 + Supabase JS v2 + Zod v3 + Vitest +
React Testing Library

### New Phase 2 Dependencies

**Install commands:**

```bash
# Client dependencies
npm i vite-plugin-pwa@^1.2.0 @stripe/stripe-js@^8.11.0 @stripe/react-stripe-js

# Server dependencies (Vercel serverless functions)
npm i stripe@^20.4.1 web-push@^3.6.7

# Dev dependencies
npm i -D @types/web-push
```

**New dependency roles:**

| Package | Version | Role |
|---|---|---|
| vite-plugin-pwa | 1.2.0 | PWA manifest + Workbox service worker (tile cache, offline, push receipt) |
| @stripe/stripe-js | 8.11.0 | Load Stripe.js client-side, initialize payment elements |
| @stripe/react-stripe-js | latest | React wrapper for Stripe Elements in checkout UI |
| stripe | 20.4.1 | Server-side: webhook handling, subscription create/cancel, trial management |
| web-push | 3.6.7 | Server-side: generate VAPID keys, send Web Push notifications to subscriptions |

**No new packages needed for:**
- Supabase Auth — already in @supabase/supabase-js v2 (activate in Supabase dashboard)
- Supabase Storage — already in @supabase/supabase-js v2 (bucket API built in)
- PostGIS spatial indexing — Supabase enables PostGIS via SQL migration, no new package

### vite-plugin-pwa Configuration Note

vite-plugin-pwa 1.2.0 uses Workbox under the hood. Phase 2 requires a custom
service worker entry point to handle Web Push notification receipt alongside
Workbox cache strategies. This is done via the `strategies: 'injectManifest'`
option which gives direct control over the service worker file.

### Architectural Decisions Established by Phase 2 Packages

**PWA / Service Worker:**
- Workbox handles tile caching (NetworkFirst strategy) and pin data (StaleWhileRevalidate)
- Custom SW entry (`src/sw.ts`) handles push event reception and notification display
- SW registration managed by vite-plugin-pwa auto-registration

**Payments:**
- Stripe Elements (React) renders the payment UI — no raw card data in our codebase
- All subscription logic server-side via Stripe Node SDK in `/api/stripe/` functions
- Stripe webhooks (POST /api/stripe/webhook) handle subscription lifecycle events

**Push Notifications:**
- VAPID key pair generated once, stored as env vars (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
- Push subscriptions stored in new `push_subscriptions` Supabase table (user_id, subscription JSON)
- Server-side `web-push` sends notifications from `/api/push/send` endpoint

**Note:** Phase 2 initialization = `npm install` with the above packages in the existing project.
First Phase 2 implementation story should install these packages and configure vite-plugin-pwa.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Database schema: 7 new Supabase tables (profiles, saved_spots, push_subscriptions, trips, trip_stops, spot_submissions, pin_photos)
- PostGIS: enable extension + spatial index on pins.location — required for national expansion
- Supabase Auth: email+password — blocks all authenticated features
- Stripe integration: checkout + webhook + portal — blocks subscription feature
- Auth/anonymous coexistence: AuthContext + useAuth pattern — blocks any auth-gated UI

**Important Decisions (Shape Architecture):**
- JWT custom claims for subscription_status — avoids extra DB round-trip per request
- localStorage migration utility (opt-in on account creation) — shapes onboarding UX
- vite-plugin-pwa injectManifest strategy — controls SW tile/pin/push cache behavior
- Offline check-in queue (localStorage pendingCheckins + online event flush)
- PremiumGate + AuthRequired component pattern — shapes all gated feature UI

**Deferred Decisions (Post Phase 2):**
- Route corridor planning (trips/trip_stops) — deferred to later Phase 2 epic
- Native iOS/Android apps — Phase 3
- Supabase Realtime for live badge updates — Phase 3

### Data Architecture

**New Supabase Tables:**

```sql
-- profiles: mirrors auth.users, holds cloud-synced user data
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rig_profile JSONB,
  subscription_status TEXT DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'trialing', 'premium', 'expired')),
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- saved_spots: cloud sync of bookmarked pins (replaces localStorage for auth users)
CREATE TABLE saved_spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  pin_id UUID REFERENCES pins(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT NOW()
);

-- push_subscriptions: Web Push subscription objects per user
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- trips: route corridor planning (premium feature)
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- trip_stops: ordered stops within a trip
CREATE TABLE trip_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  pin_id UUID REFERENCES pins(id),
  stop_order INTEGER NOT NULL,
  notes TEXT,
  UNIQUE(trip_id, stop_order)
);

-- spot_submissions: crowd-sourced spot submissions (pending moderation)
CREATE TABLE spot_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT,
  user_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  amenities JSONB,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- pin_photos: photos attached to check-ins via Supabase Storage
CREATE TABLE pin_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_in_id UUID REFERENCES check_ins(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  storage_path TEXT NOT NULL,
  cdn_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**PostGIS Spatial Index Migration:**

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
ALTER TABLE pins ADD COLUMN location geography(Point, 4326);
UPDATE pins SET location = ST_MakePoint(longitude, latitude)::geography;
CREATE INDEX idx_pins_location ON pins USING GIST(location);
-- Viewport query pattern after migration:
-- WHERE ST_DWithin(location, ST_MakePoint($lng, $lat)::geography, $radius_meters)
```

**Photo Storage:**
- Supabase Storage bucket: `pin-photos` (public, CDN-served)
- File path: `{pin_id}/{checkin_id}/{uuid}.jpg`
- Max 5MB enforced in `/api/photos/upload-url` before issuing signed upload URL
- CDN URL stored in `pin_photos.cdn_url` — components never construct Storage paths directly

**Subscription State:**
- Source of truth: Stripe (webhooks are authoritative)
- Stored in: `profiles.subscription_status` (updated by `/api/stripe/webhook`)
- Client access: TanStack Query reads `profiles` via authenticated PostgREST
- JWT custom claims: `subscription_status` embedded in Supabase JWT — updated via
  Supabase Admin API in webhook handler after Stripe event processed

### Authentication & Security

**Auth Method: Supabase Auth — Email + Password**
- RV traveler demographic skews toward familiar email/password UX
- Magic link available as secondary option (add post-launch based on user feedback)
- Supabase Auth handles session management, JWT refresh, secure cookie storage

**Anonymous to Authenticated Migration (opt-in):**
- Trigger: user completes account creation
- Action: copy `localStorage['rig-profile']` → `profiles.rig_profile`
- Action: copy `localStorage['saved-spots']` → `saved_spots` table rows
- DeviceId check-ins NOT auto-linked (privacy-preserving)
- Optional prompt: "Link your past check-ins to your account?" (user choice)
- localStorage preserved as fallback — anonymous users unaffected

**Feature Gating:**
- JWT custom claims carry `subscription_status` — no extra DB query in serverless functions
- Client: `useSubscription` hook (TanStack Query) → `{ isPremium, isTrial, status }`
- `<PremiumGate>` component: renders children if premium, upsell prompt if free
- `<AuthRequired>` route wrapper: redirects to `/account` (sign-up prompt) if not authenticated

**Stripe Webhook Security:**
```typescript
// api/stripe/webhook.ts
export const config = { api: { bodyParser: false } }  // raw body required

const sig = req.headers['stripe-signature']
const event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)
// throws if signature invalid — never process unsigned webhooks
```

### API & Communication Patterns

**New Phase 2 Endpoints:**

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/auth/migrate` | JWT | Copy localStorage rig profile + saved spots to user profile on account creation |
| `POST /api/stripe/checkout` | JWT | Create Stripe checkout session (annual subscription + 30-day trial) |
| `POST /api/stripe/webhook` | Stripe signature | Handle subscription lifecycle events |
| `POST /api/stripe/portal` | JWT | Create Stripe customer portal session for subscription management |
| `GET /api/push/vapid-key` | None | Return VITE_VAPID_PUBLIC_KEY to client for push subscription |
| `POST /api/push/subscribe` | JWT | Save Web Push subscription object to push_subscriptions table |
| `DELETE /api/push/subscribe` | JWT | Remove push subscription on user opt-out |
| `POST /api/push/send` | Bearer | Send push notifications (triggered by cron or event) |
| `POST /api/spots/submit` | None (deviceId) | Submit new spot for moderation queue |
| `GET /api/admin/submissions` | Bearer | List pending spot_submissions |
| `PATCH /api/admin/submissions/:id` | Bearer | Approve (creates pin) or reject submission |
| `POST /api/photos/upload-url` | JWT | Issue signed Supabase Storage upload URL (validates file type + size) |

**Offline Check-In Queue:**
- On submit when offline: append to `localStorage['pendingCheckins']` array
- On `window.addEventListener('online')`: iterate array, fire `useCheckinMutation` per item, clear on success
- TanStack Query `retry: 3` already configured — handles transient failures on flush

**Stripe Webhook Events Handled:**
- `checkout.session.completed` → set `subscription_status = 'trialing'` or `'premium'`
- `customer.subscription.updated` → sync status change
- `customer.subscription.deleted` → set `subscription_status = 'expired'`
- `invoice.payment_failed` → set `subscription_status = 'expired'`, trigger push notification

### Frontend Architecture

**Auth State — React Context (not Zustand):**
```typescript
// src/contexts/AuthContext.tsx
export const AuthContext = createContext<AuthContextValue>(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => setSession(session)
    )
    return () => subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ user, session, signIn, signOut, signUp }}>
    {children}
  </AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
```

**Feature Gating Components:**
```typescript
// src/components/PremiumGate.tsx
export function PremiumGate({ children, fallback }) {
  const { isPremium } = useSubscription()
  return isPremium ? children : (fallback ?? <UpsellPrompt />)
}

// src/components/AuthRequired.tsx
export function AuthRequired({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/account" replace />
  return children
}
```

**New Routes:**
- `/account` — profile, subscription management, rig sync (AuthRequired)
- `/subscribe` — Stripe checkout redirect (AuthRequired)
- `/trips` — route corridor planning (AuthRequired + PremiumGate)
- `/submit-spot` — crowd-sourced submission (open, no auth required)

**PWA Service Worker Cache Strategies (`src/sw.ts`):**
```typescript
// Tile cache — tiles don't change, cache aggressively
registerRoute(
  ({ url }) => url.hostname.includes('basemaps.cartocdn.com'),
  new CacheFirst({ cacheName: 'map-tiles', plugins: [
    new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 30 * 24 * 60 * 60 })
  ]})
)

// Pin API — stale-while-revalidate for offline browsing
registerRoute(
  ({ url }) => url.pathname.includes('/rest/v1/pins'),
  new StaleWhileRevalidate({ cacheName: 'pins-cache', plugins: [
    new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 })
  ]})
)

// Push notification receipt
self.addEventListener('push', (event) => {
  const data = event.data?.json()
  event.waitUntil(self.registration.showNotification(data.title, data.options))
})
```

**SW Update Flow:**
```typescript
// src/hooks/usePWAUpdate.ts — using vite-plugin-pwa useRegisterSW
const { needRefresh, updateServiceWorker } = useRegisterSW()
// Show "New version available" banner when needRefresh[0] is true
```

**New Zustand store additions (minimal):**
- `useUIStore` gets: `offlineQueueCount: number`, `updateAvailable: boolean`
- No new stores — auth in React context, subscription in TanStack Query

### Infrastructure & Deployment

**Supabase:**
- Upgrade to Pro tier ($25/mo) before Phase 2 launch (5k MAU, 8GB Storage on Pro)
- Enable PostGIS: SQL migration `CREATE EXTENSION IF NOT EXISTS postgis`
- Enable Supabase Auth: dashboard toggle, configure email templates
- Create `pin-photos` storage bucket (public, 5MB upload size policy)

**Stripe:**
- Create product: "Overnighter Premium" with annual price ($19.99) + optional monthly ($1.99)
- Register webhook in Stripe dashboard: `https://<production-domain>/api/stripe/webhook`
- Enable events: checkout.session.completed, customer.subscription.*, invoice.payment_failed

**New Environment Variables:**

```
# .env.example additions for Phase 2
STRIPE_SECRET_KEY=              # Server-only — Stripe secret key
STRIPE_WEBHOOK_SECRET=          # Server-only — from Stripe dashboard webhook config
STRIPE_PRICE_ID_ANNUAL=         # Server-only — Stripe price ID for annual plan
VITE_STRIPE_PUBLISHABLE_KEY=    # Client-safe — Stripe publishable key
VITE_VAPID_PUBLIC_KEY=          # Client-safe — Web Push VAPID public key
VAPID_PRIVATE_KEY=              # Server-only — Web Push VAPID private key
VAPID_SUBJECT=                  # Server-only — mailto: or URL for VAPID
```

**Implementation Sequence for Phase 2:**
1. PostGIS migration + new DB tables (blocks all Phase 2 data work)
2. Supabase Auth + AuthContext (blocks all auth-gated features)
3. localStorage migration utility (blocks account creation UX)
4. vite-plugin-pwa + SW cache strategies + push receipt (blocks offline + push)
5. Stripe checkout + webhook + portal (blocks subscription feature)
6. PremiumGate + useSubscription (blocks feature gating throughout UI)
7. Push subscription management + send endpoint (requires SW + Auth + tables)
8. Photo upload pipeline — signed URL + Storage bucket (requires Auth + tables)
9. Spot submission + admin moderation queue (blocks crowd-sourcing)
10. Route corridor planning — trips/trip_stops (premium, deferred to later epic)

**Cross-Component Dependencies:**
- Auth state (AuthContext) is required by: useSubscription, saved_spots sync, push subscriptions,
  photo uploads, migration utility, Stripe checkout
- subscription_status JWT claim is required by: PremiumGate, all premium API endpoints
- PostGIS migration must run before: national expansion pin queries, viewport bounding box queries
- vite-plugin-pwa SW must be registered before: offline queue flush, push notification receipt
- Stripe webhook must be live before: subscription_status ever updates from 'free'

## Phase 2 Implementation Patterns & Consistency Rules

### New Conflict Points (Phase 2 additions to MVP patterns)

All MVP patterns from architecture.md remain in force. Phase 2 adds 7 new
conflict areas where agents must follow explicit rules.

### Auth Patterns

**Rule: Never call supabase.auth directly in components or stores.**
Always use the `useAuth` hook from `src/contexts/AuthContext.tsx`.

```typescript
// CORRECT
const { user, session, signIn, signOut } = useAuth()

// WRONG — direct Supabase call in component
const { data: { user } } = await supabase.auth.getUser()
```

**Rule: Never read auth state from localStorage or cookies manually.**
Supabase Auth manages session persistence internally — trust `onAuthStateChange`.

**Rule: Route protection uses `<AuthRequired>` wrapper — never inline redirects.**
```typescript
// CORRECT
<Route path="/account" element={<AuthRequired><AccountScreen /></AuthRequired>} />

// WRONG — inline auth check in component
if (!user) navigate('/account')
```

### Subscription / Feature Gating Patterns

**Rule: Never check subscription status by querying `profiles` table directly in components.**
Always use `useSubscription()` hook which handles caching and loading states.

```typescript
// CORRECT
const { isPremium, isTrial } = useSubscription()

// WRONG — inline DB query in component
const { data } = await supabase.from('profiles').select('subscription_status')
```

**Rule: All premium-gated UI uses `<PremiumGate>` — never conditional rendering inline.**
```typescript
// CORRECT
<PremiumGate><TripsFeature /></PremiumGate>

// WRONG — inline premium check
{isPremium && <TripsFeature />}
```

**Rule: Premium status is NEVER derived from client-side state alone.**
Server endpoints must verify JWT claim `subscription_status === 'premium'` independently.
Client-side `isPremium` is for UI only — it cannot authorize server operations.

### Stripe Patterns

**Rule: All payment UI uses Stripe Elements — never handle raw card data.**
```typescript
// CORRECT — Stripe Elements never exposes card data to our code
<Elements stripe={stripePromise}>
  <PaymentElement />
</Elements>

// WRONG — never do this
<input name="card-number" />
```

**Rule: All subscription management goes through `/api/stripe/` endpoints.**
Never call Stripe SDK directly from client-side code — publishable key is only for
loading Stripe.js. All create/update/cancel operations are server-side only.

**Rule: Webhook handlers MUST use raw body + signature verification.**
```typescript
// api/stripe/webhook.ts — MANDATORY pattern
export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  const rawBody = await getRawBody(req)
  const sig = req.headers['stripe-signature']
  try {
    const event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)
    // process event
  } catch (err) {
    return res.status(400).json({ error: 'Invalid signature' })
  }
}
```

### Photo Upload Patterns

**Rule: Components never upload directly to Supabase Storage.**
Always request a signed URL from `/api/photos/upload-url` first, then PUT to that URL.

```typescript
// CORRECT
const { uploadUrl, cdnUrl } = await fetch('/api/photos/upload-url', {
  method: 'POST',
  body: JSON.stringify({ pinId, checkInId, fileType })
})
await fetch(uploadUrl, { method: 'PUT', body: file })

// WRONG — direct Storage upload from component
await supabase.storage.from('pin-photos').upload(path, file)
```

**Rule: Always validate file type and size BEFORE requesting an upload URL.**
```typescript
// CORRECT — client-side pre-validation
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic']
const MAX_SIZE_BYTES = 5 * 1024 * 1024
if (!ALLOWED_TYPES.includes(file.type)) throw new Error('INVALID_FILE_TYPE')
if (file.size > MAX_SIZE_BYTES) throw new Error('FILE_TOO_LARGE')
// then request upload URL
```

**Rule: Store `cdn_url` in `pin_photos` table — never construct Storage paths in components.**
```typescript
// CORRECT — use stored CDN URL
<img src={photo.cdnUrl} />

// WRONG — reconstruct path in component
<img src={`${SUPABASE_URL}/storage/v1/object/public/pin-photos/${photo.storagePath}`} />
```

### Spot Submission Patterns

**Rule: User-submitted spots NEVER go directly into the `pins` table.**
All submissions go through `POST /api/spots/submit` -> `spot_submissions` table with `status: 'pending'`.
Only admin approval via `PATCH /api/admin/submissions/:id` creates a pin.

```typescript
// CORRECT
await fetch('/api/spots/submit', { method: 'POST', body: JSON.stringify(spotData) })

// WRONG — never insert directly
await supabase.from('pins').insert(spotData)
```

**Rule: Map never renders pins with `status !== 'approved'` to public users.**
The `usePinsQuery` filter must include `WHERE status = 'approved'` — pending/rejected pins
are invisible to public map. Admin view explicitly queries pending status separately.

### PWA / Service Worker Patterns

**Rule: SW registration and update handling is always via `useRegisterSW` from vite-plugin-pwa.**
Never manually register the service worker or call `navigator.serviceWorker.register()`.

**Rule: Cache strategy names are constants — never inline string literals.**
```typescript
// CORRECT — in src/lib/constants.ts
export const CACHE_NAMES = {
  MAP_TILES: 'map-tiles',
  PINS: 'pins-cache',
  APP_SHELL: 'app-shell',
} as const

// WRONG — inline string in SW
new CacheFirst({ cacheName: 'tiles' })  // typo-prone, hard to grep
```

**Rule: Push notification receipt is handled only in `src/sw.ts` push event listener.**
Never try to intercept push events in React components.

### Enforcement Guidelines

**All AI Agents MUST:**
- Access auth state via `useAuth()` — never directly via `supabase.auth`
- Check subscription via `useSubscription()` — never inline `profiles` table queries
- Gate premium UI with `<PremiumGate>` — never inline `{isPremium && ...}`
- Use Stripe Elements for payment UI — never handle raw card data
- Route all spot submissions through `spot_submissions` table — never insert into `pins` directly
- Request signed upload URLs from `/api/photos/upload-url` — never upload to Storage directly
- Use raw body + `stripe.webhooks.constructEvent` in ALL Stripe webhook handlers

**Pattern Enforcement:**
- TypeScript strict mode catches most auth/subscription shape errors at compile time
- ESLint `no-restricted-imports` can block direct `supabase.auth` calls outside `AuthContext.tsx`
- PR review checklist: verify `<PremiumGate>` usage, bodyParser config on webhook, Stripe Elements

### Good vs Anti-Pattern Examples

**Good — Auth-gated premium API endpoint:**
```typescript
// api/trips.ts
export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'UNAUTHORIZED', status: 401 })
  const isPremium = user.app_metadata?.subscription_status === 'premium'
  if (!isPremium) return res.status(403).json({ error: 'PREMIUM_REQUIRED', status: 403 })
}
```

**Anti-pattern — trusting client-reported premium status:**
```typescript
// WRONG — never trust client assertion of premium status
const { isPremium } = req.body  // attacker can set this to true
```

**Good — localStorage to cloud migration on account creation:**
```typescript
// src/lib/migration.ts
export async function migrateLocalStorageToCloud(session: Session) {
  const rigProfile = JSON.parse(localStorage.getItem('rig-profile') ?? 'null')
  const savedSpots = JSON.parse(localStorage.getItem('saved-spots') ?? '[]')
  await fetch('/api/auth/migrate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ rigProfile, savedSpots })
  })
  // DO NOT clear localStorage — keep as fallback for offline/anonymous use
}
```

## Project Structure & Boundaries (Phase 2)

### Phase 2 Directory Structure Delta

The following shows additions and changes to the MVP project tree defined in
architecture.md. Unchanged MVP directories are marked with `(unchanged)`.

```
overnighter/
├── .env.example                    # UPDATED — Phase 2 env vars added
├── src/
│   ├── sw.ts                       # NEW — Custom service worker (vite-plugin-pwa injectManifest)
│   │
│   ├── contexts/                   # NEW directory
│   │   ├── AuthContext.tsx         # NEW — Supabase Auth session + onAuthStateChange
│   │   └── AuthContext.test.tsx
│   │
│   ├── components/                 # EXTENDED
│   │   ├── ui/ (unchanged)
│   │   ├── AuthRequired.tsx        # NEW — Route protection wrapper
│   │   ├── PremiumGate.tsx         # NEW — Feature gating wrapper
│   │   ├── OfflineIndicator.tsx    # NEW — Online/offline status banner
│   │   └── UpdateBanner.tsx        # NEW — SW update available prompt
│   │
│   ├── features/
│   │   ├── map/ (unchanged)
│   │   ├── rig-profile/ (unchanged)
│   │   ├── pin-detail/ (unchanged)
│   │   ├── saved-spots/ (unchanged — cloud sync added inside)
│   │   ├── check-in/               # EXTENDED
│   │   │   ├── (existing files unchanged)
│   │   │   └── PhotoUpload.tsx     # NEW — Photo attachment on check-in
│   │   │
│   │   ├── auth/                   # NEW feature
│   │   │   ├── SignInScreen.tsx
│   │   │   ├── SignUpScreen.tsx
│   │   │   ├── AccountScreen.tsx   # /account route
│   │   │   ├── AuthModal.tsx       # Triggered when anon user hits auth-gated action
│   │   │   └── SignInScreen.test.tsx
│   │   │
│   │   ├── subscription/           # NEW feature
│   │   │   ├── SubscribeScreen.tsx # /subscribe route
│   │   │   ├── UpsellPrompt.tsx    # Shown by PremiumGate for free users
│   │   │   ├── SubscriptionBadge.tsx
│   │   │   └── SubscribeScreen.test.tsx
│   │   │
│   │   ├── push/                   # NEW feature
│   │   │   ├── PushConsentPrompt.tsx
│   │   │   ├── pushUtils.ts        # subscribe/unsubscribe helpers
│   │   │   └── PushConsentPrompt.test.tsx
│   │   │
│   │   ├── spot-submission/        # NEW feature
│   │   │   ├── SpotSubmissionScreen.tsx  # /submit-spot route
│   │   │   ├── SpotSubmissionForm.tsx
│   │   │   ├── spotSubmissionSchema.ts   # Zod validation
│   │   │   └── SpotSubmissionScreen.test.tsx
│   │   │
│   │   ├── trips/                  # NEW feature (premium)
│   │   │   ├── TripsScreen.tsx     # /trips route (PremiumGate wrapped)
│   │   │   ├── TripBuilder.tsx
│   │   │   ├── TripStopCard.tsx
│   │   │   └── TripsScreen.test.tsx
│   │   │
│   │   └── admin/                  # EXTENDED
│   │       ├── (existing files unchanged)
│   │       ├── SubmissionsQueue.tsx    # NEW — review pending spot submissions
│   │       └── SubmissionReviewCard.tsx # NEW
│   │
│   ├── hooks/                      # EXTENDED
│   │   ├── useGeolocation.ts (unchanged)
│   │   ├── useDeviceId.ts (unchanged)
│   │   ├── useSubscription.ts      # NEW — isPremium/isTrial from profiles table
│   │   ├── usePWAUpdate.ts         # NEW — useRegisterSW wrapper, update banner state
│   │   └── useOnlineStatus.ts      # NEW — navigator.onLine + events
│   │
│   ├── lib/
│   │   ├── supabase/               # EXTENDED
│   │   │   ├── client.ts (unchanged)
│   │   │   ├── pins.ts (unchanged)
│   │   │   ├── checkIns.ts (unchanged)
│   │   │   ├── types.ts (updated — new table types)
│   │   │   ├── profiles.ts         # NEW — profile read/update queries
│   │   │   ├── savedSpots.ts       # NEW — cloud saved spots queries
│   │   │   └── trips.ts            # NEW — trip + trip_stop queries
│   │   ├── pin-model/ (unchanged)
│   │   ├── badge/ (unchanged)
│   │   ├── storage/ (unchanged — localStorage helpers kept for anonymous fallback)
│   │   ├── migration.ts            # NEW — localStorage to cloud migration utility
│   │   ├── photoUpload.ts          # NEW — upload URL request + PUT to signed URL
│   │   └── constants.ts            # NEW — CACHE_NAMES, ALLOWED_PHOTO_TYPES, MAX_PHOTO_SIZE
│   │
│   ├── store/
│   │   ├── rigStore.ts (unchanged)
│   │   ├── spotsStore.ts (unchanged — anonymous path preserved)
│   │   └── uiStore.ts              # UPDATED — adds offlineQueueCount, updateAvailable
│   │
│   ├── api/                        # EXTENDED — client-side fetch wrappers
│   │   ├── checkin.ts (unchanged)
│   │   ├── report.ts (unchanged)
│   │   ├── overpass.ts (unchanged)
│   │   ├── stripe.ts               # NEW — checkout/portal session fetch wrappers
│   │   ├── push.ts                 # NEW — push subscribe/unsubscribe wrappers
│   │   ├── photos.ts               # NEW — upload-url fetch wrapper
│   │   └── spots.ts                # NEW — spot submission fetch wrapper
│   │
│   └── types/                      # EXTENDED
│       ├── pin.ts (unchanged)
│       ├── rigProfile.ts (unchanged)
│       ├── badge.ts (unchanged)
│       ├── auth.ts                  # NEW — User, Session, AuthState
│       ├── subscription.ts          # NEW — SubscriptionStatus enum, SubscriptionState
│       ├── photo.ts                 # NEW — PinPhoto, PhotoUploadRequest
│       ├── trip.ts                  # NEW — Trip, TripStop
│       └── spotSubmission.ts        # NEW — SpotSubmission, SubmissionStatus
│
├── api/                            # EXTENDED — Vercel serverless functions
│   ├── (existing endpoints unchanged)
│   ├── stripe/
│   │   ├── checkout.ts             # POST /api/stripe/checkout
│   │   ├── checkout.test.ts
│   │   ├── webhook.ts              # POST /api/stripe/webhook (raw body, sig verified)
│   │   ├── webhook.test.ts
│   │   ├── portal.ts               # POST /api/stripe/portal
│   │   └── portal.test.ts
│   ├── push/
│   │   ├── vapid-key.ts            # GET /api/push/vapid-key
│   │   ├── subscribe.ts            # POST /api/push/subscribe
│   │   ├── subscribe.test.ts
│   │   └── send.ts                 # POST /api/push/send (Bearer protected)
│   ├── photos/
│   │   ├── upload-url.ts           # POST /api/photos/upload-url
│   │   └── upload-url.test.ts
│   ├── spots/
│   │   ├── submit.ts               # POST /api/spots/submit
│   │   └── submit.test.ts
│   └── admin/
│       ├── (existing endpoints unchanged)
│       └── submissions/
│           ├── index.ts            # GET /api/admin/submissions (Bearer)
│           ├── index.test.ts
│           ├── [id].ts             # PATCH /api/admin/submissions/:id (Bearer)
│           └── [id].test.ts
│
└── supabase/
    └── migrations/                 # EXTENDED
        ├── (001-004 unchanged)
        ├── 005_enable_postgis.sql
        ├── 006_create_profiles.sql
        ├── 007_create_saved_spots.sql
        ├── 008_create_push_subscriptions.sql
        ├── 009_create_trips_and_stops.sql
        ├── 010_create_spot_submissions.sql
        └── 011_create_pin_photos.sql
```

### Architectural Boundaries (Phase 2 additions)

**Auth Boundaries:**
- `src/contexts/AuthContext.tsx` is the ONLY place `supabase.auth.onAuthStateChange` is called
- All features access auth state via `useAuth()` — never direct Supabase auth calls
- `<AuthRequired>` is the ONLY mechanism for route-level auth protection

**Subscription Boundaries:**
- `src/hooks/useSubscription.ts` is the ONLY place `profiles.subscription_status` is queried client-side
- Server premium checks are ONLY via JWT claim in `api/_middleware.ts`
- `<PremiumGate>` is the ONLY mechanism for UI-level feature gating

**Payment Boundaries:**
- `api/stripe/` functions are the ONLY place the Stripe Node SDK is called
- `src/api/stripe.ts` ONLY calls our own `/api/stripe/` endpoints — never Stripe API directly
- Stripe Elements renders inside `src/features/subscription/` ONLY

**Storage Boundaries:**
- `api/photos/upload-url.ts` is the ONLY place Supabase Storage upload URLs are issued
- `src/lib/photoUpload.ts` is the ONLY place the PUT upload is executed client-side
- Components only consume `cdnUrl` from `pin_photos` table — never construct Storage paths

**Spot Submission Boundaries:**
- `api/spots/submit.ts` is the ONLY write path into `spot_submissions` table
- `api/admin/submissions/[id].ts` is the ONLY path from `spot_submissions` -> `pins`
- `usePinsQuery` ALWAYS filters `WHERE status = 'approved'`

### Requirements to Structure Mapping (Phase 2)

| Feature | Primary Location |
|---|---|
| User accounts + cloud sync | `src/features/auth/`, `src/contexts/AuthContext.tsx`, `src/lib/migration.ts` |
| Rig profile cloud sync | `src/lib/supabase/profiles.ts`, `api/auth/migrate.ts` |
| Saved spots cloud sync | `src/lib/supabase/savedSpots.ts` |
| Premium subscription | `src/features/subscription/`, `api/stripe/`, `src/hooks/useSubscription.ts` |
| Offline PWA | `src/sw.ts`, `src/hooks/usePWAUpdate.ts`, `src/hooks/useOnlineStatus.ts` |
| Offline check-in queue | `src/features/check-in/`, `src/lib/storage/` (pendingCheckins key) |
| Push notifications | `src/features/push/`, `api/push/`, `src/sw.ts` push event listener |
| Photo uploads | `src/features/check-in/PhotoUpload.tsx`, `src/lib/photoUpload.ts`, `api/photos/` |
| Crowd-sourced spots | `src/features/spot-submission/`, `api/spots/`, `api/admin/submissions/` |
| Admin expanded | `src/features/admin/SubmissionsQueue.tsx`, `api/admin/submissions/` |
| Route corridor planning | `src/features/trips/` (premium, PremiumGate wrapped) |
| PostGIS + spatial index | `supabase/migrations/005_enable_postgis.sql` |

### Integration Points (Phase 2 additions)

**Stripe Checkout Flow:**
```
User taps Subscribe
  -> SubscribeScreen.tsx -> src/api/stripe.ts -> POST /api/stripe/checkout
  -> Stripe hosted checkout -> checkout.session.completed webhook
  -> api/stripe/webhook.ts updates profiles.subscription_status + JWT claim
  -> useSubscription() invalidated -> isPremium = true
```

**Push Notification Flow:**
```
Opt-in: PushConsentPrompt -> pushManager.subscribe -> POST /api/push/subscribe
Send:   api/push/send.ts (Bearer) -> web-push.sendNotification()
Receive: src/sw.ts push event listener -> showNotification()
```

**Photo Upload Flow:**
```
PhotoUpload.tsx validates -> POST /api/photos/upload-url -> signed URL
-> PUT file to signed URL -> cdn_url stored in pin_photos via check-in
```

### File Organization Patterns (Phase 2 additions)

**New environment variables (.env.example additions):**
```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_ANNUAL=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
```

**Migration naming convention:**
Sequential numbered SQL files: `NNN_verb_noun.sql`.
Each migration is atomic. Run in order via Supabase CLI: `supabase db push`.

**Gap resolution — missing entries added to directory:**
```
api/
  └── auth/
      ├── migrate.ts              # POST /api/auth/migrate (JWT) — localStorage to cloud sync
      └── migrate.test.ts

src/api/
  └── auth.ts                     # NEW — migrate fetch wrapper
```

**Gap resolution — VAPID key generation (one-time, run once per environment):**
```bash
npx web-push generate-vapid-keys
# Copy VAPID Public Key  -> VITE_VAPID_PUBLIC_KEY (Vercel env var)
# Copy VAPID Private Key -> VAPID_PRIVATE_KEY (Vercel env var)
# Set VAPID_SUBJECT=mailto:your@email.com
```

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:** All Phase 2 technology choices are mutually compatible.
`vite-plugin-pwa@1.2.0` has first-class Vite 8 support. Supabase Auth is part of the
existing `@supabase/supabase-js@v2` — no new client needed. `stripe@20.4.1` is
server-only in `api/stripe/`; `@stripe/stripe-js@8.11.0` is client-only for Elements.
`web-push@3.6.7` is Node-only (serverless functions). All Phase 2 packages extend the
MVP stack without conflicts.

**Pattern Consistency:** Auth patterns (`useAuth`, `<AuthRequired>`) correctly match
the React context decision. Subscription gating (`useSubscription`, `<PremiumGate>`)
routes through TanStack Query and JWT claims consistently. Photo upload signed-URL
pattern is consistent with the security decision never to expose the service role key
client-side. Spot submission routing through `spot_submissions` (not direct `pins`
insert) is consistent throughout API and pattern sections.

**Structure Alignment:** Directory structure directly implements all architectural
decisions. `src/contexts/` holds auth state (not Zustand). `api/stripe/` is isolated.
`src/features/trips/` is PremiumGate-wrapped. Supabase migrations 005-011 map 1:1
to the 7 new tables.

### Requirements Coverage Validation

| Phase 2 Feature | Architectural Support | Status |
|---|---|---|
| User accounts + cloud sync | Supabase Auth + profiles + migration.ts | covered |
| Premium subscription | Stripe + subscription_status + JWT claims | covered |
| Offline PWA | vite-plugin-pwa + src/sw.ts + Workbox strategies | covered |
| Route corridor planning | trips/trip_stops tables + src/features/trips/ | covered |
| Push notifications | web-push + api/push/ + SW push event handler | covered |
| Photo uploads | Supabase Storage + api/photos/ + photoUpload.ts | covered |
| Crowd-sourced spots | spot_submissions + api/spots/ + moderation queue | covered |
| Expanded admin UI | SubmissionsQueue.tsx + api/admin/submissions/ | covered |
| US expansion + PostGIS | Migration 005 + spatial GIST index | covered |
| Anonymous coexistence | AuthContext + localStorage fallback preserved | covered |
| Offline check-in queue | pendingCheckins localStorage + online event flush | covered |

**NFR Coverage:**
- Subscription server-authoritative: JWT claims + Stripe webhooks as source of truth
- Photo constraints: 5MB + type validation in api/photos/upload-url.ts
- Push best-effort: no product feature depends on push delivery
- Spatial scaling: PostGIS GIST index on pins.location

### Row Level Security (RLS) Policies

RLS must be enabled on all new per-user tables before any client reads/writes.
These SQL statements belong in the same migration files as their tables, or in a
dedicated `012_rls_policies.sql` migration.

```sql
-- profiles: users can only read/update their own row
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_profile" ON profiles
  FOR ALL USING (auth.uid() = id);

-- saved_spots: users can only access their own saved spots
ALTER TABLE saved_spots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_saved_spots" ON saved_spots
  FOR ALL USING (auth.uid() = user_id);

-- push_subscriptions: users can only access their own subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_push_subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- trips: users can only access their own trips
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_trips" ON trips
  FOR ALL USING (auth.uid() = user_id);

-- trip_stops: accessible via trip ownership
ALTER TABLE trip_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_trip_stops" ON trip_stops
  FOR ALL USING (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_stops.trip_id AND trips.user_id = auth.uid())
  );

-- spot_submissions: anyone can insert (anonymous); only service_role manages rows
ALTER TABLE spot_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_can_submit_spots" ON spot_submissions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "service_role_manages_submissions" ON spot_submissions
  FOR ALL USING (auth.role() = 'service_role');

-- pin_photos: authenticated users insert their own; public can read
ALTER TABLE pin_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_users_insert_photos" ON pin_photos
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "public_read_photos" ON pin_photos
  FOR SELECT USING (true);
```

**Rule: All admin serverless functions use the Supabase service role key** —
the service role key bypasses RLS, which is why it must never be exposed client-side
and must only be used in `/api/` server functions.

### Gap Analysis Results

**Critical Violations:** None.

**Important Gaps (resolved):**
1. `api/auth/migrate.ts` — added to directory structure above
2. RLS policies — documented in this section; agents must include in migrations
3. `src/api/auth.ts` client wrapper — added to directory structure above

**Minor Gaps (resolved):**
4. VAPID key generation — one-time command documented above

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Phase 2 scope thoroughly analyzed (8 feature areas)
- [x] Complexity assessed (Medium-High, 6-7 new components)
- [x] Technical constraints identified (stack continuity, Supabase Pro, solo founder)
- [x] Cross-cutting concerns mapped (5 new concerns)

**Architectural Decisions**
- [x] All new packages with verified versions
- [x] Auth strategy (Supabase Auth, email+password, React context)
- [x] Subscription strategy (Stripe, JWT claims, webhook-authoritative)
- [x] 14 new API endpoints named and specified
- [x] 7 new DB tables with SQL DDL
- [x] RLS policies for all per-user tables
- [x] Implementation sequence documented (10 steps)

**Implementation Patterns**
- [x] 7 new conflict areas documented with rules and examples
- [x] All patterns have good/anti-pattern code examples
- [x] Enforcement guidelines documented

**Project Structure**
- [x] Complete directory delta defined
- [x] Architectural boundaries documented for all new surfaces
- [x] Requirements-to-structure mapping complete
- [x] Integration point data flows documented

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**

**Confidence Level: High** — all critical decisions are made, all Phase 2 features
have architectural homes, and the security model (Auth, Stripe webhook verification,
signed upload URLs, RLS policies, spot moderation pipeline) is sound.

**Key Strengths:**
- Clean anonymous/authenticated coexistence — MVP users are never broken by Phase 2
- Stripe webhook is the single source of truth for subscription status — no client forgery possible
- Spot submission pipeline is fully isolated from pins table — bad data cannot auto-publish
- RLS + service role key separation = defense in depth on all per-user data
- vite-plugin-pwa path was pre-planned in MVP architecture — zero stack changes needed

**Areas for Future Enhancement (Phase 3):**
- Supabase Realtime for live badge updates (replace TanStack Query polling)
- Native iOS/Android apps (React Native, Expo)
- Multi-stop trip planning with route optimization
- International expansion (Canada, Mexico snowbird corridors)

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all MVP architecture.md patterns — they remain in force for Phase 2
- Access auth state only via `useAuth()` — never direct supabase.auth calls
- Gate premium UI only via `<PremiumGate>` — never inline isPremium checks
- Use Stripe Elements for payment UI — never handle raw card data
- Enable RLS on every new table — include RLS policies in the same migration
- Route spot submissions through spot_submissions table — never insert into pins directly
- Use raw body + stripe.webhooks.constructEvent in all Stripe webhook handlers

**First Phase 2 Implementation Story should:**
```bash
# Install Phase 2 packages
npm i vite-plugin-pwa@^1.2.0 @stripe/stripe-js@^8.11.0 @stripe/react-stripe-js
npm i stripe@^20.4.1 web-push@^3.6.7
npm i -D @types/web-push

# Generate VAPID keys (one-time)
npx web-push generate-vapid-keys

# Run PostGIS + new table migrations
supabase db push
```
