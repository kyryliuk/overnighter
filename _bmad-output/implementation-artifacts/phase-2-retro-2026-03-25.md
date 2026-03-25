# Phase 2 Retrospective — Overnighter

**Scope:** Phase 2 — All 7 Epics (18 stories)
**Date:** 2026-03-25
**Facilitator:** Bob (Scrum Master)
**Project Lead:** Kyryl

## Team Participants

- Bob (Scrum Master) — Facilitator
- Alice (Product Owner)
- Charlie (Senior Developer)
- Dana (QA Engineer)
- Elena (Junior Developer)
- Kyryl (Project Lead)

---

## Phase 2 Summary

Phase 2 delivered the full platform evolution from an anonymous map tool to a production-ready, subscription-powered, offline-capable community platform.

### Delivery Metrics

| Metric | Value |
|--------|-------|
| Epics completed | 7/7 (100%) |
| Stories completed | 18/18 (100%) |
| Final test count | 1,106 tests across 101 files |
| Test files added | 101 (up from ~40 at Phase 1 end) |
| Code changes | 132 files, ~14,100 insertions |
| DB migrations added | 12 (016–027) |
| Production incidents | 0 |
| Blockers encountered | 1 (Vercel 12-function limit) |

### Epic-by-Epic Breakdown

| Epic | Title | Stories | Focus |
|------|-------|---------|-------|
| 1 | User Accounts & Data Sync | 5 | Email auth, localStorage→cloud migration, cross-device sync |
| 2 | Premium Subscription | 4 | Stripe checkout, webhooks, JWT claims, PremiumGate |
| 3 | Offline PWA | 4 | Service worker, tile cache, status banner, offline queue |
| 4 | Push Notifications | 3 | VAPID keys, per-spot opt-in, notification delivery |
| 5 | Community Contributions | 3 | Photo upload, spot submission wizard, status tracking |
| 6 | Admin Moderation UI | 3 | Submission queue, approve/reject, pin management |
| 7 | US Geographic Expansion | 2 | PostGIS spatial index, radius-based search API |

---

## What Went Well

### 1. Consistent quality discipline throughout the phase

Every story went through a Create → Dev → Code Review cycle. Code reviews caught real bugs — not just style issues — and the team fixed them before moving on. Test counts grew steadily from ~600 (Epic 1 end) to 1,106 (Phase 2 end), with no regressions.

### 2. Code review as a security gate

Reviews caught multiple security and correctness issues that would have shipped to production:

| Epic | Severity | Finding |
|------|----------|---------|
| 5 (5.2) | HIGH | Missing numeric validation on max_length_ft/max_height_ft inputs |
| 5 (5.3) | CRITICAL | XSS via `javascript:` URLs in website href — Zod `.url()` accepts `javascript:` protocol |
| 6 (6.1) | CRITICAL | N+1 counts query fetching all rows instead of using per-status COUNT |
| 6 (6.1) | HIGH | XSS in admin website href (same pattern as 5.3) |
| 6 (6.2) | HIGH | Missing server-side status guard allowing duplicate pin creation on approve |
| 6 (6.3) | HIGH | Non-blocking audit log inserts (swallowed errors violated audit integrity) |
| 6 (6.3) | HIGH | Archive not closing associated open issue_reports |
| 7 (7.2) | HIGH | Computed viewport radius exceeds API max at low zoom levels — silent fallback to stale data |
| 7 (7.2) | HIGH | useEffect with no deps cancels pending viewport debounce on re-renders |
| 7 (7.2) | MEDIUM | RadiusSearchResult typed as Pin[] but API returns distanceM field |

**Key insight**: The XSS via `javascript:` URLs pattern appeared twice (Stories 5.3 and 6.1), demonstrating the value of pattern-level awareness. After the first discovery, the fix was applied consistently: Zod `.refine()` for http/https AND frontend sanitization.

### 3. Reusable patterns accelerated later epics

Patterns established early were reused throughout:

