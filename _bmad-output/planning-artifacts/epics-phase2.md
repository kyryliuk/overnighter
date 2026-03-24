---
stepsCompleted: [1, 2, 3, 4]
workflow_completed: true
inputDocuments:
  - 'prd.md'
  - 'architecture-phase2.md'
  - 'ux-design-phase2-specification.md'
---

# Overnighter Phase 2 - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Overnighter Phase 2, decomposing the requirements from the PRD Phase 2 scope, Architecture Phase 2, and UX Design Phase 2 into implementable stories.

Route corridor planning is explicitly excluded from Phase 2 scope (deferred to a later phase).

## Requirements Inventory

### Functional Requirements

FR-P2-01: A user can create an account with email and password
FR-P2-02: A user can sign in to their existing account
FR-P2-03: A user can sign out of their account
FR-P2-04: On account creation, the system migrates the localStorage rig profile to the user's cloud profile
FR-P2-05: On account creation, the system migrates localStorage saved spots to the user's cloud account
FR-P2-06: An authenticated user's rig profile is synced across devices via cloud
FR-P2-07: An authenticated user's saved spots are synced across devices via cloud
FR-P2-08: Unauthenticated users retain full access to core map features without an account

FR-P2-09: A user can subscribe to Premium ($19.99/year) with a 30-day free trial via Stripe Checkout
FR-P2-10: The system gates premium features behind a PremiumGate component showing an upsell prompt for free users
FR-P2-11: A user can manage their subscription (cancel, update billing) via the Stripe Customer Portal
FR-P2-12: The system updates the user's subscription status based on Stripe webhook lifecycle events
FR-P2-13: The system embeds subscription_status in the Supabase JWT for server-side authorization without extra DB queries

FR-P2-14: A user can install the app as a PWA via Add to Homescreen (prompted after meaningful engagement)
FR-P2-15: A premium user can download a map area for offline tile caching with a single tap
FR-P2-16: The system displays an offline-ready badge on saved spots whose area has been cached
FR-P2-17: The system displays a non-blocking offline status banner when the user loses cellular connectivity
FR-P2-18: Check-in writes submitted while offline are queued locally and auto-submitted when connectivity is restored

FR-P2-19: An authenticated user can opt in to push notifications for a saved spot from the pin detail view
FR-P2-20: The system sends a push notification when a saved spot receives a check-in that changes its status
FR-P2-21: A user can opt out of push notifications per-spot or globally

FR-P2-22: An authenticated user can attach a photo to a check-in submission
FR-P2-23: The system stores photos in Supabase Storage and serves them via CDN URL (never via DB reads)
FR-P2-24: The system enforces a 5MB maximum upload size and JPEG/PNG/HEIC format restriction server-side

FR-P2-25: A user can submit a new spot for addition to the map via a multi-step submission form (GPS auto-fill, amenity selection, optional photo)
FR-P2-26: Submitted spots enter a pending moderation state and are not published to the public map until approved by an admin
FR-P2-27: The system shows the authenticated user's submission status (Pending / Under Review / Approved / Rejected) in their profile
FR-P2-28: The system sends a push notification to the submitter when their spot submission is approved or rejected
FR-P2-29: Approved community submissions display the submitter's username on the live pin

FR-P2-30: An admin can view the pending spot submission queue sorted by oldest first
FR-P2-31: An admin can approve a spot submission, which publishes the pin to the live map
FR-P2-32: An admin can reject a spot submission with a reason (from a predefined list + optional free text)
FR-P2-33: An admin can manage flagged pins (review, badge override, archive) via the web admin UI
FR-P2-34: An admin can override a pin's recency badge status
FR-P2-35: An admin can archive (remove from public map) a pin

FR-P2-36: The system enables PostGIS spatial indexing on the pins table for national-scale viewport queries
FR-P2-37: All pin viewport queries use ST_DWithin spatial bounding box lookups (no full table scans)

### Non-Functional Requirements

NFR-P2-P1: Offline cached tiles must load within 1 second in airplane mode
NFR-P2-P2: Photo upload must display progress feedback within 300ms of file selection
NFR-P2-P3: Auth modal (sign-up/sign-in) must open within 300ms of trigger

NFR-P2-S1: Subscription status must be server-authoritative — clients cannot self-report premium status
NFR-P2-S2: All premium API endpoints must verify JWT subscription_status claim server-side independently
NFR-P2-S3: Stripe webhooks must be verified using Stripe signature before any processing occurs
NFR-P2-S4: Photo uploads must use signed URLs — no direct client-to-Storage writes without server validation
NFR-P2-S5: RLS policies must protect all per-user tables (profiles, saved_spots, push_subscriptions, spot_submissions, pin_photos)

NFR-P2-R1: Check-in writes while offline must be queued in localStorage and auto-submitted on reconnect
NFR-P2-R2: Push delivery is best-effort — no product feature depends on guaranteed push delivery
NFR-P2-R3: localStorage data must not be overwritten during auth migration — preserved as offline fallback
NFR-P2-R4: Community spot submissions must never auto-publish — all require explicit admin approval

