# Story 3.1: PWA Manifest & Service Worker Installation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user**,
I want to install Overnighter on my home screen and have the app work with a service worker,
So that I get a faster, app-like experience and offline capability is available.

## Acceptance Criteria

**AC1 — vite-plugin-pwa configured with injectManifest strategy and manifest generated**
Given vite-plugin-pwa is already installed (`^1.2.0` in devDependencies) and configured with `strategies: 'injectManifest'`
When the app is built and served
Then a `manifest.webmanifest` is generated with correct name ("Overnighter"), icons, theme color (`#0f172a`), background color (`#020617`), display `standalone`, scope `/`, start URL `/`
And the existing `registerType: 'autoUpdate'` + Workbox config in `vite.config.ts` is migrated to the `injectManifest` strategy.

**AC2 — Custom service worker compiled and registered**
Given `src/sw.ts` is created as the custom service worker entry point
When the app loads in the browser
Then the service worker is compiled by vite-plugin-pwa and registered automatically
And the service worker registers Workbox `CacheFirst` for CartoDB map tiles (`basemaps.cartocdn.com`) with max 500 entries and 30-day expiry
And the service worker registers `StaleWhileRevalidate` for `/rest/v1/pins` with max 50 entries and 24-hour expiry.

**AC3 — PWA install bottom sheet shown after meaningful engagement**
Given a user has visited the app at least twice and saved a spot
When the browser fires the `beforeinstallprompt` event
Then a PWA install bottom sheet is shown with the app icon and "Add to Home Screen" / "Not now" buttons
And the bottom sheet follows the existing sheet pattern (`rounded-t-2xl`, max 3 lines + icon + two buttons).

**AC4 — Install prompt acceptance installs the app**
Given a user taps "Add to Home Screen"
When the install prompt is accepted
Then the app is installed and the install sheet is dismissed.

**AC5 — SW update hook provides update state to UI**
Given a new service worker version is detected
When `useRegisterSW` fires `needRefresh`
Then `usePWAUpdate` hook exposes `{ needRefresh, updateServiceWorker }` for an update banner (UpdateBanner component is a placeholder — wired in Story 3.3).

**AC6 — Cache name constants defined centrally**
Given cache strategy names are used in `src/sw.ts`
When referencing cache names
Then all cache names are defined as constants in `src/lib/constants.ts` (`MAP_TILES`, `PINS`, `APP_SHELL`).

## Tasks / Subtasks

- [x] Task 1: Migrate vite.config.ts from generateSW to injectManifest (AC: 1, 2)
  - [x] 1.1 Update the `VitePWA()` config in `vite.config.ts`: change to `strategies: 'injectManifest'`, set `srcDir: 'src'`, `filename: 'sw.ts'`. Remove the existing `workbox.runtimeCaching` block (cache strategies move into `src/sw.ts`).
  - [x] 1.2 Keep the `manifest` block as-is — it already has correct name, icons, theme color, background color, display, scope, start URL.
  - [x] 1.3 Keep `includeAssets: ['favicon.svg', 'icons.svg', 'pwa-icon.svg']` for precaching static assets.
  - [x] 1.4 Add `injectManifest: { globPatterns: ['**/*.{js,css,html,svg,ico,png}'] }` to control precache manifest injection.
  - [x] 1.5 Ensure the `isVitest` guard remains so the PWA plugin is excluded during test runs.

- [x] Task 2: Create custom service worker entry (`src/sw.ts`) (AC: 2, 6)
  - [x] 2.1 Create `src/sw.ts` with Workbox imports: `registerRoute`, `CacheFirst`, `StaleWhileRevalidate`, `ExpirationPlugin` from `workbox-routing`, `workbox-strategies`, `workbox-expiration`.
  - [x] 2.2 Add `precacheAndRoute(self.__WB_MANIFEST)` call for vite-plugin-pwa precache manifest injection.
  - [x] 2.3 Register `CacheFirst` route for CartoDB tiles: URL pattern matching `basemaps.cartocdn.com`, cache name from `CACHE_NAMES.MAP_TILES`, max 500 entries, 30-day (2592000s) expiry.
  - [x] 2.4 Register `StaleWhileRevalidate` route for pins API: URL pattern matching `/rest/v1/pins`, cache name from `CACHE_NAMES.PINS`, max 50 entries, 24-hour (86400s) expiry.
  - [x] 2.5 Add a placeholder comment block for push notification listener (`self.addEventListener('push', ...)` — implemented in Epic 4 Story 4.1). Do NOT implement push handling in this story.
  - [x] 2.6 Add TypeScript `declare const self: ServiceWorkerGlobalScope` and proper Workbox type imports.

