---
stepsCompleted: [1, 2, 3, 4]
workflowComplete: true
completedAt: '2026-03-17'
lastEdited: '2026-04-26'
editHistory:
  - date: '2026-04-26'
    changes: 'Water tap pivot extension — added FR39–FR47, NFR-ML1–ML5, Epic 6 stories for ML pipeline; FR coverage map updated FR39–FR47; workflowComplete set to true'
inputDocuments:
  - 'prd.md'
  - 'architecture.md'
  - 'ux-design-specification.md'
---

# Overnighter - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Overnighter, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: A user can set their rig class (Class A / B / C / Travel Trailer / 5th Wheel) during onboarding
FR2: A user can set their rig length (in feet) during onboarding
FR3: A user can set their rig height (in feet and inches) during onboarding
FR4: The system persists the rig profile across sessions without requiring account creation
FR5: A user can edit their saved rig profile at any time
FR6: The system uses the saved rig profile to pre-filter all map pins before display
FR7: A user can view a map showing all available stop pins for their current viewport
FR8: A user can search for a location by name or address to center the map
FR9: A user can use their device's GPS location to center the map on their current position
FR10: A user can pan and zoom the map to explore different areas
FR11: The system displays stop pins for all categories simultaneously on a single map layer
FR12: The system displays stop pins the user's rig cannot access in a visually distinct (greyed-out) state without hiding them
FR13: A user can activate one or more amenity filter chips (Water, Dump, Overnight, Fuel, Propane, Electric, Shower) to narrow displayed pins
FR14: The system applies active filter chips using AND logic — only pins matching all active filters are shown in full color
FR15: A user can deactivate individual filter chips to broaden results
FR16: The system preserves active filters when the user pans or zooms the map
FR17: The system displays a freshness badge on every pin indicating how recently it was verified (green: <7 days, yellow: 8–30 days, red: 30+ days or never)
FR18: The system aggregates spot data from BLM/USFS/NPS public APIs, OpenStreetMap Overpass, and community-submitted check-ins
FR19: The system displays multi-amenity information on a single pin when a location offers multiple services (e.g., dump + water + overnight)
FR20: The system updates a pin's recency badge immediately when a community check-in is submitted
FR21: A user can tap a pin to view its detail: name, stop type, amenities, fee, rig restrictions, last verified date, and community notes
FR22: A user can initiate navigation to a spot with a single tap, handing off to the device's native maps application
FR23: A user can report an issue on a spot directly from the pin detail view
FR24: The system immediately degrades the recency badge to red when an issue report is submitted
FR25: The system prompts a user to submit a check-in when they depart a location they previously viewed or saved
FR26: A user can submit a check-in confirming a spot's status (Still open / Closed / Changed)
FR27: A user can add an optional text note to a check-in (e.g., updated fee, hours change)
FR28: The system records check-ins without requiring user account creation (device-fingerprinted via anonymous UUID)
FR29: The system uses check-in data to update the pin's recency badge and last-verified date
FR30: A user can save a spot pin for quick reference
FR31: A user can view their saved spots in a list
FR32: The system flags a pin for admin review when it receives ≥3 "Closed" or issue reports within a 48-hour period
FR33: An admin can view and manage flagged pins (review, archive, or override badge status)
FR34: An admin can manually create and publish new spot pins with admin-verified status
FR35: An admin can edit existing pin data (amenities, restrictions, coordinates, fee)
FR36: A first-time user is guided through rig profile setup before accessing the full map
FR37: The system immediately demonstrates rig-aware filtering after onboarding completes (map re-renders with rig filter applied)
FR38: A user can skip rig profile setup and access the map without a rig profile (with reduced filter capability)
FR39: The system enumerates all amenity=fuel, amenity=campsite, and tourism=camp_site nodes within a configured geographic bounding box using the OpenStreetMap Overpass API
FR40: For each enumerated location, the system fetches up to 5 street-level photos per location from Mapillary API and Google Places Photos API (Mapillary queried first; Google Places used as fallback when Mapillary coverage is insufficient)
FR41: The system runs each fetched photo through the faucet classifier ML model and records a confidence score (0.0–1.0) per photo per location
FR42: The system creates a water tap map pin for any location where at least one photo returns a classifier confidence score ≥0.75, recording the highest-confidence photo, score, source API, and scan timestamp
FR43: The system stores each water tap pin with location coordinates, place name, place type, access classification (unverified at ML-creation time), confidence score, data source, photos, seasonal availability notes, geographic reference (Mile Marker for Florida Keys), active status, and last verified date
FR44: The system links each water tap pin to a business location record to inherit business name, address, and operating hours
FR45: A user can submit a photo of an outdoor water tap at any location via the app; the system runs the photo through the faucet classifier and, if confidence ≥0.75, creates or confirms a tap pin at that location
FR46: A user can confirm or deny an existing water tap pin ("Still here" / "No longer here") from the pin detail view; each response is recorded as a verification event in an append-only log
FR47: The system displays a water tap pin's confidence source visually: ML-discovered pins show a model confidence indicator; user-confirmed pins show a community verification count; pins confirmed by ≥2 independent users are promoted to "verified" status

### NonFunctional Requirements

NFR-P1: The map and initial pin set must render within 3 seconds on a 4G cellular connection (measured from first navigation to interactive map)
NFR-P2: Pin filtering (rig-aware + amenity chips) must respond within 200ms of user input
NFR-P3: Pin detail sheet must open within 300ms of tap
NFR-P4: Check-in submission must complete (write + badge update) within 500ms
NFR-P5: JavaScript bundle size must not exceed 250KB gzipped (initial load); Leaflet + app combined
NFR-P6: Lighthouse Performance score must be ≥80 on mobile (tested on Moto G4 equivalent)
NFR-P7: Map tile requests must be client-cached; repeat viewport visits must not re-fetch tiles from CDN
NFR-S1: All client-server communication must use HTTPS
NFR-S2: No personally identifiable information is collected or stored server-side at MVP; rig profile and saved pins are localStorage-only
NFR-S3: Device fingerprinting for anonymous check-ins must use anonymous session tokens — no canvas fingerprinting
NFR-S4: Community check-in text notes must be sanitized server-side before storage to prevent XSS injection
NFR-S5: Admin operations must require authentication — admin endpoints must not be publicly accessible
NFR-S6: API keys for any paid services must be server-side only; no secrets exposed in client bundle
NFR-SC1: The system must support 200 MAU at MVP launch without infrastructure changes
NFR-SC2: The system must be architectable to support 5,000 MAU (12-month target) with horizontal scaling only
NFR-SC3: Overpass API requests must be cached server-side with a minimum 24-hour TTL to stay within public API rate limits at scale
NFR-SC4: Check-in writes must use a serverless/queue architecture to absorb spikes without database contention
NFR-A1: The product must meet WCAG 2.1 Level AA compliance
NFR-A2: All map pins must have aria-label attributes readable by screen readers: "[SpotName]: [category], verified [recency]"
NFR-A3: Recency status must be conveyed by both color AND icon/text — never color alone
NFR-A4: All interactive elements must meet minimum 44×44px touch target size
NFR-A5: Users with prefers-reduced-motion enabled must not experience map pan/zoom animations
NFR-A6: Minimum color contrast ratio of 4.5:1 for all text against background (WCAG AA)
NFR-I1: BLM/USFS/NPS API data must be refreshed at minimum every 24 hours; data older than 48 hours must be flagged as potentially stale
NFR-I2: OpenStreetMap Overpass API queries must use a server-side proxy with response caching — direct client-to-Overpass calls are prohibited in production
NFR-I3: CartoDB tile layer must fall back to standard OSM tiles if CartoDB CDN is unavailable (no blank map)
NFR-I4: Native maps handoff must support both maps:// (iOS) and geo:// (Android) URI schemes; desktop falls back to a web maps URL
NFR-I5: Geolocation API usage must degrade gracefully when permission is denied — search functionality must remain fully usable
NFR-R1: System uptime must be ≥99% during peak usage hours (6am–10pm local time), measured monthly
NFR-R2: Check-in write failures must be retried automatically up to 3 times before surfacing an error to the user
NFR-R3: Map must remain functional (browsable with cached data) even if data API calls fail
NFR-R4: No user-submitted check-in data may be silently lost; failed writes must be queued for retry or logged for admin recovery
NFR-ML1: The water tap ML batch scan pipeline must complete a full bounding box scan of ≤500 locations within 2 hours of scheduled trigger
NFR-ML2: The faucet classifier must achieve ≥80% precision on the Florida Keys ground truth validation set before any auto-created pins are published to the map
NFR-ML3: The batch scan pipeline must re-scan the Florida Keys corridor (Homestead → Marathon bounding box) at minimum every 30 days to detect newly installed or removed taps
NFR-ML4: The ML batch pipeline image sourcing must remain within each API provider's published rate limits at all times; rate limit violations must not cause pipeline scan failures or data loss
NFR-ML5: ML model weights and training data must not be accessible to end users or exposed via any client-facing interface