NFR-P2-SC1: All pin viewport queries must use PostGIS spatial index (no full table scans post-migration)
NFR-P2-SC2: Supabase must be upgraded to Pro tier before Phase 2 launch

NFR-P2-A1: All Phase 2 components must meet WCAG AA contrast ratios (see color tokens: amber 5.8:1, blue 4.6:1, purple 4.5:1)
NFR-P2-A2: All Phase 2 dialogs/modals must implement focus trap and aria-modal attributes
NFR-P2-A3: Status pills and badges must communicate status via color AND icon — never color alone

### Additional Requirements

**Infrastructure Setup (blocks Phase 2 launch):**
- Enable PostGIS extension in Supabase via SQL migration (CREATE EXTENSION IF NOT EXISTS postgis)
- Enable Supabase Auth in dashboard; configure email verification templates
- Create `pin-photos` Supabase Storage bucket (public, 5MB max upload policy)
- Upgrade Supabase to Pro tier ($25/mo) before Phase 2 launch
- Configure Stripe: create "Overnighter Premium" product, annual price ($19.99), register webhook endpoint, enable required webhook events
- Add 7 new environment variables: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID_ANNUAL, VITE_STRIPE_PUBLISHABLE_KEY, VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT

**New Database Tables (required before any Phase 2 feature):**
- profiles (id, rig_profile JSONB, subscription_status, stripe_customer_id, created_at)
- saved_spots (id, user_id, pin_id, saved_at)
- push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
- spot_submissions (id, device_id, user_id, status, name, latitude, longitude, amenities, submitted_at)
- pin_photos (id, check_in_id, user_id, storage_path, cdn_url, created_at)

**New Packages (install in Epic 1 Story 1):**
- vite-plugin-pwa@1.2.0 (PWA manifest + Workbox service worker)
- @stripe/stripe-js@8.11.0 + @stripe/react-stripe-js (Stripe client)
- stripe@20.4.1 (server-side Stripe SDK)
- web-push@3.6.7 + @types/web-push (VAPID push sending)

**New API Endpoints (12 total):**
- POST /api/auth/migrate, POST /api/stripe/checkout, POST /api/stripe/webhook, POST /api/stripe/portal
- GET /api/push/vapid-key, POST /api/push/subscribe, DELETE /api/push/subscribe, POST /api/push/send
- POST /api/spots/submit, GET /api/admin/submissions, PATCH /api/admin/submissions/:id, POST /api/photos/upload-url

**Architecture Patterns (all Phase 2 code must follow):**
- Auth state: always via useAuth() hook from AuthContext — never call supabase.auth directly in components
- Subscription checks: always via useSubscription() hook — never query profiles table directly in components
- Premium UI gating: always via <PremiumGate> wrapper — never inline conditional rendering
- Stripe payment UI: always Stripe Elements — never handle raw card data
- Photo uploads: always via signed URL from /api/photos/upload-url — never direct Storage writes

**UX Requirements from Phase 2 Spec:**
- PremiumGate renders inline as amber card (not modal); shows feature description before price
- PWA install prompt: triggered after meaningful engagement (not on first app visit)
- Push permission: contextual ask inside pin detail toggle — never standalone cold permission modal
- Auth migration modal: must show localStorage data preview (rig + spot count) before sign-up form
- Spot submission: multi-step sheet with step indicator, GPS auto-fill on step 1
- Admin review card: two-column layout on tablet (>= 768px), single-column on mobile; auto-advances on decision

### FR Coverage Map