- [x] Task 3: Create cache name constants (`src/lib/constants.ts`) (AC: 6)
  - [x] 3.1 Create `src/lib/constants.ts` with `CACHE_NAMES` constant object: `MAP_TILES: 'map-tiles'`, `PINS: 'pins-cache'`, `APP_SHELL: 'app-shell'`.
  - [x] 3.2 Import and use `CACHE_NAMES` in `src/sw.ts` for all cache name references.
  - [x] 3.3 Note: The SW runs in a separate context from the main app. Import must be a plain TS import that Workbox bundler can resolve — no React/DOM dependencies in this file.

- [x] Task 4: Create `usePWAUpdate` hook (`src/hooks/usePWAUpdate.ts`) (AC: 5)
  - [x] 4.1 Create `src/hooks/usePWAUpdate.ts` that wraps `useRegisterSW` from `virtual:pwa-register/react`.
  - [x] 4.2 Export `{ needRefresh, updateServiceWorker }` — `needRefresh` is a boolean, `updateServiceWorker` is a function.
  - [x] 4.3 Add `updateAvailable` state to `useUIStore` in `src/store/uiStore.ts` (boolean, default `false`). `usePWAUpdate` should set `updateAvailable` when `needRefresh` changes.
  - [x] 4.4 This hook is created but NOT yet mounted in the app — it will be integrated when UpdateBanner is built in Story 3.3. Export only.

- [x] Task 5: Create PWA install prompt component (`src/components/PWAInstallPrompt.tsx`) (AC: 3, 4)
  - [x] 5.1 Create `src/components/PWAInstallPrompt.tsx` — a bottom sheet component that captures the `beforeinstallprompt` event.
  - [x] 5.2 Use `useEffect` to listen for `beforeinstallprompt`, store the event in a ref, and control visibility state.
  - [x] 5.3 Implement engagement gating: only show the prompt if the user has visited at least twice (track via `localStorage` visit counter) AND has saved at least one spot (check `localStorage['saved-spots']` or query Supabase saved spots via existing hooks).
  - [x] 5.4 Render a bottom sheet (`rounded-t-2xl`) with: app icon (use `/pwa-icon.svg`), app name "Overnighter", a brief description, "Add to Home Screen" primary CTA (amber-500 background per design tokens), and "Not now" secondary button.
  - [x] 5.5 "Add to Home Screen" calls `deferredPrompt.prompt()` and awaits the user choice. On acceptance, dismiss the sheet. On dismissal ("Not now"), hide for the session (store flag in sessionStorage).
  - [x] 5.6 Touch targets: minimum 44x44px (`min-h-11 min-w-11`) on both buttons.
  - [x] 5.7 Mobile only — do not render on desktop (`useMediaQuery` or `window.matchMedia('(display-mode: browser)')` check).

- [x] Task 6: Mount PWAInstallPrompt in app shell (AC: 3, 4)
  - [x] 6.1 Import and render `<PWAInstallPrompt />` in `src/App.tsx` (or the root layout component) so it's available on all routes.
  - [x] 6.2 The component self-manages its visibility — no props needed. It only appears when engagement criteria are met and `beforeinstallprompt` fires.

- [x] Task 7: Add tests (AC: 1, 2, 3, 4, 5, 6)
  - [x] 7.1 Create `src/hooks/usePWAUpdate.test.ts` — test that `needRefresh` and `updateServiceWorker` are exposed. Mock `virtual:pwa-register/react`.
  - [x] 7.2 Create `src/components/PWAInstallPrompt.test.tsx` — test engagement gating (not shown on first visit, shown after criteria met), bottom sheet renders with correct buttons, "Add to Home Screen" calls prompt, "Not now" hides sheet.
  - [x] 7.3 Create `src/lib/constants.test.ts` — verify `CACHE_NAMES` exports expected values.
  - [x] 7.4 Run `npm run test`, `npm run typecheck:api`, and `npm run lint` — all must pass.
  - [x] 7.5 Run `npm run build` to verify vite-plugin-pwa generates the manifest and compiles the service worker without errors.

## Dev Notes

### Context Summary