### Additional Requirements

**Architecture — Project Setup (Story 1.1 triggers):**
- Starter template: `npm create vite@latest overnighter -- --template react-ts && npx shadcn@latest init`
- Full dependency install: zustand, @tanstack/react-query, react-router-dom, leaflet, @supabase/supabase-js, zod + dev deps
- vercel.json SPA rewrite rule: `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`

**Architecture — Infrastructure Setup:**
- Supabase project creation + 4 migration files (pins, check_ins, issue_reports, overpass_cache tables)
- Vercel project connected to GitHub repository (auto CI/CD)
- GitHub Actions sync.yml for daily BLM/USFS/NPS data pipeline cron (2am UTC)
- Environment variables configured in Vercel: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_SECRET, SYNC_URL

**Architecture — State & API:**
- Zustand v5 stores: useRigStore (persisted), useSpotsStore (persisted), useUIStore
- TanStack Query v5 setup with QueryClient; useCheckinMutation and useReportMutation must set retry: 3
- React Router v7 route definitions: /, /pin/:id, /onboarding, /saved, /admin (lazy-loaded)
- Bearer token middleware (api/_middleware.ts) protecting admin serverless functions
- Supabase-to-TypeScript camelCase transform at src/lib/supabase/ boundary

**UX — Visual Design:**
- Dark theme tokens: background #0f172a, surface #1e293b, surface-raised #334155
- Recency colors: fresh #22c55e, recent #eab308, stale #ef4444, filtered #6b7280
- Brand accent: primary #0ea5e9
- 100dvh viewport height for iOS Safari address bar behavior
- Desktop split view at lg breakpoint (1024px+): map panel left, detail/search panel right

**Architecture — ML Pipeline Extension (Epic 6 triggers):**
- Supabase migrations 005–008: water_tap_pins table, tap_verification_events table, map_pins unified view, tap-photos storage bucket
- SageMaker endpoint activation + validation test using sample faucet photos (extends existing bb80f53 implementation)
- New serverless endpoints: POST /api/ml-scan (chunked, 50 locations/invocation), POST /api/tap-submit (multipart photo upload), POST /api/tap-verify (confirm/deny)
- src/features/water-taps/ module: TapPinDetailSheet, TapConfidenceBadge, TapPhotoSubmission, TapConfirmDeny components
- GitHub Actions sync.yml: monthly cron (0 3 1 * *) for ML batch scan; chunked curl loop until processed < limit
- New env vars: SAGEMAKER_ENDPOINT_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, ML_SCAN_URL (all server-only, never VITE_ prefixed)
- map_pins Supabase view unions pins + water_tap_pins; pin_category discriminator routes PinLayer.tsx to correct detail sheet
- tap-photos bucket: public read, service-role-key write only; path pattern tap-photos/{tap_pin_id}/{timestamp}.jpg; 5MB max

**UX — Component Patterns:**
- Map pin: custom SVG with recency color ring + amenity icon (not shadcn badge)
- Rig filter status bar: persistent map overlay showing "Filtering for: [class], [length]ft"
- Pin detail: shadcn Sheet (bottom sheet) sliding up on pin tap; swipe down to dismiss
- Check-in: 3-tap selector (status chips) + optional note field; custom component
- Onboarding rig setup: visual selectors (dropdowns/chips), not text fields; complete in <60 seconds
- Recency ring tooltip: single non-intrusive first-time tooltip "🟢 Green = verified this week"; dismisses on first tap, never shown again
- Check-in prompt copy: "How was [Spot Name] for your [rig class]? Help the next traveler."
- FAB "+" button (bottom right) for spot suggestion; "Missing a spot here?" on empty area tap
- Departure check-in: prompt appears once per stay at departure only — never mid-stay, never repeated

### FR Coverage Map

FR1: Epic 1 — Rig class selection during onboarding
FR2: Epic 1 — Rig length setup during onboarding
FR3: Epic 1 — Rig height setup during onboarding
FR4: Epic 1 — Rig profile localStorage persistence across sessions
FR5: Epic 1 — Edit rig profile at any time
FR6: Epic 1 — Rig-aware pre-filtering of map pins
FR7: Epic 2 — Map viewport with all stop pins
FR8: Epic 2 — Location search by name/address
FR9: Epic 2 — GPS "Near Me" centering
FR10: Epic 2 — Map pan and zoom
FR11: Epic 2 — All pin categories on single map layer
FR12: Epic 2 — Greyed-out inaccessible pins (rig filter visual)
FR13: Epic 2 — Amenity filter chips activation
FR14: Epic 2 — AND logic for active filter chips
FR15: Epic 2 — Deactivate individual filter chips
FR16: Epic 2 — Filters preserved on pan/zoom
FR17: Epic 2 — Freshness badge on every pin (green/yellow/red)
FR18: Epic 2 — Multi-source aggregation (BLM/USFS/NPS + Overpass + community)
FR19: Epic 2 — Multi-amenity display on single pin
FR20: Epic 4 — Badge update on check-in submission (optimistic)
FR21: Epic 3 — Pin detail sheet (name, amenities, fee, restrictions, badge)
FR22: Epic 3 — One-tap native navigation handoff
FR23: Epic 4 — Issue report from pin detail view
FR24: Epic 4 — Immediate badge degradation to red on issue report
FR25: Epic 4 — Departure-triggered check-in prompt
FR26: Epic 4 — Check-in status submission (Still open / Closed / Changed)
FR27: Epic 4 — Optional text note on check-in
FR28: Epic 4 — Anonymous check-in (no account, device UUID)
FR29: Epic 4 — Check-in updates pin badge and last-verified date
FR30: Epic 3 — Save a spot pin
FR31: Epic 3 — View saved spots list
FR32: Epic 5 — Auto-flag pin after threshold reports
FR33: Epic 5 — Admin view and manage flagged pins
FR34: Epic 5 — Admin create and publish new pin (admin-verified)
FR35: Epic 5 — Admin edit existing pin data
FR36: Epic 1 — First-time onboarding flow before map access
FR37: Epic 1 — Immediate rig filter demo after onboarding (map re-render)
FR38: Epic 1 — Skip onboarding option with reduced filter capability
FR39: Epic 6 — Overpass enumeration of fuel/campsite nodes within FL Keys bounding box (ml-scan pipeline)
FR40: Epic 6 — Fetch up to 5 street-level photos per location from Mapillary (primary) and Google Places Photos (fallback)
FR41: Epic 6 — Faucet classifier ML inference per photo; confidence score 0.0–1.0 recorded per photo per location
FR42: Epic 6 — Auto-create water tap pin when ≥1 photo confidence ≥0.75; highest-confidence photo, score, source, and scan timestamp recorded
FR43: Epic 6 — Water tap pin schema: coordinates, place name, place type, access, confidence, source, photos, seasonal notes, mile marker, active status, last verified date
FR44: Epic 6 — Water tap pin linked to business location record via place_ref (Google Places ID or OSM node ID)
FR45: Epic 6 — User photo submission flow: upload → classifier → create/confirm tap pin when confidence ≥0.75
FR46: Epic 6 — User confirm/deny (Still here / No longer here) appended as verification event to tap_verification_events
FR47: Epic 6 — ML-discovered pins show confidence indicator; user-confirmed pins show community count; ≥2 independent confirmations → "verified" status

## Epic List

### Epic 1: Project Foundation & Rig Profile Onboarding
Users can install the app, set up their rig profile in under 60 seconds, and immediately see the map filtered specifically for their vehicle — the first "aha" moment that differentiates Overnighter from every other map app.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR36, FR37, FR38
**Architecture stories:** Project initialization, Supabase schema, Vercel deployment, GitHub Actions cron, environment variables

### Epic 2: Map Discovery & Rig-Aware Filtering
Users can browse the full map with all stop categories in one view, see freshness badges at a glance, filter by amenity needs, and discover exactly which spots fit their rig — completing the core daily planning loop.
**FRs covered:** FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR18, FR19

