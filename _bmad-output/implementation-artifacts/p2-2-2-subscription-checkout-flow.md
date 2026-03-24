# Story 2.2: Premium Subscription Checkout

Status: review

## Story

As a **free user**,
I want to subscribe to Overnighter Premium with a 30-day free trial,
so that I can unlock offline maps and other premium features.

## Acceptance Criteria

**AC1 — PremiumGate CTA initiates Stripe Checkout**
Given a signed-in free user taps any `<PremiumGate>` upsell CTA
When they are redirected to Stripe Checkout
Then the Stripe-hosted checkout page shows the annual plan ($19.99/year) with 30-day trial
And Apple Pay / Google Pay appear as primary payment options where available.

**AC2 — Successful payment updates subscription and shows welcome**
Given the user completes payment on the Stripe checkout page
When `checkout.session.completed` webhook fires
Then `profiles.subscription_status` is updated to `'trialing'` or `'premium'`
And the Supabase JWT custom claim `subscription_status` is refreshed
And the user is redirected to `/premium-welcome` showing confirmation.

**AC3 — Cancelled checkout preserves free status**
Given the user cancels the Stripe checkout
When they are returned to the app
Then their subscription status remains `'free'` and the PremiumGate upsell is shown.

## Tasks / Subtasks

- [x] Task 1: Create the `/premium-welcome` route and page component (AC: 2)
  - [x] 1.1 Create `src/features/subscription/PremiumWelcomeScreen.tsx` that reads the `session_id` query parameter from the Stripe success redirect URL (`/premium-welcome?session_id={CHECKOUT_SESSION_ID}`).
  - [x] 1.2 On mount, trigger a session token refresh (`supabase.auth.refreshSession()`) so `useSubscription()` picks up the webhook-updated `subscription_status` claim without waiting for the next `refetchOnWindowFocus`.
  - [x] 1.3 Show a celebration/confirmation UI: heading "You're now an Overnighter Premium member", a summary of unlocked features (offline maps, etc.), and a CTA to navigate to the feature the user was trying to access (or fallback to map).
  - [x] 1.4 Handle the edge case where the user lands on `/premium-welcome` but the webhook hasn't processed yet — show a brief loading/polling state that re-checks subscription status (up to ~5 seconds with 1-second intervals), then either confirms or shows "Payment processing — check back shortly."
  - [x] 1.5 Add the `/premium-welcome` route to the app router wrapped with `<AuthRequired>`.

- [x] Task 2: Wire the end-to-end checkout redirect flow in `PremiumGate` (AC: 1, 3)
  - [x] 2.1 Verify the existing `PremiumGate.handleUpgrade()` already calls `POST /api/stripe/checkout` and redirects via `window.location.href = data.url`. Confirm error handling shows user-facing feedback if the checkout session creation fails (not just `console.error`).
  - [x] 2.2 Add user-visible error state to `PremiumGate` — if the checkout API call fails, show a brief inline error message (e.g., "Something went wrong. Please try again.") instead of silently logging. Use the existing inline alert/status pattern from the repo.
  - [x] 2.3 Verify the cancel URL in `api/stripe/checkout.ts` returns to `${origin}/` so that cancelled users land back on the map with the PremiumGate still visible.

- [x] Task 3: Subscription state refresh after Stripe redirect (AC: 2, 3)
  - [x] 3.1 In `PremiumWelcomeScreen`, call `supabase.auth.refreshSession()` on mount to force a JWT refresh that picks up the `subscription_status` custom claim set by the webhook handler in `api/stripe/webhook.ts`.
  - [x] 3.2 Invalidate the `['subscription', userId]` TanStack Query cache key after session refresh so `useSubscription()` re-fetches from the `profiles` table.
  - [x] 3.3 Verify that after the session refresh completes, `useSubscription()` returns `isPremium: true` (or `isTrial: true` for trial starts), and any `<PremiumGate>` on the page renders children instead of the upsell card.

