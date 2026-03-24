# Story 2.3: Subscription Lifecycle Management

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **premium subscriber**,
I want to manage my subscription (view status, cancel, update billing),
so that I have control over my recurring payment.

## Acceptance Criteria

**AC1 — Subscription status visible on Account screen**
Given a signed-in premium user opens the Account screen
When they view their subscription section
Then they see their current status (Premium / Trial — expires [date])
And a "Manage subscription" button is visible.

**AC2 — Manage subscription redirects to Stripe Customer Portal**
Given a premium user taps "Manage subscription"
When `POST /api/stripe/portal` is called
Then they are redirected to the Stripe Customer Portal
And they can cancel, update payment method, or view invoices.

**AC3 — Cancellation via portal expires subscription**
Given a user cancels via the portal and `customer.subscription.deleted` webhook fires
When the webhook is processed
Then `profiles.subscription_status` is set to `'expired'`
And premium features are replaced with PremiumGate upsell cards on next app load.

**AC4 — Payment failure expires subscription**
Given `invoice.payment_failed` webhook fires
When the webhook is processed
Then `profiles.subscription_status` is set to `'expired'`
And the user's JWT claim is refreshed to reflect expired status.

## Tasks / Subtasks

- [x] Task 1: Add subscription status section to AccountScreen (AC: 1)
  - [x] 1.1 In `src/features/account/AccountScreen.tsx`, add a new "Subscription" card section between the existing account header and the rig profile/settings area. The section is only rendered for authenticated users.
  - [x] 1.2 Display the current subscription status using `useSubscription()`:
    - `'premium'` → Show "Overnighter Premium" with an amber badge and a checkmark icon.
    - `'trialing'` → Show "Premium Trial" with amber badge and trial expiry info (read `subscription_period_end` from the profile if available, or show "Trial active").
    - `'expired'` → Show "Subscription Expired" with a muted badge and a "Resubscribe" CTA that triggers the same `POST /api/stripe/checkout` flow as PremiumGate.
    - `'free'` → Show "Free Plan" with a "Upgrade to Premium" CTA that triggers checkout.
  - [x] 1.3 For premium/trialing users, render a "Manage subscription" button (amber outline style using `text-amber-400 border-amber-500/30`) that calls `POST /api/stripe/portal` and redirects to `data.url`.
  - [x] 1.4 Handle loading state from `useSubscription()` with a skeleton placeholder matching the card dimensions.
  - [x] 1.5 Handle the portal redirect error case — show an inline `text-red-400` error message if the portal API call fails (same pattern as PremiumGate checkout error from Story 2.2).

