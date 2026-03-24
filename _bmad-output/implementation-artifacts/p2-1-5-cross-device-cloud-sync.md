# Story p2-1.5: Cross-Device Cloud Sync

Status: done

## Story

As an authenticated user,
I want my rig profile and saved spots to sync across all my devices,
so that I have consistent data wherever I use Overnighter.

## Acceptance Criteria

**AC1 - Rig profile changes sync to Supabase and load on other devices**
Given a user is signed in
When they update their rig profile
Then the change is written to `rig_profiles` in Supabase
And on any other signed-in device, the updated profile is loaded on next app open or foreground return
And the map re-renders with the updated rig filter as expected.

**AC2 - Saved spot saves write to cloud and appear on all signed-in devices**
Given a user is signed in
When they save a new spot pin
Then the save is written to `saved_spots` table in addition to localStorage
And the saved spot appears in the Saved tab on all signed-in devices on next app open or foreground return
And when they unsave a spot, the removal syncs to cloud and other devices equally.

**AC3 - New device with empty localStorage loads rig profile and saved spots from cloud**
Given a user is signed in on a new device with no localStorage
When the app loads
Then the rig profile and saved spots are loaded from Supabase cloud
And the Zustand stores are populated with the cloud data
And the map renders rig-filtered as expected
And the Saved tab shows all cloud-saved spots.

## Tasks / Subtasks

- [x] Task 1: Add app-visibility sync to refresh cloud state when the user returns to the app (AC: 1, 2, 3)
  - [x] 1.1 Add a `document.visibilitychange` listener inside `AuthProvider` that triggers a cloud refetch and re-merge when the page becomes visible while authenticated — reuse the existing `runInitialSync()` fetch-merge-apply-persist pattern rather than duplicating it.
  - [x] 1.2 Gate refetches with a minimum interval (e.g. 30 seconds since last sync) stored in a ref so returning to the tab frequently does not trigger redundant API calls.
  - [x] 1.3 Set `applyingRemoteStateRef.current = true` during the visibility-triggered merge to suppress the debounced write-back loop, matching the existing pattern used in `runInitialSync()`.
  - [x] 1.4 Swallow errors from the visibility-triggered refetch silently (console.warn at most) — the local store remains the source of truth until the next successful sync.
  - [x] 1.5 Clean up the visibility listener on provider unmount to prevent memory leaks.

- [x] Task 2: Verify and harden the new-device cloud-first data loading path (AC: 3)
  - [x] 2.1 Trace the exact flow for a new-device session: Supabase `onAuthStateChange` fires `INITIAL_SESSION` → `runInitialSync()` runs → local stores are empty → merge resolves to remote-only data → `replaceFromCloud()` / `replaceSavedSpots()` populate stores → localStorage persists via Zustand `persist` middleware.
  - [x] 2.2 Ensure `mergeRigProfileState()` returns the remote profile when local `rigProfile` has no `rigType` and no `updatedAt`, without error — currently handled but must be verified via a dedicated test.
  - [x] 2.3 Ensure `mergeSavedSpots()` returns the remote array unmodified when local array is empty — already handled by union-merge but must be verified via a dedicated test.
  - [x] 2.4 Confirm that after `replaceFromCloud()` the rig filter hook in the map surface picks up the new profile and re-filters pins. Verify this by checking that the store subscription triggers a re-render in the consuming component.

- [x] Task 3: Ensure debounced cloud write-back handles edge cases for cross-device correctness (AC: 1, 2)
  - [x] 3.1 Verify that after a successful `runInitialSync()` the signature refs are updated to reflect the merged state so the next debounced sync cycle does not immediately re-write the same data to cloud.
  - [x] 3.2 Confirm that unsaving a spot (removing from `savedSpots` array) triggers the debounced sync path and that `replaceSavedSpots()` in `savedSpots.ts` correctly deletes the removed pin from the `saved_spots` table via the delta-delete logic.
  - [x] 3.3 Verify that when the debounced cloud write fails (e.g. network error), the local store and localStorage remain unchanged and the next sync cycle retries the write.
  - [x] 3.4 Confirm that `trip_plans` sync continues to work alongside rig profile and saved spot sync without interference — do not regress the existing trip plans sync path.