### Epic 3: Pin Detail, Navigation & Spot Saving
Users can tap any pin to see complete stop information, launch native navigation in one tap, and save favorite spots for quick future reference — closing the loop from discovery to committed route.
**FRs covered:** FR21, FR22, FR30, FR31

### Epic 4: Community Check-In & Issue Reporting
Users can submit 3-tap departure check-ins and real-time issue reports, immediately updating freshness badges for all travelers — activating the community data flywheel that makes Overnighter self-sustaining.
**FRs covered:** FR20, FR23, FR24, FR25, FR26, FR27, FR28, FR29

### Epic 5: Admin Data Quality Operations
The founder/admin can manage pin accuracy at scale — reviewing auto-flagged pins, seeding new spots with admin-verified status, and editing existing data — maintaining the map quality that users trust.
**FRs covered:** FR32, FR33, FR34, FR35

### Epic 6: Water Tap Discovery & ML Pipeline
Keys corridor travelers can see ML-discovered water tap pins on the map, submit photos of taps they find, and confirm or deny existing pins — giving the Florida Keys corridor reliable water tap data that no other app provides.
**FRs covered:** FR39, FR40, FR41, FR42, FR43, FR44, FR45, FR46, FR47
**NFRs addressed:** NFR-ML1, NFR-ML2, NFR-ML3, NFR-ML4, NFR-ML5
**Architecture stories:** Supabase migrations 005–008, SageMaker endpoint activation, /api/ml-scan + /api/tap-submit + /api/tap-verify endpoints, features/water-taps/ module, GitHub Actions monthly cron

---

## Epic 1: Project Foundation & Rig Profile Onboarding

Users can set up their rig profile and see a personalized rig-filtered map on their very first use — the foundational "aha" moment that differentiates Overnighter from every other map app.

### Story 1.1: Project Initialization & Infrastructure Setup

As a developer,
I want a fully configured project foundation deployed to production,
So that all subsequent features can be built, tested, and shipped on a stable, production-ready base.

**Acceptance Criteria:**

**Given** the repository is cloned on a development machine
**When** the developer runs `npm install && npm run dev`
**Then** the Vite 8 + React 19 + TypeScript app starts on localhost:5173 with no errors
**And** hot module replacement works on file save

**Given** the project is initialized
**When** the developer runs `npx shadcn@latest init`
**Then** Tailwind CSS is configured, `components.json` is present, path aliases (`@/`) resolve correctly, and the `cn()` utility is available

**Given** all dependencies are installed
**When** the developer checks `package.json`
**Then** the following are present: `zustand`, `@tanstack/react-query`, `react-router-dom`, `leaflet`, `@supabase/supabase-js`, `zod`, `@tanstack/react-query-devtools`, `@types/leaflet`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`

**Given** the Supabase project is created
**When** the developer runs the migration files
**Then** four tables exist: `pins`, `check_ins`, `issue_reports`, `overpass_cache` with correct columns and types as defined in the architecture

**Given** the repository is connected to Vercel
**When** a commit is pushed to `main`
**Then** Vercel automatically builds and deploys the app to the production URL with HTTPS

**Given** `vercel.json` contains the SPA rewrite rule `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`
**When** a user navigates directly to `/onboarding` or any React Router route
**Then** the app loads correctly without a 404 error

**Given** `.env.example` is committed to the repository
**When** a developer reviews it
**Then** all required environment variables are listed: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET`, `SYNC_URL`

**Given** `.github/workflows/sync.yml` exists
**When** the developer reviews it
**Then** a cron job is defined for `0 2 * * *` (2am UTC) that calls `POST /api/sync` with the Bearer token from secrets

**Given** the app loads in a browser
**When** the app initializes
**Then** Sentry is initialized in `main.tsx` and Vercel Analytics script is active (no console errors)

---

### Story 1.2: Rig Profile Onboarding Form

As a first-time user,
I want to set my rig class, length, and height using visual selectors before accessing the map,
So that I can complete my profile in under 60 seconds without typing and immediately get a personalized experience.

**Acceptance Criteria:**

**Given** a user opens the app for the first time (no rig profile in localStorage)
**When** the app loads
**Then** the user is automatically redirected to `/onboarding` before seeing the map

**Given** the user is on the onboarding screen
**When** they view the rig class selector
**Then** five options are displayed as visual chips or cards: Class A, Class B, Class C, Travel Trailer, 5th Wheel — not a text input

**Given** the user is on the onboarding screen
**When** they view the rig length selector
**Then** a numeric input or slider is shown labeled in feet, with a valid range of 10–65ft

**Given** the user is on the onboarding screen
**When** they view the rig height selector
**Then** a numeric input is shown in feet and inches format (e.g., 12ft 6in), with a valid range of 6ft–16ft

**Given** the user has selected rig class, length, and height
**When** they tap the "Save My Rig" button
**Then** the rig profile is saved to the Zustand `useRigStore` and persisted to localStorage
**And** the user is redirected to the map view at `/`

**Given** a user is on the onboarding screen
**When** they tap "Skip for now"
**Then** they are redirected to the map without a rig profile saved
**And** no rig filtering is applied to map pins (FR38)

**Given** the onboarding form
**When** a user attempts to save without selecting a rig class
**Then** an inline validation message is shown and the form cannot be submitted

**Given** the onboarding screen on a mobile device
**When** the user interacts with any selector or button
**Then** all interactive elements meet the minimum 44×44px touch target size (NFR-A4)

---

### Story 1.3: Rig Profile Persistence & Edit

As a returning user,
I want my rig profile to be remembered between sessions and editable at any time,
So that I never have to re-enter my rig details and can update them when I change vehicles.

**Acceptance Criteria:**

**Given** a user has completed onboarding and saved a rig profile
**When** they close the browser and reopen the app
**Then** the rig profile is loaded from localStorage and the user lands directly on the map (not onboarding)

**Given** a user has a saved rig profile
**When** they navigate to the rig profile edit screen (accessible from app settings/menu)
**Then** all three fields (class, length, height) are pre-populated with the saved values

**Given** a user is editing their rig profile
**When** they change one or more values and tap "Save"
**Then** the Zustand `useRigStore` updates immediately
**And** the localStorage value is updated
**And** the user is returned to the map with the updated filter applied

**Given** a user is editing their rig profile
**When** they tap "Cancel" without saving
**Then** the original profile values are preserved unchanged

**Given** the localStorage rig profile data
**When** any component reads rig profile values
**Then** they are always read from the Zustand store — never directly from localStorage

**Given** a user with a saved rig profile
**When** they view the app on any page
**Then** a persistent rig context indicator is visible on the map showing "Filtering for: [class], [length]ft"

---

### Story 1.4: Map Shell & Rig Filter Reveal

As a user who just completed onboarding,
I want to see the map immediately re-render with spots greyed out for rigs that don't fit my profile,
So that I experience the immediate payoff of setting up my rig and understand the app's core value.

**Acceptance Criteria:**

**Given** a user has just saved their rig profile during onboarding
**When** they are redirected to the map view
**Then** a Leaflet map renders centered on the user's approximate location (or a default US location if GPS is denied)
**And** CartoDB Dark Matter tiles are loaded

**Given** the map renders with seed pin data from Supabase
**When** the rig profile is active
**Then** pins that exceed the user's rig constraints (length or height) are displayed in a visually distinct greyed-out state
**And** pins that fit the rig are displayed in full color

**Given** the map renders
**When** pins load
**Then** a persistent "Filtering for: [RigClass], [length]ft" status bar is visible on the map at all times (not hidden)

**Given** a user with no rig profile (skipped onboarding)
**When** the map renders
**Then** all pins are displayed in full color (no greying applied)
**And** the rig status bar shows "No rig profile — set up your rig for filtered results"

**Given** the map is loading pins from Supabase
**When** pins are being fetched
**Then** skeleton pin markers are displayed on the map — the map remains interactive and pannable during load (no full-screen spinner)

**Given** the initial map load on a 4G connection
**When** measured from first navigation to interactive map
**Then** the map renders within 3 seconds (NFR-P1)

**Given** Leaflet is imported
**When** the map component mounts
**Then** Leaflet is loaded via dynamic import (`React.lazy` / dynamic import) — not in the main bundle
**And** the total initial JS bundle does not exceed 250KB gzipped (NFR-P5)

**Given** a user on iOS Safari
**When** the map renders
**Then** the map uses `100dvh` for viewport height (not `100vh`) so the address bar does not overlap the map
**And** the Leaflet `tap: false` option is set to prevent iOS double-tap issues

---

## Epic 2: Map Discovery & Rig-Aware Filtering