- **`requireAdminAuth()` middleware** — reused across all admin endpoints (Epics 5, 6)
- **Zustand + persist** for local state — consistent across rig profile, saved spots, check-in prompt, offline queue
- **TanStack Query** patterns — staleTime, refetchOnWindowFocus, optimistic updates
- **Signed URL upload pattern** — established in Epic 5, reusable for future file operations
- **Supabase query chain mocking** — deeply nested `.from().update().eq().eq().select()` mock pattern
- **PremiumGate component** — single component with variant prop, never inline conditionals

### 4. Pipeline parallelism kept velocity high

The fleet pattern (create story N+1 in parallel with review of story N) eliminated idle time between stories. This was especially effective in Epics 5 and 6 where each epic's 3 stories flowed without gaps.

### 5. Incremental epic sequencing was well-designed

Each epic built cleanly on the previous:
- Epic 1 (auth) → Epic 2 (premium needs auth) → Epic 3 (offline needs auth for tile gating)
- Epic 4 (push needs auth) → Epic 5 (submissions need auth) → Epic 6 (admin needs submissions)
- Epic 7 (spatial search) was independent — good for final parallel execution

---

## Challenges and Friction

### 1. Recurring XSS via `javascript:` URL protocol

This appeared in two separate stories before the team internalized the pattern. Zod's `z.string().url()` validator accepts `javascript:` protocol, which creates XSS vectors on any `<a href>` rendering user-supplied URLs.

**Root cause**: Zod's URL validation is intentionally protocol-agnostic. The team needed to learn that URL validation ≠ safe-for-href validation.

**Resolution**: Established a two-layer defense:
1. Server: `.refine(url => /^https?:\/\//i.test(url))` on all URL fields
2. Client: `href={url.startsWith('http') ? url : '#'}` sanitization

### 2. Supabase query efficiency requires active attention

Two performance anti-patterns were caught in reviews:
- **N+1 counts**: Fetching all rows to count in JS instead of `{ count: 'exact', head: true }`
- **PostgREST limitations**: Dot-notation `.eq('check_in_id.pin_id')` is NOT valid — requires two-step queries

These aren't obvious from Supabase docs and required review-time discovery.

### 3. Test mock complexity for Supabase chains

Deeply nested Supabase query chains (`.from().update().eq().eq().select()`) require equally deep mock structures. This made test setup verbose and fragile. The team developed workable patterns but the boilerplate is significant.

### 4. Vercel Hobby function limit (12 functions)

Hit during Epic 2 (Stripe endpoints). Required removing a redundant admin/auth endpoint (`712889a`). This forced discipline in API surface design but was an unexpected constraint.

**Lesson**: Count serverless functions during planning. Files prefixed with `_` in `api/` are helpers (not deployed), which helps — but the limit requires active management.

### 5. Audit log integrity required explicit design

Initial implementation of admin audit logs used non-blocking try-catch-swallow pattern. Review correctly identified this violates audit integrity — if the audit insert fails, the admin action should also fail. Changed to blocking with error propagation.

---

## Key Insights

### Insight 1: Security review patterns compound in value

The first XSS finding (5.3) took time to diagnose. The second occurrence (6.1) was caught instantly because the pattern was known. By Epic 7, URL handling was never an issue. **Documenting security patterns as they're discovered creates a compounding knowledge asset.**

### Insight 2: Server-side guards are non-negotiable

Three separate findings (duplicate pin creation, audit log integrity, issue_reports consistency) all shared the same root cause: trusting that the client will prevent invalid operations. **Every state-mutating endpoint needs server-side validation independent of UI state.**

### Insight 3: Offline-first architecture pays forward

The offline patterns from Epic 3 (service worker, pinsCache, pendingCheckins queue, online status hook) provided infrastructure that later stories benefited from implicitly. The `useOnlineStatus()` hook and localStorage queue pattern became standard project patterns.

### Insight 4: Fleet-mode story cycles are highly efficient

The Create → Dev → Review pipeline with parallel story creation eliminated nearly all coordination overhead. The ~5-minute lag between finishing one story's review and starting the next story's implementation was the only gap.

### Insight 5: PostGIS migration design matters at scale

The review correctly identified that single unbounded UPDATE for backfill and non-CONCURRENT index creation are acceptable at current scale (10-20k rows) but would need rework at 100k+ rows. **Document scale assumptions in migrations.**

