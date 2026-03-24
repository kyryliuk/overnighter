# Story 2.1: Stripe Infrastructure & Subscription State

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer**,
I want Stripe configured and subscription status wired into the JWT and UI,
So that all premium-gated features have a reliable foundation.

## Acceptance Criteria

**AC1 - Stripe serverless endpoint functions exist and are secured**
Given the Stripe product and annual price are configured in the Stripe dashboard
When the infrastructure story is implemented
Then `POST /api/stripe/checkout`, `POST /api/stripe/webhook`, `POST /api/stripe/portal` serverless functions exist
And the Stripe webhook verifies `stripe-signature` before processing any event
And each JWT-gated endpoint uses the existing `requireUserAuth()` from `api/_auth.ts`.

**AC2 - useSubscription hook provides subscription state to the UI**
Given a signed-in user has a profile row in `profiles`
When any component calls `useSubscription()`
Then the hook returns `{ isPremium, isTrial, status, isLoading }` derived from the user's `profiles.subscription_status`
And the hook uses TanStack Query for caching and loading states
And the hook re-fetches on window focus to pick up webhook-driven status changes.

**AC3 - PremiumGate component gates premium features**
Given a `<PremiumGate>` wraps premium content
When a free user views the gated area
Then an amber inline upsell card replaces the children with feature name, one-line description, price ($19.99/year), "Unlock with Premium" CTA, and "Cancel anytime" notice
And when a premium/trialing user views the same area, the children render normally.

**AC4 - AuthRequired route wrapper redirects unauthenticated users**
Given `<AuthRequired>` wraps a route element
When an unauthenticated user navigates to that route
Then they are redirected to `/account`
And authenticated users see the route content normally.

## Tasks / Subtasks