- Sprint tracking shows `p2-3-1-pwa-manifest-and-service-worker-installation` as backlog in Phase 2 Epic 3 (Offline PWA).
- Epics 1 and 2 built all auth, subscription, and Stripe infrastructure. This story begins the PWA/offline capability track.
- `vite-plugin-pwa@^1.2.0` is **already installed** in devDependencies (from Story p2-1-1). The current `vite.config.ts` uses `registerType: 'autoUpdate'` with `workbox.runtimeCaching` (generateSW strategy). This story **migrates** to `injectManifest` for custom SW control per architecture requirements.
- The scope of this story is **PWA shell infrastructure only** — service worker registration, manifest, install prompt, and cache strategy routes. Offline tile download UI (Story 3.2), offline banner (Story 3.3), and offline check-in queue (Story 3.4) are separate stories.

### Current Repository Reality

**vite.config.ts (current state):**
```typescript
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.svg', 'icons.svg', 'pwa-icon.svg'],
  manifest: {
    name: 'Overnighter',
    short_name: 'Overnighter',
    description: 'Find reliable overnight stops...',
    theme_color: '#0f172a',
    background_color: '#020617',
    display: 'standalone',
    scope: '/',
    start_url: '/',
    icons: [{ src: 'pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,ico,png}'],
    runtimeCaching: [
      { urlPattern: /basemaps\.cartocdn\.com/, handler: 'CacheFirst', options: { cacheName: 'carto-tiles', expiration: { maxEntries: 256, maxAgeSeconds: 14 days } } },
      { urlPattern: /tile\.openstreetmap\.org/, handler: 'CacheFirst', options: { cacheName: 'osm-tiles', expiration: { maxEntries: 256, maxAgeSeconds: 14 days } } },
    ],
  },
})
```
- The manifest block is already correct — keep as-is.
- The `workbox.runtimeCaching` block must be **removed** and replaced by explicit `registerRoute()` calls in `src/sw.ts`.
- Cache strategy parameters are being **upgraded** per architecture spec: CartoDB tiles from 256→500 entries, 14→30 day expiry. Pin API caching is **new** (StaleWhileRevalidate).

**public/ directory:**
- `favicon.svg`, `icons.svg`, `pwa-icon.svg` — all exist and are referenced in the manifest.

**index.html:**
- Already has `<meta name="theme-color" content="#0f172a">`, `apple-mobile-web-app-capable`, and `apple-mobile-web-app-title` meta tags.

**package.json:**
- `vite-plugin-pwa@^1.2.0` already in devDependencies — no install needed.
- No Workbox packages need explicit install — vite-plugin-pwa bundles Workbox internally.

**uiStore.ts (current state):**
- Has `selectedPinId`, `isAdminPanelOpen`, `pendingMapCenter`, `pendingCheckIn`, `pendingReport`.
- Does NOT have `updateAvailable` or `offlineQueueCount` — this story adds `updateAvailable`.

**Files that DO NOT exist yet (to be created):**
- `src/sw.ts` — custom service worker entry
- `src/lib/constants.ts` — cache name constants
- `src/hooks/usePWAUpdate.ts` — SW update hook
- `src/components/PWAInstallPrompt.tsx` — install prompt UI

### Previous Story Intelligence (p2-2-4-premiumgate-ui-component)

- 707 tests passing across 67 test files at completion.
- No new API endpoints added (Vercel Hobby 12-function limit constraint).
- `OfflineDownloadGate` placeholder created in `src/features/offline/OfflineDownloadGate.tsx` — ready for Story 3.2 integration.
- PremiumGate enhanced with `variant` and `className` props; `requirePremiumAuth()` helper added to `api/_auth.ts`.

### Architecture Guardrails (Must Follow)

- **SW registration and update handling is always via `useRegisterSW` from vite-plugin-pwa.** Never manually register the service worker or call `navigator.serviceWorker.register()`. [Source: architecture-phase2.md — PWA / Service Worker Patterns]
- **Cache strategy names are constants — never inline string literals.** Define in `src/lib/constants.ts` as `CACHE_NAMES` object. [Source: architecture-phase2.md — PWA / Service Worker Patterns]
- **Push notification receipt is handled only in `src/sw.ts` push event listener.** But do NOT implement push handling in this story — that's Epic 4 Story 4.1. Add a placeholder comment only. [Source: architecture-phase2.md — PWA / Service Worker Patterns]
- **Use `injectManifest` strategy** (not `generateSW`) to allow custom SW entry point with direct Workbox API control. [Source: architecture-phase2.md — vite-plugin-pwa Configuration Note]
- **No new API endpoints.** Vercel Hobby 12-function limit. This story is purely client-side. [Source: architecture-phase2.md — Infrastructure Constraints]
- **Access auth state ONLY through `useAuth()`** — if checking saved spots for engagement gating, use the existing hooks/stores, not direct Supabase calls. [Source: architecture-phase2.md — Auth Patterns]