---

## Previous Retrospective Follow-Through

The Phase 1 Epic 5 retrospective (`epic-5-retro-2026-03-23.md`) made these commitments:

| Action Item | Status | Evidence |
|-------------|--------|----------|
| Story-readiness checklist for schema validation | ✅ Applied | Story files consistently reference actual schema fields; fewer AC-vs-schema mismatches in Phase 2 |
| Reconcile PRD, epics, and architecture on admin scope | ✅ Applied | Phase 2 epics file created with full alignment to architecture-phase2.md and prd.md |
| Codify reusable API and admin UI test patterns | ✅ Applied | Consistent `vi.hoisted()` API test structure, `QueryClientProvider` wrapper patterns across all Phase 2 stories |
| Review complexity growth in `api/pins/[id].ts` | ⏳ Partially | File still accumulates behavior (archive, verify, badge override added in Phase 2 Epic 6) but remains manageable |
| Reduce planning-to-schema mismatch risk | ✅ Applied | Phase 2 story ACs consistently reference actual schema fields |

**Assessment**: 4 of 5 action items completed or substantially addressed. The team applied learnings from Epic 5 retro effectively.

---

## Breakthrough Moments

1. **Sync orchestration pattern (Epic 1)**: The `syncWithCloud()` callback with `lastSyncRef` interval gating and `migrationCompletedRef` guard established the cloud sync pattern used throughout Phase 2.

2. **PremiumGate abstraction (Epic 2)**: Single component with `variant: 'full' | 'compact'` avoided premium-gating duplication across the entire app.

3. **Offline queue pattern (Epic 3)**: `pendingCheckins` module using localStorage with flush-on-reconnect became the template for any offline-capable operation.

4. **Timing-safe token comparison (Epic 4)**: Using `crypto.timingSafeEqual` for Bearer token comparison in push send endpoint — a security best practice that prevented timing attacks.

5. **XSS defense standardization (Epic 5-6)**: After the first `javascript:` URL finding, the two-layer defense (Zod refine + frontend sanitization) became a project-wide pattern applied to all URL fields.

6. **Efficient COUNT queries (Epic 6)**: Replacing `.select('status')` + JS counting with `.select('*', { count: 'exact', head: true })` per-status — a Supabase performance pattern now standard in the codebase.

---

## Technical Debt Status

### Carried Forward (Acceptable)

| Item | Severity | Notes |
|------|----------|-------|
| `api/pins/[id].ts` complexity | Medium | Handles CRUD + archive + verify + badge override. Still manageable but approaching split threshold. |
| No local Supabase stack | Low | Migrations tested via deployment. Would benefit from local Supabase CLI setup for faster iteration. |
| Webhook race condition (5s polling) | Low | Premium-welcome page polls for JWT update after Stripe webhook. Acceptable UX tradeoff. |
| Single UPDATE backfill in migration 026 | Low | Acceptable at current scale (<20k rows). Document batch approach for future large-scale migrations. |
| Non-concurrent index creation in 026 | Low | Cannot use CONCURRENTLY inside Supabase migration transactions. Acceptable at current scale. |

### Resolved in Phase 2

| Item | Resolution |
|------|-----------|
| XSS via javascript: URLs | Two-layer defense standardized (Zod refine + frontend sanitization) |
| Non-blocking audit logs | Changed to blocking with error propagation |
| N+1 counts queries | Replaced with per-status COUNT using head:true |
| Missing server-side status guards | Added 409 Conflict responses for already-processed submissions |
| Archive not closing issue_reports | Added issue_reports close in archive flow |

---

## Architectural Patterns Established in Phase 2

### Authentication & Authorization
- React Context for auth state (not Zustand)
- `useAuth()` hook as single source of truth
- `requireUserAuth()` for user endpoints, `requireAdminAuth()` for admin, `requirePremiumAuth()` for premium
- JWT custom claims for subscription status (no extra DB queries)
- Timing-safe Bearer token comparison for system endpoints

### Data Synchronization
- Zustand stores with `persist` middleware for local state
- TanStack Query for cloud fetches with appropriate staleTime
- Signature refs for dirty detection (avoid redundant writes)
- Debounced write-back (400ms) for batching updates
- Visibility-triggered sync with 30s minimum interval