- [x] Task 4: Add tests for the checkout flow (AC: 1, 2, 3)
  - [x] 4.1 Create `src/features/subscription/PremiumWelcomeScreen.test.tsx` covering: successful welcome render with premium status, loading/polling when webhook hasn't processed yet, timeout fallback message, and redirect CTA navigation.
  - [x] 4.2 Extend `src/components/PremiumGate.test.tsx` to cover: error state when checkout API fails (verify inline error message renders), redirecting state UI while checkout session is being created.
  - [x] 4.3 Add or verify integration coverage for the cancel flow: user returns from Stripe without completing → subscription status unchanged → PremiumGate upsell still visible.
  - [x] 4.4 Run `npm run test`, `npm run typecheck:api`, and `npm run lint` before moving the story to review.

## Dev Notes

### Context Summary

- Sprint tracking shows `p2-2-2-subscription-checkout-flow` as the next backlog story in Phase 2 Epic 2 (Premium Subscription).
- Story 2.1 (Stripe Infrastructure) built ALL Stripe server endpoints (`checkout.ts`, `webhook.ts`, `portal.ts`), the `useSubscription()` hook, the `PremiumGate` component, and the `getStripe()` client utility. This story focuses on the **end-to-end checkout user experience** — creating the welcome page, polishing error handling, and wiring the redirect flow.
- The `/premium-welcome` route and page component do not yet exist.

### Current Repository Reality

**Stripe Infrastructure Already Exists (from Story 2.1):**
- `api/stripe/checkout.ts` — creates Stripe checkout session with 30-day trial, returns `{ url }`. Success URL: `${origin}/premium-welcome?session_id={CHECKOUT_SESSION_ID}`. Cancel URL: `${origin}/`.
- `api/stripe/webhook.ts` — handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Updates `profiles.subscription_status` and refreshes JWT custom claims via `supabase.auth.admin.updateUserById()`.
- `api/stripe/portal.ts` — creates Stripe Customer Portal session for subscription management.
- `src/hooks/useSubscription.ts` — returns `{ isPremium, isTrial, status, isLoading }`. Uses TanStack Query with key `['subscription', userId]` and `refetchOnWindowFocus: true`. Reads from `profiles.subscription_status`.
- `src/components/PremiumGate.tsx` — renders children if premium, amber upsell card if free. `handleUpgrade()` already calls `POST /api/stripe/checkout` and does `window.location.href = data.url`. For unauthenticated users, navigates to `/account`.
- `src/lib/stripe.ts` — `getStripe()` singleton for loading Stripe.js publishable key.
- `src/components/PremiumGate.test.tsx` and `src/hooks/useSubscription.test.ts` — existing test suites.

**Database Schema (from migration `022_create_phase2_foundation_tables.sql`):**
```sql
profiles (
  id UUID PK,
  subscription_status TEXT DEFAULT 'free' CHECK IN ('free','trialing','premium','expired'),
  stripe_customer_id TEXT,
  ...
)
```

**Auth Patterns:**
- `useAuth()` from `src/contexts/AuthContext.tsx` — provides `{ session, isAuthenticated }`.
- `<AuthRequired>` at `src/components/AuthRequired.tsx` — redirects to `/account` if not authenticated.
- Auth state accessed ONLY through `useAuth()` — never direct `supabase.auth` calls from components. Exception: `supabase.auth.refreshSession()` for explicit token refresh on the welcome page is acceptable.

**Routing (React Router):**
- Routes defined in `src/App.tsx`.
- Pattern: `<Route path="/premium-welcome" element={<AuthRequired><PremiumWelcomeScreen /></AuthRequired>} />`.

### Previous Story Intelligence (p2-2-1-stripe-infrastructure)

