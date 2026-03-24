---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflow_completed: true
documentsInventoried:
  prd: '_bmad-output/planning-artifacts/prd.md'
  architecture_phase1: '_bmad-output/planning-artifacts/architecture.md'
  architecture_phase2: '_bmad-output/planning-artifacts/architecture-phase2.md'
  epics_phase1: '_bmad-output/planning-artifacts/epics.md'
  epics_phase2: '_bmad-output/planning-artifacts/epics-phase2.md'
  ux_phase1: '_bmad-output/planning-artifacts/ux-design-specification.md'
  ux_phase2: '_bmad-output/planning-artifacts/ux-design-phase2-specification.md'
---

# Implementation Readiness Assessment Report

**Date:** 2026-03-24
**Project:** Overnighter Phase 2

---

## PRD Analysis

> **Note:** The PRD (`prd.md`) was authored for the Phase 1 MVP. Phase 2 functional requirements are defined in `architecture-phase2.md` and canonically inventoried in `epics-phase2.md` as FR-P2-01 through FR-P2-37. The analysis below covers Phase 2 requirements as established across these documents.

### Functional Requirements (Phase 2)

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
FR-P2-25: A user can submit a new spot via a multi-step submission form (GPS auto-fill, amenity selection, optional photo)
FR-P2-26: Submitted spots enter a pending moderation state; not published until approved by an admin
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

**Total Phase 2 FRs: 37**

### Non-Functional Requirements (Phase 2)

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
NFR-P2-A1: All Phase 2 components must meet WCAG AA contrast ratios (amber 5.8:1, blue 4.6:1, purple 4.5:1)
NFR-P2-A2: All Phase 2 dialogs/modals must implement focus trap and aria-modal attributes
NFR-P2-A3: Status pills and badges must communicate status via color AND icon — never color alone

**Total Phase 2 NFRs: 17** (3 performance, 5 security, 4 reliability, 2 scalability, 3 accessibility)

### Additional Requirements

**Infrastructure (must be completed before Phase 2 launch):**
- Enable PostGIS extension in Supabase
- Enable Supabase Auth; configure email verification templates
- Create `pin-photos` Storage bucket (public, 5MB max policy)
- Upgrade Supabase to Pro tier
- Configure Stripe product, annual price, webhook endpoint
- Add 7 new environment variables (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID_ANNUAL, VITE_STRIPE_PUBLISHABLE_KEY, VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)

**New DB Tables:** profiles, saved_spots, push_subscriptions, spot_submissions, pin_photos

**New Packages:** vite-plugin-pwa@1.2.0, @stripe/stripe-js@8.11.0, stripe@20.4.1, web-push@3.6.7

