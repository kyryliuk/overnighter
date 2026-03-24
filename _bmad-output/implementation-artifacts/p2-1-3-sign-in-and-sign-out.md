# Story p2-1.3: Sign In and Sign Out

Status: done

## Story

As a returning user,
I want to sign in to my existing account and sign out,
so that I can access my cloud data on any device.

## Acceptance Criteria

**AC1 - Returning users can sign in with email and password**
Given a user has an existing account and is not signed in
When they tap "Sign in" in the account/auth experience
Then they can enter email and password and become authenticated
And the Profile/Account navigation affordance updates to show their account initial
And the map and core features remain otherwise unchanged.

**AC2 - Signed-in users can sign out without losing local anonymous data**
Given a user is signed in
When they tap "Sign out" in the Profile/Account screen
Then they are signed out and the app reverts to the anonymous experience
And localStorage rig profile and saved spots are preserved locally
And existing local trip drafts are not cleared by sign-out.

**AC3 - Incorrect credentials show an inline, user-friendly error**
Given a user enters incorrect credentials
When they submit the sign-in form
Then an inline error is shown with the exact message "Incorrect email or password"
And the form remains editable without clearing the entered email.

## Tasks / Subtasks

- [x] Task 1: Extend Supabase auth helpers for email/password sign-in (AC1, AC3)
  - [x] 1.1 Add a dedicated `signInWithPassword(email, password)` helper in `src/lib/supabase/auth.ts` using `supabase.auth.signInWithPassword`.
  - [x] 1.2 Normalize Supabase invalid-credential responses to the exact product copy: `Incorrect email or password`.
  - [x] 1.3 Preserve the existing `signUpWithPassword`, `requestMagicLink`, and `signOut` helpers; this story adds sign-in and should not regress registration or legacy auth utilities.
  - [x] 1.4 Add/update focused auth helper tests in `src/lib/supabase/auth.test.ts` for successful sign-in and incorrect-credential handling.

- [x] Task 2: Extend auth context/provider for sign-in state and reuse existing session sync (AC1, AC2, AC3)
  - [x] 2.1 Update `src/features/account/AuthContext.ts` to expose `signIn` and `isSigningIn` alongside the existing signup/signout contract.
  - [x] 2.2 Keep the stable re-export surface in `src/contexts/AuthContext.tsx` and `src/contexts/AuthProvider.tsx` compatible with the updated feature-level auth modules.
  - [x] 2.3 Implement `signIn` in `src/features/account/AuthProvider.tsx` by calling the new auth helper and relying on the existing session + `onAuthStateChange` flow.
  - [x] 2.4 Do not call `ensureProfile()` during sign-in; registration already owns profile bootstrap, while sign-in should only establish the session and allow the existing sync orchestration to run.
  - [x] 2.5 Preserve the current sign-out behavior so it clears auth state without deleting local rig profile, saved spots, or trip drafts.

- [x] Task 3: Update the account screen to support both registration and sign-in for anonymous users (AC1, AC3)
  - [x] 3.1 Extend `src/features/account/AccountScreen.tsx` so the unauthenticated account surface can switch between the existing create-account flow and a returning-user sign-in flow.
  - [x] 3.2 Keep the local-data summary card visible in the unauthenticated account experience so users still understand what will sync/back up.
  - [x] 3.3 Add a sign-in form with email and password inputs, loading state, and inline error rendering that matches the current accessibility/error-card pattern.
  - [x] 3.4 Keep entered email visible after an incorrect-credential failure; only clear password/success state when appropriate.
  - [x] 3.5 Preserve the existing authenticated account actions panel after successful sign-in, including the current `Sign out` entry point.

- [x] Task 4: Update Profile/Account navigation affordance and preserve anonymous continuity (AC1, AC2)
  - [x] 4.1 Update the current Account/Profile CTA in `src/features/map/MapView.tsx` so authenticated users see their account initial while anonymous users still have a clear account entry point.
  - [x] 4.2 Keep `/account` as the supported route entry point for this story; do not replace it with a modal-only implementation.
  - [x] 4.3 Preserve the existing `<AuthRequired>` route-protection pattern in `src/components/AuthRequired.tsx` and `src/App.tsx`; do not introduce inline auth redirects inside feature screens.
  - [x] 4.4 Verify sign-out returns the user to the anonymous experience without breaking map browsing, saved spots access, pin detail navigation, or other non-auth flows.

