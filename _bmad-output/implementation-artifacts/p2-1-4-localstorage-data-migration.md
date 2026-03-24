# Story p2-1.4: LocalStorage Data Migration

Status: done

## Story

As a returning anonymous user,
I want my rig profile and saved spots automatically migrated when I create an account,
so that I do not lose my data or have to re-enter anything.

## Acceptance Criteria

**AC1 - Anonymous rig profile and saved spots migrate during account creation**
Given a user has a rig profile and saved spots in localStorage  
When they create a new account  
Then the account experience shows: "Your [rig class] profile and [N] saved spots will be backed up"  
And on successful account creation an authenticated `POST /api/auth/migrate` request persists the current local snapshot into the repo's existing cloud tables (`rig_profiles` for rig data and `saved_spots` for saved pins)  
And the confirmation state shows: "[N] spots backed up"  
And the map experience remains otherwise unchanged.

**AC2 - Migration failure does not block successful account creation**
Given the migration API call fails after the account is created  
When account creation completes  
Then the user is still signed in successfully  
And the account UI shows the exact failure copy: "Account created. Data sync failed — will retry on next sign-in."  
And localStorage data is preserved and not deleted  
And the next authenticated sync path can retry without duplicating data.

**AC3 - Empty local state migrates safely**
Given a user creates an account with no local rig profile and no saved spots  
When the migration runs  
Then the request succeeds without error  
And the existing `profiles` bootstrap still completes  
And no duplicate or placeholder saved-spot rows are created.

## Tasks / Subtasks

- [x] Task 1: Add the authenticated migration endpoint and persistence contract (AC: 1, 2, 3)
  - [x] 1.1 Create `api/auth/migrate.ts` as a `POST`-only serverless handler following the existing `api/spot-submissions.ts` and `api/_auth.ts` patterns.
  - [x] 1.2 Validate the request body with `zod` and accept the local migration snapshot needed by the account flow (rig profile summary + saved spot snapshots/count metadata), including an empty-state payload.
  - [x] 1.3 Use `requireUserAuth()` plus `createServiceClient()`; do not use admin auth or client-side Supabase writes inside the API route.
  - [x] 1.4 Persist rig data into the repo's current `rig_profiles` table and saved pins into `saved_spots` idempotently, preserving current schema reality rather than trying to rename storage to `profiles.rig_profile` in this story.
  - [x] 1.5 Return the migrated counts needed by the UI confirmation state and add `api/auth/migrate.test.ts` coverage for 405, 401, invalid body, success, empty payload, and Supabase failure handling.

- [x] Task 2: Integrate signup migration into the existing auth orchestration without double-writing cloud state (AC: 1, 2, 3)
  - [x] 2.1 Refactor `src/features/account/AuthProvider.tsx` so signup can capture the current local snapshot once and route it through a dedicated migration helper instead of scattering new fetch logic through the screen.
  - [x] 2.2 Add a client migration helper under `src/lib/supabase/` (or another existing auth/sync helper location) that calls `POST /api/auth/migrate` with the authenticated session token.
  - [x] 2.3 After `signUpWithPassword()` and `ensureProfile()` succeed, invoke the migration path exactly once for first-time account creation while keeping the existing sign-in initial sync flow intact.
  - [x] 2.4 Reconcile the current `runInitialSync()` behavior so signup migration does not compete with or duplicate the existing merge-and-upload flow for `rig_profiles`, `saved_spots`, and `trip_plans`.
  - [x] 2.5 Preserve local fallback behavior: do not clear local rig profile, saved spots, trip drafts, or the anonymous `deviceId` on either success or failure.

