---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-03-17'
lastEdited: '2026-04-26'
editHistory:
  - date: '2026-04-26'
    changes: 'ML Pipeline Extension — added water tap discovery architecture (FR39–FR47, NFR-ML1–ML5): SageMaker hosting, chunked /api/ml-scan, water_tap_pins + tap_verification_events tables, map_pins view, Supabase Storage, features/water-taps/ module'
inputDocuments:
  - 'prd.md'
  - 'ux-design-specification.md'
  - 'product-brief-bmad-analisys-2026-03-17.md'
  - 'research/market-rv-travel-companion-app-research-2026-03-17.md'
  - 'brainstorming-session-2026-04-25-1000.md'
workflowType: 'architecture'
project_name: 'bmad-analisys'
user_name: 'Kyryl'
date: '2026-03-17'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
38 FRs across 9 capability groups. Architecturally significant groupings:
- **Rig-aware data layer (FR1–FR6, FR12):** Rig profile in localStorage; filtering applied before pin render. Decision point: client-side vs server-side filtering.
- **Multi-source aggregation (FR18):** BLM/USFS/NPS + Overpass + community pins normalized into a unified pin model. Requires server-side data pipeline.
- **Recency badge real-time update (FR20, FR24, FR29):** Badge state mutates immediately on check-in/issue report — optimistic client update required.
- **Departure-triggered check-in (FR25):** No native background geofencing; trigger must be app-open proximity polling or manual contextual prompt.
- **Admin operations (FR32–FR35):** Protected surface without general user auth — asymmetric auth architecture required.
- **Spot saving (FR30–FR31):** localStorage-based; no sync at MVP.

**Non-Functional Requirements:**
NFRs that directly drive architecture decisions:
- NFR-P1 (3s load on 4G) + NFR-P5 (≤250KB bundle): static CDN hosting, lazy loading, framework weight constraint.
- NFR-P2 (200ms filter): client-side pin filtering in memory (not server roundtrip).
- NFR-SC3 (24h Overpass cache): dedicated server-side caching layer.
- NFR-SC4 + NFR-R4 (check-in write reliability): serverless write endpoint with retry logic; no silent data loss.
- NFR-S2 (no PII server-side): client-only storage for all user data.
- NFR-S5 (admin auth): protected admin routes only — no general auth system.
- NFR-R3 (map functional with cached data): client-side tile cache + stale-while-revalidate pin cache for offline/degraded connectivity.

**Scale & Complexity:**
- Primary domain: Full-stack web app (SPA + serverless API + data pipeline)
- Complexity level: Medium
- Estimated architectural components: 5–6 (SPA frontend, serverless API layer, data pipeline/cron, pin database, Overpass cache, admin auth)

### Technical Constraints & Dependencies

- **Solo founder:** Minimal infrastructure complexity required. No distributed services, no separate microservices, no managed queues at MVP.
- **No auth at MVP (general users):** localStorage only. Admin auth is a separate concern — simple shared secret or basic JWT for admin routes.
- **Bundle budget ≤250KB gzipped:** Eliminates heavy SPA frameworks. Leaflet (~40KB gz) leaves ~210KB for app code.
- **Vercel/Netlify free tier:** Static hosting + serverless functions only. No persistent servers, no cron jobs natively — external cron required for data pipeline.
- **HTTPS required:** Geolocation API + localStorage security both require it. Free tier platforms provide this automatically.
- **CartoDB Dark Matter tiles:** Specific tile provider called out. Must include fallback to standard OSM tiles (NFR-I3).
- **Overpass API rate limit:** 10k req/day public endpoint. Server-side caching (24h TTL) is mandatory from day one — not optional.

### Cross-Cutting Concerns Identified

1. **Data freshness state:** The recency badge is the central data object affecting pin rendering, check-in flow, issue reporting, and admin operations. Single source of truth for badge state is critical across all surfaces.
2. **Rig profile context:** Pervades the entire app — map filtering, pin display, check-in copy, onboarding. Must be globally accessible without prop-drilling.
3. **Three-layer caching:** (a) Leaflet tile cache (browser, NFR-P7), (b) Overpass API server cache (24h TTL, NFR-SC3), (c) viewport pin data (client memory, NFR-P2). Each layer has distinct invalidation rules.
4. **Anonymous identity:** Device session tokens for check-ins and departure tracking — never PII, never localStorage-linked to any user identifier. Separate from rig profile storage.
5. **Admin/user permission asymmetry:** Main app = fully anonymous. Admin surface = protected. Two separate access models in one codebase.

## Starter Template Evaluation

### Primary Technology Domain

**SPA / Progressive Web App** — mobile-first client-side rendering, map-heavy interface, no server-rendered pages, offline-capable in Phase 2. Backend surface is serverless API endpoints only (not a full-stack framework concern).

### Starter Options Considered

| Starter | Command | Bundle fit | PRD alignment | Verdict |
|---|---|---|---|---|
| **Vite 8 + React 19 + TypeScript** | `npm create vite@latest` | ✅ Lean, ~250KB achievable | ✅ CSR/SPA explicit in PRD, shadcn/ui Vite-native | **Selected** |
| Next.js 16 App Router | `npx create-next-app@latest` | ⚠️ SSR runtime overhead, larger baseline | ❌ PRD explicitly rules out SSR at MVP; Vercel-opinionated | Eliminated |
| Vite 8 + Vue 3 + TypeScript | `npm create vite@latest --template vue-ts` | ✅ Lean | ⚠️ shadcn/ui is React-only (shadcn-vue is community port, less maintained) | Eliminated |

**Why Next.js is ruled out:** The PRD states "CSR/SPA (no SSR at MVP)" explicitly. Next.js 16 App Router defaults to RSC + SSR. Opting out produces worse DX than just using Vite. The Next.js runtime baseline also eats into the ≤250KB gzip budget before a single line of app code.

**Why Vite 8 + React 19 wins:**
- NFR-P5 (≤250KB gzip): Vite 8 uses Rolldown (Rust-based bundler), producing the leanest possible output. Leaflet 1.9.4 (~40KB gz) leaves ~210KB for all app code — achievable with careful lazy loading.
- PRD CSR/SPA requirement: Vite produces pure static output; deploy to Vercel/Netlify free tier as a static site with zero config.
- shadcn/ui: Official first-class Vite support as of shadcn CLI v4 (March 2026). `npx shadcn@latest init` presents a template selector with Vite explicitly listed.
- PWA path (Phase 2): `vite-plugin-pwa` v1.2.0 has first-class React support — add it in Phase 2 without changing the build stack.
- React 19.2: Server Actions not needed (no server); use cases are purely client-side hooks and concurrent rendering for map performance.

### Selected Starter: Vite 8 + React 19 + TypeScript

**Initialization Command:**