FR-P2-01: Epic 1 - User can create account with email + password
FR-P2-02: Epic 1 - User can sign in to existing account
FR-P2-03: Epic 1 - User can sign out
FR-P2-04: Epic 1 - localStorage rig profile migrates to cloud on account creation
FR-P2-05: Epic 1 - localStorage saved spots migrate to cloud on account creation
FR-P2-06: Epic 1 - Rig profile synced across devices for authenticated users
FR-P2-07: Epic 1 - Saved spots synced across devices for authenticated users
FR-P2-08: Epic 1 - Unauthenticated users retain full access to core features
FR-P2-09: Epic 2 - User can subscribe to Premium via Stripe Checkout
FR-P2-10: Epic 2 - PremiumGate component shows upsell for free users
FR-P2-11: Epic 2 - User can manage subscription via Stripe Customer Portal
FR-P2-12: Epic 2 - Subscription status updated by Stripe webhook events
FR-P2-13: Epic 2 - subscription_status embedded in Supabase JWT
FR-P2-14: Epic 3 - User can install app as PWA via Add to Homescreen
FR-P2-15: Epic 3 - Premium user can download map area for offline tile caching
FR-P2-16: Epic 3 - Offline-ready badge on cached saved spots
FR-P2-17: Epic 3 - Non-blocking offline status banner when connectivity lost
FR-P2-18: Epic 3 - Offline check-in writes queued and auto-submitted on reconnect
FR-P2-19: Epic 4 - Authenticated user can opt in to push notifications from pin detail
FR-P2-20: Epic 4 - System sends push notification when saved spot status changes
FR-P2-21: Epic 4 - User can opt out of push notifications per-spot or globally
FR-P2-22: Epic 5 - Authenticated user can attach photo to check-in submission
FR-P2-23: Epic 5 - Photos stored in Supabase Storage and served via CDN URL
FR-P2-24: Epic 5 - 5MB max upload + JPEG/PNG/HEIC restriction enforced server-side
FR-P2-25: Epic 5 - User can submit new spot via multi-step form with GPS auto-fill
FR-P2-26: Epic 5 - Submitted spots enter pending state; not published until admin approves
FR-P2-27: Epic 5 - Submission status visible in user profile (Pending/Approved/Rejected)
FR-P2-28: Epic 5 - Push notification sent to submitter on approval or rejection
FR-P2-29: Epic 5 - Approved submissions display submitter username on live pin
FR-P2-30: Epic 6 - Admin can view pending spot submission queue
FR-P2-31: Epic 6 - Admin can approve submission, publishing pin to live map
FR-P2-32: Epic 6 - Admin can reject submission with reason
FR-P2-33: Epic 6 - Admin can manage flagged pins via web UI
FR-P2-34: Epic 6 - Admin can override pin recency badge status
FR-P2-35: Epic 6 - Admin can archive (remove) a pin from public map
FR-P2-36: Epic 7 - PostGIS spatial indexing enabled on pins table
FR-P2-37: Epic 7 - All pin viewport queries use ST_DWithin spatial bounding box lookups

## Epic List

### Epic 1: User Accounts & Data Sync
Users can create accounts, sign in/out, and have their rig profile and saved spots persist and sync across devices. Anonymous users remain fully unaffected — no forced login at any point. Includes Phase 2 package installation, database schema migration, AuthContext, and localStorage migration utility.
**FRs covered:** FR-P2-01, FR-P2-02, FR-P2-03, FR-P2-04, FR-P2-05, FR-P2-06, FR-P2-07, FR-P2-08

### Epic 2: Premium Subscription
Users can subscribe to Overnighter Premium ($19.99/year with 30-day free trial) and all premium-gated features show appropriate upsell prompts for free users. Includes Stripe Checkout, Stripe Webhook lifecycle handling, Stripe Customer Portal, PremiumGate component, useSubscription hook, and JWT custom claims.
**FRs covered:** FR-P2-09, FR-P2-10, FR-P2-11, FR-P2-12, FR-P2-13

### Epic 3: Offline PWA
Premium users can install the app and download map areas for offline use. All users see a clear connectivity status indicator and have check-in writes queued automatically when offline and flushed on reconnect. Includes vite-plugin-pwa, Workbox service worker cache strategies, offline banner, and offline check-in queue.
**FRs covered:** FR-P2-14, FR-P2-15, FR-P2-16, FR-P2-17, FR-P2-18

### Epic 4: Push Notifications
Authenticated users can opt in to receive push notifications when a saved spot's check-in status changes, with full opt-out control. Includes VAPID key setup, push subscription storage, notification send endpoint, and contextual in-pin-detail opt-in toggle.
**FRs covered:** FR-P2-19, FR-P2-20, FR-P2-21

### Epic 5: Community Contributions
Authenticated users can attach photos to check-ins and submit entirely new spots to the community map, with submission status tracking and submitter attribution on approved pins. Includes Supabase Storage bucket, signed URL photo upload pipeline, multi-step spot submission form, status tracking, and push notification on approval/rejection.
**FRs covered:** FR-P2-22, FR-P2-23, FR-P2-24, FR-P2-25, FR-P2-26, FR-P2-27, FR-P2-28, FR-P2-29

### Epic 6: Admin Moderation UI
Admins can review and action community spot submissions and manage all map pins via a web admin interface, replacing direct database access. Includes submission review queue, approve/reject flow with reason, pin flag management, badge override, and pin archive.
**FRs covered:** FR-P2-30, FR-P2-31, FR-P2-32, FR-P2-33, FR-P2-34, FR-P2-35

### Epic 7: US Geographic Expansion
The system supports national-scale pin data with PostGIS spatial indexing, enabling Overnighter to expand beyond the Florida pilot corridor without full table scans on viewport queries. Includes PostGIS extension migration, spatial index on pins table, and viewport query migration to ST_DWithin.
**FRs covered:** FR-P2-36, FR-P2-37

---

## Epic 1: User Accounts & Data Sync

Users can create accounts, sign in/out, and have their rig profile and saved spots persist and sync across devices. Anonymous users remain fully unaffected — no forced login at any point. Includes Phase 2 package installation, database schema migration, AuthContext, and localStorage migration utility.

### Story 1.1: Phase 2 Foundation Setup

As a **developer**,
I want the Phase 2 packages installed, environment variables configured, and database schema migrated,
So that all Phase 2 features have a stable technical foundation to build on.

**Acceptance Criteria:**