- [x] Task 3: Update account UX for the migration moment and retry messaging (AC: 1, 2)
  - [x] 3.1 Update `src/features/account/AccountScreen.tsx` so the sign-up surface shows the exact backup-preview copy with dynamic rig class and saved-spot count before submission.
  - [x] 3.2 Show an explicit in-progress state such as "Migrating your data..." after successful signup while migration is running.
  - [x] 3.3 Show a success state using the migrated spot count (`"[N] spots backed up"`) and keep the map/account navigation behavior stable after completion.
  - [x] 3.4 Show the exact failure copy from AC2 in a prominent account-scoped feedback treatment; if no shared toast utility exists yet, keep the implementation lightweight and consistent with the repo's current inline status/alert pattern instead of adding a new notification framework.

- [x] Task 4: Add focused regression coverage for migration and anonymous continuity (AC: 1, 2, 3)
  - [x] 4.1 Extend `src/features/account/AuthProvider.test.tsx` to cover successful signup migration, migration failure with local-data preservation, and empty-local-state migration.
  - [x] 4.2 Extend `src/features/account/AccountScreen.test.tsx` to cover the backup-preview copy, migrating state, success count, and failure messaging.
  - [x] 4.3 Add or extend API tests to verify the authenticated migration route persists the expected cloud rows and rejects invalid/authless requests.
  - [x] 4.4 Keep regression focus on anonymous browsing, `/account`, and existing sign-in behavior so Story p2-1-3 remains intact.
  - [x] 4.5 Run `npm run test`, `npm run typecheck:api`, and `npm run lint` before moving the story to review.

## Dev Notes

### Context Summary

- Sprint tracking currently shows `p2-1-4-localstorage-data-migration` as the next backlog story in Phase 2 Epic 1.
- The repo already contains email/password registration and sign-in, plus an `AuthProvider` that merges local and remote state for rig profile, saved spots, and trip drafts after authentication.
- The planned architecture calls for `POST /api/auth/migrate`, but the current repo does not yet contain an `api/auth/` migration endpoint, so this story should add that missing server-authoritative migration path without rewriting the whole sync stack.

### Current Repository Reality

- `src/features/account/AccountScreen.tsx` already frames account creation as backing up local rig profile, saved spots, and trip drafts, but it currently only shows a generic success message after signup.
- `src/features/account/AuthProvider.tsx` already:
  - loads the current session via `getCurrentSession()`
  - subscribes to `onAuthStateChange`
  - runs `runInitialSync()` after auth to merge local + cloud state
  - syncs `rig_profiles`, `saved_spots`, and `trip_plans` back to Supabase.
- `src/lib/sync/mergeCloudState.ts` already defines merge behavior:
  - rig profile uses newest `updatedAt`
  - saved spots use a set-union by pin ID
  - trip plans use newest `updatedAt` by plan ID.
- `src/lib/supabase/profiles.ts` already bootstraps the `profiles` row with `ensureProfile(userId)`.
- Current schema reality is `rig_profiles` + `saved_spots`, not a `profiles.rig_profile` column. Treat the architecture wording as intent; implement against the actual schema unless a deliberate migration is included.
- `api/_auth.ts` already provides JWT user auth for serverless routes, and `api/spot-submissions.ts` / `api/spot-submissions.test.ts` provide the closest pattern for a user-authenticated JSON API handler plus tests.

### Previous Story Intelligence

- Story `p2-1-2-user-registration` established the current email/password registration path, backup-oriented account copy, and `ensureProfile()` bootstrap. Reuse those patterns instead of reintroducing magic-link or parallel account flows.
- Story `p2-1-3-sign-in-and-sign-out` confirmed that:
  - auth state should stay in React context
  - sign-in should rely on the existing provider sync flow
  - local anonymous data must survive auth transitions
  - route protection stays on the existing `<AuthRequired>` wrapper pattern.
- The current account/auth surface is already the right integration point. Do not move migration orchestration into unrelated screens or stores.

### Architecture Guardrails (Must Follow)