- All 625 tests passed at completion.
- The `PremiumGate` component currently logs checkout errors to console but does **not** show user-facing error feedback — this story must fix that.
- `useSubscription` returns `isPremium: true` for both `'premium'` AND `'trialing'` statuses. This means trial users also pass the gate.
- The checkout endpoint already creates the Stripe customer on first checkout if `stripe_customer_id` is null, so the PremiumGate flow handles both first-time and returning customers.
- Vercel Hobby 12-function limit is a constraint — do NOT add new API endpoints in this story. All 3 Stripe endpoints already exist.
- Commit `712889a` removed a redundant admin/auth endpoint to stay within the limit.

### Architecture Guardrails (Must Follow)

- **PremiumGate is the ONLY way to gate features.** Never use inline `{isPremium && ...}` conditionals. [Source: architecture-phase2.md — Premium Feature Gates]
- **Premium status is NEVER derived from client-side state alone.** Client `isPremium` is for UI rendering only. Server endpoints verify JWT claim `subscription_status === 'premium'` independently. [Source: architecture-phase2.md — JWT Custom Claims]
- **No custom payment form.** Stripe-hosted checkout is a trust-driven design decision. Do not embed Stripe Elements or handle raw card data. [Source: ux-design-phase2-specification.md — Trust Patterns]
- **ALL subscription management goes through `/api/stripe/` endpoints.** Never call Stripe SDK directly from client-side code. [Source: architecture-phase2.md — Stripe Integration]
- **Route protection** uses `<AuthRequired>` wrapper — never inline redirect logic. [Source: architecture-phase2.md — Auth Patterns]
- Access auth state ONLY through `useAuth()` — never direct `supabase.auth` calls from components (refresh on welcome page is the one acceptable exception). [Source: architecture-phase2.md — Auth Patterns]

### UX Requirements Relevant To This Story