**Given** the existing MVP codebase
**When** the Phase 2 setup story is implemented
**Then** `vite-plugin-pwa@1.2.0`, `@stripe/stripe-js`, `@stripe/react-stripe-js`, `stripe@20.4.1`, `web-push@3.6.7`, and `@types/web-push` are installed
**And** all 5 new Supabase tables exist: `profiles`, `saved_spots`, `push_subscriptions`, `spot_submissions`, `pin_photos`
**And** RLS is enabled on all 5 tables with user-scoped policies
**And** `.env.example` is updated with all 7 new Phase 2 environment variable keys
**And** `AuthContext.tsx` and `useAuth` hook exist at `src/contexts/AuthContext.tsx`
**And** the existing app continues to work identically for anonymous users (no regression)

### Story 1.2: User Account Registration

As a **new user**,
I want to create an account with my email and password,
So that my data is stored securely in the cloud.

**Acceptance Criteria:**

**Given** a user is on any screen and has not signed in
**When** they tap the "Save to account" banner or the Profile tab sign-up CTA
**Then** the AuthMigrationModal opens showing the email + password form

**Given** the auth modal is open
**When** the user enters a valid email and password and taps "Create account"
**Then** a Supabase Auth account is created and a `profiles` record is inserted
**And** the user is signed in and the modal closes
**And** the map is unchanged — no navigation occurs

**Given** the auth modal is open
**When** the user enters an email already in use
**Then** an inline error message is shown: "An account with this email already exists"

**Given** a user has not created an account
**When** they use the app normally (browse map, filter, view pins)
**Then** all core features work identically to the anonymous experience

### Story 1.3: User Sign In and Sign Out

As a **returning user**,
I want to sign in to my existing account and sign out,
So that I can access my cloud data on any device.

**Acceptance Criteria:**

**Given** a user has an existing account and is not signed in
**When** they tap "Sign in" in the auth modal
**Then** they enter email + password and are authenticated
**And** the Profile tab nav icon updates to show their account initial
**And** the map and core features remain unchanged

**Given** a user is signed in
**When** they tap "Sign out" in the Profile screen
**Then** they are signed out and the app reverts to the anonymous experience
**And** localStorage rig profile and saved spots are preserved locally

**Given** a user enters incorrect credentials
**When** they submit the sign-in form
**Then** an inline error is shown: "Incorrect email or password"

### Story 1.4: Anonymous Data Migration on Account Creation

As a **returning anonymous user**,
I want my rig profile and saved spots automatically migrated when I create an account,
So that I don't lose my data or have to re-enter anything.

**Acceptance Criteria:**

**Given** a user has a rig profile and saved spots in localStorage
**When** they create a new account
**Then** the auth modal shows: "Your [rig class] profile and [N] saved spots will be backed up"
**And** on successful account creation, `POST /api/auth/migrate` copies rig profile to `profiles.rig_profile`
**And** saved spot pin IDs are copied to `saved_spots` table rows
**And** the confirmation screen shows: "[N] spots backed up"

**Given** the migration API call fails
**When** account creation completes
**Then** the user is still signed in successfully
**And** a toast shows: "Account created. Data sync failed — will retry on next sign-in."
**And** localStorage data is preserved and not deleted

**Given** a user creates an account with empty localStorage
**When** the migration runs
**Then** an empty `profiles` record is created with no error

### Story 1.5: Cross-Device Cloud Sync

As an **authenticated user**,
I want my rig profile and saved spots to sync across all my devices,
So that I have consistent data wherever I use Overnighter.

**Acceptance Criteria:**

**Given** a user is signed in
**When** they update their rig profile
**Then** the change is written to `profiles.rig_profile` in Supabase
**And** on any other signed-in device, the updated profile is loaded on next app open

**Given** a user is signed in
**When** they save a new spot pin
**Then** the save is written to `saved_spots` table in addition to localStorage
**And** the saved spot appears in the Saved tab on all signed-in devices

**Given** a user is signed in on a new device with no localStorage
**When** the app loads
**Then** the rig profile and saved spots are loaded from Supabase cloud
**And** the map renders rig-filtered as expected

---

## Epic 2: Premium Subscription

Users can subscribe to Overnighter Premium ($19.99/year with 30-day free trial) and all premium-gated features show appropriate upsell prompts for free users. Includes Stripe Checkout, Stripe Webhook lifecycle handling, Stripe Customer Portal, PremiumGate component, useSubscription hook, and JWT custom claims.

### Story 2.1: Stripe Infrastructure & Subscription State

As a **developer**,
I want Stripe configured and subscription status wired into the JWT and UI,
So that all premium-gated features have a reliable foundation.

**Acceptance Criteria:**

**Given** the Stripe product and annual price are configured in the Stripe dashboard
**When** the infrastructure story is implemented
**Then** `POST /api/stripe/checkout`, `POST /api/stripe/webhook`, `POST /api/stripe/portal` serverless functions exist
**And** the Stripe webhook verifies `stripe-signature` before processing any event
**And** `useSubscription()` hook exists returning `{ isPremium, isTrial, status }`
**And** `<PremiumGate>` component renders children if premium, amber upsell card if free
**And** `<AuthRequired>` route wrapper redirects to `/account` if not authenticated