```bash
npm create vite@latest overnighter -- --template react-ts
cd overnighter
npm install
npx shadcn@latest init
```

The `shadcn@latest init` step (shadcn CLI v4) configures Tailwind CSS, `components.json`, path aliases, and the `cn()` utility in one interactive step — selecting "Vite" when prompted for framework.

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
- TypeScript 5.x strict mode — enforced throughout; no `any` escape hatches in map/state logic
- React 19.2.4 — concurrent features available; `useTransition` usable for heavy pin render cycles
- Node 20+ LTS runtime for build tooling

**Styling Solution:**
- Tailwind CSS (configured by shadcn init) — utility classes; mobile-first breakpoints
- shadcn/ui component library — accessible, unstyled-first components; dark mode support (CartoDB Dark Matter tile theme alignment)
- CSS variables for theming — single token set for light/dark parity

**Build Tooling:**
- Vite 8.0 + Rolldown bundler — sub-second HMR, tree-shaking, chunk splitting
- `vite.config.ts` — lazy-load routes and heavy map components via `React.lazy()` to hit bundle budget
- Static output (`dist/`) — deploy directly to Vercel/Netlify as static site; serverless functions handled separately in `/api` directory

**Testing Framework:**
- Vitest (Vite-native, same config) — unit and integration tests
- React Testing Library — component tests
- Playwright — E2E (to be added post-init)

**Code Organization:**
```
src/
  components/       # shadcn/ui + custom UI components
  features/         # feature-sliced: map/, rig-profile/, check-in/, admin/
  hooks/            # shared custom hooks
  lib/              # pin model, badge state logic, localStorage utils
  api/              # serverless function clients (thin fetch wrappers)
  store/            # Zustand stores (rig profile, saved spots)
  types/            # shared TypeScript interfaces
```

**Development Experience:**
- Vite dev server with HMR — instant feedback on map component changes
- TypeScript strict — catches pin model shape errors at compile time
- Path aliases (`@/components`, `@/lib`) configured by shadcn init
- ESLint + Prettier (add post-init)

**Note:** Project initialization using the commands above should be the first implementation story (Story 1.1).

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Database: Supabase (PostgreSQL) — pin storage, check-ins, issue reports, Overpass cache
- State management: Zustand v5 (client) + TanStack Query v5 (server)
- Admin auth: Env-var Bearer token
- Routing: React Router v7

**Important Decisions (Shape Architecture):**
- REST API pattern for serverless functions
- Anonymous device identity via `crypto.randomUUID()` → localStorage
- Vercel hosting + built-in CI/CD
- GitHub Actions scheduled cron for data pipeline

**Deferred Decisions (Post-MVP):**
- PWA / Service Worker (vite-plugin-pwa — Phase 2 path already clear)
- Supabase Realtime (live badge updates without polling — Phase 2)
- User accounts / sync of saved spots across devices (Phase 3)

### Data Architecture

**Database: Supabase (PostgreSQL) — free tier (500MB, 50k MAU)**
- Pin table: unified pin model (BLM/USFS/NPS + Overpass + community), geospatial coordinates, rig constraints
- Check-in table: deviceId (anonymous UUID), pinId, timestamp — no PII
- Issue report table: deviceId, pinId, type, timestamp
- Overpass cache table: bounding box key, raw GeoJSON payload, cached_at timestamp (24h TTL, NFR-SC3)
- Supabase PostgREST used for direct client reads (pin queries, saved spot lookups)
- Custom serverless functions handle all writes (check-in, report, admin ops)

**Data pipeline:** GitHub Actions daily cron → `POST /api/sync` (Bearer-protected) → fetches BLM/USFS/NPS APIs → normalizes to unified pin model → upserts to Supabase

**Client-side pin cache:** TanStack Query v5 stale-while-revalidate — viewport pin data held in memory, re-fetched on focus/reconnect (NFR-R3)

### Authentication & Security

**Admin auth: Env-var Bearer token**
- Secret stored in Vercel environment variables (`ADMIN_SECRET`)
- Every admin serverless function checks `Authorization: Bearer <secret>` header
- Token rotation = change env var in Vercel dashboard, redeploy

**Anonymous device identity:**
- `crypto.randomUUID()` called once on first app load
- Stored as `deviceId` in localStorage under a separate key from rig profile
- Sent with every check-in and issue report POST
- Never linked to rig profile data (NFR-S2 compliance)

**No general user auth at MVP** — all map reads are fully anonymous, no login wall

### API & Communication Patterns

**Pattern: REST + JSON over HTTPS**
- All serverless functions in `/api` directory (Vercel convention)
- Uniform error response shape: `{ "error": "ERROR_CODE", "message": "Human readable", "status": 4xx|5xx }`
- HTTP verbs as semantic intent: GET (read), POST (create), PATCH (update), DELETE (remove)

