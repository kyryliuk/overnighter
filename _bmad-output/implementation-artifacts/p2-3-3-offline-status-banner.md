# Story 3.3: Offline Status Banner & Indicators

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user**,
I want to see a clear indicator when I'm offline and when an app update is available,
So that I understand what features are available, that the app is working from cache, and can update to the latest version.

## Acceptance Criteria

**AC1 — Offline banner appears when connectivity is lost**
Given a user loses cellular connectivity
When the `navigator.onLine` event fires as false
Then an offline banner appears at the top of the screen
And the banner does not push map content — it overlays with partial opacity

**AC2 — Offline banner shows correct message based on cache state**
Given the user is offline with a cached area
When they browse the cached map
Then cached tiles and saved spot data load normally
And the offline banner message indicates cached data is available with the cache timestamp

Given the user is offline in an area with no cached tiles
When they open the app
Then the banner shows a message indicating no cached map data is available
And the map shows an empty tile background (no crash)

**AC3 — Offline banner auto-dismisses on reconnect**
Given the user regains connectivity
When the `online` event fires
Then the offline banner is dismissed automatically

**AC4 — Update available banner shown when new SW version is detected**
Given a new service worker version is detected
When `usePWAUpdate` reports `needRefresh` as true
Then an update available banner is shown with "Update available" text and an "Update" action button
And tapping "Update" calls `updateServiceWorker()` to activate the new SW version
And the banner is dismissible without updating

**AC5 — Banners are non-blocking and accessible**
Given a banner is visible (offline or update)
When the user interacts with the app
Then the banner does not block map interaction or push content
And the banner has `role="status"` for screen reader accessibility
And both banners can coexist (offline + update) without overlapping

## Tasks / Subtasks

- [ ] Task 1: Enhance OfflineStatusBanner component (AC: 1, 2, 3, 5)
  - [ ] 1.1 Update `src/components/OfflineStatusBanner.tsx` — the component already exists with basic offline detection via `useOnlineStatus()` and pins cache timestamp display. Verify it meets all ACs and refine messaging:
    - Offline with cached data: "Offline — showing saved map data from {timestamp}. Check-ins and reports require a connection."
    - Offline without cached data: "Offline — connect once to download map data. Check-ins and reports require a connection."
  - [ ] 1.2 Ensure the banner uses `fixed` positioning with `z-[1100]`, does not push content, and overlays with partial opacity (`bg-background/95`).
  - [ ] 1.3 Verify the banner auto-dismisses when `isOnline` returns `true` (already implemented — `if (isOnline) return null`).
  - [ ] 1.4 Ensure the banner has `role="status"` for accessibility (already implemented — verify).
  - [ ] 1.5 Listen for `PINS_CACHE_UPDATED_EVENT`, `storage`, `online`, and `offline` events to refresh cache state (already implemented — verify).