### Story 2.2: Premium Subscription Checkout

As a **free user**,
I want to subscribe to Overnighter Premium with a 30-day free trial,
So that I can unlock offline maps and other premium features.

**Acceptance Criteria:**

**Given** a signed-in free user taps any `<PremiumGate>` upsell CTA
**When** they are redirected to Stripe Checkout
**Then** the Stripe-hosted checkout page shows the annual plan ($19.99/year) with 30-day trial
**And** Apple Pay / Google Pay appear as primary payment options where available

**Given** the user completes payment on the Stripe checkout page
**When** `checkout.session.completed` webhook fires
**Then** `profiles.subscription_status` is updated to `'trialing'` or `'premium'`
**And** the Supabase JWT custom claim `subscription_status` is refreshed
**And** the user is redirected to `/premium-welcome` showing confirmation

**Given** the user cancels the Stripe checkout
**When** they are returned to the app
**Then** their subscription status remains `'free'` and the PremiumGate upsell is shown

### Story 2.3: Subscription Lifecycle Management

As a **premium subscriber**,
I want to manage my subscription (view status, cancel, update billing),
So that I have control over my recurring payment.

**Acceptance Criteria:**

**Given** a signed-in premium user opens the Profile screen
**When** they view their subscription section
**Then** they see their current status (Premium / Trial — expires [date])
**And** a "Manage subscription" button is visible

**Given** a premium user taps "Manage subscription"
**When** `POST /api/stripe/portal` is called
**Then** they are redirected to the Stripe Customer Portal
**And** they can cancel, update payment method, or view invoices

**Given** a user cancels via the portal and `customer.subscription.deleted` webhook fires
**When** the webhook is processed
**Then** `profiles.subscription_status` is set to `'expired'`
**And** premium features are replaced with PremiumGate upsell cards on next app load

**Given** `invoice.payment_failed` webhook fires
**When** the webhook is processed
**Then** `profiles.subscription_status` is set to `'expired'`
**And** the user's JWT claim is refreshed to reflect expired status

### Story 2.4: Premium Feature Gating Throughout UI

As a **free user**,
I want to see what premium features exist and how to unlock them,
So that I understand the value of subscribing before committing.

**Acceptance Criteria:**

**Given** a free user navigates to any premium-gated feature area
**When** the `<PremiumGate>` component renders
**Then** an amber inline card is shown with the feature name, one-line description, price ($19.99/year), and "Unlock with Premium" CTA
**And** "Cancel anytime" is visible below the CTA
**And** no modal is shown — the card replaces the feature content inline

**Given** a free user views a premium gate card
**When** they are not signed in
**Then** tapping the CTA opens the auth modal first
**And** after sign-in, the Stripe checkout flow begins automatically

**Given** a premium server endpoint is called with a free user's JWT
**When** the endpoint checks `subscription_status` claim
**Then** a `403 Forbidden` response is returned

---

## Epic 3: Offline PWA

Premium users can install the app and download map areas for offline use. All users see a clear connectivity status indicator and have check-in writes queued automatically when offline and flushed on reconnect. Includes vite-plugin-pwa, Workbox service worker cache strategies, offline banner, and offline check-in queue.

### Story 3.1: PWA Service Worker & Install Prompt

As a **user**,
I want to install Overnighter on my home screen and have the app work with a service worker,
So that I get a faster, app-like experience and offline capability is available.

**Acceptance Criteria:**

**Given** vite-plugin-pwa is installed and configured with `strategies: 'injectManifest'`
**When** the app is built and served
**Then** a `manifest.webmanifest` is generated with correct name, icons, and theme color
**And** `src/sw.ts` is compiled and registered as the service worker
**And** the service worker registers Workbox CacheFirst for CartoDB map tiles (max 500 entries, 30-day expiry)
**And** the service worker registers StaleWhileRevalidate for `/rest/v1/pins` (max 50 entries, 24-hour expiry)

**Given** a user has visited the app at least twice and saved a spot
**When** the browser fires the `beforeinstallprompt` event
**Then** a PWA install bottom sheet is shown with the app icon and "Add to Home Screen" / "Not now" buttons

**Given** a user taps "Add to Home Screen"
**When** the install prompt is accepted
**Then** the app is installed and the install sheet is dismissed

### Story 3.2: Offline Tile Cache Activation

As a **premium user**,
I want to download a map area for offline use with a single tap,
So that I can browse saved spots and the map when I have no cellular signal.

**Acceptance Criteria:**

**Given** a signed-in premium user opens the map or Saved Spots view
**When** they see the "Download area" button in the map header
**Then** tapping it shows a bounding box preview overlay on the map

**Given** the bbox preview is shown
**When** the user taps "Download"
**Then** a progress indicator appears in the header showing cache download progress
**And** map tiles and saved spot data for the selected area are cached by the service worker