Users can browse the full map, discover stops pre-filtered for their rig with freshness signals visible at a glance, and use amenity filter chips to find exactly what they need — completing the core daily planning loop.

### Story 2.1: Location Search & GPS "Near Me"

As a user,
I want to search for a location by name or address, or tap "Near Me" to center the map on my current GPS position,
So that I can quickly navigate to the area I'm planning to stop in without manual map panning.

**Acceptance Criteria:**

**Given** the map view is displayed
**When** the user types a location name or address into the search field
**Then** matching results appear as a dropdown list within 500ms
**And** selecting a result re-centers the map on that location

**Given** the map view is displayed
**When** the user taps the "Near Me" button
**Then** the browser requests geolocation permission
**And** if granted, the map re-centers on the user's current GPS coordinates

**Given** the user taps "Near Me"
**When** the browser geolocation permission is denied
**Then** the map remains on its current position
**And** a non-blocking inline message is shown: "Location access denied — search for a place to get started"
**And** the search field remains fully functional (NFR-I5)

**Given** the user taps "Near Me"
**When** the GPS fix takes more than 3 seconds
**Then** a loading indicator is shown on the "Near Me" button
**And** the map does not freeze or block interaction during the wait

**Given** the app is accessed over HTTP (not HTTPS)
**When** the user taps "Near Me"
**Then** the geolocation API is unavailable and a graceful fallback message is shown (NFR-S1)

---

### Story 2.2: Full Pin Layer with Rig-Aware Greying

As a user,
I want to see all stop pins across all categories on a single map layer, with pins my rig cannot access displayed in a greyed-out state rather than hidden,
So that I can see the full landscape of stops while knowing at a glance which ones fit my rig.

**Acceptance Criteria:**

**Given** the map renders with a rig profile saved
**When** pins load from Supabase
**Then** all pins are displayed simultaneously on one layer — overnight, dump, water, fuel, propane, electric, shower categories all visible together (FR11)

**Given** a pin's rig constraints (max length or max height) are exceeded by the saved rig profile
**When** that pin renders on the map
**Then** it is displayed in a greyed-out visual state (reduced opacity, grey color ring)
**And** it remains visible on the map — it is never hidden (FR12)

**Given** a greyed-out pin
**When** the user taps it
**Then** the pin detail sheet opens and clearly indicates why it is filtered: "This spot may not fit your [class], [length]ft rig"

**Given** all pins render on the map
**When** a screen reader reads a pin
**Then** the pin has an `aria-label` in the format: "[SpotName]: [category], verified [recency]" (NFR-A2)

**Given** the user pans or zooms the map
**When** new pins enter the viewport
**Then** pins load progressively — skeleton markers appear first, then resolve to full pin markers
**And** the map remains pannable and interactive during pin loading

**Given** pins are filtering based on rig profile in memory
**When** the user changes the rig profile
**Then** the rig filter re-applies within 200ms with no server round trip (NFR-P2)

**Given** a user has `prefers-reduced-motion` enabled
**When** the map pans or zooms
**Then** smooth pan/zoom animations are disabled (NFR-A5)

---

### Story 2.3: Recency Badge Display

As a user,
I want every pin to display a freshness badge as the dominant visual signal showing how recently it was verified,
So that I can assess data trustworthiness at a glance without tapping a pin.

**Acceptance Criteria:**

**Given** a pin's last verified date is less than 7 days ago
**When** the pin renders on the map
**Then** the recency badge displays as green (fresh)

**Given** a pin's last verified date is 8–30 days ago
**When** the pin renders on the map
**Then** the recency badge displays as yellow (recent)

**Given** a pin's last verified date is more than 30 days ago, or the pin has never been verified
**When** the pin renders on the map
**Then** the recency badge displays as red (stale)

**Given** a pin renders on the map
**When** a user views it
**Then** the recency badge is the most visually prominent element on the pin marker — larger visual weight than the category icon

**Given** a pin's recency badge
**When** it is displayed
**Then** freshness is conveyed by BOTH color AND an icon or text label — never color alone (NFR-A3)
**And** minimum color contrast ratio of 4.5:1 is met for all badge text against its background (NFR-A6)

**Given** a pin displays multiple amenities (e.g., dump + water + overnight)
**When** it renders on the map
**Then** a single pin marker is shown with all amenities represented (no duplicate markers per location) (FR19)

**Given** a user has not seen the recency badge before (first session)
**When** they first view the map with pins
**Then** a single non-intrusive tooltip is shown once: "Green = verified this week" — it dismisses on first tap and never appears again

---

### Story 2.4: Multi-Source Data Pipeline

As a user,
I want the map to display aggregated stop data from BLM/USFS/NPS public land APIs, OpenStreetMap Overpass, and community check-ins in a unified view,
So that I see all available stops in one place without switching apps or cross-referencing sources.

**Acceptance Criteria:**

**Given** the GitHub Actions sync.yml cron runs at 2am UTC daily
**When** `POST /api/sync` is called with a valid Bearer token
**Then** the function fetches BLM/USFS/NPS API data, normalizes it to the unified pin model, and upserts to the `pins` Supabase table

**Given** BLM/USFS/NPS data has been synced
**When** data is older than 48 hours
**Then** affected pins are flagged as potentially stale (NFR-I1)

**Given** the client requests OpenStreetMap Overpass data for a viewport
**When** the request is made
**Then** it goes through `GET /api/overpass` (server-side proxy) — direct client-to-Overpass calls never occur (NFR-I2)

**Given** an Overpass query is proxied through `GET /api/overpass`
**When** the same bounding box is requested within 24 hours
**Then** the cached response from the `overpass_cache` Supabase table is returned — no new Overpass API call is made (NFR-SC3)

**Given** all pin sources (BLM/USFS/NPS, Overpass, community)
**When** a pin is stored in Supabase
**Then** it follows the unified pin model with a `source` field indicating its origin

**Given** the CartoDB Dark Matter tile layer
**When** the CartoDB CDN is unavailable
**Then** the map automatically falls back to standard OSM tiles — no blank map is shown (NFR-I3)

**Given** the map is loaded and the data API is unavailable
**When** the user browses the map
**Then** previously cached pin data (TanStack Query stale-while-revalidate) continues to display
**And** the map remains fully browsable (NFR-R3)

---

### Story 2.5: Amenity Filter Chips

As a user,
I want to activate one or more amenity filter chips that persist as I pan and zoom the map,
So that I can quickly narrow results to exactly the services I need right now (e.g., dump + water only).

**Acceptance Criteria:**

**Given** the map view is displayed
**When** the user views the filter bar
**Then** a horizontally scrollable row of amenity chips is visible above the map: Water, Dump, Overnight, Fuel, Propane, Electric, Shower
**And** the chip bar is never hidden behind a modal or hamburger menu

**Given** no filter chips are active
**When** the user taps a single chip (e.g., "Dump")
**Then** only pins offering dump services are shown in full color
**And** all other pins are either greyed or hidden based on rig filter state

**Given** one filter chip is active
**When** the user taps a second chip (e.g., "Water")
**Then** AND logic applies — only pins offering BOTH dump AND water are shown in full color (FR14)

**Given** one or more filter chips are active
**When** the user taps an active chip to deactivate it
**Then** that filter is removed and the pin display updates accordingly (FR15)

**Given** active filter chips are set
**When** the user pans or zooms the map
**Then** the active filter chips remain applied — they are not reset on viewport change (FR16)

**Given** filter chips are applied
**When** the pin filter recalculates
**Then** the result updates within 200ms of chip tap — client-side in-memory filtering, no server round trip (NFR-P2)

**Given** all filter chips are inactive
**When** the map renders
**Then** all pins (that pass the rig filter) are displayed in full color

**Given** a filter chip is active
**When** no pins in the current viewport match the active filters
**Then** the map shows an empty state message: "No matching spots in this area — try zooming out or adjusting filters"

---

## Epic 3: Pin Detail, Navigation & Spot Saving

Users can view complete stop information, navigate to a spot in one tap, and save favorites for quick reference — closing the loop from discovery to committed route.

### Story 3.1: Pin Detail Sheet

As a user,
I want to tap any map pin and see a bottom sheet with the stop's full details,
So that I can make a confident go/no-go decision without leaving the app.

**Acceptance Criteria:**

**Given** the map is displayed with pins
**When** the user taps a pin marker
**Then** a bottom sheet slides up from the bottom of the screen within 300ms (NFR-P3)
**And** the map remains visible behind the sheet