### UX Requirements Relevant To This Story

- **PWA install prompt:** Bottom sheet `rounded-t-2xl`, max 3 lines + icon + two buttons. Same sheet pattern as existing pin detail views. [Source: ux-design-phase2-specification.md — Layout Patterns]
- **PWA install prompt: mobile only** (no desktop add-to-homescreen). [Source: ux-design-phase2-specification.md — Breakpoint Strategy]
- **Installation:** Add-to-homescreen prompt triggered after meaningful engagement (not on first visit). Homescreen icon = psychological commitment. [Source: ux-design-phase2-specification.md — Engagement Patterns]
- **Touch targets:** Minimum 44x44px (`min-h-11 min-w-11`) for all interactive elements. [Source: ux-design-phase2-specification.md — Accessibility]
- **Color tokens:** `premium-amber` (#F59E0B) for CTA buttons. [Source: ux-design-phase2-specification.md — Color Tokens]

### Implementation Notes For The Dev Agent

- **The current `vite.config.ts` already has a working PWA config with `generateSW`.** The migration to `injectManifest` requires: (1) changing `strategies` to `'injectManifest'`, (2) adding `srcDir` + `filename`, (3) moving `runtimeCaching` logic to `src/sw.ts`, (4) moving `globPatterns` under `injectManifest` key. The `manifest` block stays unchanged.
- **Workbox imports in `src/sw.ts`:** Use `workbox-routing`, `workbox-strategies`, `workbox-expiration`, `workbox-precaching`. These are available through vite-plugin-pwa's Workbox bundling — no explicit npm install needed.
- **`precacheAndRoute(self.__WB_MANIFEST)`** is required in `src/sw.ts` for vite-plugin-pwa to inject the precache manifest at build time.
- **The `beforeinstallprompt` event** is only fired by Chromium browsers (Chrome, Edge, Samsung Internet). Safari on iOS does not fire it — iOS users add to home screen manually. The component should gracefully handle the event never firing.
- **Engagement gating for install prompt:** Use a simple `localStorage` counter incremented on each app visit. Check `localStorage['saved-spots']` array length > 0 for the "has saved a spot" condition. For authenticated users, also consider checking cloud saved spots via existing hooks.
- **OSM tile caching:** The current config caches OSM tiles too, but the architecture spec only specifies CartoDB tiles for the custom SW. Include both CartoDB and OSM tile caching in `src/sw.ts` to maintain parity with the existing config.
- **`updateAvailable` in uiStore:** Add this as a simple boolean. The `usePWAUpdate` hook sets it to `true` when `needRefresh[0]` is true. The UpdateBanner component (Story 3.3) will consume it.

### Testing Requirements

- Minimum validation commands:
  - `npm run test`
  - `npm run typecheck:api`
  - `npm run lint`
  - `npm run build` (verify manifest + SW compilation)
- Test coverage for this story:
  - `usePWAUpdate`: exposes `needRefresh` and `updateServiceWorker`, sets `updateAvailable` in uiStore
  - `PWAInstallPrompt`: engagement gating, bottom sheet rendering, button actions, mobile-only guard
  - `CACHE_NAMES`: correct constant values
- Use `@testing-library/react` + `vitest` per existing patterns.
- Mock `virtual:pwa-register/react` for `useRegisterSW` in tests.
- Service worker functionality is not unit-testable in jsdom — verify via `npm run build` output.

### Project Structure Notes

- Modified: `vite.config.ts` — migrate VitePWA from generateSW to injectManifest
- New file: `src/sw.ts` — custom service worker with Workbox cache strategies
- New file: `src/lib/constants.ts` — `CACHE_NAMES` constant object
- New file: `src/hooks/usePWAUpdate.ts` — `useRegisterSW` wrapper
- New file: `src/components/PWAInstallPrompt.tsx` — install prompt bottom sheet UI
- New file: `src/components/PWAInstallPrompt.test.tsx` — tests
- New file: `src/hooks/usePWAUpdate.test.ts` — tests
- New file: `src/lib/constants.test.ts` — tests
- Modified: `src/store/uiStore.ts` — add `updateAvailable` boolean state
- Modified: `src/App.tsx` — mount `<PWAInstallPrompt />`
- No new API endpoints (Vercel Hobby 12-function limit).
- No new npm packages required.

### References

- Source: `_bmad-output/planning-artifacts/epics-phase2.md` — Epic 3: Offline PWA, Story 3.1: PWA Service Worker & Install Prompt
- Source: `_bmad-output/planning-artifacts/architecture-phase2.md` — vite-plugin-pwa Configuration Note, PWA / Service Worker Patterns, Cache Strategies (`src/sw.ts`), SW Update Flow, Directory Structure
- Source: `_bmad-output/planning-artifacts/prd.md` — FR-P2-14: PWA install via Add to Homescreen
- Source: `_bmad-output/planning-artifacts/ux-design-phase2-specification.md` — PWA install prompt layout, engagement patterns, color tokens, touch targets, breakpoint strategy
- Source: `vite.config.ts` — current VitePWA configuration (generateSW)
- Source: `index.html` — existing PWA meta tags
- Source: `package.json` — vite-plugin-pwa already in devDependencies
- Source: `src/store/uiStore.ts` — current store state (no PWA fields yet)
- Source: `_bmad-output/implementation-artifacts/p2-2-4-premiumgate-ui-component.md` — previous story completion (707 tests, 67 files)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- All 7 tasks completed. All ACs met.
- Migrated vite-plugin-pwa from `generateSW` to `injectManifest` strategy with custom `src/sw.ts` entry point.
- Cache strategy parameters upgraded per architecture spec: CartoDB tiles 256→500 entries, 14→30 day expiry. Pin API caching added (StaleWhileRevalidate).
- OSM tile caching preserved for parity with prior generateSW config.
- PWAInstallPrompt implements engagement gating (2+ visits AND 1+ saved spot), mobile-only rendering, session-scoped dismissal.
- `usePWAUpdate` hook created (export-only, not yet mounted — Story 3.3 will integrate).
- `updateAvailable` boolean added to `useUIStore`.
- Test setup enhanced with `matchMedia` stub for jsdom and virtual module alias for `virtual:pwa-register/react`.
- 730 tests passing across 70 files (was 709 across 67). All lint and typecheck clean.
- No new API endpoints added (Vercel Hobby constraint maintained).
- `src/sw.ts` excluded from `tsconfig.app.json` (compiled separately by vite-plugin-pwa).

### Change Log

- `vite.config.ts` — Migrated VitePWA from generateSW to injectManifest; added test alias for virtual:pwa-register/react
- `src/sw.ts` — New custom service worker with Workbox CacheFirst (CartoDB + OSM tiles) and StaleWhileRevalidate (pins API)
- `src/lib/constants.ts` — New CACHE_NAMES constant object (MAP_TILES, PINS, APP_SHELL)
- `src/hooks/usePWAUpdate.ts` — New hook wrapping useRegisterSW, exposes needRefresh + updateServiceWorker
- `src/components/PWAInstallPrompt.tsx` — New bottom sheet install prompt with engagement gating
- `src/store/uiStore.ts` — Added updateAvailable boolean + setUpdateAvailable action
- `src/App.tsx` — Mounted PWAInstallPrompt in app shell
- `tsconfig.app.json` — Added vite-plugin-pwa/react types; excluded src/sw.ts
- `src/test/setup.ts` — Added matchMedia stub for jsdom
- `src/test/__mocks__/pwa-register-react.ts` — New mock for virtual:pwa-register/react
- `src/App.test.tsx` — Added PWAInstallPrompt mock

### File List

- Modified: `vite.config.ts`
- Modified: `src/store/uiStore.ts`
- Modified: `src/App.tsx`
- Modified: `src/App.test.tsx`
- Modified: `tsconfig.app.json`
- Modified: `src/test/setup.ts`
- New: `src/sw.ts`
- New: `src/lib/constants.ts`
- New: `src/lib/constants.test.ts`
- New: `src/hooks/usePWAUpdate.ts`
- New: `src/hooks/usePWAUpdate.test.ts`
- New: `src/components/PWAInstallPrompt.tsx`
- New: `src/components/PWAInstallPrompt.test.tsx`
- New: `src/test/__mocks__/pwa-register-react.ts`