- [x] Task 1: Install Stripe dependencies and configure environment (AC: 1)
  - [x] 1.1 Verify `stripe` (20.4.1), `@stripe/stripe-js` (8.11.0), and `@stripe/react-stripe-js` are already in `package.json` — do NOT reinstall. If any are missing, add them.
  - [x] 1.2 Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_ANNUAL`, and `VITE_STRIPE_PUBLISHABLE_KEY` to `.env.example` with descriptive comments. Do NOT commit actual secret values.
  - [x] 1.3 Create `src/lib/stripe.ts` exporting a lazy-loaded `getStripe()` helper that calls `loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)` once and caches the promise. Follow the same singleton pattern used by `src/lib/supabase/client.ts`.

- [x] Task 2: Create `POST /api/stripe/checkout` endpoint (AC: 1)
  - [x] 2.1 Create `api/stripe/checkout.ts` as a POST-only Vercel serverless handler following the existing `api/spot-submissions.ts` pattern (method guard → auth → logic → response).
  - [x] 2.2 Use `requireUserAuth(req, res)` from `api/_auth.ts` to authenticate the caller. Extract `user.id` from the returned user.
  - [x] 2.3 Import `stripe` (server SDK) and initialize with `STRIPE_SECRET_KEY`. Create or retrieve a Stripe Customer using the user's email, storing the `stripe_customer_id` in `profiles` via Supabase service client if it doesn't exist yet.
  - [x] 2.4 Create a Stripe Checkout Session with: `mode: 'subscription'`, `line_items: [{ price: STRIPE_PRICE_ID_ANNUAL, quantity: 1 }]`, `subscription_data: { trial_period_days: 30 }`, `success_url` pointing to `/premium-welcome?session_id={CHECKOUT_SESSION_ID}`, `cancel_url` pointing to the app root, `customer` set to the Stripe customer ID.
  - [x] 2.5 Return `{ url: session.url }` as JSON (200). The client will redirect to this URL.
  - [x] 2.6 Add `api/stripe/checkout.test.ts` covering: 405 for non-POST, 401 for unauthenticated, successful session creation (mock Stripe SDK), and Stripe API error handling.

- [x] Task 3: Create `POST /api/stripe/webhook` endpoint (AC: 1)
  - [x] 3.1 Create `api/stripe/webhook.ts` following the Vercel raw body pattern. Export `export const config = { api: { bodyParser: false } }` so the raw body is available for signature verification.
  - [x] 3.2 Read the raw request body from the stream. Verify the webhook signature using `stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET)`. Return 400 if verification fails.
  - [x] 3.3 Handle `checkout.session.completed`: extract `customer` and `subscription` from the event. Determine if trial is active. Update `profiles.subscription_status` to `'trialing'` or `'premium'` where `stripe_customer_id` matches. If `stripe_customer_id` is not yet set, look up the profile by the customer's email.
  - [x] 3.4 Handle `customer.subscription.updated`: sync the subscription status from the Stripe subscription object's `status` field to the `profiles` table. Map Stripe statuses: `trialing` → `'trialing'`, `active` → `'premium'`, `canceled`/`past_due`/`unpaid` → `'expired'`.
  - [x] 3.5 Handle `customer.subscription.deleted`: set `profiles.subscription_status = 'expired'` for the matching `stripe_customer_id`.
  - [x] 3.6 Handle `invoice.payment_failed`: set `profiles.subscription_status = 'expired'` for the matching `stripe_customer_id`.
  - [x] 3.7 After updating `profiles.subscription_status`, refresh the user's JWT custom claims by calling the Supabase Admin API: `supabase.auth.admin.updateUserById(userId, { app_metadata: { subscription_status } })`. This ensures `useSubscription()` picks up the change on next token refresh.
  - [x] 3.8 Return 200 for all handled events, 200 for unhandled event types (Stripe expects 2xx). Log unhandled event types at `console.info` level.
  - [x] 3.9 Add `api/stripe/webhook.test.ts` covering: missing signature → 400, invalid signature → 400, each handled event type updates profiles correctly, JWT claim refresh is called, and unhandled event types return 200.

- [x] Task 4: Create `POST /api/stripe/portal` endpoint (AC: 1)
  - [x] 4.1 Create `api/stripe/portal.ts` as a POST-only handler using `requireUserAuth()`.
  - [x] 4.2 Look up the user's `stripe_customer_id` from `profiles`. If not found, return 400 with `{ error: 'No subscription found' }`.
  - [x] 4.3 Create a Stripe Billing Portal session with `customer` and `return_url` pointing to the app's account page.
  - [x] 4.4 Return `{ url: session.url }` as JSON (200).
  - [x] 4.5 Add `api/stripe/portal.test.ts` covering: 405 for non-POST, 401 for unauthenticated, 400 for no stripe_customer_id, and successful portal session creation.

- [x] Task 5: Create `useSubscription` hook (AC: 2)
  - [x] 5.1 Create `src/hooks/useSubscription.ts`. Use TanStack Query (`useQuery`) to fetch the authenticated user's `profiles.subscription_status` from Supabase via the existing client: `supabase.from('profiles').select('subscription_status').eq('id', user.id).single()`.
  - [x] 5.2 Derive and return `{ isPremium: status === 'premium' || status === 'trialing', isTrial: status === 'trialing', status, isLoading }`.
  - [x] 5.3 Set query key to `['subscription', userId]`. Enable `refetchOnWindowFocus: true` so that webhook-driven status changes are picked up when the user returns from Stripe Checkout or portal.
  - [x] 5.4 If user is not authenticated (no session), return `{ isPremium: false, isTrial: false, status: 'free', isLoading: false }` without firing a query.
  - [x] 5.5 Add `src/hooks/useSubscription.test.ts` covering: unauthenticated returns free defaults, authenticated free user, authenticated premium user, authenticated trialing user, loading state, and window focus refetch behavior.

- [x] Task 6: Create `<PremiumGate>` component (AC: 3)
  - [x] 6.1 Create `src/components/PremiumGate.tsx`. Accept props: `children: ReactNode`, `feature: string` (feature name for upsell copy), `description?: string` (one-line feature description).
  - [x] 6.2 Use `useSubscription()` to check premium status. If `isPremium`, render `children`. If `isLoading`, render a subtle skeleton placeholder.
  - [x] 6.3 If not premium, render an amber inline card (not a modal) with: feature name, description, price "$19.99/year", "Unlock with Premium" CTA button, and "Cancel anytime" sub-text. Use `premium-amber` (#F59E0B) as the accent color via Tailwind classes like `text-amber-400`, `border-amber-500/30`, `bg-amber-500/10`.
  - [x] 6.4 The CTA button should check if the user is authenticated. If not, navigate to `/account`. If authenticated, call `POST /api/stripe/checkout` and redirect to the returned URL.
  - [x] 6.5 Add `src/components/PremiumGate.test.tsx` covering: renders children when premium, renders upsell card when free, shows loading skeleton, CTA navigates to account when unauthenticated, CTA calls checkout API when authenticated.

- [x] Task 7: Create `<AuthRequired>` route wrapper (AC: 4)
  - [x] 7.1 Create `src/components/AuthRequired.tsx`. Use `useAuth()` from `src/features/account/AuthContext.ts` to check if user is authenticated.
  - [x] 7.2 If not authenticated, render `<Navigate to="/account" replace />`. If authenticated, render `children`.
  - [x] 7.3 Handle the loading state from `useAuth()` — show nothing (or a spinner) while auth state is initializing to prevent flash of redirect.
  - [x] 7.4 Add `src/components/AuthRequired.test.tsx` covering: redirects when unauthenticated, renders children when authenticated, handles loading state.

- [x] Task 8: Validate and run test suite (AC: 1, 2, 3, 4)
  - [x] 8.1 Run `npm run typecheck` and `npm run typecheck:api` — fix any type errors.
  - [x] 8.2 Run `npm run lint` — fix any lint errors.
  - [x] 8.3 Run `npm run test` — all existing tests must pass plus new tests.
  - [x] 8.4 Verify that anonymous user browsing (map, saved spots, rig profile) is completely unaffected by the new code — no imports or side effects should touch the anonymous path.

## Dev Notes

### Context Summary

- This is the first story in Phase 2 Epic 2 (Premium Subscription). It establishes the entire Stripe payment infrastructure that Stories 2.2–2.4 build upon.
- The `profiles` table already has `subscription_status` (TEXT, default `'free'`, CHECK constraint for `free/trialing/premium/expired`) and `stripe_customer_id` (TEXT, nullable) columns — created in migration `022_create_phase2_foundation_tables.sql`. No schema changes needed.
- Stripe packages are already installed: `stripe` (20.4.1), `@stripe/stripe-js` (8.11.0), `@stripe/react-stripe-js` (^5.6.1). No new `npm install` needed.
- The `api/_auth.ts` helper (`requireUserAuth`) is already established and used by `api/auth/migrate.ts`, `api/spot-submissions.ts`, etc. Reuse it for all JWT-gated Stripe endpoints.
- The `api/_supabase.ts` helper (`createServiceClient`) provides a Supabase admin client for server-side operations. Use it in webhook handler for profile updates and JWT claim refresh.
- Auth state is accessed via `useAuth()` from `src/features/account/AuthContext.ts` — never call `supabase.auth` directly.
- The Vercel Hobby plan has a 12-function limit. Current function count is near the limit (the admin/auth endpoint was removed in commit `712889a` to stay under). Plan the 3 new `api/stripe/` files carefully — they count toward this limit. Verify total function count before finalizing.

### Current Repository Reality

- `api/` directory has: `_auth.ts`, `_middleware.ts`, `_normalize.ts`, `_supabase.ts`, `_spot-submissions.ts`, `checkin.ts`, `overpass.ts`, `report.ts`, `spot-submissions.ts`, `sync-gov.ts`, plus `admin/` and `auth/` subdirectories.
- `src/features/account/AuthProvider.tsx` (393 lines) manages auth state, session, cloud sync, visibility-triggered refetch. Do NOT modify this file in this story.
- `src/features/account/AuthContext.ts` (33 lines) exports `AuthContextValue` type, `AuthContext`, and `useAuth()` hook. The context value includes: `session`, `isLoading`, `isAuthenticated`, `isSigningIn`, `isSigningUp`, `isSyncing`, `syncError`, `lastSyncedAt`, `signIn()`, `signUp()`, `signOut()`.
- `src/hooks/` exists and contains existing hooks. Place `useSubscription.ts` here.
- `src/components/` exists and contains shared components. Place `PremiumGate.tsx` and `AuthRequired.tsx` here.
- No `api/stripe/` directory exists yet — create it.
- No `src/hooks/useSubscription.ts` exists yet — create it.
- No `src/components/PremiumGate.tsx` or `AuthRequired.tsx` exist yet — create them.

### Previous Story Intelligence

- Story `p2-1-5-cross-device-cloud-sync` (last completed):
  - Established visibility-triggered refetch pattern in AuthProvider — `useSubscription` should similarly use `refetchOnWindowFocus` for freshness.
  - All 625 tests passing at completion.
  - Key pattern: `applyingRemoteStateRef` to prevent sync loops — not relevant to this story but shows the codebase uses refs for gating.
- Story `p2-1-4-localstorage-data-migration`:
  - Established `POST /api/auth/migrate` endpoint pattern — follow same file structure, method guard, auth, zod validation, service client usage.
  - Established test pattern: mock Supabase service client, test 405/401/success/failure cases.
- Key lessons from Phase 2 Epic 1:
  - Always use `useAuth()` — never call `supabase.auth` directly from components.
  - Keep auth orchestration in `AuthProvider` — don't scatter auth logic.
  - The `requireUserAuth()` helper in `api/_auth.ts` is the standard pattern for server-side auth.
  - Test files co-located with implementation (e.g., `api/stripe/checkout.test.ts` next to `api/stripe/checkout.ts`).

### Architecture Guardrails (Must Follow)

- **Never call `supabase.auth` directly** in components or stores — use `useAuth()`. [Source: architecture-phase2.md — Auth Patterns]
- **Never check subscription status by querying `profiles` table directly in components** — use `useSubscription()` hook. [Source: architecture-phase2.md — Subscription / Feature Gating Patterns]
- **All premium-gated UI uses `<PremiumGate>`** — never conditional rendering inline like `{isPremium && <Feature />}`. [Source: architecture-phase2.md — Subscription / Feature Gating Patterns]
- **Route protection uses `<AuthRequired>` wrapper** — never inline redirect logic. [Source: architecture-phase2.md — Auth Patterns]
- **Stripe webhook must verify `stripe-signature`** before processing any event — use `stripe.webhooks.constructEvent()`. [Source: architecture-phase2.md — Stripe Webhook Security]
- **JWT custom claims carry `subscription_status`** — updated via Supabase Admin API in webhook handler. No extra DB round-trip in serverless functions. [Source: architecture-phase2.md — Feature Gating]
- **Subscription state source of truth is Stripe** (webhooks are authoritative). Stored in `profiles.subscription_status`. Client reads via TanStack Query. [Source: architecture-phase2.md — Subscription State]
- **Auth/anonymous coexistence is critical** — anonymous users must browse map and use local storage without triggering cloud sync, login walls, or subscription checks. [Source: architecture-phase2.md — Critical complexity]
- **Vercel Hobby 12-function limit** — the 3 new `api/stripe/` files count toward this limit. Verify total after creating. [Source: commit 712889a]

### UX Requirements

- **PremiumGate is an inline amber card**, not a modal. It replaces the gated content. [Source: ux-design-phase2-specification.md — PremiumGate]
- **Premium amber color**: `#F59E0B` — use for gates, subscription badges, upgrade CTAs. [Source: ux-design-phase2-specification.md — Color system]
- **PremiumGate card content**: feature name, one-line description, price ($19.99/year), "Unlock with Premium" CTA, "Cancel anytime" sub-text. [Source: epics-phase2.md — Story 2.4 AC]
- **PremiumGate variants**: compact (list) and full-width (section). [Source: ux-design-phase2-specification.md — PremiumGate]
- **Stripe-hosted checkout page** — never a custom payment form. Stripe handles Apple Pay / Google Pay. [Source: ux-design-phase2-specification.md — Trust in Stripe checkout]
- **Checkout flow**: under 60 seconds from "upgrade" tap to confirmed subscription. [Source: ux-design-phase2-specification.md — Performance targets]
- **Free → Premium journey**: tap PremiumGate CTA → check auth → Stripe checkout → webhook updates profile → redirect to `/premium-welcome`. [Source: ux-design-phase2-specification.md — Journey 2]