**Given** the pin detail sheet is open
**When** the user views it
**Then** the following information is displayed: stop name, stop type/category, amenities list (icons + labels), fee (or "Free"), rig restrictions (max length, max height), last verified date, recency badge (green/yellow/red with icon), and any community notes

**Given** the pin detail sheet is open for a pin with multiple amenities
**When** the user views the amenities section
**Then** all amenities offered at that location are listed (e.g., Dump, Water, Fuel, Overnight) — not just the primary category

**Given** the pin detail sheet is open
**When** the user's rig profile exceeds the pin's rig restrictions
**Then** a clear inline notice is shown: "This spot may not fit your [class], [length]ft rig"

**Given** the pin detail sheet is open
**When** the user swipes down on the sheet
**Then** the sheet dismisses and the map returns to full view

**Given** the pin detail sheet is open on a deep-linked URL (`/pin/:id`)
**When** the user shares the URL with another person
**Then** that person can open the same pin detail sheet directly

**Given** the pin detail sheet is open
**When** a screen reader is active
**Then** all content is announced in a logical order: name, type, recency, amenities, fee, restrictions, notes

---

### Story 3.2: One-Tap Navigation

As a user,
I want to launch native navigation to a stop with a single tap from the pin detail sheet,
So that the transition from planning to driving is instant with no copy-pasting or app-switching friction.

**Acceptance Criteria:**

**Given** the pin detail sheet is open
**When** the user taps the "Get Directions" button
**Then** the device's native maps application opens with the pin's coordinates pre-filled as the destination

**Given** the user taps "Get Directions" on an iOS device
**When** the native maps handoff executes
**Then** the `maps://` URI scheme is used to open Apple Maps with the destination set

**Given** the user taps "Get Directions" on an Android device
**When** the native maps handoff executes
**Then** the `geo://` URI scheme is used to open the default maps app with the destination set (NFR-I4)

**Given** the user taps "Get Directions" on a desktop browser
**When** the native maps handoff executes
**Then** a web maps URL (Google Maps) opens in a new browser tab with the destination pre-filled (NFR-I4)

**Given** the "Get Directions" button
**When** it renders
**Then** it meets the minimum 44×44px touch target size (NFR-A4)
**And** it is visually prominent — the primary CTA in the pin detail sheet

---

### Story 3.3: Spot Saving & Saved Spots List

As a user,
I want to save a spot pin for quick reference and view all my saved spots in a list,
So that I can bookmark promising stops and return to them without searching the map again.

**Acceptance Criteria:**

**Given** the pin detail sheet is open
**When** the user taps the save/bookmark icon
**Then** the spot is added to the `useSpotsStore` Zustand store
**And** the store persists the saved spots array to localStorage immediately
**And** the bookmark icon updates to a filled/active state

**Given** a spot is already saved
**When** the user opens the same pin detail sheet
**Then** the bookmark icon is shown in its active/filled state

**Given** a spot is saved and the user taps the active bookmark icon
**When** the action completes
**Then** the spot is removed from `useSpotsStore` and localStorage
**And** the bookmark icon returns to its inactive state

**Given** the user navigates to `/saved`
**When** the saved spots list renders
**Then** all saved spots are displayed as a scrollable list with: spot name, category, last verified recency badge, and distance from current location (if GPS available)

**Given** the saved spots list is displayed
**When** the user taps a spot in the list
**Then** the map re-centers on that spot and opens its pin detail sheet

**Given** the user has no saved spots
**When** they navigate to `/saved`
**Then** an empty state is shown: "No saved spots yet — tap the bookmark icon on any pin to save it"

**Given** saved spots are stored in localStorage
**When** the user closes and reopens the app
**Then** all previously saved spots are still present in the list

---

## Epic 4: Community Check-In & Issue Reporting

Users can submit 3-tap departure check-ins and real-time issue reports, immediately updating freshness badges for all travelers — activating the community data flywheel that makes Overnighter self-sustaining.

### Story 4.1: Anonymous Device Identity

As the system,
I want to assign each device a persistent anonymous UUID on first app load,
So that check-ins can be attributed to a device without collecting any personally identifiable information.

**Acceptance Criteria:**

**Given** a user opens the app for the first time
**When** the app initializes
**Then** `crypto.randomUUID()` is called once and the result is stored in localStorage under a dedicated key (separate from the rig profile key)

**Given** a device UUID has been generated and stored
**When** the user closes and reopens the app
**Then** the same UUID is retrieved from localStorage — a new UUID is never generated for an existing device

**Given** the device UUID is read
**When** any component or hook accesses it
**Then** it is always read via the `useDeviceId` hook — never directly from localStorage in components

**Given** the device UUID in localStorage
**When** it is inspected
**Then** it contains no rig profile data, no location data, and no user-identifiable information (NFR-S2)

**Given** the anonymous UUID method
**When** it is implemented
**Then** `crypto.randomUUID()` is used — no canvas fingerprinting, no third-party fingerprinting library (NFR-S3)

---

### Story 4.2: Departure-Triggered Check-In Prompt

As a user,
I want to be prompted once to submit a check-in when I depart a location I previously viewed or saved,
So that the contribution moment arrives naturally at the right time without requiring me to remember or seek out the feature.

**Acceptance Criteria:**

**Given** a user has viewed or saved a pin during a session
**When** the user reopens the app and their GPS location is within proximity of that pin (within 0.5 miles)
**Then** a departure check-in prompt is displayed: "How was [Spot Name] for your [rig class]? Help the next traveler."

**Given** the departure prompt has been shown for a specific pin visit
**When** the user dismisses or completes the check-in
**Then** the prompt is never shown again for that same visit (once-per-stay rule)

**Given** the user is still at the location (within proximity)
**When** the app opens
**Then** no departure prompt is shown — the prompt only triggers when the user has moved away

**Given** GPS permission has been denied
**When** the app opens after a user viewed a pin
**Then** no departure prompt is shown — the prompt gracefully does not appear without GPS (NFR-I5)

**Given** the departure prompt is displayed
**When** the user taps "Skip"
**Then** the prompt dismisses without submitting a check-in
**And** the once-per-stay flag is still set (prompt will not reappear for this visit)

**Given** the departure prompt is displayed
**When** the user taps "Check In"
**Then** the check-in form opens (Story 4.3)

---

### Story 4.3: Check-In Submission & Badge Update

As a user,
I want to submit a 3-tap check-in confirming a spot's current status with an optional note, and see the freshness badge update immediately,
So that my contribution takes effect instantly and the next traveler benefits within seconds.

**Acceptance Criteria:**

**Given** the check-in form is open
**When** the user views the status selector
**Then** three status options are displayed as tappable chips: "Still Open", "Closed", "Changed"

**Given** the user selects a status
**When** they tap "Submit Check-In"
**Then** the check-in is submitted to `POST /api/checkin` with `{ pinId, deviceId, status, note?, timestamp }`
**And** the pin's recency badge updates to green immediately on the user's device (optimistic update via TanStack Query)

**Given** the check-in mutation fires
**When** `onMutate` executes
**Then** the TanStack Query cache is optimistically updated with the new badge state before the server responds (FR20)

**Given** the server responds successfully to `POST /api/checkin`
**When** `onSettled` executes
**Then** the `['pins', viewport]` query is invalidated and refetched to confirm server truth

**Given** the check-in form is open
**When** the user adds an optional text note (e.g., "Fee is now $12")
**Then** the note is included in the submission payload
**And** the note field is never required — the form can be submitted without it (FR27)

**Given** the check-in is submitted
**When** the server writes the `check_ins` row to Supabase
**Then** the check-in note is sanitized server-side before storage to prevent XSS injection (NFR-S4)

**Given** `POST /api/checkin` fails on the first attempt
**When** the mutation retries
**Then** it automatically retries up to 3 times with exponential backoff (NFR-R2)
**And** on all 3 failures, a user-facing toast is shown: "Couldn't save check-in. Tap to retry."

**Given** all 3 retry attempts fail
**When** the final failure occurs
**Then** the failed check-in is logged to Sentry — no data is silently lost (NFR-R4)

**Given** the check-in submission completes (success or failure)
**When** measured from tap to badge update
**Then** the optimistic badge update appears within 500ms (NFR-P4)

**Given** the check-in is recorded in Supabase
**When** the `check_ins` row is written
**Then** it contains only: `pin_id`, `device_id` (anonymous UUID), `status`, `note` (nullable), `created_at` — no PII (NFR-S2)

---

### Story 4.4: Issue Reporting & Immediate Badge Degradation