- [x] Task 5: Add focused regression coverage for sign-in/sign-out behavior (AC1, AC2, AC3)
  - [x] 5.1 Add/update `src/lib/supabase/auth.test.ts` for sign-in success and friendly invalid-credential errors.
  - [x] 5.2 Add/update `src/features/account/AuthProvider.test.tsx` for sign-in session handling, loading state, and sign-out behavior.
  - [x] 5.3 Add/update `src/features/account/AccountScreen.test.tsx` for switching to sign-in mode, inline error handling, and successful authenticated rendering.
  - [x] 5.4 Add/update `src/App.test.tsx` and/or `src/features/map/MapView.test.tsx` to cover the Profile/Account affordance and anonymous/authenticated route behavior.
  - [x] 5.5 Run `npm run test`, `npm run typecheck:api`, and `npm run lint` before marking the story ready for review.

## Dev Notes

### Context Summary

- Sprint status shows `p2-1-3-sign-in-and-sign-out` is the next backlog story after `p2-1-2-user-registration`.
- The repository already includes the Phase 2 auth provider, account route, registration flow, local/cloud sync orchestration, and a working sign-out button.
- This story is primarily about adding a returning-user sign-in path and tightening the account/profile affordance, not rebuilding auth foundations.

### Current Repository Reality

- `src/features/account/AccountScreen.tsx` currently renders a registration-first unauthenticated account screen with email/password signup and a signed-in actions panel that already includes `Sign out`.
- `src/features/account/AuthProvider.tsx` already loads the current session, subscribes to `onAuthStateChange`, performs initial cloud sync for rig profile/saved spots/trip plans, and supports `signUp` plus `signOut`.
- `src/features/account/AuthContext.ts` exposes `signUp` and `signOut`, but not `signIn` or `isSigningIn`.
- `src/lib/supabase/auth.ts` already contains `signUpWithPassword()` and `signOut()`, but it does not yet expose a dedicated `signInWithPassword()` helper or invalid-credential normalization for sign-in.
- `src/contexts/AuthContext.tsx` and `src/contexts/AuthProvider.tsx` are thin re-export wrappers used by `src/App.tsx` and `src/components/AuthRequired.tsx`; keep those wrappers aligned with any feature-level auth contract changes.
- `src/features/map/MapView.tsx` currently uses a simple `Account` button that routes to `/account`; it does not yet reflect authenticated initials from the active session.

### Previous Story Intelligence

- Story `p2-1-2-user-registration` established the current email/password registration approach, friendly auth-error normalization, and the backup-oriented account copy.
- Registration already treats `profiles` as additive metadata and keeps `rig_profiles`, `saved_spots`, and `trip_plans` sync inside the existing provider orchestration.
- The previous story added reusable route-level auth gating via `<AuthRequired>` and verified anonymous `/suggest-spot` redirects in `src/App.test.tsx`; reuse that pattern rather than adding new inline redirect logic.
- The previous story also confirmed that auth work belongs in the existing account/auth modules instead of spreading raw Supabase calls across screens.

### Architecture Guardrails (Must Follow)

- Always access auth state/actions through `useAuth()`; do not call `supabase.auth` directly from components or stores. [Source: `_bmad-output/planning-artifacts/architecture-phase2.md#Rule: Never call supabase.auth directly in components or stores.`]
- Do not manually read auth state from localStorage or cookies. Trust Supabase session persistence through `onAuthStateChange`. [Source: `_bmad-output/planning-artifacts/architecture-phase2.md#Rule: Never read auth state from localStorage or cookies manually.`]
- Keep route protection on the established `<AuthRequired>` wrapper pattern; do not add inline route-guard redirects inside screens. [Source: `_bmad-output/planning-artifacts/architecture-phase2.md#Rule: Route protection uses <AuthRequired> wrapper — never inline redirects.`]
- Keep auth state in React context, not Zustand or ad hoc component state. [Source: `_bmad-output/planning-artifacts/architecture-phase2.md#Auth State — React Context (not Zustand)`]
- Preserve anonymous/local fallback behavior while auth is absent. [Source: `_bmad-output/planning-artifacts/architecture-phase2.md` (coverage matrix row for anonymous coexistence)]

### UX Requirements Relevant To This Story

- The non-authenticated Profile tab/account surface must present a clear sign-in CTA for returning users. [Source: `_bmad-output/planning-artifacts/ux-design-phase2-specification.md#Navigation Patterns`]
- Keep the existing backup framing and local-data visibility from registration so the account surface still explains what syncs to the cloud. [Source: `_bmad-output/planning-artifacts/ux-design-phase2-specification.md` (account backup interaction copy around the create-account flow)]
- Inline errors are required for failed sign-in attempts; do not rely on hidden or toast-only errors.
- Preserve the current map/core experience while auth state changes; signing in should unlock account-backed data without turning the app into a login wall.

### Implementation Notes For The Dev Agent