- Always access auth state/actions through `useAuth()` or provider-owned helpers; do not call `supabase.auth` directly from components or stores. [Source: `_bmad-output/planning-artifacts/architecture-phase2.md` — Auth Patterns]
- Never read auth state from localStorage or cookies manually; trust Supabase session persistence and `onAuthStateChange`. [Source: `_bmad-output/planning-artifacts/architecture-phase2.md` — Auth Patterns]
- Preserve auth/anonymous coexistence. Anonymous users must still browse the map and use local storage without a login wall. [Source: `_bmad-output/planning-artifacts/architecture-phase2.md` — Critical complexity: auth/anonymous coexistence]
- Keep route protection on `<AuthRequired>`; do not introduce inline redirect logic during migration work. [Source: `_bmad-output/planning-artifacts/architecture-phase2.md` — Auth Patterns]
- Use the existing API conventions for authenticated serverless routes: `requireUserAuth()` for JWT validation and `createServiceClient()` for privileged table writes. [Source: `api/_auth.ts`, `api/_supabase.ts`, `api/spot-submissions.ts`]

### UX Requirements Relevant To This Story

- The migration moment should feel like relief, not setup friction: users should see that their existing data is being backed up with zero re-entry. [Source: `_bmad-output/planning-artifacts/ux-design-phase2-specification.md` — Critical Success Moments]
- The sign-up surface should use explicit backup-preview copy: "Your rig profile and [N] saved spots will be backed up." [Source: `_bmad-output/planning-artifacts/ux-design-phase2-specification.md` — account backup interaction]
- During signup, users need visible progress feedback ("Migrating your data...") and a concrete success result (`"[N] spots backed up"`). [Source: `_bmad-output/planning-artifacts/ux-design-phase2-specification.md` — account backup interaction / Journey 2]
- If migration fails, localStorage must remain the fallback source of truth and the user should receive clear retry messaging instead of silent failure. [Source: `_bmad-output/planning-artifacts/epics-phase2.md` — Story 1.4 failure path]
- The map should remain unchanged after successful account creation; do not redirect away from the current flow. [Source: `_bmad-output/planning-artifacts/epics-phase2.md` — Story 1.4 and Story 1.2 continuity]

### Implementation Notes For The Dev Agent

- Prefer extracting a reusable migration helper from `AuthProvider` rather than bolting special cases into `AccountScreen`. The screen should trigger signup; the provider should own authenticated migration and sync orchestration.
- Avoid duplicate writes: signup migration and the existing `runInitialSync()` can easily race each other. Either:
  - share a common helper for the initial authenticated sync/migration pass, or
  - gate the first sync so the migration endpoint handles the initial upload and the general sync loop resumes afterward.
- Preserve current trip-draft behavior. Trip drafts are not part of the epic acceptance text, but the repo already syncs them; do not regress that path while focusing on rig profile + saved spots.
- Preserve anonymous `deviceId` behavior from `src/App.tsx` / `src/hooks/useDeviceId.ts`; this story should not wipe or relink historical anonymous check-ins automatically.
- Because the repo currently has no shared toast utility, keep error/success feedback implementation small and local unless a reusable notification primitive already exists by the time dev starts.
- Follow the existing file/test patterns:
  - API handler + Vitest file under `api/`
  - client sync/auth helpers under `src/lib/supabase/` or `src/lib/sync/`
  - account orchestration in `src/features/account/`
  - store logic stays in the existing Zustand stores unless a small helper extraction is truly needed.

### Testing Requirements

- Minimum required validation for this story:
  - `npm run test`
  - `npm run typecheck:api`
  - `npm run lint`
- Focused regression coverage should include:
  - successful signup migration into cloud rows
  - migration failure that keeps the user authenticated and local data intact
  - empty local-state migration
  - sign-in continuity from Story `p2-1-3`
  - anonymous route continuity for `/`, `/account`, and existing auth-gated routes.

### Project Structure Notes