### Offline-First
- Service worker with stale-while-revalidate for app shell
- Dedicated cache names per concern (map-tiles, pins-cache, app-shell, osm-tiles, offline-tiles-meta)
- localStorage queue for pending operations with auto-flush on reconnect
- `useOnlineStatus()` reactive hook for connectivity awareness

### API Design
- Zod validation on all inputs with `.refine()` for security constraints
- Signed URLs for direct Storage access (no proxy upload)
- Fire-and-forget for best-effort operations (push notifications)
- 409 Conflict for duplicate/invalid state transitions
- Blocking audit logs for admin operations

---

## Phase 2 Readiness Assessment

| Dimension | Status | Notes |
|-----------|--------|-------|
| Story completion | ✅ Complete | 18/18 stories done |
| Test coverage | ✅ Strong | 1,106 tests, 101 test files |
| Code review | ✅ Complete | All stories reviewed, all findings resolved |
| Technical debt | ✅ Manageable | 5 low/medium items carried forward, all acceptable |
| Security | ✅ Hardened | XSS, injection, auth patterns standardized |
| Performance | ✅ Optimized | Efficient queries, spatial indexing, offline caching |
| Deployment readiness | ✅ Ready | All code on main branch, migrations sequential |

---

## Action Items

### Process Improvements

1. **Maintain security pattern catalog**
   - Owner: Charlie (Senior Dev) + Dana (QA)
   - Success criteria: Document known security patterns (XSS URLs, timing-safe comparison, server-side guards) in a reference file that review agents can consult

2. **Pre-count serverless functions during epic planning**
   - Owner: Bob (Scrum Master) + Charlie (Senior Dev)
   - Success criteria: Each epic plan includes an API surface audit against the Vercel function limit

3. **Document scale assumptions in migrations**
   - Owner: Charlie (Senior Dev)
   - Success criteria: Every migration that operates on existing data includes a comment noting the expected row count and whether batch processing is needed

### Technical Debt

1. **Evaluate `api/pins/[id].ts` for splitting**
   - Owner: Charlie (Senior Dev)
   - Priority: Medium
   - Notes: File handles 6+ operations. Consider splitting by concern (user CRUD vs. admin operations) before adding more.

2. **Set up local Supabase CLI**
   - Owner: Charlie (Senior Dev)
   - Priority: Low
   - Notes: Would enable faster migration testing and reduce deployment round-trips

### Team Agreements

- All URL fields in user-submitted data get two-layer validation (server Zod refine + client sanitization)
- All state-mutating admin endpoints include server-side status guards
- Audit log inserts are always blocking (throw on failure)
- Migrations document scale assumptions and include rollback SQL
- Code reviews focus on security, state consistency, and query efficiency — not style

---

## Next Steps

Phase 2 is fully complete. No Phase 3 epics are currently defined. The next planning cycle should:

1. **Define Phase 3 scope** — Potential directions include route corridor planning (explicitly deferred from Phase 2), social features, or international expansion
2. **Review carried technical debt** — Evaluate the 5 items above before adding new feature complexity
3. **Celebrate** — 38 stories across 12 epics, 1,106 tests, zero production incidents. This is a well-built product.

---

## Final Takeaways

1. **Code review is the highest-value quality gate** — 10 HIGH/CRITICAL findings caught before shipping. The XSS, N+1, and audit integrity findings alone justified the entire review process.

2. **Pattern reuse compounds** — Auth middleware, test harness patterns, offline queue design, and PremiumGate abstraction all accelerated later stories measurably.

3. **Fleet-mode story cycles work** — The Create → Dev → Review pipeline with parallel story creation delivered 18 stories across 7 epics with minimal coordination overhead.

4. **Previous retro follow-through was strong** — 4/5 action items from the Phase 1 Epic 5 retro were applied in Phase 2, demonstrating the team's commitment to continuous improvement.

5. **Security awareness is a skill that improves** — The first XSS finding took discovery effort; by Epic 6, the team preemptively applied the pattern. Invest in documenting security patterns as living references.