- Reuse the auth-helper normalization pattern already present in `src/lib/supabase/auth.ts`; add a sign-in-specific branch for invalid credentials instead of inventing a second error-mapping style.
- Keep sign-in lighter than signup: no `profiles` bootstrap, no duplicate registration flow, and no schema changes should be necessary for this story.
- The provider already performs initial sync after a session appears. Sign-in should lean on that existing behavior so returning users receive cloud data after authentication without a second sync mechanism.
- Keep the account screen implementation additive: returning users need sign-in, but the current create-account path from Story p2-1-2 must remain available.
- If the authenticated Profile/Account affordance is updated in `MapView`, make the change minimal and testable; do not redesign the entire bottom navigation in this story.
- Preserve current behavior where sign-out navigates back toward the anonymous map experience and leaves local state intact.

### Testing Requirements

- Minimum required validation for this story:
  - `npm run test`
  - `npm run typecheck:api`
  - `npm run lint`
- Focused test coverage should include:
  - auth helper success + invalid-credential handling
  - provider sign-in/sign-out state transitions
  - account screen sign-in mode toggle and inline errors
  - authenticated vs anonymous Profile/Account affordance
  - anonymous route continuity, especially `/account` and existing auth-gated routes

### Project Structure Notes

- Keep feature auth UI/state work in the existing account files under `src/features/account/`.
- Keep Supabase auth calls centralized in `src/lib/supabase/auth.ts`.
- Keep the public app-wide import surface stable through `src/contexts/AuthContext.tsx` and `src/contexts/AuthProvider.tsx`.
- Keep the Profile/Account CTA update in the current map/navigation surface under `src/features/map/MapView.tsx`.
- Do not introduce unrelated API endpoints, migrations, or store rewrites in this story.

### References

- Source: `_bmad-output/planning-artifacts/epics-phase2.md#Story 1.3: User Sign In and Sign Out`
- Source: `_bmad-output/planning-artifacts/architecture-phase2.md#Auth State — React Context (not Zustand)`
- Source: `_bmad-output/planning-artifacts/architecture-phase2.md#Rule: Never call supabase.auth directly in components or stores.`
- Source: `_bmad-output/planning-artifacts/architecture-phase2.md#Rule: Never read auth state from localStorage or cookies manually.`
- Source: `_bmad-output/planning-artifacts/architecture-phase2.md#Rule: Route protection uses <AuthRequired> wrapper — never inline redirects.`
- Source: `_bmad-output/planning-artifacts/ux-design-phase2-specification.md#Navigation Patterns`
- Source: `_bmad-output/implementation-artifacts/p2-1-2-user-registration.md`
- Source: `src/features/account/AccountScreen.tsx`
- Source: `src/features/account/AuthContext.ts`
- Source: `src/features/account/AuthProvider.tsx`
- Source: `src/lib/supabase/auth.ts`
- Source: `src/contexts/AuthContext.tsx`
- Source: `src/contexts/AuthProvider.tsx`
- Source: `src/features/map/MapView.tsx`
- Source: `src/components/AuthRequired.tsx`
- Source: `src/App.tsx`

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Previous story context: `_bmad-output/implementation-artifacts/p2-1-2-user-registration.md`
- Recent commit context reviewed via `git log --oneline -5`
- Validation commands:
  - `npm run test`
  - `npm run typecheck:api`
  - `npm run lint`

### Completion Notes List

- Added `signInWithPassword()` to the centralized Supabase auth helper and normalized invalid-credential responses to the exact inline copy `Incorrect email or password`.
- Extended the auth context/provider contract with `signIn` and `isSigningIn`, while keeping sign-in scoped to session establishment and preserving the existing sync orchestration and local-data-safe sign-out behavior.
- Updated the anonymous account screen to switch between create-account and returning-user sign-in flows without removing the local data summary or the existing signed-in account actions panel.
- Updated the map account affordance so authenticated users see their account initial while anonymous users still get the existing clear `/account` entry point.
- Added focused regression coverage across auth helpers, provider state transitions, account screen mode switching and errors, app route continuity, and map account affordance behavior.
- Ran `npm run test`, `npm run typecheck:api`, and `npm run lint`; all passed.

### File List

- `src/lib/supabase/auth.ts`
- `src/lib/supabase/auth.test.ts`
- `src/features/account/AuthContext.ts`
- `src/features/account/AuthProvider.tsx`
- `src/features/account/AuthProvider.test.tsx`
- `src/features/account/AccountScreen.tsx`
- `src/features/account/AccountScreen.test.tsx`
- `src/features/map/MapView.tsx`
- `src/features/map/MapView.test.tsx`
- `src/App.test.tsx`
- `src/contexts/AuthContext.test.tsx`
- `_bmad-output/implementation-artifacts/p2-1-3-sign-in-and-sign-out.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-03-24: Implemented returning-user sign-in, preserved sign-out/local-data continuity, added auth/account/map regression coverage, and advanced the story to `review`.
- 2025-07-21: Code review approved with no issues. Status set to `done`.