- Add the new endpoint under `api/auth/migrate.ts`; create the `api/auth/` folder if needed, matching the architecture's intended route layout.
- Reuse `api/_auth.ts` and `api/_supabase.ts` rather than inventing new auth or service-client wrappers.
- Keep client migration code close to existing auth/sync helpers in `src/lib/supabase/` or `src/lib/sync/`.
- Keep account UI work in `src/features/account/AccountScreen.tsx` and provider orchestration in `src/features/account/AuthProvider.tsx`.
- Do not introduce unrelated schema redesign, premium/subscription work, or route rewrites in this story.

### References

- Source: `_bmad-output/planning-artifacts/epics-phase2.md` — Story 1.4: Anonymous Data Migration on Account Creation
- Source: `_bmad-output/planning-artifacts/architecture-phase2.md` — auth/anonymous coexistence, localStorage -> cloud migration, planned `POST /api/auth/migrate`, Auth State / Auth Patterns
- Source: `_bmad-output/planning-artifacts/ux-design-phase2-specification.md` — account migration loop, critical success moments, account backup interaction, navigation patterns
- Source: `_bmad-output/implementation-artifacts/p2-1-2-user-registration.md`
- Source: `_bmad-output/implementation-artifacts/p2-1-3-sign-in-and-sign-out.md`
- Source: `src/features/account/AccountScreen.tsx`
- Source: `src/features/account/AuthProvider.tsx`
- Source: `src/lib/sync/mergeCloudState.ts`
- Source: `src/lib/supabase/profiles.ts`
- Source: `src/lib/supabase/rigProfiles.ts`
- Source: `src/lib/supabase/savedSpots.ts`
- Source: `src/store/rigStore.ts`
- Source: `src/store/spotsStore.ts`
- Source: `src/store/tripPlansStore.ts`
- Source: `src/App.tsx`
- Source: `src/hooks/useDeviceId.ts`
- Source: `api/_auth.ts`
- Source: `api/_supabase.ts`
- Source: `api/spot-submissions.ts`
- Source: `api/spot-submissions.test.ts`
- Source: `supabase/migrations/015_create_user_sync_tables.sql`

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Previous story context: `_bmad-output/implementation-artifacts/p2-1-3-sign-in-and-sign-out.md`
- Recent commit context reviewed via `git log --oneline -5`

### Completion Notes List

- All 4 tasks completed and verified.
- `POST /api/auth/migrate` endpoint added with zod validation, `requireUserAuth()` + `createServiceClient()`, idempotent upserts to `rig_profiles` and `saved_spots`.
- Client migration helper added at `src/lib/supabase/migrate.ts` calling the endpoint with Bearer token.
- `AuthProvider.signUp()` captures local snapshot, calls migration after `ensureProfile()`, uses `migrationCompletedRef` to gate initial sync and prevent duplicate cloud writes.
- Migration failure does not block account creation — user stays authenticated, local data preserved, failure copy shown.
- `AccountScreen` shows backup-preview copy ("Your [rig class] profile and [N] saved spots will be backed up"), migrating state, success count, and exact AC2 failure copy.
- All 609 tests pass. `npm run typecheck:api` and `npm run lint` clean.

### File List

- `api/auth/migrate.ts` — new: authenticated POST endpoint for localStorage migration
- `api/auth/migrate.test.ts` — new: 7 tests covering 405, 401, validation, success, empty payload, DB failures
- `src/lib/supabase/migrate.ts` — new: client migration helper (fetch wrapper)
- `src/features/account/AuthContext.ts` — modified: expanded `SignUpResult` with `migrationResult` and `migrationError`
- `src/features/account/AuthProvider.tsx` — modified: migration call in `signUp()`, `migrationCompletedRef` to gate initial sync
- `src/features/account/AccountScreen.tsx` — modified: backup preview copy, migrating state, success/failure messages
- `src/features/account/AuthProvider.test.tsx` — modified: added 3 migration tests (success, failure, empty state)
- `src/features/account/AccountScreen.test.tsx` — modified: added 3 migration UX tests (preview copy, success count, failure copy)