**Custom endpoint surface (minimal):**

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/checkin` | None (deviceId in body) | Submit check-in, recalculate badge state |
| `POST /api/report` | None (deviceId in body) | Submit issue report, update badge state |
| `GET /api/overpass` | None | Fetch OSM data with 24h server-side cache |
| `POST /api/sync` | Bearer token | Trigger BLM/USFS/NPS pipeline (cron + manual) |
| `DELETE /api/pins/:id` | Bearer token | Admin: remove pin |
| `PATCH /api/pins/:id/verify` | Bearer token | Admin: verify/close report |

**Direct Supabase PostgREST:** All pin reads, check-in history reads — no serverless function hop

### Frontend Architecture

**Client state — Zustand v5 (~1KB gz)**
- `useRigStore` — rig profile (type, length, height, weight limits); synced to localStorage on mutation
- `useSpotsStore` — saved spots array; synced to localStorage on mutation
- `useUIStore` — active modal, selected pin, map viewport state

**Server state — TanStack Query v5**
- `usePinsQuery` — viewport pin fetch with stale-while-revalidate; invalidated on check-in/report success
- `useCheckinMutation` — optimistic update: mutates badge state immediately in cache, rolls back on error (FR20, FR24)
- `useReportMutation` — same optimistic pattern for issue reports (FR29)

**Routing — React Router v7**
- `/` — map view (default)
- `/pin/:id` — pin detail sheet (deep-linkable)
- `/onboarding` — rig profile setup (first-launch)
- `/saved` — saved spots list
- `/admin` — admin dashboard (Bearer token gated, lazy-loaded chunk)

**Bundle strategy:**
- Admin route: `React.lazy()` — excluded from main bundle, loaded only when admin path accessed
- Leaflet: dynamic import on map mount — deferred until map component renders
- Target: main bundle ≤150KB gz; Leaflet chunk ~40KB gz; admin chunk ~30KB gz; total ≤250KB gz (NFR-P5)

### Infrastructure & Deployment

**Hosting: Vercel (free tier)**
- Static SPA output from `vite build` → Vercel CDN (global edge, NFR-P1)
- Serverless functions in `/api` directory — zero-config deployment
- GitHub integration: push to `main` → production; PRs → preview deploys

**CI/CD:**
- Vercel built-in for frontend — no additional pipeline needed at MVP
- GitHub Actions for data pipeline cron only

**Data pipeline cron (GitHub Actions):**
```yaml
on:
  schedule:
    - cron: '0 2 * * *'  # 2am UTC daily
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - run: curl -X POST ${{ secrets.SYNC_URL }} -H "Authorization: Bearer ${{ secrets.ADMIN_SECRET }}"
```

**Monitoring:**
- Vercel Analytics (free) — Core Web Vitals, page load tracking against NFR-P1
- Sentry free tier — client error tracking + serverless function error capture (NFR-SC4 silent failure detection)

### Decision Impact Analysis

**Implementation Sequence:**
1. Supabase project + schema setup (blocks all data work)
2. Vite starter init + shadcn config (blocks all UI work)
3. React Router routes scaffolded (blocks feature development)
4. Zustand stores + localStorage sync (blocks rig profile feature)
5. Vercel project connected to GitHub (blocks deployment)
6. Serverless function skeletons + Bearer token middleware (blocks admin + write ops)
7. TanStack Query setup + Supabase client (blocks pin data features)

**Cross-Component Dependencies:**
- Badge state is owned by Supabase (source of truth) + TanStack Query cache (optimistic layer) — both must be consistent
- Rig profile in Zustand drives client-side pin filtering — filter logic must subscribe to store changes
- deviceId (localStorage) must be initialized before any check-in or report mutation fires
- Admin Bearer token must be in Vercel env vars before any admin serverless function is testable in production

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 6 areas where AI agents could make incompatible choices without explicit rules — naming conventions, file structure, API response format, data field casing, state update patterns, and error handling.

### Naming Patterns

**Database Naming Conventions (Supabase/PostgreSQL):**
- Tables: `snake_case` plural — `pins`, `check_ins`, `issue_reports`, `overpass_cache`
- Columns: `snake_case` — `pin_id`, `cached_at`, `rig_type`, `device_id`
- Foreign keys: `{table_singular}_id` — `pin_id`, not `fk_pin` or `pinId`
- Indexes: `idx_{table}_{column}` — `idx_pins_coordinates`

**API Naming Conventions:**
- Endpoints: `kebab-case` plural nouns — `/api/pins`, `/api/check-ins`
- Route parameters: `:id` (Express/Vercel convention) — `/api/pins/:id`
- Query parameters: `camelCase` — `?rigType=ClassA&maxLength=35`
- Custom headers: `X-` prefix — `X-Device-Id`

**Code Naming Conventions:**
- React components: `PascalCase` files and exports — `PinCard.tsx`, `export function PinCard`
- Non-component files: `camelCase` — `pinUtils.ts`, `supabaseClient.ts`
- Custom hooks: `use` prefix, `camelCase` — `useRigStore`, `usePinsQuery`
- Zustand stores: `use{Name}Store` — `useRigStore`, `useSpotsStore`, `useUIStore`
- TanStack Query keys: `[resource, ...params]` array — `['pins', { viewport }]`, `['pin', pinId]`
- Constants: `SCREAMING_SNAKE_CASE` — `BADGE_THRESHOLDS`, `OVERPASS_CACHE_TTL`
- TypeScript interfaces: `PascalCase` — prefer `Pin`, `CheckIn` over `IPin`

### Structure Patterns

**Project Organization:**
```
overnighter/
  src/
    components/         # Shared UI: shadcn wrappers, global layout
    features/
      map/              # Leaflet map, pin rendering, viewport management
      rig-profile/      # Rig setup form, onboarding
      check-in/         # Check-in flow, departure prompt
      pin-detail/       # Pin detail sheet, badge display
      saved-spots/      # Saved spots list
      admin/            # Admin dashboard (lazy-loaded)
    hooks/              # Shared hooks only (used by 2+ features)
    lib/
      supabase/         # supabaseClient.ts + typed query helpers
      pin-model/        # Unified pin type + normalization utils
      badge/            # Badge state calculation logic
      storage/          # localStorage read/write helpers
    store/              # Zustand store definitions
    types/              # Shared TypeScript types (no logic)
    api/                # Thin fetch wrappers for custom serverless endpoints
  api/                  # Vercel serverless functions (Node.js)
    checkin.ts
    report.ts
    overpass.ts
    sync.ts
    pins/
      [id].ts           # DELETE /api/pins/:id
      [id]/verify.ts    # PATCH /api/pins/:id/verify
```

**Test placement:** Co-located alongside source files
- `PinCard.tsx` → `PinCard.test.tsx` in same directory
- `pinUtils.ts` → `pinUtils.test.ts` in same directory
- Serverless functions: `api/checkin.ts` → `api/checkin.test.ts`

**Supabase queries:** Always in `src/lib/supabase/` helpers — never inline Supabase client calls inside components or stores directly

### Format Patterns

**API Response Formats:**

Success (2xx) — direct payload, no wrapper:
```json
{ "id": "uuid", "name": "Dispersed Site", "coordinates": [lat, lng] }
```

Error (4xx/5xx) — always this shape:
```json
{ "error": "PIN_NOT_FOUND", "message": "Pin with id xyz was not found", "status": 404 }
```

No envelope like `{ data: ..., success: true }` — direct payload or error shape only.

**Data Exchange Formats:**
- Dates: ISO 8601 strings — `"2026-03-17T02:00:00Z"` (never Unix timestamps in API responses)
- Coordinates: `[latitude, longitude]` number array (Leaflet convention)
- Boolean: `true`/`false` (never `1`/`0`)
- Missing optional fields: `null` explicitly (never `undefined` in JSON)
- Supabase `snake_case` → transform to `camelCase` in `src/lib/supabase/` helpers before use in React — components and stores never handle `snake_case` field names

### Communication Patterns

**Zustand State Update Patterns:**
- Always use immutable updates via `set()` — never mutate state directly
- Persist to localStorage inside the store action, not in components
- Store shape: flat where possible — avoid deeply nested state objects

```typescript
// ✅ Correct
set((state) => ({ rigProfile: { ...state.rigProfile, length: 35 } }))

