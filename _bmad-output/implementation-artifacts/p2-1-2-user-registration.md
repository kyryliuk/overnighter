# Story p2-1.2: User Account Registration

Status: review

## Story

As a new user,
I want to create an account with my email and password,
so that my data is stored securely in the cloud.

## Acceptance Criteria

**AC1 - Registration entry points show email and password account creation**
Given a user is not authenticated
When they open the current account entry surface from `/account` or from an auth-gated CTA such as Suggest Spot
Then the unauthenticated account experience shows a create-account form with email and password fields
And the create-account call-to-action is the primary action
And the current local data summary remains visible so the user understands what will sync after signup.

**AC2 - Successful registration creates the auth user and initializes app profile state**
Given the create-account form is valid
When the user submits email and password
Then a Supabase Auth account is created with email/password credentials
And a matching row exists in the `profiles` table for the authenticated user
And the user becomes authenticated in the existing auth provider flow
And the account surface returns to the signed-in state without navigating away from the current map context.

**AC3 - Duplicate email errors are shown inline**
Given the create-account form is submitted with an email that already exists
When Supabase returns an auth error
Then the user sees an inline error message that clearly explains the address is already in use
And the form remains editable without clearing entered values.

**AC4 - Anonymous usage remains unaffected for non-auth flows**
Given a user does not create an account
When they continue browsing the app anonymously
Then map browsing, filtering, pin detail, onboarding, saved spots, and other existing anonymous flows continue working without redirect loops or auth blocking.

**AC5 - Existing local-to-cloud sync path remains intact after signup**
Given a user already has local rig profile, saved spots, or trip drafts
When account creation succeeds and the session is established
Then the existing `AuthProvider` sync flow is allowed to merge and persist that local state to cloud tables
And registration does not bypass, duplicate, or break the current sync logic.

## Tasks / Subtasks

- [x] Task 1: Extend Supabase auth helpers for email/password signup (AC2, AC3)
  - [x] 1.1 Add a dedicated signup helper in `src/lib/supabase/auth.ts` using `supabase.auth.signUp`.
  - [x] 1.2 Keep the current redirect/origin utilities only where still required; do not regress existing magic-link tests unless the flow is intentionally replaced.
  - [x] 1.3 Normalize auth-layer errors into user-facing messages, especially duplicate-email failures.
  - [x] 1.4 Add or update auth helper tests in `src/lib/supabase/auth.test.ts` for successful signup and duplicate-email handling.

- [x] Task 2: Expand auth context/provider contract for registration (AC2, AC5)
  - [x] 2.1 Update `src/features/account/AuthContext.ts` to expose signup action and any pending state required by the form.
  - [x] 2.2 Update `src/features/account/AuthProvider.tsx` to call the new signup helper and surface success and error state cleanly.
  - [x] 2.3 Preserve the existing session-based sync behavior for `rig_profiles`, `saved_spots`, and `trip_plans`; do not introduce a second competing migration path in this story.
  - [x] 2.4 Ensure provider state transitions remain compatible with current consumers that only need `session`, `isAuthenticated`, and `signOut`.

- [x] Task 3: Guarantee `profiles` table initialization on signup (AC2)
  - [x] 3.1 Add a focused helper for `profiles` table bootstrap if none exists yet.
  - [x] 3.2 Insert or upsert the authenticated user's `profiles` row immediately after successful registration.
  - [x] 3.3 Keep this story scoped to baseline profile creation only; do not migrate subscription or billing logic into registration.
  - [x] 3.4 Avoid replacing the existing `rig_profiles` storage path in this story; `profiles` is additive metadata, not a schema rewrite.

- [x] Task 4: Replace the current magic-link-first account UI with registration-first UI (AC1, AC2, AC3)
  - [x] 4.1 Update `src/features/account/AccountScreen.tsx` so the unauthenticated state presents email and password inputs with a primary "Create account" action.
  - [x] 4.2 Preserve the existing local data summary card so the user can see what will sync after account creation.
  - [x] 4.3 Keep the signed-in state and account actions intact after registration completes.
  - [x] 4.4 Ensure submit loading, success feedback, and inline error rendering meet the current screen's accessibility pattern.

- [x] Task 5: Verify registration entry points and anonymous regression coverage (AC1, AC4, AC5)
  - [x] 5.1 Confirm current CTA surfaces that route to `/account` still make sense after the registration update, including the map account button and the unauthenticated Suggest Spot gate.
  - [x] 5.2 Add or update focused component/provider tests for registration success and duplicate-email error display.
  - [x] 5.3 Run `npm run test` and `npm run typecheck:api` after the implementation.
  - [x] 5.4 Smoke-test that anonymous browsing still works when the user never opens or submits the registration form.

### Review Follow-ups (AI)