### Environment Variables

```
STRIPE_SECRET_KEY=              # Server-only — Stripe secret key
STRIPE_WEBHOOK_SECRET=          # Server-only — from Stripe dashboard webhook config
STRIPE_PRICE_ID_ANNUAL=         # Server-only — Stripe price ID for annual plan
VITE_STRIPE_PUBLISHABLE_KEY=    # Client-safe — Stripe publishable key
```

### Stripe Webhook Events to Handle

| Event | Action |
|---|---|
| `checkout.session.completed` | Set `subscription_status` = `'trialing'` or `'premium'` |
| `customer.subscription.updated` | Sync status from Stripe subscription object |
| `customer.subscription.deleted` | Set `subscription_status` = `'expired'` |
| `invoice.payment_failed` | Set `subscription_status` = `'expired'` |

### Testing Requirements

- Minimum required validation:
  - `npm run test`
  - `npm run typecheck` and `npm run typecheck:api`
  - `npm run lint`
- New test files to create:
  - `api/stripe/checkout.test.ts`
  - `api/stripe/webhook.test.ts`
  - `api/stripe/portal.test.ts`
  - `src/hooks/useSubscription.test.ts`
  - `src/components/PremiumGate.test.ts`
  - `src/components/AuthRequired.test.ts`
- Mock Stripe SDK in all API tests. Mock Supabase service client for webhook profile updates.
- Verify anonymous user paths are completely unaffected.

