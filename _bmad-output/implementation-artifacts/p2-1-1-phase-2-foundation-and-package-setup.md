# Story p2-1.1: Phase 2 Foundation and Package Setup

Status: ready-for-dev

## Story

As a developer,
I want the Phase 2 packages installed, environment variables configured, and database schema migrated,
so that all Phase 2 features have a stable technical foundation to build on.

## Acceptance Criteria

**AC1 - Required Phase 2 packages are installed**
Given the current codebase
When the foundation story is implemented
Then the following dependencies are present and lockfile-updated:
- `@stripe/stripe-js`
- `@stripe/react-stripe-js`
- `stripe@20.4.1`
- `web-push@3.6.7`
- `@types/web-push`
And the existing `vite-plugin-pwa@1.2.0` setup remains functional.

**AC2 - Environment template includes full Phase 2 keys**
Given project environment templates
When `.env.example` is updated
Then it includes these keys with clear server/client comments:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_ANNUAL`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

**AC3 - Core Phase 2 DB tables exist with RLS enabled**
Given Supabase migrations are applied
When migration scripts are executed
Then these tables exist and are queryable:
- `profiles`
- `saved_spots`
- `push_subscriptions`
- `spot_submissions`
- `pin_photos`
And RLS is enabled with user-scoped policies for each table where applicable.

**AC4 - Auth context foundation exists**
Given frontend architecture for Phase 2
When auth foundation is implemented
Then `src/contexts/AuthContext.tsx` exists
And a reusable `useAuth` hook is exported from the auth context module
And app composition includes the provider wiring in app bootstrap.

**AC5 - No regression to anonymous flow**
Given existing MVP behavior
When all foundation changes are merged
Then map browsing, filtering, and saved/local behavior for anonymous users remain unchanged.

## Tasks / Subtasks

- [ ] Task 1: Install and verify Phase 2 packages (AC1)
  - [ ] 1.1 Add `@stripe/stripe-js` and `@stripe/react-stripe-js` to root dependencies.
  - [ ] 1.2 Add `stripe@20.4.1` and `web-push@3.6.7` to server runtime scope used by `api/*` functions.
  - [ ] 1.3 Add `@types/web-push` to dev dependencies.
  - [ ] 1.4 Run install and ensure lockfile reflects package additions without downgrading existing stack.
  - [ ] 1.5 Run tests/typecheck baseline to confirm no package regression.

- [ ] Task 2: Extend environment template for Phase 2 (AC2)
  - [ ] 2.1 Update `.env.example` with all Stripe and VAPID keys.
  - [ ] 2.2 Keep strict client/server separation comments (`VITE_*` vs server-only).
  - [ ] 2.3 Keep existing Supabase/admin/sync variables intact.

- [ ] Task 3: Create migration(s) for remaining Phase 2 foundation tables + RLS (AC3)
  - [ ] 3.1 Audit current migrations to avoid duplicating existing table definitions.
  - [ ] 3.2 Create new SQL migration(s) only for missing Phase 2 foundation tables and constraints.
  - [ ] 3.3 Enable RLS and add policies aligned with auth ownership patterns.
  - [ ] 3.4 Add indexes/uniques needed for practical query usage (for example endpoint uniqueness for push subscriptions).
  - [ ] 3.5 Validate migration apply/reset flow in local Supabase.

- [ ] Task 4: Implement `AuthContext` + `useAuth` foundation (AC4)
  - [ ] 4.1 Create `src/contexts/AuthContext.tsx` with `onAuthStateChange` session tracking.
  - [ ] 4.2 Expose typed auth value including `user`, `session`, and auth actions.
  - [ ] 4.3 Wire provider at app root bootstrap path (`src/main.tsx` and/or app shell as appropriate).
  - [ ] 4.4 Add targeted unit tests for initial session load and auth state transitions.

- [ ] Task 5: Verify anonymous behavior remains unchanged (AC5)
  - [ ] 5.1 Run existing onboarding and saved spots e2e coverage.
  - [ ] 5.2 Verify no forced redirect/auth prompt blocks map and pin flows.
  - [ ] 5.3 Capture any behavior drift and fix before marking story complete.

## Dev Notes

### Context Summary

- Sprint tracking indicates this is the first backlog story of Phase 2 epic 1.
- Current project already includes `vite-plugin-pwa@1.2.0`, so this story should preserve that baseline while adding Stripe and push infrastructure packages.
- Current migrations already include user sync and submissions/trip plan foundations; this story must add only missing schema elements and RLS hardening rather than recreating existing tables.

### Existing Code and Structure Signals

- Frontend root currently has no `src/contexts` directory in this workspace state.
- API structure already uses dedicated folders (`api/admin`, `api/pins`) and shared middleware helpers (`api/_middleware.ts`, `api/_supabase.ts`), so Phase 2 endpoints should follow the same pattern.
- Existing `supabase/migrations` already runs through `021_*`; new schema work should continue sequentially.

### Architecture Guardrails (Must Follow)

- Use `useAuth()` from auth context in UI components; avoid direct `supabase.auth` usage spread throughout feature components.
- Keep premium checks server-authoritative later via JWT/subscription state; this story only prepares foundation.
- Preserve anonymous local behavior as fallback path; do not remove or break local storage paths in this story.
- Keep server secrets strictly out of `VITE_*` scope.

### Testing Requirements

- Minimum required checks for this story:
  - `npm run test`
  - `npm run typecheck:api`
  - Focused tests for new auth context module
  - Migration sanity check (apply/reset)
- Regression risk focus:
  - onboarding and saved spots flows
  - app startup rendering with provider wrapper
  - existing API tests that rely on env structure

### Project Structure Notes

- Follow current structure conventions:
  - Frontend app logic under `src/*`
  - Serverless handlers under `api/*`
  - SQL changes under `supabase/migrations/*`
- Keep story scope foundational:
  - infra/packages/env/auth-context/migrations only
  - do not implement full signup/signin UI in this story

### References

- Source: `_bmad-output/planning-artifacts/epics-phase2.md` (Epic 1, Story 1.1)
- Source: `_bmad-output/planning-artifacts/architecture-phase2.md` (Dependencies, auth patterns, RLS direction)
- Source: `_bmad-output/planning-artifacts/ux-design-phase2-specification.md` (Auth migration and anonymous continuity expectations)
- Source: `.env.example` (current env layout)
- Source: `package.json` (current dependency baseline)
- Source: `supabase/migrations/` (current schema history)

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Recent commit context: latest 5 commits reviewed via `git log --oneline -5`

### Completion Notes List

- Story context generated from Phase 2 artifacts with repository-specific guardrails.
- Story status initialized as `ready-for-dev`.

### File List

- `_bmad-output/implementation-artifacts/p2-1-1-phase-2-foundation-and-package-setup.md`