- [x] Task 4: Add focused test coverage for cross-device sync scenarios (AC: 1, 2, 3)
  - [x] 4.1 Add tests in `AuthProvider.test.tsx` for the visibility-triggered refetch: mock `document.visibilitychange`, verify that `getRigProfile()` and `getSavedSpots()` are called again, verify that the store is updated with fresh cloud data.
  - [x] 4.2 Add tests in `AuthProvider.test.tsx` for the new-device scenario: start with empty stores, mock cloud data return, verify stores are populated correctly after `runInitialSync()`.
  - [x] 4.3 Add tests in `AuthProvider.test.tsx` for the debounce gating after visibility-triggered sync: verify the minimum interval prevents rapid re-fetches.
  - [x] 4.4 Add or extend `mergeCloudState.test.ts` tests for edge cases: empty local + populated remote, populated local + empty remote, both empty, conflicting timestamps.
  - [x] 4.5 Verify existing anonymous user behavior is not regressed: anonymous users should never trigger visibility refetch or cloud sync.
  - [x] 4.6 Run `npm run test`, `npm run typecheck:api`, and `npm run lint` before moving the story to review.

## Dev Notes

### Context Summary

- Sprint tracking shows `p2-1-5-cross-device-cloud-sync` as the next backlog story in Phase 2 Epic 1, with all four prior stories (`p2-1-1` through `p2-1-4`) completed.
- The repo already contains a working bidirectional sync infrastructure in `AuthProvider`: `runInitialSync()` fetches and merges cloud data on sign-in, and a debounced write-back loop pushes local changes to cloud on a 400ms delay.
- The core cloud write and merge logic is already in place. This story's primary new functionality is adding **app-visibility-triggered refetch** so that returning to the app on any device picks up changes made on other devices, plus hardening and testing the new-device (empty localStorage) path.
- The architecture specifies that real-time sync via Supabase Realtime is deferred to Phase 3. Phase 2 uses polling/refetch-on-focus for cross-device freshness.

### Current Repository Reality

- `src/features/account/AuthProvider.tsx` (358 lines) already:
  - Subscribes to `supabase.auth.onAuthStateChange` and runs `runInitialSync()` on auth
  - Fetches `getRigProfile()`, `getSavedSpots()`, and `getTripPlans()` in parallel from Supabase
  - Merges local + cloud state using `mergeRigProfileState()`, `mergeSavedSpots()`, `mergeTripPlans()` from `mergeCloudState.ts`
  - Applies merged state to Zustand stores via `replaceFromCloud()`, `replaceSavedSpots()`, `replaceTripPlans()`
  - Writes merged state back to cloud via `upsertRigProfile()`, `syncSavedSpots()`, `syncTripPlans()`
  - Tracks synced state via JSON signature refs (`rigSigRef`, `spotsSigRef`, `tripsSigRef`)
  - Uses `applyingRemoteStateRef` to suppress write-back during merge
  - Uses 400ms debounce for write-back to cloud
  - Has a `migrationCompletedRef` that gates initial sync after signup migration
- `src/lib/sync/mergeCloudState.ts` (68 lines) implements:
  - `mergeRigProfileState()`: takes newer by `updatedAt` timestamp; local wins on tie
  - `mergeSavedSpots()`: union-merge by pin ID; local overwrites remote with same ID
  - `mergeTripPlans()`: union-merge by plan ID with timestamp-based conflict resolution
- `src/lib/supabase/rigProfiles.ts` (52 lines): `getRigProfile()`, `upsertRigProfile()`, `deleteRigProfile()` — all use direct Supabase client queries with RLS
- `src/lib/supabase/savedSpots.ts` (56 lines): `getSavedSpots()`, `replaceSavedSpots()` — uses delta-based sync: reads existing IDs → upserts new → deletes removed
- `src/store/rigStore.ts` (48 lines): Zustand store with `persist` middleware, localStorage key `'rig-profile'`, `replaceFromCloud()` method for cloud merge
- `src/store/spotsStore.ts` (41 lines): Zustand store with `persist` middleware, localStorage key `'saved-spots'`, `replaceSavedSpots()` method for cloud merge
- `src/store/tripPlansStore.ts` (80 lines): Zustand store with `persist` middleware, localStorage key `'trip-plans'`, `replaceTripPlans()` method
- `src/lib/supabase/profiles.ts` (12 lines): `ensureProfile(userId)` — creates `profiles` row on sign-up
- `src/lib/supabase/migrate.ts` (38 lines): client-side wrapper for `POST /api/auth/migrate`
- `api/auth/migrate.ts` (85 lines): server-side migration endpoint with zod validation
- Current schema uses `rig_profiles` table (not `profiles.rig_profile` column) — the architecture doc's wording is aspirational; Story p2-1-4 explicitly decided to use the actual schema
- No `document.visibilitychange` or window focus listener currently exists in the codebase for sync purposes

### Previous Story Intelligence

- Story `p2-1-4-localstorage-data-migration` established:
  - The `POST /api/auth/migrate` endpoint and client wrapper
  - Integration of migration into `signUp()` flow in AuthProvider
  - `migrationCompletedRef` to gate initial sync after signup migration
  - Account screen backup preview copy and success/failure messaging
  - All 609 tests passing at completion