**Given** the cache download completes
**When** the user views their Saved Spots list
**Then** a blue "Offline ready" badge appears on each saved spot within the cached area

**Given** a free user views the map header
**When** they see the "Download area" button area
**Then** a `<PremiumGate>` card is shown inline explaining offline maps as a premium feature

**Given** cached tiles are loaded in airplane mode
**When** the user pans the cached map area
**Then** tiles load within 1 second with no network request (NFR-P2-P1)

### Story 3.3: Offline Status Banner & Indicators

As a **user**,
I want to see a clear indicator when I'm offline,
So that I understand what features are available and that the app is working from cache.

**Acceptance Criteria:**

**Given** a user loses cellular connectivity
**When** the `navigator.onLine` event fires as false
**Then** a blue offline banner appears at the top of the screen: "Offline — cached map active"
**And** the banner does not push map content — it overlays with partial opacity

**Given** the user is offline with a cached area
**When** they browse the cached map
**Then** cached tiles and saved spot data load normally
**And** the blue "Offline ready" badge is visible on cached saved spots

**Given** the user regains connectivity
**When** the `online` event fires
**Then** the offline banner is dismissed automatically

**Given** the user is offline in an area with no cached tiles
**When** they open the app
**Then** the banner shows: "Offline — no cached map for this area"
**And** the map shows an empty tile background (no crash)

### Story 3.4: Offline Check-In Queue

As a **user**,
I want my check-ins to be saved and submitted automatically when I regain signal,
So that I can contribute data even in areas with no cellular coverage.

**Acceptance Criteria:**

**Given** a user submits a check-in while offline
**When** the check-in write would normally call the API
**Then** the check-in is appended to `localStorage['pendingCheckins']` array
**And** the UI shows a success confirmation as if the check-in was submitted

**Given** pending check-ins exist in localStorage
**When** the `window.online` event fires
**Then** each queued check-in is submitted via `useCheckinMutation` in sequence
**And** successfully submitted items are removed from the queue
**And** if a submission fails after 3 retries, it remains in the queue for next reconnect

**Given** the user opens the app while online with pending check-ins
**When** the app initializes
**Then** any pending check-ins are flushed automatically without user action

---

## Epic 4: Push Notifications

Authenticated users can opt in to receive push notifications when a saved spot's check-in status changes, with full opt-out control. Includes VAPID key setup, push subscription storage, notification send endpoint, and contextual in-pin-detail opt-in toggle.

### Story 4.1: Push Notification Infrastructure

As a **developer**,
I want the push notification backend infrastructure in place,
So that authenticated users can subscribe and the system can send targeted notifications.

**Acceptance Criteria:**

**Given** VAPID keys are generated and stored as environment variables
**When** the infrastructure story is implemented
**Then** `GET /api/push/vapid-key` returns the public VAPID key to the client
**And** `POST /api/push/subscribe` saves a Web Push subscription object to `push_subscriptions` with the user's `user_id`
**And** `DELETE /api/push/subscribe` removes the subscription record for the authenticated user
**And** `POST /api/push/send` (Bearer auth) sends a Web Push notification via `web-push` for a given `user_id`
**And** the service worker in `src/sw.ts` handles `push` events and calls `self.registration.showNotification`

### Story 4.2: Per-Spot Push Notification Opt-In

As a **signed-in user**,
I want to opt in to push notifications for a specific saved spot from its detail view,
So that I am alerted when that spot's status changes.

**Acceptance Criteria:**

**Given** a signed-in user opens a pin detail sheet for a saved spot
**When** they view the detail sheet
**Then** a `PushNotificationToggle` is visible: "Notify me when status changes" with the toggle off

**Given** the user taps the toggle to enable notifications
**When** the browser push permission has not been requested yet
**Then** the description is shown: "You'll get an alert when a new check-in changes this spot's status"
**And** the browser permission dialog appears only after the description is visible
**And** if the user allows, `POST /api/push/subscribe` is called and a test confirmation notification is sent

**Given** the browser push permission was previously denied
**When** the toggle is tapped
**Then** the toggle stays off and shows: "Enable notifications in your browser settings"

### Story 4.3: Push Notification Delivery & Opt-Out

As a **subscribed user**,
I want to receive relevant spot notifications and be able to opt out,
So that push notifications remain valuable and not intrusive.

**Acceptance Criteria:**

**Given** a check-in is submitted that changes a spot's recency badge state
**When** the check-in write completes
**Then** `POST /api/push/send` is called for all users subscribed to that spot
**And** the notification payload includes spot name and new status (e.g., "Flying J Ocala: still open")

**Given** a push notification is received while the app is in the background
**When** the service worker `push` event fires
**Then** a system notification is displayed with the spot name and status message
**And** tapping the notification opens the app to the relevant pin detail

**Given** a signed-in user wants to stop notifications for a spot
**When** they toggle the `PushNotificationToggle` to off
**Then** `DELETE /api/push/subscribe` is called and the subscription record is removed
**And** no further notifications are sent for that spot