As a user,
I want to report an issue on a spot directly from its pin detail view and see the badge immediately degrade to red,
So that other travelers are warned before driving to a problematic location.

**Acceptance Criteria:**

**Given** the pin detail sheet is open
**When** the user taps "Report an Issue"
**Then** an issue report sheet slides up with issue type options: "Dump station closed", "Water unavailable", "Overnight parking prohibited", "Access blocked", "Other"

**Given** the user selects an issue type and taps "Submit Report"
**When** the report is submitted to `POST /api/report`
**Then** the pin's recency badge immediately degrades to red on the user's device (optimistic update) (FR24)

**Given** the issue report mutation fires
**When** `onMutate` executes
**Then** the TanStack Query cache is optimistically updated to red badge state before the server responds

**Given** the server responds to `POST /api/report`
**When** `onSettled` executes
**Then** the pin query is invalidated and refetched to confirm server badge state

**Given** the issue report is submitted
**When** the server writes the `issue_reports` row
**Then** the `issue_report` row contains: `pin_id`, `device_id`, `type`, `created_at` — no PII
**And** any free-text content is sanitized server-side before storage (NFR-S4)

**Given** the `POST /api/report` call fails
**When** the mutation retries
**Then** it automatically retries up to 3 times (NFR-R2)
**And** on final failure, an actionable error toast is shown and the failure is logged to Sentry (NFR-R4)

**Given** a pin has accumulated issue reports
**When** the server processes the report
**Then** the pin's `last_verified_date` is updated server-side to reflect the issue report (FR29)

**Given** the issue report sheet
**When** it renders on a mobile device
**Then** all issue type options meet the 44×44px minimum touch target (NFR-A4)

---

## Epic 5: Admin Data Quality Operations

The founder/admin can manage pin accuracy at scale — reviewing auto-flagged pins, seeding new spots with admin-verified status, and editing existing data — maintaining the map quality that users trust.

### Story 5.1: Admin Authentication Gate

As an admin,
I want the admin dashboard to be protected by a Bearer token gate,
So that admin operations are never publicly accessible and no secrets are exposed in the client bundle.

**Acceptance Criteria:**

**Given** the user navigates to `/admin`
**When** the route loads
**Then** the admin chunk is loaded via `React.lazy()` — it is not included in the main JS bundle (NFR-P5)

**Given** the `/admin` route loads
**When** the admin auth gate renders
**Then** a token input form is shown asking for the admin secret

**Given** the admin enters the correct Bearer token and submits
**When** the token is validated
**Then** access to the admin dashboard is granted for the current session
**And** the token is stored in sessionStorage (not localStorage) — cleared when the tab closes

**Given** the admin enters an incorrect Bearer token
**When** they submit
**Then** an error is shown: "Invalid admin token" and access is denied

**Given** any admin serverless function (`DELETE /api/pins/:id`, `PATCH /api/pins/:id/verify`, `POST /api/sync`)
**When** a request arrives without a valid `Authorization: Bearer <secret>` header
**Then** the function returns `{ "error": "UNAUTHORIZED", "message": "Admin access required", "status": 401 }` and takes no action (NFR-S5)

**Given** the `ADMIN_SECRET` environment variable
**When** it is accessed
**Then** it is only available server-side in Vercel environment variables — it is never prefixed with `VITE_` and never appears in the client bundle (NFR-S6)

**Given** the `api/_middleware.ts` Bearer token check
**When** it is applied
**Then** it is shared across all admin serverless functions — the check is never duplicated inline per function

---

### Story 5.2: Flagged Pin Review Queue

As an admin,
I want to see a list of pins auto-flagged by the system and be able to archive or override their badge status,
So that data quality issues surface automatically and I can resolve them without manually scanning the entire map.

**Acceptance Criteria:**

**Given** a pin receives ≥3 "Closed" or issue reports within a 48-hour period
**When** the server processes the incoming report
**Then** the pin's `flagged` field in Supabase is set to `true` (FR32)

**Given** the admin is authenticated and views the admin dashboard
**When** the flagged pins section loads
**Then** all pins with `flagged = true` are displayed in a list with: pin name, coordinates, flag count, most recent report type, and current badge state

**Given** the admin reviews a flagged pin
**When** they tap "Archive Pin"
**Then** `DELETE /api/pins/:id` is called with the Bearer token
**And** the pin is removed from public map display
**And** the pin is marked as archived in Supabase (not hard-deleted)

**Given** the admin reviews a flagged pin
**When** they tap "Override Badge — Mark Verified"
**Then** `PATCH /api/pins/:id/verify` is called with the Bearer token
**And** the pin's `last_verified_date` is updated to now, badge recalculates to green
**And** the pin's `flagged` field is reset to `false`

**Given** the admin reviews a flagged pin
**When** they tap "Dismiss Flag" (no action needed)
**Then** the pin's `flagged` field is reset to `false` without changing badge state

**Given** there are no flagged pins
**When** the admin views the flag queue
**Then** an empty state is shown: "No flagged pins — map data is healthy"

---

### Story 5.3: Admin Pin Creation

As an admin,
I want to manually create and publish new spot pins with admin-verified status,
So that I can seed the map with high-quality founder-verified spots before community data fills in.

**Acceptance Criteria:**

**Given** the admin is authenticated and views the admin dashboard
**When** they tap "Add New Pin"
**Then** a pin creation form is shown with fields: name, stop type/category, latitude, longitude, amenities (multi-select checkboxes), fee, max rig length, max rig height, notes

**Given** the admin fills in all required fields (name, coordinates, at least one amenity)
**When** they tap "Publish Pin"
**Then** `POST /api/sync` or a dedicated admin create endpoint is called with the Bearer token
**And** a new row is inserted into the `pins` Supabase table with `source = 'admin'` and `last_verified_date = now()`

**Given** a pin is created by the admin
**When** it appears on the public map
**Then** its recency badge is green (just verified)
**And** it is visually indistinguishable from other green-badged pins — no special admin badge shown to users

**Given** the admin submits the form with missing required fields
**When** validation runs
**Then** inline error messages are shown for each missing field and the form cannot be submitted

**Given** the admin enters invalid coordinates (outside continental US bounds)
**When** they attempt to submit
**Then** a validation error is shown: "Coordinates appear to be outside the supported region"

---

### Story 5.4: Admin Pin Editing

As an admin,
I want to edit any existing pin's data including amenities, restrictions, coordinates, and fee,
So that I can correct inaccurate information immediately without waiting for a data pipeline re-run.

**Acceptance Criteria:**

**Given** the admin is authenticated and views the admin dashboard
**When** they search for or select an existing pin
**Then** an edit form is shown pre-populated with all current pin data: name, category, coordinates, amenities, fee, max rig length, max rig height, notes

**Given** the admin modifies one or more fields and taps "Save Changes"
**When** the update is submitted
**Then** `PATCH /api/pins/:id` is called with the Bearer token and the updated fields
**And** the `pins` row in Supabase is updated immediately

**Given** the admin updates a pin's amenities
**When** the change is saved
**Then** the pin's amenity display updates on the public map within the next TanStack Query refetch cycle (stale-while-revalidate)

**Given** the admin edits a pin and taps "Cancel"
**When** the action completes
**Then** no changes are written to Supabase and the pin data is unchanged

**Given** the `PATCH /api/pins/:id` serverless function
**When** it receives the request
**Then** it validates the request body with Zod before writing to Supabase — invalid field values are rejected with a `400` error response

**Given** the admin saves changes to a pin
**When** the update completes successfully
**Then** a confirmation toast is shown: "Pin updated successfully"
**And** the admin dashboard returns to the pin list view

---

## Epic 6: Water Tap Discovery & ML Pipeline

Keys corridor travelers can see ML-discovered water tap pins on the map, submit photos of taps they find, and confirm or deny existing pins — giving the Florida Keys corridor reliable water tap data that no other app provides.

### Story 6.1: Water Tap Database Schema & Storage Setup

As a developer,
I want the Supabase database extended with water tap pin tables, a unified map pins view, and a photo storage bucket,
So that all subsequent ML pipeline and user-facing tap features have a stable, production-ready data layer to build on.

**Acceptance Criteria:**