- [ ] Task 2: Create UpdateBanner component (AC: 4, 5)
  - [ ] 2.1 Create `src/components/UpdateBanner.tsx` — a fixed-position banner that shows when `usePWAUpdate()` reports `needRefresh` as true.
  - [ ] 2.2 The banner displays: "A new version is available" text + "Update" button (blue-500 bg, white text) + dismiss "✕" button.
  - [ ] 2.3 Tapping "Update" calls `updateServiceWorker()` from `usePWAUpdate()`. Tapping "✕" dismisses the banner (local state, reappears on next SW detection cycle).
  - [ ] 2.4 Position the banner at the top of the screen, below the OfflineStatusBanner if both are showing. Use `fixed top-4 left-4 right-4 z-[1099]` (one level below OfflineStatusBanner's `z-[1100]`). If OfflineStatusBanner is visible, shift UpdateBanner down with `top-20` to avoid overlap.
  - [ ] 2.5 The banner must not push content — overlay only, with `pointer-events-none` on the container and `pointer-events-auto` on the banner itself.
  - [ ] 2.6 Add `role="status"` for screen reader accessibility.
  - [ ] 2.7 Touch targets: minimum 44x44px (`min-h-11 min-w-11`) for Update and dismiss buttons.

- [ ] Task 3: Integrate UpdateBanner into App shell (AC: 4, 5)
  - [ ] 3.1 Import and render `<UpdateBanner />` in `src/App.tsx`, adjacent to `<OfflineStatusBanner />`. Place it directly after the OfflineStatusBanner so both can render independently.
  - [ ] 3.2 The `usePWAUpdate()` hook is already called in App.tsx indirectly (via `useRegisterSW` registration). The UpdateBanner should call `usePWAUpdate()` internally to get `needRefresh` and `updateServiceWorker`.
  - [ ] 3.3 Verify that the existing `useUIStore.updateAvailable` state syncs correctly with `usePWAUpdate()` — the hook already sets this in `uiStore` via `setUpdateAvailable(needRefresh)`.

- [ ] Task 4: Coordinate banner stacking (AC: 5)
  - [ ] 4.1 Use the `useOnlineStatus()` hook in UpdateBanner to detect if the offline banner is also showing. When offline banner is visible, shift UpdateBanner down (e.g., `top-20` instead of `top-4`).
  - [ ] 4.2 Both banners use `pointer-events-none` on their outer container and `pointer-events-auto` on the inner content to allow map interaction behind them.

- [ ] Task 5: Add comprehensive tests (AC: 1, 2, 3, 4, 5)
  - [ ] 5.1 Create `src/components/UpdateBanner.test.tsx`:
    - Renders nothing when `needRefresh` is false.
    - Renders banner with "Update" button when `needRefresh` is true.
    - Clicking "Update" calls `updateServiceWorker()`.
    - Clicking dismiss hides the banner.
    - Has `role="status"` attribute.
    - Shifts position when offline (test with mocked `useOnlineStatus`).
  - [ ] 5.2 Create or update `src/components/OfflineStatusBanner.test.tsx`:
    - Renders nothing when online.
    - Renders offline message when `useOnlineStatus()` returns false.
    - Shows cached timestamp when pins cache snapshot exists.
    - Shows "connect once to download" when no cache exists.
    - Has `role="status"` attribute.
    - Auto-dismisses when transitioning from offline to online.
  - [ ] 5.3 Run `npm run test`, `npm run typecheck:api`, and `npm run lint` — all must pass.

## Dev Notes

### Context Summary

- Sprint tracking shows `p2-3-3-offline-status-banner` as backlog in Phase 2 Epic 3 (Offline PWA). Stories 3.1 (PWA Manifest & SW Installation) and 3.2 (Offline Map Tile Cache) are in review with implementations complete.
- **Key insight:** Much of this story is already partially implemented. The `OfflineStatusBanner` component, `useOnlineStatus` hook, and `usePWAUpdate` hook all exist. The primary new work is creating the `UpdateBanner` component and ensuring all ACs are met.
- No new API endpoints needed (Vercel Hobby 12-function limit maintained).

### Current Repository Reality

**OfflineStatusBanner (`src/components/OfflineStatusBanner.tsx` — already exists):**
```typescript
export default function OfflineStatusBanner() {
  const isOnline = useOnlineStatus()
  const [cachedAt, setCachedAt] = useState<string | null>(
    () => readPinsCacheSnapshot()?.cachedAt ?? null,
  )
  // ... listens for PINS_CACHE_UPDATED_EVENT, storage, online, offline events
  if (isOnline) return null
  const message = cachedAt
    ? `Offline — showing saved map data from ${formatCachedAt(cachedAt)}...`
    : 'Offline — connect once to download map data...'
  return (
    <div className="fixed top-4 left-4 right-4 z-[1100] flex justify-center pointer-events-none">
      <p role="status" className="... bg-background/95 ...">
        {message}
      </p>
    </div>
  )
}
```
- Already meets AC1, AC2, AC3, AC5 (non-blocking, accessible). Verify and confirm — no major changes expected.

**useOnlineStatus (`src/hooks/useOnlineStatus.ts` — already exists):**
```typescript
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(getInitialOnlineStatus)
  useEffect(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => { /* cleanup */ }
  }, [])
  return isOnline
}
```
- Reactive online/offline detection via browser events. Used by OfflineStatusBanner.

**usePWAUpdate (`src/hooks/usePWAUpdate.ts` — already exists):**
```typescript
export function usePWAUpdate() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  const setUpdateAvailable = useUIStore((state) => state.setUpdateAvailable)
  useEffect(() => { setUpdateAvailable(needRefresh) }, [needRefresh, setUpdateAvailable])
  return { needRefresh, updateServiceWorker }
}
```
- Wraps `useRegisterSW`, exposes `needRefresh` boolean and `updateServiceWorker` function. Already syncs to `uiStore.updateAvailable`. The UpdateBanner should consume this hook directly.

**UIStore (`src/store/uiStore.ts`):**
```typescript
updateAvailable: boolean  // synced by usePWAUpdate
setUpdateAvailable: (available: boolean) => void
```
- Already has update state. UpdateBanner can read `updateAvailable` from the store OR call `usePWAUpdate()` directly.

**App.tsx — already imports OfflineStatusBanner:**
```typescript
import OfflineStatusBanner from '@/components/OfflineStatusBanner'
// ...
<OfflineStatusBanner />
<Suspense fallback={...}>
  <Routes>...</Routes>
</Suspense>
```
- OfflineStatusBanner is rendered above the router. UpdateBanner should be placed adjacent.

**Pins Cache (`src/lib/offline/pinsCache.ts`):**
- `readPinsCacheSnapshot()` returns `{ pins: Pin[], cachedAt: string } | null` from localStorage.
- `PINS_CACHE_UPDATED_EVENT` custom event fired on cache writes.
- Used by OfflineStatusBanner to show cache timestamp.

**Cache Name Constants (`src/lib/constants.ts`):**
```typescript
export const CACHE_NAMES = {
  MAP_TILES: 'map-tiles',
  OSM_TILES: 'osm-tiles',
  PINS: 'pins-cache',
  APP_SHELL: 'app-shell',  // Reserved for Story 3.3 UpdateBanner
  OFFLINE_TILES: 'offline-tiles-meta',
} as const
```

### Architecture Guardrails (Must Follow)

- **No new API endpoints.** Vercel Hobby 12-function limit. All banner logic is purely client-side. [Source: architecture-phase2.md — Infrastructure Constraints]
- **Cache strategy names are constants — never inline string literals.** Use `CACHE_NAMES` from `src/lib/constants.ts`. [Source: architecture-phase2.md — PWA / Service Worker Patterns]
- **SW registration and update handling is always via `useRegisterSW` from vite-plugin-pwa.** Never manually call `navigator.serviceWorker.register()`. Use the `usePWAUpdate` hook. [Source: architecture-phase2.md — PWA / Service Worker Patterns]
- **Banners must not block UI interaction.** Use `pointer-events-none` on container, `pointer-events-auto` on interactive elements. [Source: architecture-phase2.md, ux-design-phase2-specification.md]
- **Offline as proactive capability, not error state.** Never frame offline as degradation. The banner should be informational, not alarming. [Source: ux-design-phase2-specification.md — Anti-Patterns]

### UX Requirements Relevant To This Story

- **Offline banner:** Informational, non-blocking overlay at top of screen. Uses `bg-background/95` partial opacity. Border uses `border-amber-500/30` for offline state.
- **Update banner:** Should use blue/primary styling to distinguish from the amber offline banner. "Update" button with blue-500 bg.
- **Touch targets:** Minimum 44x44px (`min-h-11 min-w-11`) for all interactive elements (Update button, dismiss button).
- **Color tokens:** Offline banner: amber/warning tones. Update banner: blue/primary tones.
- **Accessibility:** `role="status"` on both banners for live region announcements.

### Previous Story Intelligence (p2-3-2-offline-map-tile-cache)

- OfflineStatusBanner, useOnlineStatus, and pinsCache modules were all created/refined in Story 3.2.
- The offline banner already handles both "cached data available" and "no cached data" states.
- `PINS_CACHE_UPDATED_EVENT` is dispatched when pin cache is written — the banner listens for this.
- 730+ tests passing across 70+ test files at Story 3.1 completion.

### Previous Story Intelligence (p2-3-1-pwa-manifest-and-service-worker-installation)

- `usePWAUpdate` hook created with `needRefresh` and `updateServiceWorker` exports.
- `uiStore.updateAvailable` state added and synced by the hook.
- Story 3.1 AC5 explicitly states: "UpdateBanner component is a placeholder — wired in Story 3.3."
- This story fulfills that deferred work by creating the actual UpdateBanner component.

### Implementation Notes For The Dev Agent

- **OfflineStatusBanner is mostly done.** The primary work is verifying it meets all ACs and writing/updating tests. Minor tweaks to messaging or styling may be needed.
- **UpdateBanner is the main new component.** It should:
  1. Call `usePWAUpdate()` to get `needRefresh` and `updateServiceWorker`.
  2. Maintain a local `dismissed` state (boolean, default false).
  3. Render only when `needRefresh && !dismissed`.
  4. On "Update" click: call `updateServiceWorker()`.
  5. On dismiss: set `dismissed = true`.
  6. Use `useOnlineStatus()` to detect if OfflineStatusBanner is visible and adjust vertical position.
- **Banner stacking:** OfflineStatusBanner uses `z-[1100] top-4`. UpdateBanner should use `z-[1099]`. When offline banner is also showing, UpdateBanner shifts to `top-20` to avoid overlap.
- **No SW changes needed.** The service worker already handles update detection via vite-plugin-pwa's built-in mechanisms. The UpdateBanner is purely a UI concern.
- **Mock `virtual:pwa-register/react`** in tests. The existing test setup should already have this alias configured (see `vite.config.ts` test section from Story 3.1).

### Testing Requirements

- Minimum validation commands:
  - `npm run test`
  - `npm run typecheck:api`
  - `npm run lint`
- Test coverage for this story:
  - `OfflineStatusBanner`: renders nothing online, renders offline messages (with/without cache), auto-dismiss on reconnect, accessibility
  - `UpdateBanner`: renders nothing when no update, renders banner with update available, update button calls updateServiceWorker, dismiss works, stacking with offline banner, accessibility
- Use `@testing-library/react` + `vitest` per existing patterns.
- Mock `useOnlineStatus`, `usePWAUpdate`, and `readPinsCacheSnapshot` as needed.

### Project Structure Notes

- Existing file (update): `src/components/OfflineStatusBanner.tsx` — verify/refine
- New file: `src/components/UpdateBanner.tsx` — update available banner
- New file: `src/components/UpdateBanner.test.tsx` — tests
- New or updated file: `src/components/OfflineStatusBanner.test.tsx` — tests
- Existing file (update): `src/App.tsx` — add UpdateBanner import and render