- [x] [AI-Review][High] Updated the Supabase signup flow so a created user with no immediate session returns an email-confirmation result instead of surfacing a false failure. [`src/lib/supabase/auth.ts`, `src/lib/supabase/auth.test.ts`]
- [x] [AI-Review][High] Made signup/profile bootstrap rollback-safe and added a regression test for `ensureProfile()` failure. [`src/features/account/AuthProvider.tsx`, `src/features/account/AuthProvider.test.tsx`]
- [x] [AI-Review][Medium] Added app-level regression coverage for anonymous map access and unauthenticated `/suggest-spot` visits redirecting to `/account`. [`src/App.test.tsx`]
- [x] [AI-Review][Medium] Introduced a reusable `AuthRequired` wrapper for gated destinations and moved Suggest Spot auth gating out of inline screen logic. [`src/components/AuthRequired.tsx`, `src/App.tsx`, `src/features/spot-submissions/SuggestSpotScreen.tsx`]
- [x] [AI-Review][Medium] Reconciled the Dev Agent Record File List with the story-related code changes in the repository. [`_bmad-output/implementation-artifacts/p2-1-2-user-registration.md`]
- [x] [AI-Review][Low] Updated signup CTA and success messaging to better match the backup-focused Phase 2 UX framing. [`src/features/account/AccountScreen.tsx`, `src/features/account/AccountScreen.test.tsx`]

## Dev Notes

### Context Summary

- Sprint tracking marks `p2-1-2-user-registration` as the first backlog story after the Phase 2 foundation story.
- The current repository has already advanced beyond the original planning baseline: auth context, account route, sync helpers, and Phase 2 foundation tables already exist.
- Current auth is magic-link based, but the story requirements call for email/password account creation. This story should evolve the existing auth layer rather than rebuild account sync from scratch.

### Current Repository Reality

- `src/features/account/AccountScreen.tsx` currently shows a magic-link form on the `/account` route.
- `src/features/account/AuthProvider.tsx` already performs session-driven merge/sync for local rig profile, saved spots, and trip drafts.
- `src/lib/supabase/auth.ts` currently exposes `requestMagicLink`, `getCurrentSession`, `onAuthSessionChange`, and `signOut`, but no email/password signup helper.
- `supabase/migrations/015_create_user_sync_tables.sql` already defines `rig_profiles` and `saved_spots`.
- `supabase/migrations/022_create_phase2_foundation_tables.sql` already defines `profiles`, `push_subscriptions`, and `pin_photos`.

### Architecture Guardrails (Must Follow)

- Continue using `useAuth()` from context in UI code; do not spread raw `supabase.auth` calls into screens.
- Preserve the existing `AuthProvider` as the source of truth for auth state and sync orchestration.
- Treat `profiles` as additive account metadata for this story. Do not replace or rename `rig_profiles` and `saved_spots` as part of registration.
- Do not break current anonymous access patterns. Account creation is opt-in and must not introduce forced-login behavior.
- Keep route-level behavior stable: `/account` already exists and is linked from current surfaces. If a reusable modal is introduced later, the route should remain a supported entry point.

### UX Requirements Relevant To This Story

- Registration should be framed as backing up the user's existing local data, not forcing a login wall.
- Keep the local data preview visible in the unauthenticated account experience so the user sees what they are protecting.
- Maintain inline validation and inline auth errors rather than pushing users into opaque toast-only failure states.
- Keep map context stable after successful registration. The current route-based flow should not redirect the user away from the app's main experience unexpectedly.

### Implementation Notes For The Dev Agent

- The current app wiring already mounts `AuthProvider` in `src/App.tsx`; registration work belongs inside the existing account/auth files rather than app bootstrap.
- Existing tests already cover `useAuth` context access and magic-link redirect behavior. Extend them instead of replacing them blindly.
- The current signed-in experience in `AccountScreen` already supports rig edit, saved spots, spot suggestion, route planning, and sign out. Reuse that post-registration state.
- Because `AuthProvider` already syncs `trip_plans`, ensure registration changes do not accidentally drop trip draft sync even though trip drafts are not part of the original Phase 2 story text.

### Testing Requirements

- Minimum required validation for this story:
  - `npm run test`
  - `npm run typecheck:api`
  - Focused auth helper tests for signup success and duplicate-email failure
  - Focused account/provider tests for authenticated transition after registration
- Regression focus:
  - `/account` unauthenticated and authenticated states
  - map `Account` CTA routing
  - Suggest Spot unauthenticated gate routing to `/account`
  - anonymous browsing without account creation

### Project Structure Notes

- Keep frontend auth work in existing files under `src/features/account/`, `src/contexts/`, and `src/lib/supabase/`.
- Keep database changes minimal. This story should not require broad schema redesign if `profiles` bootstrap can be handled with the existing tables.
- If a new helper is needed for `profiles`, place it under `src/lib/supabase/` alongside other table-specific helpers.

### References

- Source: `_bmad-output/planning-artifacts/epics-phase2.md` (Epic 1, Story 1.2)
- Source: `_bmad-output/planning-artifacts/architecture-phase2.md` (Auth patterns, profiles table, feature-gating boundaries)
- Source: `_bmad-output/planning-artifacts/ux-design-phase2-specification.md` (backup framing, data preview, anonymous continuity)
- Source: `src/features/account/AccountScreen.tsx`
- Source: `src/features/account/AuthProvider.tsx`
- Source: `src/lib/supabase/auth.ts`
- Source: `src/App.tsx`
- Source: `supabase/migrations/015_create_user_sync_tables.sql`
- Source: `supabase/migrations/022_create_phase2_foundation_tables.sql`

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Recent commit context reviewed via `git log --oneline -5`
- Validation commands:
  - `npm run test`
  - `npm run typecheck:api`
  - `npm run lint`