**Given** the developer runs Supabase migration 005
**When** the migration completes
**Then** a `water_tap_pins` table exists with columns: `id` (UUID PK), `location` (GEOGRAPHY POINT), `place_name` (TEXT), `place_type` (TEXT: gas_station | campground | restaurant), `access` (TEXT nullable), `confidence` (NUMERIC 3,2), `source` (TEXT: ml_batch | user_submission | manual), `photos` (TEXT[] default '{}'), `seasonal_notes` (TEXT nullable), `mile_marker` (NUMERIC 5,1 nullable), `is_active` (BOOLEAN default TRUE), `verified_date` (TIMESTAMPTZ nullable), `place_ref` (TEXT nullable), `created_at` (TIMESTAMPTZ default NOW()), `updated_at` (TIMESTAMPTZ default NOW())
**And** three indexes exist: `idx_water_tap_pins_location` (GIST on location), `idx_water_tap_pins_is_active` (on is_active), `idx_water_tap_pins_mile_marker` (partial, on mile_marker where NOT NULL)

**Given** the developer runs Supabase migration 006
**When** the migration completes
**Then** a `tap_verification_events` table exists with columns: `id` (UUID PK), `tap_pin_id` (UUID FK → water_tap_pins.id), `device_id` (TEXT), `event_type` (TEXT: confirmed | denied | ml_scan | user_submission), `confidence` (NUMERIC 3,2 nullable), `photo_url` (TEXT nullable), `created_at` (TIMESTAMPTZ default NOW())
**And** index `idx_tap_verification_tap_pin_id` exists on tap_pin_id
**And** the table has no UPDATE or DELETE grants — it is append-only

**Given** the developer runs Supabase migration 007
**When** the migration completes
**Then** a `map_pins` view exists that UNION ALLs `pins` (with `pin_category = 'regular'`) and `water_tap_pins` (with `pin_category = 'water_tap'`), filtering both on `is_active = TRUE`
**And** the view exposes at minimum: `id`, `location`, `pin_category`, `place_name`

**Given** the developer runs Supabase migration 008
**When** the migration completes
**Then** a `tap-photos` Supabase Storage bucket exists with public read access and service-role-key-only write access
**And** the bucket enforces a 5MB maximum file size

**Given** the `.env.example` file is reviewed
**When** the developer inspects it
**Then** the following server-only (non-VITE_) environment variables are documented: `SAGEMAKER_ENDPOINT_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `ML_SCAN_URL`
**And** none of these variables are prefixed with `VITE_` — they must never appear in the client bundle (NFR-ML5)

**Given** the Vercel project settings
**When** the admin reviews the environment variables
**Then** all five new server-only variables are configured in Vercel's environment — absent from the client bundle in the production build (NFR-S6, NFR-ML5)

---

### Story 6.2: SageMaker Endpoint Activation & Precision Validation

As a developer,
I want the existing faucet classifier SageMaker endpoint activated and validated against the Florida Keys ground truth test set,
So that the ML pipeline can only auto-publish water tap pins when the model meets the required ≥80% precision threshold.

**Acceptance Criteria:**

**Given** the SageMaker endpoint (extending the existing `bb80f53` implementation) is activated
**When** the developer sends a test inference request `{ "image_url": "<sample-faucet-photo-url>" }`
**Then** the endpoint returns `{ "confidence": <0.0–1.0> }` with no error
**And** response latency is under 5 seconds per image (sufficient for ≤50-location chunked batch)

**Given** the Florida Keys ground truth validation set exists
**When** the developer runs the offline precision evaluation script against the SageMaker endpoint
**Then** the faucet classifier achieves ≥80% precision on that set
**And** the evaluation results are recorded (pass/fail + precision score) before any production scan is authorized (NFR-ML2)

**Given** the precision gate has not been passed (precision < 80%)
**When** a developer attempts to run `/api/ml-scan` in any environment
**Then** the endpoint returns `{ "error": "PRECISION_GATE_BLOCKED", "message": "Model precision below 80% threshold — production scan disabled" }` and writes zero records

**Given** the SageMaker credentials in the environment
**When** any serverless function accesses `SAGEMAKER_ENDPOINT_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, or `AWS_REGION`
**Then** they are read from server-side environment variables only — never from `process.env.VITE_*` and never bundled to the client (NFR-ML5)

**Given** a sample photo of a non-faucet object (e.g., a door, a fire hydrant)
**When** it is sent to the SageMaker endpoint
**Then** the returned confidence is below 0.75 — the model does not produce false positives on the smoke-test inputs

---

### Story 6.3: Tap Photo Submission & Verification API

As a user,
I want to submit a photo of a water tap I've found, and confirm or deny whether an existing tap pin is still present,
So that my ground-truth observations improve the accuracy of the water tap map for all Keys corridor travelers.

**Acceptance Criteria:**

**Given** the user is on a tap pin detail sheet or a map empty-state area
**When** they initiate a tap photo submission
**Then** `POST /api/tap-submit` accepts `multipart/form-data` with `{ photo: File, location: [lat, lng], deviceId: string }`
**And** the endpoint validates: file size ≤5MB and MIME type is `image/*`; invalid requests are rejected with a `400` error

**Given** a valid photo is received by `/api/tap-submit`
**When** the server processes the request
**Then** the photo is uploaded to Supabase Storage at path `tap-photos/{uuid}/{timestamp}.jpg`
**And** the SageMaker endpoint is called with `{ image_url: <storage-public-url> }` to obtain a confidence score

**Given** the SageMaker inference returns confidence ≥0.75
**When** the server completes the submission flow
**Then** a `water_tap_pins` row is upserted: created if no existing pin is within 50 meters, or the photo is appended to an existing nearby pin
**And** a `tap_verification_events` row is appended with `event_type = 'user_submission'`, `confidence`, `photo_url`, and `device_id`
**And** the response returns `{ pinId, confidence, status: 'created' | 'confirmed' }` (FR45)

**Given** the SageMaker inference returns confidence < 0.75
**When** the server completes the submission flow
**Then** no `water_tap_pins` row is created or modified
**And** the response returns `{ pinId: null, confidence, status: 'below_threshold' }`
**And** no photo URL is stored in the database for a below-threshold submission

**Given** a user views an existing water tap pin detail sheet
**When** they tap "Still here" or "No longer here"
**Then** `POST /api/tap-verify` is called with `{ tapPinId: string, eventType: 'confirmed' | 'denied', deviceId: string }`
**And** a `tap_verification_events` row is appended with the correct event_type, tap_pin_id, and device_id (FR46)
**And** the response returns the updated verification count (confirmed, denied)

**Given** a tap pin accumulates ≥2 unique device `confirmed` events
**When** the `/api/tap-verify` endpoint processes a confirmation
**Then** the `water_tap_pins.source` is updated to `'verified'` in Supabase (FR47 — promotion to verified status)

**Given** `/api/tap-submit` or `/api/tap-verify` is called
**When** the request arrives
**Then** no `Authorization: Bearer` header is required — these are public endpoints authenticated by `deviceId` in the request body only (consistent with check-in and issue report pattern)

**Given** any text content submitted via `/api/tap-submit` (seasonal notes field)
**When** it is written to Supabase
**Then** it is sanitized server-side before storage (NFR-S4)

---

### Story 6.4: Water Taps Feature Module & Tap Pin Detail UI

As a Keys corridor traveler,
I want to view a dedicated tap pin detail sheet showing the tap's confidence source, photos, mile marker, and seasonal notes, and be able to submit a photo or confirm/deny the tap from that sheet,
So that I have complete, contextual information for every water tap pin without leaving the app.

**Acceptance Criteria:**

**Given** the user taps a `water_tap` pin on the map
**When** `PinLayer.tsx` handles the tap event
**Then** `navigate('/tap/:id')` is called — not `/pin/:id` (pin_category discriminator routing)
**And** `TapPinDetailSheet` loads as a lazy-loaded chunk separate from the main bundle

**Given** the `/tap/:id` route loads
**When** `TapPinDetailSheet` renders
**Then** a bottom sheet slides up from the bottom of the screen within 300ms (NFR-P3)
**And** the sheet displays: place name, place type, access classification, confidence score/source, photos (scrollable if multiple), mile marker (if present), seasonal notes (if present), last verified date, and `TapConfidenceBadge`

**Given** a water tap pin was created by the ML batch scan (`source = 'ml_batch'`)
**When** `TapConfidenceBadge` renders
**Then** it shows the ML model confidence as a percentage (e.g., "ML Confidence: 87%") alongside the data source label "ML Discovered" (FR47)

**Given** a water tap pin has accumulated ≥1 user confirmations but fewer than 2
**When** `TapConfidenceBadge` renders
**Then** it shows the community verification count (e.g., "1 traveler confirmed") alongside the ML confidence if available (FR47)