- [x] Task 2: Create SubscriptionStatusCard component (AC: 1, 2)
  - [x] 2.1 Create `src/features/subscription/SubscriptionStatusCard.tsx` as a reusable card component that encapsulates the subscription status display and management actions. Accept props: none (reads from `useSubscription()` internally).
  - [x] 2.2 Implement the status display logic from Task 1.2 inside this component. Use `premium-amber` (#F59E0B) accent colors consistent with PremiumGate: `text-amber-400`, `border-amber-500/30`, `bg-amber-500/10`.
  - [x] 2.3 Implement the "Manage subscription" button that calls `POST /api/stripe/portal` using the existing fetch pattern from PremiumGate's `handleUpgrade()`. On success, redirect via `window.location.href = data.url`. On error, show inline error text.
  - [x] 2.4 Implement the "Upgrade to Premium" / "Resubscribe" CTA for free/expired users that calls `POST /api/stripe/checkout` and redirects to Stripe Checkout (same flow as PremiumGate).
  - [x] 2.5 For unauthenticated users, this component should not render (guard with early return if `!isAuthenticated` from `useAuth()`).

- [x] Task 3: Verify webhook lifecycle handlers (AC: 3, 4)
  - [x] 3.1 Verify that `api/stripe/webhook.ts` correctly handles `customer.subscription.deleted` — sets `profiles.subscription_status = 'expired'` and refreshes JWT claims via `supabase.auth.admin.updateUserById()`. This handler already exists from Story 2.1; confirm it works correctly by reviewing the code and existing tests.
  - [x] 3.2 Verify that `api/stripe/webhook.ts` correctly handles `invoice.payment_failed` — sets status to `'expired'` and refreshes JWT claims. Already implemented in Story 2.1.
  - [x] 3.3 Verify that `api/stripe/webhook.ts` correctly handles `customer.subscription.updated` — maps Stripe statuses (`trialing` → `'trialing'`, `active` → `'premium'`, `canceled`/`past_due`/`unpaid` → `'expired'`). Already implemented in Story 2.1.
  - [x] 3.4 If any webhook handler is incomplete or incorrect, fix it. If all handlers are correct, document this verification in the completion notes.

- [x] Task 4: Verify portal endpoint return URL (AC: 2)
  - [x] 4.1 Review `api/stripe/portal.ts` and verify the `return_url` is set to `${origin}/account` (or equivalent) so users land back on the Account screen after managing their subscription in the Stripe portal.
  - [x] 4.2 If the return URL is not pointing to the account page, update it. The user should return to the Account screen where they can see their updated subscription status via `useSubscription()` + `refetchOnWindowFocus`.

- [x] Task 5: Handle subscription state refresh after portal return (AC: 1, 3, 4)
  - [x] 5.1 When the user returns from the Stripe Customer Portal to `/account`, `useSubscription()` should automatically re-fetch due to `refetchOnWindowFocus: true`. Verify this behavior works correctly.
  - [x] 5.2 If the webhook processes before the user returns (typical case), `useSubscription()` will pick up the new status on focus. If there's a race condition (user returns before webhook processes), the status will update on next window focus or manual page refresh. This is acceptable — do NOT add polling for the portal return flow (unlike the checkout welcome page).

- [x] Task 6: Add tests for subscription lifecycle management (AC: 1, 2, 3, 4)
  - [x] 6.1 Create `src/features/subscription/SubscriptionStatusCard.test.tsx` covering:
    - Renders premium status with amber badge and "Manage subscription" button.
    - Renders trialing status with trial badge and "Manage subscription" button.
    - Renders expired status with "Resubscribe" CTA.
    - Renders free status with "Upgrade to Premium" CTA.
    - Does not render when user is unauthenticated.
    - "Manage subscription" button calls portal API and redirects on success.
    - Portal API error shows inline error message.
    - Loading state shows skeleton.
  - [x] 6.2 Extend `src/features/account/AccountScreen.test.tsx` (or create if needed) to verify the SubscriptionStatusCard is rendered for authenticated users.
  - [x] 6.3 Run `npm run test`, `npm run typecheck:api`, and `npm run lint` before moving the story to review.

## Dev Notes

### Context Summary

- Sprint tracking shows `p2-2-3-subscription-lifecycle-management` as backlog in Phase 2 Epic 2 (Premium Subscription).
- Stories 2.1 and 2.2 built ALL Stripe server-side infrastructure: checkout, webhook, and portal endpoints. This story focuses on the **client-side subscription management experience** — displaying status on the Account screen and wiring the portal redirect.
- The webhook handlers for cancellation (`customer.subscription.deleted`), payment failure (`invoice.payment_failed`), and status sync (`customer.subscription.updated`) are **already implemented** in `api/stripe/webhook.ts` from Story 2.1. This story verifies they work correctly but should NOT rewrite them.
- The portal endpoint (`api/stripe/portal.ts`) is **already implemented** from Story 2.1. This story wires the client-side button to call it and verifies the return URL.

### Current Repository Reality

**Stripe Infrastructure Already Exists (from Story 2.1):**
- `api/stripe/checkout.ts` — creates Stripe checkout session with 30-day trial, returns `{ url }`.
- `api/stripe/webhook.ts` — handles 4 event types: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Updates `profiles.subscription_status` and refreshes JWT custom claims via `supabase.auth.admin.updateUserById()`.
- `api/stripe/portal.ts` — creates Stripe Customer Portal session, returns `{ url }`. Return URL set to `${origin}/account`.
- `src/hooks/useSubscription.ts` — returns `{ isPremium, isTrial, status, isLoading }`. Uses TanStack Query with key `['subscription', userId]` and `refetchOnWindowFocus: true`. Reads from `profiles.subscription_status`.
- `src/components/PremiumGate.tsx` — renders children if premium, amber upsell card if free. `handleUpgrade()` calls `POST /api/stripe/checkout` and redirects. Error state shows inline `text-red-400` message (added in Story 2.2).
- `src/lib/stripe.ts` — `getStripe()` singleton for loading Stripe.js publishable key.

**Checkout Flow (from Story 2.2):**
- `src/features/subscription/PremiumWelcomeScreen.tsx` — welcome page after successful checkout, polls for subscription status update.
- `/premium-welcome` route added to `src/App.tsx` with `<AuthRequired>` wrapper.

**Account Screen (current state):**
- `src/features/account/AccountScreen.tsx` — shows auth state, rig profile summary, saved spots count, trip drafts. Does NOT display subscription status or management actions. This is what Story 2.3 must add.
- The account page is accessed via the Profile tab in the bottom navigation.

**Database Schema (from migration `022_create_phase2_foundation_tables.sql`):**
```sql
profiles (
  id UUID PK,
  subscription_status TEXT DEFAULT 'free' CHECK IN ('free','trialing','premium','expired'),
  stripe_customer_id TEXT,
  ...
)
```

**Webhook Status Mapping (already in `api/stripe/webhook.ts`):**
| Stripe Status | App Status |
|---|---|
| `trialing` | `'trialing'` |
| `active` | `'premium'` |
| `canceled` / `past_due` / `unpaid` | `'expired'` |
| (default) | `'free'` |

**Auth Patterns:**
- `useAuth()` from `src/features/account/AuthContext.ts` — provides `{ session, isAuthenticated, isLoading }`.
- `<AuthRequired>` at `src/components/AuthRequired.tsx` — redirects to `/account` if not authenticated.
- Auth state accessed ONLY through `useAuth()` — never direct `supabase.auth` calls from components.

### Previous Story Intelligence (p2-2-2-subscription-checkout-flow)

- 675 tests passing across 64 test files at completion (was 660/63 before Story 2.2).
- `PremiumGate` now has inline error handling for failed checkout API calls — use the SAME pattern for portal API errors in `SubscriptionStatusCard`.
- `PremiumWelcomeScreen` uses polling for webhook race condition — do NOT replicate this for portal return. `refetchOnWindowFocus` is sufficient for the portal flow.
- No new API endpoints were added in Story 2.2 (stayed within Vercel Hobby 12-function limit).
- Key pattern for redirect: `window.location.href = data.url` after successful API call.

### Previous Story Intelligence (p2-2-1-stripe-infrastructure)

- All 3 Stripe serverless endpoints created and tested (checkout, webhook, portal).
- `useSubscription` returns `isPremium: true` for both `'premium'` AND `'trialing'` statuses.
- Webhook handler updates both `profiles.subscription_status` AND `auth.users.app_metadata.subscription_status` for JWT claim sync.
- Vercel Hobby 12-function limit is a constraint — do NOT add new API endpoints.
- Portal endpoint `return_url` is `${origin}/account`.

### Architecture Guardrails (Must Follow)

- **PremiumGate is the ONLY way to gate features.** Never use inline `{isPremium && ...}` conditionals. The SubscriptionStatusCard displays status info — it does not gate features. [Source: architecture-phase2.md — Premium Feature Gates]
- **Premium status is NEVER derived from client-side state alone.** Server endpoints verify JWT claim `subscription_status` independently. [Source: architecture-phase2.md — JWT Custom Claims]
- **All subscription management goes through `/api/stripe/` endpoints.** Never call Stripe SDK directly from client-side code. [Source: architecture-phase2.md — Stripe Patterns]
- **Access auth state ONLY through `useAuth()`** — never direct `supabase.auth` calls from components. [Source: architecture-phase2.md — Auth Patterns]
- **Never check subscription status by querying `profiles` table directly in components** — use `useSubscription()` hook. [Source: architecture-phase2.md — Subscription / Feature Gating Patterns]
- **No new API endpoints.** All 3 Stripe endpoints exist. Do NOT create new serverless functions (Vercel Hobby 12-function limit). [Source: commit 712889a, p2-2-1 completion notes]
- **Stripe Customer Portal is the ONLY way users manage billing.** No custom cancellation form, no custom payment update form, no custom invoice viewer. Stripe handles all of this. [Source: architecture-phase2.md — Stripe Patterns, ux-design-phase2-specification.md — Trust Patterns]

### UX Requirements Relevant To This Story

- **Subscription status display:** Premium users see amber-accented status card with their plan name and management button. [Source: ux-design-phase2-specification.md — Journey 2]
- **Amber badge in profile:** Premium status indicated with `premium-amber` (#F59E0B) badge. [Source: ux-design-phase2-specification.md — Color Tokens]
- **"Cancel anytime" prominent:** Subscription section should reinforce that users are in control — the "Manage subscription" button leading to Stripe Portal gives them full control. [Source: ux-design-phase2-specification.md — User Mental Model]
- **Design tokens:** `premium-amber` (#F59E0B) for gates, badges, CTAs. Premium prompts use `text-amber-400 font-semibold`. Amber CTAs: zinc-900 text on amber-500 background (5.8:1 contrast). [Source: ux-design-phase2-specification.md — Color Tokens, Typography, Accessibility]
- **Inline premium gates for expired users:** When subscription expires, PremiumGate upsell cards automatically replace premium feature content (this is existing behavior from PremiumGate). [Source: ux-design-phase2-specification.md — Design Rationale]
- **Stripe-hosted portal page** — never a custom billing management form. Stripe handles cancel, update payment, view invoices. [Source: ux-design-phase2-specification.md — Trust Patterns]

### Implementation Notes For The Dev Agent

- **Do NOT create new API endpoints.** All server-side Stripe infrastructure already exists. This story is purely client-side: a new component + AccountScreen integration.
- **Do NOT modify webhook handlers** unless a bug is found during verification. The handlers are tested and working from Story 2.1.
- The `SubscriptionStatusCard` should follow the existing subscription feature folder pattern: `src/features/subscription/SubscriptionStatusCard.tsx`. The `src/features/subscription/` directory already exists (created for `PremiumWelcomeScreen` in Story 2.2).
- For the portal redirect, reuse the exact pattern from `PremiumGate.handleUpgrade()`:
  ```typescript
  const res = await fetch('/api/stripe/portal', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const data = await res.json()
  window.location.href = data.url
  ```
- For the checkout redirect (free/expired users upgrading), reuse the exact pattern from `PremiumGate.handleUpgrade()`:
  ```typescript
  const res = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const data = await res.json()
  window.location.href = data.url
  ```
- The `useSubscription()` hook already has `refetchOnWindowFocus: true`. When the user returns from Stripe Portal, the browser focus event will trigger a re-fetch, picking up any status changes from webhooks. No additional polling or refresh logic is needed.
- For the error state in portal/checkout calls, use the same pattern established in Story 2.2's PremiumGate: a `text-red-400` inline error message.
- The AccountScreen is approximately 310 lines. Add the `SubscriptionStatusCard` as a section within the authenticated user view. Do not restructure the entire file.

### Testing Requirements

- Minimum validation commands:
  - `npm run test`
  - `npm run typecheck:api`
  - `npm run lint`
- Test coverage for this story:
  - `SubscriptionStatusCard`: all 4 status states (premium, trialing, expired, free), portal redirect, checkout redirect, error handling, loading state, unauthenticated guard
  - `AccountScreen`: verify SubscriptionStatusCard renders for authenticated users
- Mock `useSubscription()` return values for different subscription states.
- Mock `useAuth()` for authenticated/unauthenticated scenarios.
- Mock `fetch` for portal and checkout API calls.
- Use `@testing-library/react` + `vitest` per existing patterns.

### Project Structure Notes

- New file: `src/features/subscription/SubscriptionStatusCard.tsx`
- New file: `src/features/subscription/SubscriptionStatusCard.test.tsx`
- Modified: `src/features/account/AccountScreen.tsx` — add SubscriptionStatusCard section
- Modified: `src/features/account/AccountScreen.test.tsx` — verify SubscriptionStatusCard renders (if test file exists; create if not)
- No new API endpoints (Vercel Hobby 12-function limit).
- No new npm packages required.
- No database schema changes.

### References

- Source: `_bmad-output/planning-artifacts/epics-phase2.md` — Epic 2: Premium Subscription, Story 2.3: Subscription Lifecycle Management
- Source: `_bmad-output/planning-artifacts/architecture-phase2.md` — Stripe Integration, Subscription State, JWT Custom Claims, Feature Gating, Auth Patterns, Stripe Patterns
- Source: `_bmad-output/planning-artifacts/ux-design-phase2-specification.md` — Journey 2 (Free → Premium), PremiumGate specs, Color Tokens, Trust Patterns, User Mental Model
- Source: `_bmad-output/implementation-artifacts/p2-2-1-stripe-infrastructure.md` — Previous story context, file list, webhook handlers, portal endpoint
- Source: `_bmad-output/implementation-artifacts/p2-2-2-subscription-checkout-flow.md` — Previous story context, PremiumGate error handling pattern, PremiumWelcomeScreen
- Source: `api/stripe/webhook.ts` — Webhook event handling, status mapping, JWT claim refresh
- Source: `api/stripe/portal.ts` — Billing portal session creation, return URL
- Source: `api/stripe/checkout.ts` — Checkout session creation
- Source: `src/hooks/useSubscription.ts` — TanStack Query key, isPremium/isTrial logic, refetchOnWindowFocus
- Source: `src/components/PremiumGate.tsx` — handleUpgrade pattern, error handling pattern
- Source: `src/features/subscription/PremiumWelcomeScreen.tsx` — Redirect pattern reference
- Source: `src/features/account/AccountScreen.tsx` — Current account page (no subscription section)
- Source: `src/features/account/AuthContext.ts` — useAuth() hook, session access
- Source: `supabase/migrations/022_create_phase2_foundation_tables.sql` — profiles schema

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- **Task 3 (Webhook verification):** All webhook handlers in `api/stripe/webhook.ts` are correct and complete. `customer.subscription.deleted` → `'expired'`, `invoice.payment_failed` → `'expired'`, `customer.subscription.updated` → uses `mapStripeStatus()` correctly (trialing→trialing, active→premium, canceled/past_due/unpaid→expired). All handlers update both `profiles.subscription_status` and JWT claims via `supabase.auth.admin.updateUserById()`. No changes needed.
- **Task 4 (Portal return URL):** `api/stripe/portal.ts` already sets `return_url: ${origin}/account` — confirmed correct.
- **Task 5 (State refresh):** `useSubscription()` already has `refetchOnWindowFocus: true` — portal return flow automatically picks up status changes. No polling added.
- **Validation:** 688 tests passing across 65 test files (was 675/64 before this story — added 13 new tests in 1 new test file). Typecheck and lint pass cleanly.

### Change Log

- Created `SubscriptionStatusCard` component with 4 status states, portal/checkout redirect, error handling, loading skeleton, and auth guard
- Integrated `SubscriptionStatusCard` into `AccountScreen` for authenticated users
- Added 11 tests in `SubscriptionStatusCard.test.tsx` covering all acceptance criteria
- Added 2 tests in `AccountScreen.test.tsx` verifying card renders for authenticated users and not for unauthenticated

### File List

- `src/features/subscription/SubscriptionStatusCard.tsx` — **new** — Reusable subscription status display and management card
- `src/features/subscription/SubscriptionStatusCard.test.tsx` — **new** — 11 tests for SubscriptionStatusCard
- `src/features/account/AccountScreen.tsx` — **modified** — Added SubscriptionStatusCard import and rendering for authenticated users
- `src/features/account/AccountScreen.test.tsx` — **modified** — Added 2 tests for SubscriptionStatusCard integration, added mocks for useSubscription and @/contexts/AuthContext