---

## Epic 5: Community Contributions

Authenticated users can attach photos to check-ins and submit entirely new spots to the community map, with submission status tracking and submitter attribution on approved pins. Includes Supabase Storage bucket, signed URL photo upload pipeline, multi-step spot submission form, status tracking, and push notification on approval/rejection.

### Story 5.1: Photo Upload on Check-Ins

As a **signed-in user**,
I want to attach a photo when submitting a check-in,
So that I can give the community a current visual of the spot's condition.

**Acceptance Criteria:**

**Given** a signed-in user opens the check-in submission sheet
**When** they view the check-in form
**Then** a camera icon CTA is visible above the text fields as the primary photo action

**Given** the user taps the camera icon
**When** the native file picker opens and they select an image
**Then** the image is compressed client-side to under 1MB
**And** `POST /api/photos/upload-url` is called to get a signed Supabase Storage upload URL
**And** a progress bar shows upload progress from the first byte

**Given** the upload completes
**When** the check-in is submitted
**Then** the `cdn_url` is stored in `pin_photos` linked to the `check_in_id`
**And** a thumbnail is visible in the check-in confirmation

**Given** the user selects a file over 5MB or a non-JPEG/PNG/HEIC format
**When** the upload URL endpoint validates the request
**Then** a `400` error is returned and the user sees: "Photo must be JPEG, PNG, or HEIC and under 5MB"

**Given** the upload fails due to network error
**When** the failure occurs
**Then** a silent auto-retry fires once
**And** if the retry also fails, an error state shows: "Photo upload failed — tap to retry"

### Story 5.2: Spot Submission Form

As a **user**,
I want to submit a new spot that's missing from the map,
So that the community can benefit from locations I've discovered.

**Acceptance Criteria:**

**Given** any user (authenticated or anonymous) taps the "Submit a spot" button
**When** the SpotSubmissionSheet opens
**Then** Step 1 of 3 is shown with a step indicator
**And** spot type chips (Overnight, Dump, Water, Fuel) are shown for selection
**And** GPS coordinates are auto-filled from the device location

**Given** the user completes Step 1 and taps Next
**When** Step 2 is shown
**Then** amenity checkboxes, fee input, and access restriction fields are visible
**And** tapping Back returns to Step 1 with all entered data preserved

**Given** the user completes Step 2 and taps Next
**When** Step 3 is shown
**Then** the optional `PhotoUpload` component is visible
**And** a Submit button is visible

**Given** the user taps Submit with valid data
**When** `POST /api/spots/submit` is called
**Then** a `spot_submissions` record is created with `status = 'pending'`
**And** the sheet closes and a toast shows: "Submitted — your spot is under review"

**Given** a required field is empty when the user taps Next on any step
**When** step-level validation runs
**Then** an inline error is shown on the invalid field and the user cannot advance

### Story 5.3: Submission Status Tracking

As a **user who submitted a spot**,
I want to see the status of my submission and be notified when it's approved or rejected,
So that I know my contribution was received and acted on.

**Acceptance Criteria:**

**Given** a user has submitted one or more spots
**When** they open the Profile screen and navigate to "My Submissions"
**Then** each submission is shown with a colored status pill: Pending (yellow), Under Review (blue), Approved (green), Rejected (red)

**Given** an admin approves a spot submission
**When** the approval is processed
**Then** the submission status pill updates to Approved
**And** a push notification is sent to the submitter: "Your spot [name] was approved and is now live"

**Given** an admin rejects a spot submission
**When** the rejection is processed
**Then** the submission status pill updates to Rejected
**And** a push notification is sent: "Your spot submission was not approved: [reason]"

**Given** an approved submission is live on the map
**When** any user views that pin
**Then** "Submitted by [username]" is visible in the pin detail view

---

## Epic 6: Admin Moderation UI

Internal admin users can review the queue of crowd-sourced spot submissions, approve or reject them with reasons, manage flagged pins, override recency badge status, and archive pins. Requires an admin-only route protected by a `role = 'admin'` JWT claim, the `AdminReviewCard` component, and `SubmissionStatusPill`.

### Story 6.1: Admin Submission Queue

As an **admin user**,
I want to see a paginated list of all pending spot submissions,
So that I can triage and process community contributions efficiently.

**Acceptance Criteria:**

**Given** an admin navigates to `/admin/submissions`
**When** the page loads
**Then** a list of `AdminReviewCard` components is shown, each displaying: submitted spot name, type, coordinates, submitter username, submitted-at timestamp, and current status pill
**And** only submissions with `status = 'pending'` are shown by default

**Given** an admin opens the filter panel
**When** they filter by status (Pending, Under Review, Approved, Rejected)
**Then** `GET /api/admin/submissions` is called with the selected status as a query param
**And** the list updates to reflect the filter

**Given** a non-admin authenticated user navigates to `/admin/submissions`
**When** the route guard checks the JWT claim
**Then** they are redirected to `/` with no admin UI visible