// ❌ Wrong — direct mutation
state.rigProfile.length = 35
```

**TanStack Query Key Conventions:**
```typescript
['pins']                                          // resource list
['pins', { viewport: { ne, sw }, rigType }]       // list with params
['pin', pinId]                                    // single resource
```

**Optimistic Update Pattern (badge state):**
1. `onMutate`: snapshot current cache, apply optimistic update
2. `onError`: roll back to snapshot
3. `onSettled`: invalidate query to sync with server truth

### Process Patterns

**Error Handling:**
- Serverless functions: always catch errors, always return `{ error, message, status }` shape — never let unhandled rejections propagate
- React components: use React Error Boundaries for feature-level errors (not global)
- TanStack Query: use `onError` callback on mutations for user-facing toast/alert — do not swallow silently
- User-facing error messages: plain English, actionable — `"Couldn't save check-in. Tap to retry."` not `"Error: 500 Internal Server Error"`
- Log to Sentry: server errors and unhandled client exceptions only — not expected 404s

**Loading State Patterns:**
- Use TanStack Query's `isLoading` / `isFetching` — do not maintain separate loading booleans in Zustand for server data
- Map pin loading: skeleton pin markers (not full-screen spinner) — map remains interactive while pins load
- Form submissions: disable submit button + show inline spinner on `isPending` from mutation
- Initial app load: skeleton UI for map viewport; never blank white screen

**Validation Patterns:**
- Client-side: validate at form submit only (not on every keystroke for MVP)
- Server-side: always re-validate in serverless functions — never trust client input
- Rig profile fields: validate ranges in `useRigStore` action before persisting to localStorage

### Enforcement Guidelines

**All AI Agents MUST:**
- Use `snake_case` for all Supabase table/column names
- Use `camelCase` for all TypeScript variable, function, and object field names
- Transform Supabase results to `camelCase` at the `src/lib/supabase/` boundary — never elsewhere
- Return the standard `{ error, message, status }` shape from all serverless function error paths
- Place tests co-located with source files, not in a separate `__tests__` directory
- Use TanStack Query for all server data — never `useEffect` + `useState` for async data fetching
- Use Zustand stores for all cross-component client state — never prop-drill rig profile

**Pattern Enforcement:**
- ESLint + Prettier enforces code style automatically
- TypeScript strict mode catches type shape violations at compile time
- PR preview deploys on Vercel allow manual pattern verification before merge

### Pattern Examples

**Good — Supabase query helper:**
```typescript
// src/lib/supabase/pins.ts
export async function getPinsInViewport(viewport: Viewport, rigProfile: RigProfile): Promise<Pin[]> {
  const { data, error } = await supabase
    .from('pins')
    .select('*')
    .gte('latitude', viewport.sw.lat)
  if (error) throw error
  return data.map(toCamelCase)  // transform at boundary
}
```

**Anti-pattern — inline Supabase in component:**
```typescript
// ❌ Never do this in a component
const { data } = await supabase.from('pins').select('*')
// snake_case fields leak into component, no type safety, no reuse
```

**Good — Zustand store with localStorage sync:**
```typescript
// src/store/rigStore.ts
export const useRigStore = create<RigStore>()(
  persist(
    (set) => ({
      rigProfile: defaultRigProfile,
      setRigProfile: (profile) => set({ rigProfile: profile }),
    }),
    { name: 'rig-profile' }
  )
)
```

**Anti-pattern — localStorage in component:**
```typescript
// ❌ Never manage localStorage directly in components
localStorage.setItem('rig', JSON.stringify(profile))
```

## Project Structure & Boundaries

### Complete Project Directory Structure

```
overnighter/
├── README.md
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.ts          # Generated by shadcn init
├── components.json             # shadcn/ui config
├── .env.local                  # Local dev secrets (gitignored)
├── .env.example                # Committed env var template
├── .gitignore
├── .eslintrc.cjs
├── .prettierrc
├── vercel.json                 # Vercel routing + function config
├── .github/
│   └── workflows/
│       └── sync.yml            # Daily BLM/USFS/NPS data pipeline cron
├── api/                        # Vercel serverless functions (Node.js/TypeScript)
│   ├── checkin.ts              # POST /api/checkin
│   ├── checkin.test.ts
│   ├── report.ts               # POST /api/report
│   ├── report.test.ts
│   ├── overpass.ts             # GET /api/overpass
│   ├── overpass.test.ts
│   ├── sync.ts                 # POST /api/sync (Bearer-protected)
│   ├── sync.test.ts
│   ├── _middleware.ts          # Bearer token check for admin routes
│   └── pins/
│       ├── [id].ts             # DELETE /api/pins/:id (Bearer-protected)
│       ├── [id].test.ts
│       └── [id]/
│           ├── verify.ts       # PATCH /api/pins/:id/verify (Bearer-protected)
│           └── verify.test.ts
├── supabase/
│   ├── migrations/             # SQL migration files (Supabase CLI)
│   │   ├── 001_create_pins.sql
│   │   ├── 002_create_check_ins.sql
│   │   ├── 003_create_issue_reports.sql
│   │   └── 004_create_overpass_cache.sql
│   └── seed.sql                # Dev seed data
├── public/
│   ├── favicon.ico
│   ├── icons/                  # PWA icons (Phase 2)
│   └── map-markers/            # Custom Leaflet marker SVGs
└── src/
    ├── main.tsx                # App entry point
    ├── App.tsx                 # Router + global providers
    ├── index.css               # Tailwind base imports
    ├── vite-env.d.ts
    │
    ├── components/             # Shared UI (used by 2+ features)
    │   ├── ui/                 # shadcn/ui generated components
    │   │   ├── button.tsx
    │   │   ├── sheet.tsx
    │   │   ├── badge.tsx
    │   │   └── ...
    │   ├── Layout.tsx          # App shell (nav, bottom bar)
    │   ├── ErrorBoundary.tsx   # Feature-level error boundary
    │   └── SkeletonPin.tsx     # Loading skeleton for pin markers
    │
    ├── features/
    │   ├── map/
    │   │   ├── MapView.tsx             # Root map route component
    │   │   ├── LeafletMap.tsx          # Leaflet instance (lazy-imported)
    │   │   ├── PinLayer.tsx            # Renders pins on map
    │   │   ├── PinMarker.tsx           # Individual pin marker
    │   │   ├── RigFilterOverlay.tsx    # Active filter indicator (FR12)
    │   │   ├── MapView.test.tsx
    │   │   └── LeafletMap.test.tsx
    │   ├── rig-profile/
    │   │   ├── OnboardingScreen.tsx    # First-launch rig setup (FR1-FR3)
    │   │   ├── RigProfileForm.tsx      # Edit rig profile
    │   │   ├── RigProfileForm.test.tsx
    │   │   └── rigProfileSchema.ts     # Zod validation schema
    │   ├── pin-detail/
    │   │   ├── PinDetailSheet.tsx      # Bottom sheet (FR13-FR17)
    │   │   ├── RecencyBadge.tsx        # 🟢/🟡/🔴 badge (FR19-FR20)
    │   │   ├── PinAttributes.tsx       # Height/length/amenities display
    │   │   ├── CheckInHistory.tsx      # Recent check-ins list
    │   │   ├── PinDetailSheet.test.tsx
    │   │   └── RecencyBadge.test.tsx
    │   ├── check-in/
    │   │   ├── CheckInButton.tsx       # Trigger check-in (FR21-FR24)
    │   │   ├── DeparturePrompt.tsx     # Departure-triggered prompt (FR25)
    │   │   ├── CheckInForm.tsx         # Check-in submission form
    │   │   ├── CheckInButton.test.tsx
    │   │   └── checkInUtils.ts         # Proximity calculation for departure
    │   ├── issue-report/
    │   │   ├── IssueReportSheet.tsx    # Report issue bottom sheet (FR29)
    │   │   ├── IssueReportForm.tsx
    │   │   └── IssueReportSheet.test.tsx
    │   ├── saved-spots/
    │   │   ├── SavedSpotsScreen.tsx    # /saved route (FR30-FR31)
    │   │   ├── SavedSpotCard.tsx
    │   │   └── SavedSpotsScreen.test.tsx
    │   └── admin/
    │       ├── AdminDashboard.tsx      # /admin route, lazy-loaded (FR32-FR35)
    │       ├── PinModerationList.tsx   # Review/remove pins
    │       ├── ReportReviewList.tsx    # Close/verify reports
    │       ├── AdminAuth.tsx           # Bearer token gate
    │       └── AdminDashboard.test.tsx
    │
    ├── hooks/                  # Shared hooks (used by 2+ features)
    │   ├── useGeolocation.ts   # Wrapper for browser Geolocation API
    │   └── useDeviceId.ts      # crypto.randomUUID() init + localStorage
    │
    ├── lib/
    │   ├── supabase/
    │   │   ├── client.ts           # Supabase client singleton
    │   │   ├── pins.ts             # Pin read queries (PostgREST)
    │   │   ├── checkIns.ts         # Check-in history reads
    │   │   └── types.ts            # Supabase-generated DB types
    │   ├── pin-model/
    │   │   ├── types.ts            # Unified Pin interface
    │   │   ├── normalize.ts        # BLM/USFS/NPS/OSM → unified Pin
    │   │   └── normalize.test.ts
    │   ├── badge/
    │   │   ├── badgeState.ts       # 🟢/🟡/🔴 calculation logic
    │   │   └── badgeState.test.ts
    │   └── storage/
    │       ├── rigProfile.ts       # localStorage key constants + helpers
    │       └── savedSpots.ts
    │
    ├── store/
    │   ├── rigStore.ts         # useRigStore — rig profile, persisted
    │   ├── spotsStore.ts       # useSpotsStore — saved spots, persisted
    │   └── uiStore.ts          # useUIStore — active modal, selected pin
    │
    ├── api/                    # Client-side fetch wrappers for custom endpoints
    │   ├── checkin.ts          # POST /api/checkin
    │   ├── report.ts           # POST /api/report
    │   └── overpass.ts         # GET /api/overpass
    │
    └── types/
        ├── pin.ts              # Pin, PinSource, RigConstraints
        ├── rigProfile.ts       # RigProfile, RigType
        └── badge.ts            # BadgeState, BadgeColor