- **PremiumGate upsell card:** Amber inline card (not modal), shows feature name + description + "$19.99/year" + "Unlock with Premium" CTA + "Cancel anytime". Card replaces feature content inline (no dismiss). [Source: ux-design-phase2-specification.md — PremiumGate]
- **Checkout should take <60 seconds** from "upgrade" tap to confirmed subscription. [Source: ux-design-phase2-specification.md — Success Metrics]
- **Premium welcome:** User lands on `/premium-welcome` after successful checkout. Shows confirmation heading, unlocked features summary, and amber badge indicator. [Source: ux-design-phase2-specification.md — Journey 2]
- **Cancel returns to app** with PremiumGate still shown; no partial charge. [Source: ux-design-phase2-specification.md — Cancel/Return Behavior]
- **Design tokens:** `premium-amber` (#F59E0B) for gates, badges, CTAs. Premium prompts use `text-amber-400 font-semibold`. [Source: ux-design-phase2-specification.md — Color Tokens]

### Implementation Notes For The Dev Agent

- **Do NOT create new API endpoints.** All three Stripe endpoints already exist from Story 2.1. This story is purely client-side: a new page component + error handling polish + session refresh.
- The `PremiumWelcomeScreen` should follow the existing feature folder pattern: `src/features/subscription/PremiumWelcomeScreen.tsx`. If the `src/features/subscription/` directory doesn't exist yet, create it.
- For the webhook processing delay on the welcome page: the Stripe webhook typically fires within seconds, but there can be a race where the user's browser redirects before the webhook processes. Handle this with a short polling loop (up to ~5 seconds) that calls `supabase.auth.refreshSession()` and checks `useSubscription().isPremium`.
- The existing `useSubscription` hook has `refetchOnWindowFocus: true`, but after a redirect from Stripe the focus event may not fire reliably. Explicitly invalidate the query cache and refresh the session on mount of the welcome page.
- Use `useSearchParams()` from React Router to read `session_id` from the URL. The `session_id` is informational — do NOT use it to verify payment on the client. Payment verification is done server-side by the webhook.
- For the error state in `PremiumGate`, keep it lightweight — a small `text-red-400` message below the CTA button that auto-clears after a few seconds or on retry. Match the existing inline error patterns in the repo (e.g., from `AccountScreen`).
- The cancel URL is already set to `${origin}/` in `api/stripe/checkout.ts`. Verify this works correctly — user should land on the root map view where any previously attempted PremiumGate feature still shows the upsell.

### Testing Requirements

- Minimum validation commands:
  - `npm run test`
  - `npm run typecheck:api`
  - `npm run lint`
- Test coverage for this story:
  - `PremiumWelcomeScreen`: render with premium status, loading/polling state, timeout fallback, CTA navigation
  - `PremiumGate`: error state on checkout failure, redirecting state
  - Cancel flow: verify status unchanged
- Mock `supabase.auth.refreshSession()` in tests to simulate JWT refresh.
- Mock `useSubscription()` return values for different states.
- Use `@testing-library/react` + `vitest` per existing patterns.

### Project Structure Notes

- New file: `src/features/subscription/PremiumWelcomeScreen.tsx`
- New file: `src/features/subscription/PremiumWelcomeScreen.test.tsx`
- Modified: `src/App.tsx` — add `/premium-welcome` route
- Modified: `src/components/PremiumGate.tsx` — add inline error state for checkout failures
- Modified: `src/components/PremiumGate.test.tsx` — extend with error state tests
- No new API endpoints (Vercel Hobby 12-function limit).
- No new npm packages required.

### References

- Source: `_bmad-output/planning-artifacts/epics-phase2.md` — Epic 2: Premium Subscription, Story 2.2: Premium Subscription Checkout
- Source: `_bmad-output/planning-artifacts/architecture-phase2.md` — Stripe Integration, JWT Custom Claims, Premium Feature Gates, Auth Patterns
- Source: `_bmad-output/planning-artifacts/ux-design-phase2-specification.md` — Journey 2 (Free → Premium), PremiumGate specs, Premium Welcome, Trust Patterns, Color Tokens
- Source: `_bmad-output/implementation-artifacts/p2-2-1-stripe-infrastructure.md` — Previous story context, file list, completion notes
- Source: `api/stripe/checkout.ts` — Checkout session creation, success/cancel URLs
- Source: `api/stripe/webhook.ts` — Event handling, profile + JWT update
- Source: `src/hooks/useSubscription.ts` — TanStack Query key, isPremium logic
- Source: `src/components/PremiumGate.tsx` — Current handleUpgrade implementation, missing error state
- Source: `src/lib/stripe.ts` — getStripe() singleton
- Source: `src/App.tsx` — Route definitions
- Source: `supabase/migrations/022_create_phase2_foundation_tables.sql` — profiles schema

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- All 4 tasks completed. 675 tests passing across 64 test files (was 660/63).
- PremiumWelcomeScreen implements 3-state flow: polling → confirmed / pending.
- Polling uses direct Supabase profile query (up to 5 attempts, 1s interval) plus session refresh + query cache invalidation.
- PremiumGate catch block now sets user-visible error (was only console.error).
- Cancel URL verified: `${origin}/` returns user to map with PremiumGate upsell still visible.
- No new API endpoints added (stays within Vercel Hobby 12-function limit).
- Lint clean, typecheck:api clean, all tests green.

### Change Log

- 2026-03-24: Implemented story end-to-end — welcome page, error handling, route, tests.

### File List

- `src/features/subscription/PremiumWelcomeScreen.tsx` — NEW: Premium welcome page with polling/confirmation/pending states
- `src/features/subscription/PremiumWelcomeScreen.test.tsx` — NEW: 10 tests covering all welcome screen states
- `src/components/PremiumGate.tsx` — MODIFIED: Added `setCheckoutError` in catch block for network errors
- `src/components/PremiumGate.test.tsx` — MODIFIED: Added 5 tests for error state, redirecting state, retry clearing, cancel flow
- `src/App.tsx` — MODIFIED: Added `/premium-welcome` route with AuthRequired + lazy loading