**Given** there are more than 20 submissions
**When** the user scrolls to the bottom of the list
**Then** the next page of results is loaded and appended (infinite scroll or pagination)

### Story 6.2: Approve and Reject Submissions

As an **admin user**,
I want to approve or reject a pending submission with a reason,
So that the community map contains only accurate and appropriate spots.

**Acceptance Criteria:**

**Given** an admin views an `AdminReviewCard` for a pending submission
**When** they expand the card
**Then** the full submission detail is visible: all fields from step 1–3 of the submission form, plus the attached photo if any

**Given** the admin taps "Approve"
**When** the confirmation is shown and they confirm
**Then** `PATCH /api/admin/submissions/:id` is called with `{ status: 'approved' }`
**And** a new `pins` record is created from the submission data
**And** the submitter receives a push notification: "Your spot [name] was approved and is now live"
**And** the card's status pill updates to Approved (green) inline

**Given** the admin taps "Reject"
**When** a reason text field appears
**Then** the admin must enter a reason (required, min 10 characters) before confirming
**And** `PATCH /api/admin/submissions/:id` is called with `{ status: 'rejected', rejection_reason: '...' }`
**And** the submitter receives a push notification: "Your spot submission was not approved: [reason]"
**And** the card's status pill updates to Rejected (red) inline

**Given** the approval API call fails
**When** the error is returned
**Then** the card state reverts and an error toast shows: "Action failed — try again"

### Story 6.3: Pin Management (Flag, Badge Override, Archive)

As an **admin user**,
I want to manage live pins by handling flags, correcting badge status, and archiving bad data,
So that the map stays accurate and free of inappropriate content.

**Acceptance Criteria:**

**Given** an admin navigates to `/admin/pins`
**When** the page loads
**Then** flagged pins are shown first, each with a flag count badge and the most recent flag reason

**Given** the admin reviews a flagged pin and finds it valid
**When** they tap "Clear flags"
**Then** all flag records for that pin are marked resolved and the pin remains live
**And** the flag count badge disappears from the card

**Given** the admin finds a pin with an incorrect recency badge
**When** they tap "Override status" and select a new status (Open / Closed / Unverified)
**Then** `PATCH /api/admin/pins/:id` is called with `{ badge_override: 'open' | 'closed' | 'unverified' }`
**And** the pin's badge shows the overridden value with a small lock icon indicating admin override

**Given** the admin determines a pin should be removed from the map
**When** they tap "Archive pin" and confirm the confirmation dialog
**Then** `PATCH /api/admin/pins/:id` is called with `{ archived: true }`
**And** the pin no longer appears in any user-facing map query
**And** the admin list marks the pin as "Archived" but the record is retained in the database

---

## Epic 7: US Geographic Expansion

Migrate the pin dataset to PostGIS spatial indexing to support performant viewport queries across all US states, and expand the data coverage to include the full continental US. Enables the `ST_DWithin` query strategy replacing the bounding-box approach used in Phase 1.

### Story 7.1: PostGIS Spatial Index Migration

As a **developer**,
I want the `pins` table to use a PostGIS `geography(Point)` column with a GiST index,
So that spatial proximity queries are fast at scale across the continental US.

**Acceptance Criteria:**

**Given** the Phase 2 database migration is applied
**When** a spatial query runs against the `pins` table
**Then** the `location geography(Point, 4326)` column exists on the `pins` table
**And** a GiST index exists on `pins.location`
**And** all existing pin records have their `lat`/`lng` values back-filled into the `location` column

**Given** a new pin is inserted via any code path
**When** the insert completes
**Then** the `location` column is populated from `lat` and `lng` using `ST_MakePoint(lng, lat)::geography`
**And** both the `location` column and the scalar `lat`/`lng` columns remain in sync

**Given** a developer runs the migration in a local dev environment
**When** `npx supabase db reset` is executed
**Then** the migration applies cleanly with no errors
**And** the existing seed data is queryable via `ST_DWithin`

### Story 7.2: Viewport Query Migration to ST_DWithin

As a **user**,
I want the map to load pins within my visible viewport quickly regardless of which US state I'm in,
So that I get fast, relevant results everywhere across the continental US.

**Acceptance Criteria:**

**Given** the user pans or zooms the map to any viewport within the continental US
**When** the viewport query fires
**Then** `GET /api/pins?lat=&lng=&radius_m=` is called with the viewport center and a radius derived from the zoom level
**And** the server executes `ST_DWithin(pins.location, ST_MakePoint(lng, lat)::geography, radius_m)` using the GiST index
**And** only pins within the radius are returned

**Given** the user is at zoom level 10 (city-scale view)
**When** the radius is computed
**Then** the radius is set to 50,000 meters (50 km)
**And** the query returns in under 300ms for datasets up to 100,000 pins (verified via query plan)

**Given** the previous bounding-box query endpoint was used by the Phase 1 client
**When** the new `radius_m` endpoint is deployed
**Then** the old bounding-box parameters (`bbox`) are still accepted and internally converted to a center+radius
**And** no breaking change is introduced for any cached or older client requests