- Story `p2-1-3-sign-in-and-sign-out` established:
  - The entire `AuthProvider` with initial sync and debounced write-back
  - Auth state via React context (not Zustand)
  - `runInitialSync()` as the merge orchestrator
  - Signature-based dirty detection for cloud write-back
  - `applyingRemoteStateRef` pattern to prevent sync loops
  - All merge functions in `mergeCloudState.ts`
- Story `p2-1-2-user-registration` established:
  - Email/password registration flow
  - `ensureProfile()` bootstrap
  - Backup-oriented account copy in AccountScreen
- Key lessons from prior stories:
  - Always use `useAuth()` hook — never call `supabase.auth` directly
  - Keep auth orchestration in `AuthProvider` — don't scatter into screens
  - Preserve anonymous data through auth transitions
  - The existing sync flow in AuthProvider is the right integration point — extend it, don't replace

### Architecture Guardrails (Must Follow)

- Always access auth state/actions through `useAuth()` or provider-owned helpers; do not call `supabase.auth` directly from components or stores. [Source: `_bmad-output/planning-artifacts/architecture-phase2.md` — Auth Patterns]
- Never read auth state from localStorage or cookies manually; trust Supabase session persistence and `onAuthStateChange`. [Source: `_bmad-output/planning-artifacts/architecture-phase2.md` — Auth Patterns]
- Preserve auth/anonymous coexistence. Anonymous users must browse the map and use local storage without triggering cloud sync or login walls. [Source: `_bmad-output/planning-artifacts/architecture-phase2.md` — Critical complexity: auth/anonymous coexistence]
- Keep route protection on `<AuthRequired>`; do not introduce inline redirect logic. [Source: `_bmad-output/planning-artifacts/architecture-phase2.md` — Auth Patterns]
- Supabase Realtime subscriptions are deferred to Phase 3. Phase 2 cross-device freshness uses refetch-on-app-open/focus, not live subscriptions. [Source: `_bmad-output/planning-artifacts/architecture-phase2.md` — Future roadmap]
- TanStack Query `retry: 3` is already configured for transient failure handling. [Source: `_bmad-output/planning-artifacts/architecture-phase2.md` — Offline Check-In Queue]
- RLS is enabled on `rig_profiles` and `saved_spots` with user-scoped policies. All client reads/writes go through Supabase client which applies RLS automatically. [Source: `supabase/migrations/015_create_user_sync_tables.sql`]

### UX Requirements Relevant To This Story

- Cross-device sync should feel seamless: users open the app on a new device and "it just works" with their existing rig profile and saved spots. [Source: `_bmad-output/planning-artifacts/ux-design-phase2-specification.md` — Marcus user profile]
- The migration moment (Story 1.4) frames cloud as "backup" — this story extends that mental model: data is always up-to-date everywhere, not just backed up once. [Source: `_bmad-output/planning-artifacts/ux-design-phase2-specification.md` — account migration loop]
- No explicit sync status indicator is specified in the UX spec for Phase 2. Sync should be invisible and automatic. Only failure should surface feedback (e.g. retry messaging from Story 1.4). [Source: `_bmad-output/planning-artifacts/ux-design-phase2-specification.md`]
- The map should remain unchanged and functional during and after sync operations. [Source: `_bmad-output/planning-artifacts/epics-phase2.md` — Story 1.5 AC3]
- Async feedback pattern: progress → success → dismiss. For background sync, this is implicit — no visible spinner. [Source: `_bmad-output/planning-artifacts/ux-design-phase2-specification.md` — Feedback patterns]

### Implementation Notes For The Dev Agent

- The primary new code is a `document.visibilitychange` listener in `AuthProvider` that triggers a cloud refetch when the user returns to the app. This should reuse the same fetch-merge-apply-persist flow from `runInitialSync()`.
- Extract the fetch-merge-apply-persist logic from `runInitialSync()` into a reusable helper (e.g. `syncWithCloud()`) that both `runInitialSync()` and the visibility listener can call, to avoid duplication.
- The minimum-interval gate should use a `lastSyncRef` timestamp ref, not a timer. Compare `Date.now() - lastSyncRef.current > SYNC_INTERVAL_MS` before triggering.
- Do NOT add Supabase Realtime subscriptions — that is Phase 3 work.
- Do NOT add a visible sync spinner or status banner — the UX spec does not call for one in Phase 2.
- The new-device path should already work via the existing merge logic (empty local + populated remote = remote wins). The task here is to verify and test it, not to rewrite it.
- Keep error handling for background sync lightweight: `console.warn` for visibility-triggered sync failures. The user's local data is the fallback.
- The visibility listener must only activate for authenticated users. Check `sessionRef.current` or equivalent before initiating sync.
- Preserve the `applyingRemoteStateRef` pattern during visibility-triggered merge to prevent the debounced write-back from firing redundantly.
- Trip plans sync should continue to work alongside rig profile and saved spot sync — do not regress it.
- Follow the existing file patterns:
  - Sync orchestration stays in `src/features/account/AuthProvider.tsx`
  - Merge logic stays in `src/lib/sync/mergeCloudState.ts`
  - Supabase query helpers stay in `src/lib/supabase/`
  - Store logic stays in Zustand stores