```

### Architectural Boundaries

**API Boundaries:**
- `api/` (Vercel functions) — write operations + admin + Overpass cache only; no direct DB reads
- Supabase PostgREST — all pin reads and check-in history reads; accessed from `src/lib/supabase/` only
- Overpass API — never called from client; always proxied through `GET /api/overpass` (rate limit + cache)
- BLM/USFS/NPS APIs — called only from `api/sync.ts` (server-side, cron-triggered)

**Component Boundaries:**
- `src/features/*` — each feature is self-contained; imports only from `src/components/`, `src/hooks/`, `src/lib/`, `src/store/`, `src/types/`
- Features do NOT import from other features — cross-feature coordination goes through stores or React Router navigation
- `src/components/ui/` — shadcn/ui components only; no business logic

**State Boundaries:**
- Zustand stores own all client-persisted state — no direct localStorage access outside `src/store/` and `src/lib/storage/`
- TanStack Query owns all server-fetched state — no `useEffect`+`useState` for async data
- URL (React Router) owns navigation state — active pin ID in URL params, not in Zustand

**Data Boundaries:**
- All Supabase query results transformed `snake_case` → `camelCase` inside `src/lib/supabase/` before leaving the module
- `src/types/` contains canonical TypeScript interfaces; `src/lib/supabase/types.ts` contains generated Supabase types (separate concern)

### Requirements to Structure Mapping

| FR Group | FRs | Primary Location |
|---|---|---|
| Rig Profile | FR1–FR6 | `src/features/rig-profile/`, `src/store/rigStore.ts` |
| Map Display + Filtering | FR7–FR12 | `src/features/map/`, `src/lib/pin-model/` |
| Pin Detail | FR13–FR17 | `src/features/pin-detail/` |
| Multi-source Aggregation | FR18 | `api/sync.ts`, `src/lib/pin-model/normalize.ts`, `supabase/migrations/` |
| Recency Badge | FR19–FR24 | `src/lib/badge/`, `src/features/pin-detail/RecencyBadge.tsx` |
| Check-in Flow | FR21–FR25 | `src/features/check-in/`, `api/checkin.ts` |
| Departure Trigger | FR25 | `src/features/check-in/DeparturePrompt.tsx`, `src/hooks/useGeolocation.ts` |
| Issue Reporting | FR29 | `src/features/issue-report/`, `api/report.ts` |
| Spot Saving | FR30–FR31 | `src/features/saved-spots/`, `src/store/spotsStore.ts` |
| Admin Operations | FR32–FR35 | `src/features/admin/`, `api/pins/[id].ts`, `api/pins/[id]/verify.ts`, `api/_middleware.ts` |

**Cross-Cutting Concerns:**

| Concern | Location |
|---|---|
| Anonymous device identity | `src/hooks/useDeviceId.ts` |
| Recency badge state logic | `src/lib/badge/badgeState.ts` |
| Rig-aware pin filtering | `src/store/rigStore.ts` + `src/lib/pin-model/` |
| Three-layer cache | Leaflet (browser auto), `api/overpass.ts` (server), TanStack Query (memory) |
| Admin Bearer token check | `api/_middleware.ts` |

### Integration Points

**Data Flow — Pin Load:**
```
User opens app
  → LeafletMap mounts (lazy import)
  → TanStack Query usePinsQuery fires
  → src/lib/supabase/pins.ts → Supabase PostgREST
  → Results transformed snake_case → camelCase
  → Client-side rig filter applied (useRigStore)
  → PinLayer renders filtered pins on map
```

**Data Flow — Check-in Submit:**
```
User taps Check In
  → useCheckinMutation fires
  → onMutate: optimistic badge update in TanStack Query cache
  → POST /api/checkin { pinId, deviceId, timestamp }
  → api/checkin.ts validates + writes check_ins row to Supabase
  → Recalculates badge state server-side → updates pins row
  → onSettled: invalidate ['pins', viewport] → refetch confirms server truth
```

**External Integrations:**

| Service | Direction | Location | Auth |
|---|---|---|---|
| Supabase PostgREST | Client → Supabase | `src/lib/supabase/` | Supabase anon key (VITE_ env var) |
| Supabase DB (writes) | Server → Supabase | `api/*.ts` | Service role key (server-only env var) |
| Overpass API | Server → Overpass | `api/overpass.ts` | None (managed by cache) |
| BLM/USFS/NPS APIs | Server → External | `api/sync.ts` | Per-API keys (env vars) |
| Sentry | Client + Server → Sentry | `main.tsx` + api functions | DSN (env var) |
| Vercel Analytics | Client → Vercel | `main.tsx` | Auto (Vercel project) |

### File Organization Patterns

**Environment Variables:**
```
# .env.example
VITE_SUPABASE_URL=           # Public — safe to expose to client
VITE_SUPABASE_ANON_KEY=      # Public — safe to expose to client
SUPABASE_SERVICE_ROLE_KEY=   # Server-only — never VITE_ prefix
ADMIN_SECRET=                # Server-only — Bearer token
SYNC_URL=                    # Server-only — cron target URL
```

**Build output:** `dist/` (gitignored) — Vercel deploys `dist/` + `api/` together from same repo

**Local dev:** `npm run dev` (Vite on `:5173`) + `vercel dev` required to test serverless functions locally

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:** All technology choices are mutually compatible. Vite 8 + React 19 + TypeScript forms the core; shadcn/ui CLI v4 has first-class Vite support; Zustand v5, TanStack Query v5, and React Router v7 all support React 19 concurrent rendering. Supabase-js v2 works directly in the Vite SPA (anon key) and from Vercel serverless functions (service role key).

**Pattern Consistency:** Naming conventions are internally consistent — `snake_case` DB columns transform to `camelCase` TypeScript at the `src/lib/supabase/` boundary without leaking into components. REST + JSON error shape aligns with TanStack Query's `onError` pattern. Feature-sliced directory structure aligns with the no-cross-feature-import rule.

**Structure Alignment:** Project structure directly supports all architectural decisions. Admin feature is isolated in `src/features/admin/` with `React.lazy()` as decided. Leaflet is dynamically imported in `LeafletMap.tsx` as required by bundle budget. The `api/_middleware.ts` pattern correctly implements the Bearer token check without duplicating it in each function.

### Requirements Coverage Validation ✅

**Functional Requirements (38/38 covered):**

| FR Range | Coverage | Location |
|---|---|---|
| FR1–FR6 | Rig profile setup, localStorage persistence | `rigStore.ts`, `features/rig-profile/` |
| FR7–FR12 | Map, CartoDB tiles, OSM fallback, rig filtering | `features/map/`, `lib/pin-model/` |
| FR13–FR17 | Pin detail, attributes, source attribution | `features/pin-detail/` |
| FR18 | Multi-source aggregation pipeline | `api/sync.ts`, `lib/pin-model/normalize.ts` |
| FR19–FR24 | Recency badge, optimistic updates | `lib/badge/`, `RecencyBadge.tsx`, TanStack Query optimistic mutation |
| FR25–FR28 | Check-in flow, departure proximity prompt | `features/check-in/`, `hooks/useGeolocation.ts` |
| FR29 | Issue reporting | `features/issue-report/`, `api/report.ts` |
| FR30–FR31 | Spot saving, localStorage persistence | `store/spotsStore.ts`, `features/saved-spots/` |
| FR32–FR35 | Admin moderation, pin removal, report close | `features/admin/`, `api/pins/`, `api/_middleware.ts` |

**Non-Functional Requirements (all architecturally addressed):**
- NFR-P1/P5: Vite 8 Rolldown + CDN + lazy chunks → ≤250KB gz, 3s load target ✅
- NFR-P2: Client-side in-memory filter via rigStore → 200ms filter target ✅
- NFR-SC3: `api/overpass.ts` + `overpass_cache` Supabase table → 24h TTL ✅
- NFR-SC4/R4: `retry: 3` on `useCheckinMutation` + Sentry capture → no silent data loss ✅
- NFR-S2: deviceId = UUID only, rig profile localStorage-only → no PII server-side ✅
- NFR-S5: `api/_middleware.ts` Bearer token → admin routes protected ✅
- NFR-R3: TanStack Query stale-while-revalidate → map functional with cached data ✅

### Implementation Readiness Validation ✅

**Decision Completeness:** All critical decisions are documented with verified versions. Two library versions added during gap analysis (Zod, supabase-js) complete the dependency picture.

**Structure Completeness:** Complete directory tree with every file named. All integration points mapped with direction and auth method. Data flows documented for the two most complex paths (pin load, check-in submit).

**Pattern Completeness:** 6 conflict-prone areas addressed with explicit rules and examples. Anti-patterns documented alongside correct patterns to prevent the most common agent divergence points.

### Gap Analysis Results

**Important gaps addressed:**

1. **Zod v3 added to tech stack** — form and server-side input validation. `rigProfileSchema.ts` uses Zod for rig profile field validation; serverless functions use Zod to validate request bodies before DB writes. Install: `npm i zod`

2. **supabase-js v2 pinned** — explicit dependency. Install: `npm i @supabase/supabase-js`

3. **TanStack Query retry pattern for NFR-SC4** — `useCheckinMutation` and `useReportMutation` must set `retry: 3` with default exponential backoff. On final failure: surface actionable error toast, log to Sentry, do NOT silently drop.

4. **`vercel.json` SPA routing rule** — required for React Router to handle all client-side routes:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed (Medium, 5–6 components)
- [x] Technical constraints identified (bundle budget, free tier, solo founder)
- [x] Cross-cutting concerns mapped (5 identified)

**✅ Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified (Vite 8, React 19, TypeScript, Tailwind, shadcn/ui, Leaflet 1.9.4, Zustand v5, TanStack Query v5.90.x, React Router v7, Supabase, Zod v3)
- [x] Integration patterns defined (REST, PostgREST, Bearer token)
- [x] Performance considerations addressed (3 lazy chunks, CDN, client-side filter)

**✅ Implementation Patterns**
- [x] Naming conventions established (snake_case DB, camelCase TS, PascalCase components)
- [x] Structure patterns defined (feature-sliced, co-located tests)
- [x] Communication patterns specified (Zustand immutable, TanStack Query keys)
- [x] Process patterns documented (error handling, loading states, validation)

**✅ Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established (no cross-feature imports)
- [x] Integration points mapped (6 external services)
- [x] Requirements to structure mapping complete (38 FRs mapped)

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**

**Confidence Level: High** — all critical decisions made, no blocking gaps, patterns comprehensive enough to prevent agent conflicts on the highest-risk areas (badge state, caching, auth).

**Key Strengths:**
- Single-service simplicity: Supabase covers DB + API reads in one dashboard — minimal infrastructure for solo founder
- Clear state ownership: Zustand (client) / TanStack Query (server) / URL (navigation) — no ambiguity about where state lives
- Optimistic update pattern explicitly defined for the recency badge — the highest UX-risk feature has an explicit implementation contract
- Bundle budget strategy is concrete: three named chunks with target sizes

**Areas for Future Enhancement:**
- PWA / Service Worker (Phase 2): `vite-plugin-pwa` integration path already clear, no architecture changes needed
- Supabase Realtime (Phase 2): replace polling with WebSocket badge updates — isolated to `src/lib/supabase/` and TanStack Query invalidation
- User accounts (Phase 3): Supabase Auth can be added without changing the anonymous device identity pattern

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented — do not substitute libraries not listed
- Use implementation patterns consistently — refer to the Good/Anti-pattern examples in Step 5
- Respect feature boundaries — no cross-feature imports; coordination through stores and router
- Refer to this document for all architectural questions before making independent decisions

**First Implementation Story (Story 1.1):**
```bash
npm create vite@latest overnighter -- --template react-ts
cd overnighter
npm install
npx shadcn@latest init
npm i zustand @tanstack/react-query react-router-dom leaflet @supabase/supabase-js zod @tanstack/react-query-devtools
npm i -D @types/leaflet vitest @testing-library/react @testing-library/jest-dom
```

---

## ML Pipeline Extension — Architectural Decisions

_Extension to the original architecture (2026-03-17) to support water tap discovery pipeline (FR39–FR47, NFR-ML1–ML5). All original decisions remain unchanged._

### Extension Decision Summary

**Critical Decisions (Block ML Pipeline Implementation):**
- ML model hosting: SageMaker endpoint (extends existing `bb80f53` implementation)
- Batch pipeline trigger: GitHub Actions monthly cron → `POST /api/ml-scan` (chunked, 50 locations/invocation)
- Data model: Separate `water_tap_pins` + `tap_verification_events` tables; unified `map_pins` Supabase view

**Important Decisions (Shape Extension Architecture):**
- User photo storage: Supabase Storage (`tap-photos` bucket) — stays in existing infrastructure
- UI module: Dedicated `src/features/water-taps/` — no cross-contamination with `pin-detail/`

**Deferred to Phase 2:**
- Real-time ML inference API endpoint (PRD-deferred; batch-only at MVP)
- ONNX on-device model for offline Keys use (evaluate after batch pipeline stable)
- Multi-state ML scan expansion (after Florida Keys pilot validated)

### Data Architecture Extension

**New Tables:**

`water_tap_pins`:
```sql
CREATE TABLE water_tap_pins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location        GEOGRAPHY(POINT, 4326) NOT NULL,
  place_name      TEXT NOT NULL,
  place_type      TEXT NOT NULL,          -- 'gas_station' | 'campground' | 'restaurant'
  access          TEXT,                   -- 'public' | 'ask_inside' | '24h' | 'daylight_only' (unverified at creation)
  confidence      NUMERIC(3,2) NOT NULL,  -- 0.00–1.00
  source          TEXT NOT NULL,          -- 'ml_batch' | 'user_submission' | 'manual'
  photos          TEXT[] DEFAULT '{}',    -- Supabase Storage URLs
  seasonal_notes  TEXT,
  mile_marker     NUMERIC(5,1),           -- NULL for non-Keys pins
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  verified_date   TIMESTAMPTZ,
  place_ref       TEXT,                   -- Google Places ID or OSM node ID
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_water_tap_pins_location    ON water_tap_pins USING GIST(location);
CREATE INDEX idx_water_tap_pins_is_active   ON water_tap_pins (is_active);
CREATE INDEX idx_water_tap_pins_mile_marker ON water_tap_pins (mile_marker) WHERE mile_marker IS NOT NULL;
```

`tap_verification_events` (append-only — never UPDATE or DELETE rows):
```sql
CREATE TABLE tap_verification_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tap_pin_id   UUID NOT NULL REFERENCES water_tap_pins(id),
  device_id    TEXT NOT NULL,            -- anonymous UUID, same pattern as check_ins
  event_type   TEXT NOT NULL,            -- 'confirmed' | 'denied' | 'ml_scan' | 'user_submission'
  confidence   NUMERIC(3,2),            -- present for ml_scan events
  photo_url    TEXT,                     -- present for user_submission events
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tap_verification_tap_pin_id ON tap_verification_events (tap_pin_id);
```

**Supabase View — unified map pin source:**
```sql
CREATE VIEW map_pins AS
  SELECT id, location, 'regular'   AS pin_category, place_name FROM pins          WHERE is_active = TRUE
  UNION ALL
  SELECT id, location, 'water_tap' AS pin_category, place_name FROM water_tap_pins WHERE is_active = TRUE;
```
Client queries `map_pins` via PostgREST — `pin_category` discriminator routes to `PinDetailSheet` vs `TapPinDetailSheet` in `PinLayer.tsx`.

**Supabase Storage:**
- Bucket: `tap-photos` — public read (photos displayed in pin detail); write via service role key from serverless functions only
- Path pattern: `tap-photos/{tap_pin_id}/{timestamp}.jpg`
- Max file size: 5MB (enforced server-side in `/api/tap-submit`)

### API Extension

**New Endpoints:**

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/ml-scan` | Bearer token | Chunked batch scan: Overpass → Mapillary/Places → SageMaker → `water_tap_pins` write |
| `POST /api/tap-submit` | None (deviceId in body) | User photo → Supabase Storage → SageMaker → create/confirm tap pin |
| `POST /api/tap-verify` | None (deviceId in body) | User confirm/deny → append `tap_verification_events` row |

**`/api/ml-scan` chunking contract:**
```
POST /api/ml-scan?offset=0&limit=50
Body: { bbox: { north, south, east, west } }
Response: { processed: 50, created: 8, updated: 3, skipped: 39, nextOffset: 50 }
```
GitHub Actions calls sequentially (offset 0, 50, 100…) until `processed < limit`. Each invocation completes in <60s (50 locations × ~1s SageMaker call + image fetch), satisfying NFR-ML1 (≤500 locations within 2 hours) across ~10 sequential invocations.

**`/api/tap-submit` flow:**
```
1. Receive multipart/form-data: { photo: File, location: [lat, lng], deviceId: string }
2. Validate: file size ≤5MB, MIME type image/*
3. Upload to Supabase Storage → tap-photos/{uuid}/{timestamp}.jpg
4. Call SageMaker endpoint: { image_url } → { confidence: 0.0–1.0 }
5. If confidence ≥0.75: upsert water_tap_pins (create or add photo to existing pin at location)
6. Append tap_verification_events row (event_type: 'user_submission')
7. Return: { pinId, confidence, status: 'created' | 'confirmed' | 'below_threshold' }
```

### Frontend Architecture Extension

**New feature module `src/features/water-taps/`:**
```
src/features/water-taps/
  TapPinDetailSheet.tsx       # Bottom sheet: confidence, photos, mile marker, seasonal notes, access type
  TapConfidenceBadge.tsx      # ML confidence indicator + community verification count (FR47)
  TapPhotoSubmission.tsx      # Photo upload flow: camera/file input + submission state (FR45)
  TapConfirmDeny.tsx          # "Still here / No longer here" UI (FR46)
  TapPinDetailSheet.test.tsx
  TapPhotoSubmission.test.tsx
  waterTapsApi.ts             # Fetch wrappers: POST /api/tap-submit, POST /api/tap-verify
```

**Map routing update (`src/features/map/PinLayer.tsx`):**
```typescript
function onPinTap(pin: MapPin) {
  if (pin.pinCategory === 'water_tap') navigate(`/tap/${pin.id}`)
  else navigate(`/pin/${pin.id}`)
}
```

**New route:** `/tap/:id` → `TapPinDetailSheet` (lazy-loaded chunk, separate from main bundle)

**New TanStack Query keys:**
```typescript
['water-taps', { viewport }]   // viewport tap pin list
['water-tap', tapPinId]        // single tap pin detail + verification count
```

**New mutations:**
- `useTapSubmitMutation` — multipart POST; optimistic: show "pending" confidence badge immediately
- `useTapVerifyMutation` — POST to `/api/tap-verify`; optimistic: increment/decrement verification count

### Infrastructure Extension

**GitHub Actions `sync.yml` update:**
```yaml
on:
  schedule:
    - cron: '0 2 * * *'    # BLM/USFS/NPS daily sync (unchanged)
    - cron: '0 3 1 * *'    # ML tap scan monthly (new — 1st of month, 3am UTC)

jobs:
  # existing sync job unchanged
  ml-scan:
    if: github.event.schedule == '0 3 1 * *'
    runs-on: ubuntu-latest
    steps:
      - name: Run ML scan (chunked)
        run: |
          OFFSET=0; LIMIT=50
          while true; do
            RESP=$(curl -s -X POST "${{ secrets.ML_SCAN_URL }}?offset=$OFFSET&limit=$LIMIT" \
              -H "Authorization: Bearer ${{ secrets.ADMIN_SECRET }}" \
              -d '{"bbox":{"north":25.7,"south":24.5,"east":-80.1,"west":-81.8}}')
            PROCESSED=$(echo $RESP | jq '.processed')
            OFFSET=$((OFFSET + LIMIT))
            [ "$PROCESSED" -lt "$LIMIT" ] && break
          done
```

**New environment variables (additions to `.env.example`):**
```
SAGEMAKER_ENDPOINT_URL=    # Server-only — SageMaker inference endpoint URL
AWS_ACCESS_KEY_ID=         # Server-only — AWS credentials for SageMaker
AWS_SECRET_ACCESS_KEY=     # Server-only
AWS_REGION=                # Server-only — e.g. us-east-1
ML_SCAN_URL=               # Server-only — full /api/ml-scan URL (for GitHub Actions)
```

**New Supabase migrations:**
```
supabase/migrations/
  005_create_water_tap_pins.sql
  006_create_tap_verification_events.sql
  007_create_map_pins_view.sql
  008_create_tap_photos_storage_bucket.sql
```

### Extension Decision Impact Analysis

**Implementation Sequence (extension only):**
1. Supabase migrations 005–008 (blocks all tap data work)
2. SageMaker endpoint activated + tested with sample photo (blocks `/api/ml-scan` and `/api/tap-submit`)
3. `/api/tap-submit` + `/api/tap-verify` serverless functions (blocks user-facing tap features)
4. `src/features/water-taps/` module + `/tap/:id` route (blocks tap pin UI)
5. `/api/ml-scan` + GitHub Actions cron update (blocks batch discovery pipeline)
6. `map_pins` view wired into `usePinsQuery` + `PinLayer` routing update (completes unified map display)

**Cross-Component Dependencies:**
- `useWaterTapsQuery` depends on `map_pins` view (migration 007)
- `/api/tap-submit` depends on Supabase Storage bucket (migration 008) + SageMaker endpoint active
- `TapPinDetailSheet` depends on `tap_verification_events` query helper in `src/lib/supabase/`
- GitHub Actions cron depends on `ML_SCAN_URL` + `ADMIN_SECRET` in repository secrets
- `PinLayer.tsx` routing update depends on `pin_category` discriminator in `map_pins` view

**Requirements Coverage (FR39–FR47, NFR-ML1–ML5):**

| FR/NFR | Coverage | Location |
|---|---|---|
| FR39 (Overpass enumeration) | Overpass query at scan start | `api/ml-scan.ts` |
| FR40 (image fetch, ≤5/location) | Mapillary first, Places fallback | `api/ml-scan.ts` |
| FR41 (ML inference per photo) | SageMaker endpoint call per photo | `api/ml-scan.ts` + SageMaker |
| FR42 (create pin at ≥0.75) | `water_tap_pins` upsert on threshold | `api/ml-scan.ts` |
| FR43 (tap pin schema) | Full schema with all required fields | migrations 005, 006 |
| FR44 (business location link) | `place_ref` column | migration 005 |
| FR45 (user photo submission) | Storage upload → SageMaker → pin write | `api/tap-submit.ts` + `TapPhotoSubmission.tsx` |
| FR46 (confirm/deny log) | Append-only event log | `api/tap-verify.ts` + `tap_verification_events` |
| FR47 (confidence display + verified status) | ML confidence + community count + ≥2 users = verified | `TapConfidenceBadge.tsx` |
| NFR-ML1 (≤500 locations / 2h) | Chunked 50-location invocations, ~10 sequential calls | `api/ml-scan.ts` design |
| NFR-ML2 (≥80% precision gate) | SageMaker offline evaluation before first production scan | SageMaker eval step |
| NFR-ML3 (30-day re-scan) | Monthly cron trigger | `.github/workflows/sync.yml` |
| NFR-ML4 (rate limit compliance) | Server-side delay between Mapillary/Places calls | `api/ml-scan.ts` |
| NFR-ML5 (model not client-accessible) | `SAGEMAKER_ENDPOINT_URL` + AWS creds server-only; never `VITE_` prefixed | `.env.example`, all `api/*.ts` |