**New API Endpoints (12):** POST /api/auth/migrate, POST /api/stripe/checkout, POST /api/stripe/webhook, POST /api/stripe/portal, GET+POST+DELETE /api/push/*, POST /api/spots/submit, GET+PATCH /api/admin/submissions/:id, POST /api/photos/upload-url

### PRD Completeness Assessment

The Phase 1 PRD is complete and well-structured (38 FRs, 24 NFRs, 5 user journeys). Phase 2 requirements are defined in `architecture-phase2.md` and fully cataloged in `epics-phase2.md`. The PRD explicitly mentions Phase 2 as the account/PWA/premium tier phase in the architecture section. Requirements are traceable and non-overlapping with Phase 1.

---

## Epic Coverage Validation

### Coverage Matrix

| FR | Requirement Summary | Epic Coverage | Status |
|----|---------------------|---------------|--------|
| FR-P2-01 | Create account with email + password | Epic 1 → Story 1.2 | ✓ Covered |
| FR-P2-02 | Sign in to existing account | Epic 1 → Story 1.3 | ✓ Covered |
| FR-P2-03 | Sign out of account | Epic 1 → Story 1.3 | ✓ Covered |
| FR-P2-04 | Migrate localStorage rig profile on account creation | Epic 1 → Story 1.4 | ✓ Covered |
| FR-P2-05 | Migrate localStorage saved spots on account creation | Epic 1 → Story 1.4 | ✓ Covered |
| FR-P2-06 | Rig profile synced across devices | Epic 1 → Story 1.5 | ✓ Covered |
| FR-P2-07 | Saved spots synced across devices | Epic 1 → Story 1.5 | ✓ Covered |
| FR-P2-08 | Unauthenticated users retain full access | Epic 1 → Story 1.1 | ✓ Covered |
| FR-P2-09 | Subscribe to Premium via Stripe Checkout | Epic 2 → Story 2.2 | ✓ Covered |
| FR-P2-10 | PremiumGate component shows upsell | Epic 2 → Story 2.4 | ✓ Covered |
| FR-P2-11 | Manage subscription via Stripe Customer Portal | Epic 2 → Story 2.3 | ✓ Covered |
| FR-P2-12 | Subscription status updated by Stripe webhook events | Epic 2 → Story 2.3 | ✓ Covered |
| FR-P2-13 | subscription_status embedded in Supabase JWT | Epic 2 → Story 2.1 | ✓ Covered |
| FR-P2-14 | Install app as PWA via Add to Homescreen | Epic 3 → Story 3.1 | ✓ Covered |
| FR-P2-15 | Premium user downloads map area for offline tile caching | Epic 3 → Story 3.2 | ✓ Covered |
| FR-P2-16 | Offline-ready badge on cached saved spots | Epic 3 → Story 3.2 | ✓ Covered |
| FR-P2-17 | Non-blocking offline status banner | Epic 3 → Story 3.3 | ✓ Covered |
| FR-P2-18 | Offline check-in writes queued and auto-submitted | Epic 3 → Story 3.4 | ✓ Covered |
| FR-P2-19 | Authenticated user opts in to push notifications per spot | Epic 4 → Story 4.2 | ✓ Covered |
| FR-P2-20 | Push notification sent when saved spot status changes | Epic 4 → Story 4.3 | ✓ Covered |
| FR-P2-21 | User can opt out of push per-spot or globally | Epic 4 → Story 4.3 | ✓ Covered |
| FR-P2-22 | Attach photo to check-in submission | Epic 5 → Story 5.1 | ✓ Covered |
| FR-P2-23 | Photos stored in Supabase Storage, served via CDN URL | Epic 5 → Story 5.1 | ✓ Covered |
| FR-P2-24 | 5MB max + JPEG/PNG/HEIC restriction enforced server-side | Epic 5 → Story 5.1 | ✓ Covered |
| FR-P2-25 | Submit new spot via multi-step form with GPS auto-fill | Epic 5 → Story 5.2 | ✓ Covered |
| FR-P2-26 | Submitted spots enter pending state; not published until approved | Epic 5 → Story 5.2 | ✓ Covered |
| FR-P2-27 | Submission status visible in user profile | Epic 5 → Story 5.3 | ✓ Covered |
| FR-P2-28 | Push notification on submission approval/rejection | Epic 5 → Story 5.3 | ✓ Covered |
| FR-P2-29 | Approved submissions show submitter username on live pin | Epic 5 → Story 5.3 | ✓ Covered |
| FR-P2-30 | Admin views pending submission queue | Epic 6 → Story 6.1 | ✓ Covered |
| FR-P2-31 | Admin approves submission, publishes pin to live map | Epic 6 → Story 6.2 | ✓ Covered |
| FR-P2-32 | Admin rejects submission with reason | Epic 6 → Story 6.2 | ✓ Covered |
| FR-P2-33 | Admin manages flagged pins via web UI | Epic 6 → Story 6.3 | ✓ Covered |
| FR-P2-34 | Admin overrides pin recency badge | Epic 6 → Story 6.3 | ✓ Covered |
| FR-P2-35 | Admin archives pin from public map | Epic 6 → Story 6.3 | ✓ Covered |
| FR-P2-36 | PostGIS spatial indexing on pins table | Epic 7 → Story 7.1 | ✓ Covered |
| FR-P2-37 | All viewport queries use ST_DWithin | Epic 7 → Story 7.2 | ✓ Covered |

### Missing Requirements

**None.** All 37 Phase 2 FRs have explicit story coverage.

### Coverage Statistics

- Total Phase 2 FRs: **37**
- FRs covered in epics: **37**
- Coverage percentage: **100%**
- NFRs addressed across stories: **17** (all NFRs have corresponding AC in relevant stories)

---

## UX Alignment Assessment

### UX Document Status

**Found:** `ux-design-phase2-specification.md` — 14-step workflow, `workflow_completed: true`

### UX ↔ PRD Alignment

| UX Coverage Area | PRD/Architecture Requirement | Status |
|---|---|---|
| Auth migration modal (data preview → sign-up) | FR-P2-04, FR-P2-05 — localStorage migration | ✓ Aligned |
| PremiumGate inline amber card with upsell | FR-P2-10 — PremiumGate component | ✓ Aligned |
| PWA install prompt after meaningful engagement | FR-P2-14 — Add to Homescreen | ✓ Aligned |
| Offline tile cache download (premium) | FR-P2-15 — offline tile caching | ✓ Aligned |
| OfflineBanner (non-blocking) | FR-P2-17 — non-blocking offline banner | ✓ Aligned |
| PushNotificationToggle (contextual, in pin detail) | FR-P2-19 — push opt-in from pin detail | ✓ Aligned |
| PhotoUpload component with progress bar | FR-P2-22, FR-P2-23 — photo on check-in | ✓ Aligned |
| SpotSubmissionSheet (3-step, GPS auto-fill) | FR-P2-25 — multi-step submission form | ✓ Aligned |
| SubmissionStatusPill in profile "My Submissions" | FR-P2-27 — submission status tracking | ✓ Aligned |
| AdminReviewCard two-column layout (tablet) | FR-P2-30 — admin submission queue | ✓ Aligned |
| Approve/reject with reason flow | FR-P2-31, FR-P2-32 — admin approve/reject | ✓ Aligned |
| CachedSpotBadge on saved spots | FR-P2-16 — offline-ready badge | ✓ Aligned |
| 6 Mermaid journey flows in UX | All 7 epics' primary user journeys | ✓ Aligned |

### UX ↔ Architecture Alignment

| UX Component/Pattern | Architecture Support | Status |
|---|---|---|
| AuthContext + useAuth() hook | Supabase Auth, RLS, JWT custom claims | ✓ Supported |
| useSubscription() hook | `profiles` table, JWT `subscription_status` claim | ✓ Supported |
| Stripe redirect checkout (hosted page) | POST /api/stripe/checkout → Stripe hosted page | ✓ Supported |
| Stripe Customer Portal redirect | POST /api/stripe/portal | ✓ Supported |
| Workbox CacheFirst for map tiles | vite-plugin-pwa + Workbox injectManifest | ✓ Supported |
| Web Push VAPID opt-in flow | /api/push/vapid-key + /api/push/subscribe | ✓ Supported |
| Signed URL upload → progress bar | POST /api/photos/upload-url → Supabase Storage | ✓ Supported |
| Admin route guard (JWT `role = 'admin'`) | Architecture defines JWT custom claims pattern | ✓ Supported |
| WCAG AA color tokens (amber 5.8:1, blue 4.6:1) | NFR-P2-A1 — WCAG AA contrast requirement | ✓ Supported |
| Focus trap + aria-modal on all Phase 2 dialogs | NFR-P2-A2 — accessibility mandate | ✓ Supported |

### Warnings

None. The UX specification is comprehensive, complete, and fully aligned with both PRD requirements and architecture decisions.

**One note (non-blocking):** The UX document defines an `AuthRequired` gate component separate from `PremiumGate`. This is implied by the architecture's auth patterns but not explicitly named in `architecture-phase2.md`. The component is straightforward (redirect to sign-in if unauthenticated) and should be created as a thin wrapper in Epic 1, Story 1.1 (Phase 2 Foundation).

---

## Epic Quality Review

### Epic Structure Validation

| Epic | User-Centric Title | User Value Delivered | Can Stand Independently | Status |
|---|---|---|---|---|
| 1: User Accounts & Data Sync | ✓ User action | ✓ Persistent data across devices | ✓ Foundational epic | ✓ Pass |
| 2: Premium Subscription | ✓ User action | ✓ Premium feature access | ✓ After Epic 1 (intentional ordering) | ✓ Pass |
| 3: Offline PWA | ✓ User capability | ✓ Use app without connectivity | ✓ After Epic 1+2 | ✓ Pass |
| 4: Push Notifications | ✓ User benefit | ✓ Real-time spot alerts | ✓ After Epic 1 | ✓ Pass |
| 5: Community Contributions | ✓ User capability | ✓ Photo + spot submission | ✓ After Epic 1 | ✓ Pass |
| 6: Admin Moderation UI | ⚠️ Admin-user-facing (not end user) | ✓ Admin can maintain map quality | ✓ After Epic 5 | ✓ Pass (admin user = valid user type) |
| 7: US Geographic Expansion | ⚠️ Technical framing | ⚠️ User benefit exists but stories are developer-role | Conditional (infrastructure) | 🟠 See issue below |

### Dependency Analysis

**Forward Dependencies Check — all 24 stories:**

No story references a future story for its completion. All Given/When/Then ACs reference only features available from prior epics or the current story.

Notable sequential dependencies (intentional, not violations):
- Epic 2 → requires Epic 1 (auth is prerequisite for subscriptions) ✓ Correct ordering
- Story 5.3 push notification delivery → requires Epic 4 infrastructure ✓ Correct ordering
- Story 6.1–6.3 → requires Epic 5 (spot submissions must exist before admin can review them) ✓ Correct ordering

### Story Quality Assessment

**Acceptance Criteria Format:** All 24 stories use proper Given/When/Then BDD format ✓
**Error Conditions:** Stories 1.2–1.4, 2.1–2.3, 3.4, 5.1, 6.2 all include explicit error-state ACs ✓
**Testability:** All ACs produce measurable, verifiable outcomes ✓
**User Value:** 22 of 24 stories deliver direct user value ✓ (see minor concerns below)

### Violations Found

#### 🔴 Critical Violations
None.

#### 🟠 Major Issues

**Issue M1: Epic 7 Stories (7.1 and 7.2) use "developer" as the user role**

- Story 7.1 — "As a developer, I want the `pins` table to use PostGIS..." — is a pure infrastructure migration story with no direct user-facing outcome per story
- Story 7.2 — "As a user, I want the map to load pins quickly..." — is better framed but the AC includes developer-level verification ("verified via query plan")
- **Assessment:** Acceptable for a brownfield infrastructure migration, but the user-role mismatch in 7.1 is a structural deviation from the INVEST principle
- **Recommendation:** Re-frame Story 7.1 user role as "As a **system** (infrastructure migration)" or merge 7.1 + 7.2 into a single story: "As a user browsing the national map, I want pins to load within 300ms anywhere in the continental US." The PostGIS migration becomes an AC, not a user-facing story in its own right.

#### 🟡 Minor Concerns

**Concern 1: Story 1.1 creates all 5 Phase 2 DB tables upfront**

- Best practice: tables created by the story that first needs them
- Story 1.1 creates: `profiles`, `saved_spots`, `push_subscriptions`, `spot_submissions`, `pin_photos`
- `push_subscriptions` is not needed until Epic 4; `spot_submissions` and `pin_photos` not until Epic 5
- **Rationale for current approach:** This is a brownfield project (Phase 1 is live). Supabase migrations apply as a single transaction — distributed migrations across stories risk partial state during development. A single Phase 2 migration in Story 1.1 is operationally safer.
- **Recommendation:** Acceptable as-is with a comment in Story 1.1 ACs noting the consolidated migration rationale. No change required.

**Concern 2: Story 2.1 (Stripe Infrastructure) is infrastructure-heavy with indirect user value**

- "As a developer, I want Stripe keys configured and the webhook endpoint live…"
- The user role is not explicitly stated in the story, but the story is necessary to enable Epic 2's user value
- **Assessment:** Acceptable — every payment epic needs a foundation story. The user value is unlocked by Stories 2.2–2.4.

### Best Practices Compliance Checklist

| Epic | User Value | Independent | Stories Sized | No Fwd Deps | DB Timing | Clear ACs | FR Trace |
|---|---|---|---|---|---|---|---|
| Epic 1 | ✓ | ✓ | ✓ | ✓ | ⚠️ Minor | ✓ | ✓ |
| Epic 2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Epic 3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Epic 4 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Epic 5 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Epic 6 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Epic 7 | ⚠️ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**Overall quality: 6/7 epics fully pass. Epic 7 has 1 major issue (Story 7.1 user role framing) requiring decision before sprint planning.**

---

## Summary and Recommendations

### Overall Readiness Status

**READY** *(with one pre-sprint decision required on Epic 7)*

### Issues Found

| Severity | Count | Description |
|---|---|---|
| 🔴 Critical | 0 | No critical blockers |
| 🟠 Major | 1 | Story 7.1 user role framing |
| 🟡 Minor | 2 | DB migration consolidation (acceptable), Stripe infra story role |
| ℹ️ Info | 1 | `AuthRequired` component not explicitly named in architecture |

### Critical Issues Requiring Immediate Action

None. Phase 2 planning artifacts are complete, coherent, and fully traceable. All 37 Phase 2 FRs have explicit story coverage. PRD, Architecture, UX Design, and Epics are aligned.

### Recommended Next Steps

1. **Decide on Epic 7 Story 7.1 re-framing (pre-sprint):** Either merge Stories 7.1 + 7.2 into a single performance story ("As a user browsing the national map, I want pins to load within 300ms anywhere in the continental US — PostGIS migration is the AC"), or acknowledge Story 7.1 as an infrastructure migration story and proceed as-is. Both are acceptable; the decision should be documented.

2. **Complete infrastructure prerequisites before starting Epic 1 Story 1:**
   - Enable PostGIS extension in Supabase
   - Enable Supabase Auth + configure email templates
   - Create `pin-photos` Storage bucket
   - Upgrade Supabase to Pro tier
   - Configure Stripe product + annual price + webhook endpoint
   - Add 7 environment variables to deployment config

3. **Run Sprint Planning** (`/bmad-bmm-sprint-planning`) in a fresh context window to generate the Phase 2 sprint plan and story ordering from `epics-phase2.md`.

4. **Implement stories in sequence:** Use the Create Story → Dev Story → Code Review cycle for each story. Do not skip Story 1.1 (Phase 2 Foundation) — it installs all packages, creates the full DB schema, and establishes AuthContext.

5. **Add `AuthRequired` component to Story 1.1 scope** — a thin wrapper that redirects unauthenticated users to sign-in, used by Stories 1.5, 4.2, 5.1, 5.2, 5.3, and all Epic 6 stories.

### Final Note

This assessment evaluated 6 documents, 37 FRs, 17 NFRs, 7 epics, and 24 stories across Overnighter Phase 2. The planning artifacts are of high quality and implementation-ready. The single major issue (Epic 7 Story 7.1 user role) is a structural concern but does not block implementation — it can be resolved during sprint planning or at Story 7.1 creation time.

**Assessor:** Implementation Readiness Workflow (automated)
**Date:** 2026-03-24