### Project Structure Notes

- New files to create:
  - `api/stripe/checkout.ts` — Checkout session creation endpoint
  - `api/stripe/webhook.ts` — Webhook event handler
  - `api/stripe/portal.ts` — Customer portal session endpoint
  - `src/lib/stripe.ts` — Client-side Stripe.js lazy loader
  - `src/hooks/useSubscription.ts` — Subscription state hook
  - `src/components/PremiumGate.tsx` — Premium feature gate component
  - `src/components/AuthRequired.tsx` — Auth route wrapper component
- Follow existing API patterns in `api/spot-submissions.ts` and `api/auth/migrate.ts`.
- Follow existing hook patterns in `src/hooks/`.
- Follow existing component patterns in `src/components/`.

### References

- Source: `_bmad-output/planning-artifacts/epics-phase2.md` — Epic 2, Story 2.1: Stripe Infrastructure & Subscription State
- Source: `_bmad-output/planning-artifacts/architecture-phase2.md` — Subscription State, Feature Gating, Stripe Webhook Security, Auth Patterns, API Endpoints
- Source: `_bmad-output/planning-artifacts/ux-design-phase2-specification.md` — PremiumGate, Journey 2, Color system, Performance targets
- Source: `_bmad-output/implementation-artifacts/p2-1-5-cross-device-cloud-sync.md` — Previous story patterns
- Source: `_bmad-output/implementation-artifacts/p2-1-4-localstorage-data-migration.md` — API endpoint patterns
- Source: `api/_auth.ts` — requireUserAuth() helper
- Source: `api/_supabase.ts` — createServiceClient() helper
- Source: `src/features/account/AuthContext.ts` — useAuth() hook
- Source: `src/lib/supabase/client.ts` — Supabase client singleton pattern
- Source: `supabase/migrations/022_create_phase2_foundation_tables.sql` — profiles table schema

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- All 8 tasks completed successfully across 4 acceptance criteria
- Stripe packages were already installed (Task 1.1); `.env.example` already had Stripe vars (Task 1.2)
- AuthRequired component already existed per prior story; tests added per AC4
- 660 tests pass (35 new tests added, 0 regressions from baseline 625)
- typecheck:api and lint pass clean
- Anonymous user paths completely unaffected — no new imports touch anonymous flow
- Vercel function count: 3 new serverless functions (checkout, webhook, portal) added to api/stripe/

### File List

- `src/lib/stripe.ts` — Client-side Stripe.js lazy loader (getStripe singleton)
- `api/stripe/checkout.ts` — POST endpoint for creating Stripe Checkout sessions
- `api/stripe/checkout.test.ts` — Tests for checkout endpoint (6 tests)
- `api/stripe/webhook.ts` — POST endpoint for handling Stripe webhook events
- `api/stripe/webhook.test.ts` — Tests for webhook endpoint (12 tests)
- `api/stripe/portal.ts` — POST endpoint for creating Stripe Billing Portal sessions
- `api/stripe/portal.test.ts` — Tests for portal endpoint (5 tests)
- `src/hooks/useSubscription.ts` — TanStack Query hook for subscription state
- `src/hooks/useSubscription.test.ts` — Tests for useSubscription hook (6 tests)
- `src/components/PremiumGate.tsx` — Amber inline upsell gate component
- `src/components/PremiumGate.test.tsx` — Tests for PremiumGate component (6 tests)
- `src/components/AuthRequired.test.tsx` — Tests for existing AuthRequired component (3 tests)