**Given** a water tap pin has `source = 'verified'` (≥2 independent confirmed events)
**When** `TapConfidenceBadge` renders
**Then** it displays "Community Verified" status — the highest-trust signal — replacing the ML confidence indicator (FR47)

**Given** `TapPinDetailSheet` is open
**When** the user taps "Still here"
**Then** `useTapVerifyMutation` fires `POST /api/tap-verify` with `event_type = 'confirmed'`
**And** the verification count in the sheet increments optimistically before the server responds (FR46)

**Given** `TapPinDetailSheet` is open
**When** the user taps "No longer here"
**Then** `useTapVerifyMutation` fires `POST /api/tap-verify` with `event_type = 'denied'`
**And** the verification count updates optimistically

**Given** `TapPinDetailSheet` is open
**When** the user taps "Submit a Photo"
**Then** `TapPhotoSubmission` renders: a camera/file input, a preview of the selected photo, and a "Submit" button (FR45)

**Given** the user selects a photo and taps "Submit"
**When** `useTapSubmitMutation` fires
**Then** a "Checking photo..." pending state is shown immediately with a confidence badge in a loading state (optimistic)
**And** the multipart request is sent to `POST /api/tap-submit` with the photo, device GPS location, and deviceId

**Given** the submission returns `status: 'created'` or `'confirmed'`
**When** the result renders
**Then** a success message is shown: "Photo added! This tap is now on the map."
**And** `['water-tap', tapPinId]` TanStack Query key is invalidated and refetched

**Given** the submission returns `status: 'below_threshold'`
**When** the result renders
**Then** a neutral message is shown: "Our model couldn't confirm a tap in that photo. Try a closer shot of the faucet."
**And** no pin is created

**Given** the `TapPinDetailSheet`
**When** it renders on a mobile device
**Then** all interactive elements (Still here, No longer here, Submit a Photo) meet the minimum 44×44px touch target size (NFR-A4)
**And** swiping down on the sheet dismisses it and returns to the map

**Given** the `src/features/water-taps/` module
**When** a developer reviews its structure
**Then** it contains: `TapPinDetailSheet.tsx`, `TapConfidenceBadge.tsx`, `TapPhotoSubmission.tsx`, `TapConfirmDeny.tsx`, `TapPinDetailSheet.test.tsx`, `TapPhotoSubmission.test.tsx`, `waterTapsApi.ts`
**And** no water-taps components import from `src/features/pin-detail/` — the modules are isolated

---

### Story 6.5: ML Batch Scan Pipeline & Monthly Cron

As the system,
I want an admin-protected chunked ML scan endpoint triggered by a monthly GitHub Actions cron to scan the Florida Keys bounding box for water tap locations,
So that new publicly accessible water taps are automatically discovered and added to the map without manual data entry.

**Acceptance Criteria:**

**Given** `POST /api/ml-scan` is called without a valid `Authorization: Bearer <ADMIN_SECRET>` header
**When** the middleware processes the request
**Then** the function returns `{ "error": "UNAUTHORIZED", "status": 401 }` and performs no scan (NFR-S5)

**Given** a valid Bearer token and a request body `{ bbox: { north, south, east, west } }` with `?offset=0&limit=50`
**When** `/api/ml-scan` runs
**Then** it queries the OpenStreetMap Overpass API (server-side proxy) for `amenity=fuel`, `amenity=campsite`, and `tourism=camp_site` nodes within the bounding box (FR39)
**And** the Overpass response is fetched server-side — no client-to-Overpass calls occur (NFR-I2)

**Given** the Overpass enumeration returns locations
**When** the pipeline processes each location in the offset/limit window
**Then** for each location, up to 5 street-level photos are fetched: Mapillary queried first; Google Places Photos API used as fallback when Mapillary coverage is insufficient (FR40)
**And** a server-side delay is applied between external API calls to stay within Mapillary and Google Places published rate limits (NFR-ML4)

**Given** photos are fetched for a location
**When** each photo is processed
**Then** it is sent to the SageMaker endpoint with `{ image_url }` and the returned confidence (0.0–1.0) is recorded per photo per location (FR41)

**Given** at least one photo for a location returns confidence ≥0.75
**When** the scan writes results
**Then** a `water_tap_pins` row is upserted with: location coordinates, place name, place type, `access = NULL` (unverified at creation), highest-confidence photo URL, confidence score, `source = 'ml_batch'`, scan timestamp, and `place_ref` (OSM node ID or Places ID) for business location linking (FR42, FR43, FR44)
**And** a `tap_verification_events` row is appended with `event_type = 'ml_scan'` and the confidence score

**Given** a location where all photos score below 0.75
**When** the scan processes that location
**Then** no `water_tap_pins` row is created or modified for that location

**Given** the scan for an offset/limit window completes
**When** the response is returned
**Then** it includes `{ processed: <n>, created: <n>, updated: <n>, skipped: <n>, nextOffset: <offset + limit> }`
**And** when `processed < limit`, the GitHub Actions loop terminates (all locations exhausted)

**Given** the GitHub Actions `sync.yml` workflow
**When** a developer reviews it
**Then** a new `ml-scan` job is defined triggered by cron `0 3 1 * *` (1st of month, 3am UTC) (NFR-ML3)
**And** the job calls `POST /api/ml-scan` sequentially at offset 0, 50, 100… (using `ML_SCAN_URL` + `ADMIN_SECRET` from repository secrets) until `processed < limit`
**And** the existing daily BLM/USFS/NPS sync job is unchanged
**And** neither `ML_SCAN_URL` nor `ADMIN_SECRET` appear as `VITE_` variables (NFR-ML5)

**Given** the full Florida Keys bounding box (Homestead → Key West, ≤500 locations)
**When** the monthly cron runs all chunked invocations sequentially
**Then** the entire scan completes within 2 hours (NFR-ML1)
**And** each individual `/api/ml-scan` invocation processes 50 locations and returns within 60 seconds

**Given** an API provider (Mapillary or Google Places) returns a rate limit error during a scan
**When** the pipeline handles the error
**Then** the current location is skipped and logged — the pipeline does not fail entirely, and no data loss occurs for other locations (NFR-ML4)

---

### Story 6.6: Unified Map Pin Integration

As a user,
I want water tap pins to appear on the main map alongside regular stop pins, using the same freshness badge and rig-aware display logic,
So that I never need to switch to a separate view to find water taps on the Florida Keys corridor.

**Acceptance Criteria:**

**Given** the `usePinsQuery` hook in `src/lib/supabase/`
**When** it fetches pins for the current viewport
**Then** it queries the `map_pins` Supabase view (not the `pins` table directly)
**And** the response includes both `pin_category = 'regular'` and `pin_category = 'water_tap'` pins for the viewport

**Given** the TanStack Query key `['water-taps', { viewport }]`
**When** the viewport changes (pan or zoom)
**Then** water tap pins for the new viewport are fetched and displayed — consistent with regular pin fetching behavior

**Given** water tap pins load on the map
**When** `PinLayer.tsx` renders a pin with `pin_category = 'water_tap'`
**Then** it renders a custom SVG pin marker with a water/faucet icon and the same recency color ring logic (green/yellow/red based on `verified_date`)
**And** when the pin is tapped, `navigate('/tap/:id')` is called — not `/pin/:id`

**Given** water tap pins appear on the map alongside regular pins
**When** the user activates the "Water" amenity filter chip
**Then** both regular water fill pins and water tap pins are shown in full color
**And** non-water categories are greyed or hidden per existing AND filter logic

**Given** a water tap pin has `is_active = FALSE`
**When** `usePinsQuery` fetches from `map_pins`
**Then** that pin is excluded from the map display — `map_pins` view already filters `is_active = TRUE` only

**Given** the `pin_category` discriminator in `PinLayer.tsx`
**When** a developer reviews the routing logic
**Then** the routing is handled by a single conditional: `if (pin.pinCategory === 'water_tap') navigate('/tap/' + pin.id)` — no inline `TapPinDetailSheet` rendering in the map layer
**And** `TapPinDetailSheet` is imported only in the `/tap/:id` route chunk (lazy-loaded, not in the main bundle)

**Given** a screen reader is active
**When** a water tap pin is read aloud
**Then** the `aria-label` follows the format: "[PlaceName]: water tap, verified [recency]" (NFR-A2)

**Given** the `map_pins` view is the sole data source for the map pin layer
**When** the developer verifies the integration
**Then** no direct `pins` or `water_tap_pins` table queries exist in `PinLayer.tsx` or `usePinsQuery` — all pin data flows through the unified view