### Completion Notes List

- Story context was adjusted to the real repository state, which already includes auth provider wiring, sync helpers, and current magic-link auth.
- The story explicitly scopes registration to email/password account creation and `profiles` bootstrap without rewriting the existing `rig_profiles` and `saved_spots` sync model.
- Current `/account` and auth-gated CTA routes are treated as the primary delivery surfaces for this story.
- Implemented `signUpWithPassword` with friendly duplicate-email handling for email/password registration.
- Updated `signUpWithPassword` so email-confirmation-required signups return a structured result instead of surfacing a false failure state.
- Added `ensureProfile` so successful registration initializes the `profiles` row without changing the existing `rig_profiles` and `saved_spots` sync model.
- Added rollback handling when profile initialization fails after auth succeeds, preventing partially initialized authenticated sessions.
- Replaced the unauthenticated account screen flow with an email/password create-account form while keeping the local rig, saved spots, and trip drafts summary visible.
- Tightened account copy to use backup-focused wording and explicit confirmation guidance.
- Added focused tests covering the auth helper, account provider signup flow, account screen rendering, and duplicate-email inline error handling.
- Added app-level regression coverage for anonymous map access and `/suggest-spot` redirecting to `/account`.
- Editor diagnostics are clean; `npm run test`, API typecheck, and lint passed.

### File List

- `src/App.tsx`
- `src/App.test.tsx`
- `src/components/AuthRequired.tsx`
- `src/lib/supabase/auth.ts`
- `src/lib/supabase/auth.test.ts`
- `src/lib/supabase/profiles.ts`
- `src/features/account/AuthContext.ts`
- `src/features/account/AuthProvider.tsx`
- `src/features/account/AccountScreen.tsx`
- `src/features/account/AuthProvider.test.tsx`
- `src/features/account/AccountScreen.test.tsx`
- `src/features/spot-submissions/SuggestSpotScreen.tsx`
- `src/contexts/AuthContext.tsx`
- `src/contexts/AuthProvider.tsx`
- `src/contexts/AuthContext.test.tsx`
- `_bmad-output/implementation-artifacts/p2-1-2-user-registration.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-03-24: Implemented email/password registration, profile bootstrap, updated account UX, and focused registration test coverage.
- 2026-03-24: Senior developer review completed; status returned to `in-progress` with AI review follow-ups for signup edge cases, route-gating consistency, test gaps, and story traceability.
- 2026-03-24: Addressed all AI review follow-ups, added auth-gating regressions, and returned the story to `review`.

## Senior Developer Review (AI)

### Reviewer

Kyryl

### Date

2026-03-24

### Outcome

Changes Requested

### Summary

- Found 2 high-severity issues, 3 medium-severity issues, and 1 low-severity issue.
- Re-ran validation locally: `npm run test`, `npm run typecheck:api`, and `npm run lint` all completed successfully.
- The implementation does cover the happy-path registration UX and duplicate-email messaging, but the current review does not support promoting this story to `done`.

### Findings

1. **High** — `signUpWithPassword()` treats the `data.session === null` signup path as a failure by immediately attempting `signInWithPassword()`. In Supabase projects that require email confirmation, that can surface a signup error even though the account was created successfully. [`src/lib/supabase/auth.ts:71-99`]
2. **High** — `AuthProvider.signUp()` does not make auth creation and `profiles` bootstrap atomic. If `ensureProfile()` fails after auth succeeds, the user can be authenticated without the required `profiles` row, violating AC2. [`src/features/account/AuthProvider.tsx:239-250`, `src/features/account/AuthProvider.test.tsx:100-125`]
3. **Medium** — Task 5.1 / 5.4 are marked complete, but the checked-in tests do not exercise the unauthenticated Suggest Spot gate or anonymous browsing continuity. That leaves the story claim unverified in the repository. [`_bmad-output/implementation-artifacts/p2-1-2-user-registration.md:71-75`, `src/features/account/AccountScreen.test.tsx:77-104`, `src\App.test.tsx:1-109`, `src/features/spot-submissions/SuggestSpotScreen.tsx:133-158`]
4. **Medium** — The implementation still bypasses the documented `<AuthRequired>` route-protection pattern by mounting `/account` and `/suggest-spot` directly and keeping Suggest Spot’s auth gate inline. [`src/App.tsx:52-58`, `src/features/spot-submissions/SuggestSpotScreen.tsx:133-158`]
5. **Medium** — The Dev Agent Record File List is incomplete relative to the actual story-related changes in git, which hurts auditability for follow-up work. [`_bmad-output/implementation-artifacts/p2-1-2-user-registration.md:173-185`]
6. **Low** — The new account copy is directionally better, but it does not fully match the Phase 2 UX requirement to lead with “back up” language and confirm that data has been backed up after success. [`src/features/account/AccountScreen.tsx:40-42`, `src/features/account/AccountScreen.tsx:136-176`]