### Testing Requirements

- Minimum required validation for this story:
  - `npm run test`
  - `npm run typecheck:api`
  - `npm run lint`
- Focused test coverage should include:
  - Visibility-triggered refetch fires when page becomes visible with authenticated session
  - Visibility-triggered refetch does NOT fire for anonymous users
  - Minimum interval gate prevents rapid re-fetches
  - New-device scenario: empty local stores + cloud data → stores populated correctly
  - Merge edge cases: empty local + populated remote, populated local + empty remote, both empty
  - Unsave-spot sync: removal propagates to cloud via delta-delete
  - Debounce signature update after initial sync prevents redundant write-back
  - Anonymous browsing continuity: map, saved spots, rig profile all work without cloud sync
  - Trip plans sync not regressed

### Project Structure Notes

- All sync orchestration stays in `src/features/account/AuthProvider.tsx` — extend, don't create new files for the visibility listener.
- If extracting a reusable `syncWithCloud()` helper, keep it as a private function within `AuthProvider.tsx` or as a nearby helper in the same directory — do not create a new module unless the extraction is substantial.
- Merge logic stays in `src/lib/sync/mergeCloudState.ts` — extend with edge case tests, not new merge strategies.
- Supabase query helpers in `src/lib/supabase/` are stable and should not need changes for this story.
- Zustand stores in `src/store/` are stable and should not need changes for this story.
- Do not introduce new dependencies, schema changes, or API endpoints in this story.

### References

- Source: `_bmad-output/planning-artifacts/epics-phase2.md` — Story 1.5: Cross-Device Cloud Sync
- Source: `_bmad-output/planning-artifacts/architecture-phase2.md` — Auth Patterns, Anonymous to Authenticated Migration, Data Layer Design, Client Data Access Pattern, Sync Strategy
- Source: `_bmad-output/planning-artifacts/ux-design-phase2-specification.md` — Marcus user profile, account migration loop, async feedback patterns
- Source: `_bmad-output/implementation-artifacts/p2-1-4-localstorage-data-migration.md`
- Source: `_bmad-output/implementation-artifacts/p2-1-3-sign-in-and-sign-out.md`
- Source: `src/features/account/AuthProvider.tsx`
- Source: `src/features/account/AuthContext.ts`
- Source: `src/lib/sync/mergeCloudState.ts`
- Source: `src/lib/supabase/rigProfiles.ts`
- Source: `src/lib/supabase/savedSpots.ts`
- Source: `src/lib/supabase/profiles.ts`
- Source: `src/lib/supabase/migrate.ts`
- Source: `src/store/rigStore.ts`
- Source: `src/store/spotsStore.ts`
- Source: `src/store/tripPlansStore.ts`
- Source: `api/auth/migrate.ts`
- Source: `supabase/migrations/015_create_user_sync_tables.sql`

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Extracted `syncWithCloud()` as a `useCallback` in AuthProvider to DRY the fetch-merge-apply-persist logic between initial sync and visibility-triggered sync.
- Signature refs are updated inside the `applyingRemoteStateRef = true` guard (before cloud write-back) to prevent the debounced write-back from firing a redundant cycle immediately after sync.
- All 625 tests pass (up from 609), typecheck and lint clean.
- 16 new tests: 7 AuthProvider visibility/new-device tests, 9 mergeCloudState edge case tests.

### File List

- `src/features/account/AuthProvider.tsx` — Added `syncWithCloud` callback, visibility-change effect with 30s gate, `lastSyncTimestampRef`, exported `VISIBILITY_SYNC_INTERVAL_MS` constant.
- `src/features/account/AuthProvider.test.tsx` — Added visibility-triggered sync tests (refetch, anonymous gate, interval gate, hidden state, error swallowing) and new-device cloud-first loading tests.
- `src/lib/sync/mergeCloudState.test.ts` — Added edge case tests: null remote, both empty, equal timestamps, empty local/remote arrays for all three merge functions.
