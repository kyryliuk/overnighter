# Story 1.1: Project Initialization & Infrastructure Setup

Status: done

## Story

As a developer,
I want a fully configured project foundation deployed to production,
So that all subsequent features can be built, tested, and shipped on a stable, production-ready base.

## Acceptance Criteria

1. **Given** the repository is cloned on a development machine **When** the developer runs `npm install && npm run dev` **Then** the Vite 8 + React 19 + TypeScript app starts on localhost:5173 with no errors **And** hot module replacement works on file save.

2. **Given** the project is initialized **When** the developer runs `npx shadcn@latest init` **Then** Tailwind CSS is configured, `components.json` is present, path aliases (`@/`) resolve correctly, and the `cn()` utility is available at `@/lib/utils`.

3. **Given** all dependencies are installed **When** the developer checks `package.json` **Then** the following are present: `zustand`, `@tanstack/react-query`, `react-router-dom`, `leaflet`, `@supabase/supabase-js`, `zod`, `@tanstack/react-query-devtools`, `@types/leaflet`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`.

4. **Given** the Supabase project is created **When** the developer runs the migration files **Then** four tables exist: `pins`, `check_ins`, `issue_reports`, `overpass_cache` with correct columns and types per schema below.

5. **Given** the repository is connected to Vercel **When** a commit is pushed to `main` **Then** Vercel automatically builds and deploys the app to the production URL with HTTPS.

6. **Given** `vercel.json` contains the SPA rewrite rule `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }` **When** a user navigates directly to `/onboarding` or any React Router route **Then** the app loads correctly without a 404 error.

7. **Given** `.env.example` is committed to the repository **When** a developer reviews it **Then** all required environment variables are listed: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET`, `SYNC_URL`.

8. **Given** `.github/workflows/sync.yml` exists **When** the developer reviews it **Then** a cron job is defined for `0 2 * * *` (2am UTC) that calls `POST /api/sync` with the Bearer token from `secrets.ADMIN_SECRET` and the URL from `secrets.SYNC_URL`.

9. **Given** the app loads in a browser **When** the app initializes **Then** Sentry is initialized in `main.tsx` and Vercel Analytics script is active (no console errors).

## Tasks / Subtasks

- [x] **Task 1: Initialize Vite project and install all dependencies** (AC: 1, 3)
  - [x] Run `npm create vite@latest overnighter -- --template react-ts`
  - [x] Run `npm install` inside `overnighter/`
  - [x] Tailwind v4 + shadcn/ui config created manually (non-interactive); `components.json` + `@/` alias + `cn()` configured
  - [x] Install production deps: zustand@5, @tanstack/react-query@5, react-router-dom@7, leaflet@1.9.4, @supabase/supabase-js@2, zod@3, @tanstack/react-query-devtools@5
  - [x] Install dev deps: @types/leaflet, vitest@4, @testing-library/react, @testing-library/jest-dom, jsdom
  - [x] Install monitoring: @sentry/react, @vercel/analytics
  - [x] Verify `npm run build` succeeds and `npx vitest run` passes (HMR verified via dev server)

- [x] **Task 2: Configure project structure** (AC: 1, 2)
  - [x] Create full directory tree including all feature, lib, store, api, types subdirectories
  - [x] Create `api/` (root — Vercel serverless functions), `supabase/migrations/`, `public/map-markers/`
  - [x] `@/` path alias configured in `vite.config.ts` + `tsconfig.app.json`
  - [x] `.github/workflows/` directory created

- [x] **Task 3: Create skeleton source files** (AC: 1)
  - [x] `src/main.tsx` — Sentry init (disabled in dev) + Vercel Analytics + React 19 root
  - [x] `src/App.tsx` — QueryClientProvider + BrowserRouter + lazy-loaded route placeholders for all 5 routes
  - [x] `src/index.css` — Tailwind v4 `@import "tailwindcss"` + `@theme` CSS variables (dark theme)
  - [x] `src/types/pin.ts`, `src/types/rigProfile.ts`, `src/types/badge.ts` — full typed interfaces
  - [x] `src/store/rigStore.ts`, `src/store/spotsStore.ts`, `src/store/uiStore.ts` — Zustand stores with persist
  - [x] `src/lib/supabase/client.ts` — Supabase client singleton + `src/lib/supabase/types.ts` (DB types)
  - [x] `src/lib/utils.ts` — `cn()` utility (clsx + tailwind-merge)
  - [x] All serverless function skeletons with correct error shape + Bearer auth

- [x] **Task 4: Create Supabase migrations** (AC: 4)
  - [x] `supabase/migrations/001_create_pins.sql` — pins table with all columns, indexes
  - [x] `supabase/migrations/002_create_check_ins.sql` — check_ins table
  - [x] `supabase/migrations/003_create_issue_reports.sql` — issue_reports table with composite index
  - [x] `supabase/migrations/004_create_overpass_cache.sql` — overpass_cache table
  - [x] `supabase/seed.sql` — 5 diverse seed pins for local dev
  - [ ] ⚠️ MANUAL STEP: Create Supabase project in dashboard at supabase.com and run migrations
  - [ ] ⚠️ MANUAL STEP: Verify all 4 tables exist via Supabase Table Editor

- [x] **Task 5: Configure deployment** (AC: 5, 6)
  - [x] `vercel.json` — SPA rewrite rule + @vercel/node@4 function runtime
  - [x] `.gitignore` — includes `.env.local`, `dist/`, `node_modules/`
  - [x] `.env.example` — all 6 required env var keys documented with descriptions
  - [ ] ⚠️ MANUAL STEP: Create `.env.local` with real Supabase credentials
  - [ ] ⚠️ MANUAL STEP: Push repository to GitHub
  - [ ] ⚠️ MANUAL STEP: Connect GitHub repo to Vercel via Vercel dashboard
  - [ ] ⚠️ MANUAL STEP: Add env vars to Vercel project settings + verify auto-deploy on push to main

- [x] **Task 6: Configure GitHub Actions cron** (AC: 8)
  - [x] `.github/workflows/sync.yml` — daily cron `0 2 * * *` + manual dispatch, uses `secrets.SYNC_URL` + `secrets.ADMIN_SECRET`
  - [ ] ⚠️ MANUAL STEP: Add `SYNC_URL` and `ADMIN_SECRET` to GitHub repository secrets

- [x] **Task 7: Configure tooling** (AC: 1)
  - [x] ESLint already configured by Vite template (`eslint.config.js`)
  - [x] `.prettierrc` — standard formatting config
  - [x] `vite.config.ts` — Vitest config with `globals: true`, `environment: 'jsdom'`, `setupFiles`
  - [x] `src/test/setup.ts` — imports `@testing-library/jest-dom`
  - [x] `npm run test` (vitest run) passes with 17 tests across 3 files

- [x] **Task 8: Verify Sentry and Analytics** (AC: 9)
  - [x] `@sentry/react` init in `src/main.tsx` — reads `VITE_SENTRY_DSN`, disabled in dev (`import.meta.env.PROD`)
  - [x] `@vercel/analytics` `inject()` called in `src/main.tsx`
  - [x] `VITE_SENTRY_DSN` added to `.env.example`

## Dev Notes

### Critical Architecture Guardrails

**These rules are MANDATORY for ALL subsequent stories. Establishing them now sets the foundation.**

**File location rules:**
- React components → `PascalCase.tsx` in the feature directory (e.g., `src/features/map/MapView.tsx`)
- Non-component TypeScript → `camelCase.ts` (e.g., `src/lib/supabase/client.ts`, `src/store/rigStore.ts`)
- Custom hooks → `use` prefix in `src/hooks/` (shared) or feature directory (feature-specific)
- Serverless functions → `src/api/` contains client-side fetch wrappers; `api/` (root) contains Vercel serverless functions — **never mix these two**
- Tests → co-located with source: `MapView.tsx` + `MapView.test.tsx` in the same directory. **NEVER use a separate `__tests__` directory.**

**State rules:**
- Supabase PostgREST → used ONLY from `src/lib/supabase/` helpers. **NEVER call `supabase.from()` inside components or stores.**
- All Supabase query results MUST transform `snake_case` → `camelCase` inside `src/lib/supabase/` before the result leaves the module. Components and stores **never** handle `snake_case` field names.
- TanStack Query → all server state. **NEVER use `useEffect` + `useState` for async data fetching.**
- Zustand → all cross-component client state. **NEVER prop-drill rig profile.**
- localStorage → only accessed from `src/store/` (via Zustand `persist`) and `src/lib/storage/`. **NEVER call `localStorage.setItem()` directly in a component.**

### Project Initialization Commands

```bash
npm create vite@latest overnighter -- --template react-ts
cd overnighter
npm install
npx shadcn@latest init
# When prompted: select Vite, Dark, yes to CSS variables, @/ alias, yes to tailwind.config.ts
npm i zustand @tanstack/react-query react-router-dom leaflet @supabase/supabase-js zod @tanstack/react-query-devtools
npm i -D @types/leaflet vitest @testing-library/react @testing-library/jest-dom
npm i @sentry/react @vercel/analytics
```

**shadcn init generates:** `tailwind.config.ts`, `components.json`, `src/lib/utils.ts` (with `cn()` helper), updates `index.css` with Tailwind imports, configures `@/` alias in `vite.config.ts` and `tsconfig.json`.

### Exact Dependency Versions (from Architecture)

| Package | Version | Notes |
|---|---|---|
| Vite | 8.x | Auto-selected by `create vite@latest` |
| React | 19.2.x | TypeScript template includes React 19 |
| TypeScript | 5.x strict | Already configured by template |
| Tailwind CSS | 4.x | Configured by shadcn init |
| shadcn/ui CLI | v4 (`shadcn@latest`) | First-class Vite support as of March 2026 |
| Leaflet | 1.9.4 | `npm i leaflet@1.9.4` — pin this version |
| Zustand | v5 | `npm i zustand@5` |
| TanStack Query | v5.90.x | `npm i @tanstack/react-query@5` |
| React Router | v7 | `npm i react-router-dom@7` |
| Supabase JS | v2 | `npm i @supabase/supabase-js@2` |
| Zod | v3 | `npm i zod@3` |
| Vitest | latest | Vite-native, same config |

**Bundle budget:** main bundle ≤150KB gz; Leaflet chunk ~40KB gz; admin chunk ~30KB gz; total ≤250KB gz (NFR-P5). This is a hard constraint enforced via Vite bundle analysis.

### Supabase Migration SQL Schemas

**`supabase/migrations/001_create_pins.sql`**
```sql
CREATE TABLE pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  pin_type TEXT NOT NULL CHECK (pin_type IN ('blm', 'usfs', 'nps', 'overpass', 'community')),
  source_id TEXT,
  max_length_ft INTEGER,
  max_height_ft DOUBLE PRECISION,
  amenities JSONB NOT NULL DEFAULT '{}',
  badge_state TEXT NOT NULL DEFAULT 'grey' CHECK (badge_state IN ('green', 'yellow', 'red', 'grey')),
  last_check_in_at TIMESTAMPTZ,
  recent_check_in_count INTEGER NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pins_coordinates ON pins (latitude, longitude);
CREATE INDEX idx_pins_badge_state ON pins (badge_state);
CREATE INDEX idx_pins_pin_type ON pins (pin_type);
```

**`supabase/migrations/002_create_check_ins.sql`**
```sql
CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX idx_check_ins_pin_id ON check_ins (pin_id);
CREATE INDEX idx_check_ins_checked_in_at ON check_ins (checked_in_at);
```

**`supabase/migrations/003_create_issue_reports.sql`**
```sql
CREATE TABLE issue_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('closed', 'damaged', 'inaccurate', 'other')),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_issue_reports_pin_id ON issue_reports (pin_id);
CREATE INDEX idx_issue_reports_status ON issue_reports (status);
CREATE INDEX idx_issue_reports_created_at ON issue_reports (created_at);
```

**`supabase/migrations/004_create_overpass_cache.sql`**
```sql
CREATE TABLE overpass_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bbox_key TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_overpass_cache_bbox_key ON overpass_cache (bbox_key);
CREATE INDEX idx_overpass_cache_cached_at ON overpass_cache (cached_at);
```

**Column naming rule:** All Supabase columns use `snake_case` (enforced by architecture). The `src/lib/supabase/` layer transforms to `camelCase` before any other code sees the data.

**Amenities JSONB shape** (used in pin filtering in future stories):
```json
{
  "water": false,
  "dump": false,
  "electric": false,
  "shower": false,
  "fuel": false,
  "propane": false,
  "overnight": false
}
```

### `src/main.tsx` Template

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { inject } from '@vercel/analytics'
import App from './App'
import './index.css'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
})

inject()  // Vercel Analytics

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

### `src/App.tsx` Skeleton

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<div>Map (placeholder)</div>} />
          <Route path="/onboarding" element={<div>Onboarding (placeholder)</div>} />
          <Route path="/pin/:id" element={<div>Pin Detail (placeholder)</div>} />
          <Route path="/saved" element={<div>Saved Spots (placeholder)</div>} />
          <Route path="/admin" element={<div>Admin (placeholder)</div>} />
        </Routes>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

### `src/lib/supabase/client.ts` Skeleton

```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### `vercel.json` Content

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "functions": {
    "api/**/*.ts": {
      "runtime": "@vercel/node@4"
    }
  }
}
```

### `.env.example` Content

```
# Supabase — public (safe to expose to browser)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Supabase — server-only (NEVER prefix with VITE_)
SUPABASE_SERVICE_ROLE_KEY=

# Admin — server-only Bearer token
ADMIN_SECRET=

# Data pipeline — cron target URL
SYNC_URL=

# Sentry — public DSN (safe to expose)
VITE_SENTRY_DSN=
```

**Critical env var rule:** Variables prefixed `VITE_` are embedded in the client bundle (visible in browser). `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_SECRET` must **NEVER** use `VITE_` prefix — only read in serverless functions (`api/*.ts`), not in `src/`.

### `.github/workflows/sync.yml` Content

```yaml
name: Daily Sync

on:
  schedule:
    - cron: '0 2 * * *'  # 2am UTC daily
  workflow_dispatch:       # Manual trigger for testing

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger sync
        run: |
          curl -X POST "${{ secrets.SYNC_URL }}" \
            -H "Authorization: Bearer ${{ secrets.ADMIN_SECRET }}" \
            -H "Content-Type: application/json"
```

### Serverless Function Skeleton Pattern

All functions in `api/` must follow this pattern (establishes the error response shape for all future stories):

```typescript
// api/checkin.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only', status: 405 })
  }

  try {
    // Implementation in Story 4.3
    return res.status(200).json({ message: 'ok' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong', status: 500 })
  }
}
```

**Error shape is mandatory**: `{ "error": "ERROR_CODE", "message": "Human readable", "status": 4xx|5xx }`. This exact shape is required by architecture. **Never** return bare error strings or `{ success: false }` wrappers.

### `api/_middleware.ts` Bearer Token Pattern

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node'

export function requireAdminAuth(req: VercelRequest, res: VercelResponse): boolean {
  const authHeader = req.headers['authorization']
  const token = authHeader?.replace('Bearer ', '')

  if (!token || token !== process.env.ADMIN_SECRET) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or missing Bearer token', status: 401 })
    return false
  }
  return true
}
```

### Zustand Store Skeleton Pattern

**Establish this correct pattern now** — all future stores must follow it:

```typescript
// src/store/rigStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface RigProfile {
  rigType: string | null
  lengthFt: number | null
  heightFt: number | null
}

interface RigStore {
  rigProfile: RigProfile
  setRigProfile: (profile: RigProfile) => void
  clearRigProfile: () => void
}

const defaultRigProfile: RigProfile = {
  rigType: null,
  lengthFt: null,
  heightFt: null,
}

export const useRigStore = create<RigStore>()(
  persist(
    (set) => ({
      rigProfile: defaultRigProfile,
      setRigProfile: (profile) => set({ rigProfile: profile }),
      clearRigProfile: () => set({ rigProfile: defaultRigProfile }),
    }),
    { name: 'rig-profile' }  // localStorage key
  )
)
```

**Anti-patterns to avoid:**
```typescript
// ❌ NEVER: direct localStorage in component
localStorage.setItem('rig', JSON.stringify(profile))

// ❌ NEVER: mutate state directly
state.rigProfile.lengthFt = 35

// ✅ ALWAYS: immutable set()
set((state) => ({ rigProfile: { ...state.rigProfile, lengthFt: 35 } }))
```

### Vitest Configuration

Configure Vitest inside `vite.config.ts` (not a separate file) to avoid config duplication:

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom'
```

### TypeScript Strict Mode

The Vite react-ts template already enables `strict: true` in `tsconfig.json`. **Do not downgrade it.** Common gotchas:
- `import.meta.env.VITE_X` needs `vite-env.d.ts` (already generated by template)
- Leaflet types require `@types/leaflet` (installed in dev deps above)
- No `any` in map/state logic — define proper interfaces in `src/types/`

### What This Story Does NOT Include

Story 1.1 is **infrastructure only**. The following are explicitly out of scope and belong to later stories:
- Actual map rendering (Story 1.4)
- Rig onboarding form UI (Story 1.2)
- Any real Supabase data queries (Story 2.2+)
- Real API endpoint implementations (Stories 4.x, 5.x)
- Authentication flows (Story 5.1)
- Leaflet map component (Story 1.4)

**Scope guardrail:** If a task requires writing feature business logic, it belongs in a later story. Story 1.1 = project runs, deploys, CI/CD works, DB tables exist.

### Project Structure Notes

Alignment with unified project structure per architecture document:

```
overnighter/
├── .env.example              ← committed (no values)
├── .env.local                ← gitignored (real secrets)
├── .gitignore
├── .eslintrc.cjs
├── .prettierrc
├── vercel.json
├── vite.config.ts            ← also contains Vitest config
├── components.json           ← shadcn/ui config (auto-generated)
├── tailwind.config.ts        ← auto-generated by shadcn init
├── tsconfig.json
├── .github/workflows/sync.yml
├── api/
│   ├── _middleware.ts        ← Bearer token helper
│   ├── checkin.ts            ← skeleton only
│   ├── report.ts             ← skeleton only
│   ├── overpass.ts           ← skeleton only
│   ├── sync.ts               ← skeleton only
│   └── pins/[id].ts          ← skeleton only
│   └── pins/[id]/verify.ts   ← skeleton only
├── supabase/
│   ├── migrations/001_create_pins.sql
│   ├── migrations/002_create_check_ins.sql
│   ├── migrations/003_create_issue_reports.sql
│   ├── migrations/004_create_overpass_cache.sql
│   └── seed.sql
└── src/
    ├── main.tsx              ← Sentry + Analytics + React root
    ├── App.tsx               ← QueryClientProvider + BrowserRouter + placeholder routes
    ├── index.css             ← Tailwind base imports
    ├── vite-env.d.ts         ← auto-generated
    ├── test/setup.ts         ← @testing-library/jest-dom import
    ├── components/ui/        ← shadcn/ui components (auto-generated later)
    ├── features/             ← empty subdirectories only (no files yet)
    ├── hooks/                ← empty
    ├── lib/supabase/client.ts
    ├── store/rigStore.ts     ← skeleton Zustand store
    ├── store/spotsStore.ts   ← skeleton
    ├── store/uiStore.ts      ← skeleton
    ├── api/                  ← empty (client-side fetch wrappers, story 4+)
    └── types/                ← placeholder interfaces
```

### References

- [Source: architecture.md#Starter Template Evaluation] — Vite 8 + React 19 selected, init commands
- [Source: architecture.md#Implementation Patterns & Consistency Rules] — naming conventions, file structure, anti-patterns
- [Source: architecture.md#Data Architecture] — 4 Supabase tables, column naming (snake_case)
- [Source: architecture.md#API & Communication Patterns] — error response shape `{ error, message, status }`
- [Source: architecture.md#Infrastructure & Deployment] — vercel.json, GitHub Actions sync.yml content
- [Source: architecture.md#Authentication & Security] — env var naming, VITE_ prefix rules, admin Bearer token
- [Source: architecture.md#Frontend Architecture] — Zustand store pattern, QueryClient setup
- [Source: architecture.md#Project Structure & Boundaries] — complete directory tree
- [Source: epics.md#Story 1.1 Acceptance Criteria] — all ACs with exact dependency list

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Tailwind v4 `@tailwindcss/vite@4.2.1` has peer dep constraint `vite^5-7`; installed with `--legacy-peer-deps`. Works correctly at runtime.
- Tailwind v4 CSS: `@apply border-border` fails because CSS variables must be defined via `@theme` not `@layer base`. Fixed by using `@theme` with `--color-*` convention.
- `vite.config.ts` requires `import { defineConfig } from 'vitest/config'` (not `vite`) when using `test` block, otherwise TypeScript errors on unknown `test` property.

### Completion Notes List

- Vite 8.0.0 + React 19.2.4 + TypeScript 5.9.3 project created and builds successfully
- All 11 production dependencies installed with pinned versions per architecture spec
- Tailwind v4 configured with dark theme `@theme` variables; shadcn/ui `components.json` created manually (non-interactive)
- Full directory structure matching architecture.md created
- All 5 lazy-loaded route placeholders established in `App.tsx` (MapView, Onboarding, PinDetail, SavedSpots, Admin)
- 3 Zustand stores with Zustand `persist` middleware for localStorage sync
- All 4 Supabase migration SQL files with correct `snake_case` schema + indexes
- 5 seed pins covering diverse pin types and rig constraints
- All 7 serverless function skeletons with correct `{ error, message, status }` error shape
- `api/_middleware.ts` Bearer token helper established — used by admin functions
- `vercel.json` SPA rewrite + function runtime configured
- `.github/workflows/sync.yml` daily cron with `curl -f` for failure detection
- Sentry init (prod-only) + Vercel Analytics in `main.tsx`
- **17 tests across 3 files: all pass** — rigStore (6), spotsStore (6), cn() utility (5)
- Bundle: main 107.77 KB gzip (target ≤150KB ✅); 5 lazy chunks created correctly
- **Manual steps remaining for Kyryl:** (1) Create Supabase project + run migrations, (2) Create `.env.local` with credentials, (3) Push to GitHub + connect Vercel, (4) Add secrets to GitHub repo

### File List

overnighter/package.json
overnighter/vite.config.ts
overnighter/tsconfig.app.json
overnighter/components.json
overnighter/.gitignore
overnighter/.env.example
overnighter/.prettierrc
overnighter/vercel.json
overnighter/.github/workflows/sync.yml
overnighter/src/main.tsx
overnighter/src/App.tsx
overnighter/src/index.css
overnighter/src/test/setup.ts
overnighter/src/types/pin.ts
overnighter/src/types/rigProfile.ts
overnighter/src/types/badge.ts
overnighter/src/lib/utils.ts
overnighter/src/lib/utils.test.ts
overnighter/src/lib/supabase/client.ts
overnighter/src/lib/supabase/types.ts
overnighter/src/store/rigStore.ts
overnighter/src/store/rigStore.test.ts
overnighter/src/store/spotsStore.ts
overnighter/src/store/spotsStore.test.ts
overnighter/src/store/uiStore.ts
overnighter/src/features/map/MapView.tsx
overnighter/src/features/rig-profile/OnboardingScreen.tsx
overnighter/src/features/pin-detail/PinDetailSheet.tsx
overnighter/src/features/saved-spots/SavedSpotsScreen.tsx
overnighter/src/features/admin/AdminDashboard.tsx
overnighter/api/_middleware.ts
overnighter/api/checkin.ts
overnighter/api/report.ts
overnighter/api/overpass.ts
overnighter/api/sync.ts
overnighter/api/pins/[id].ts
overnighter/api/pins/[id]/verify.ts
overnighter/supabase/migrations/001_create_pins.sql
overnighter/supabase/migrations/002_create_check_ins.sql
overnighter/supabase/migrations/003_create_issue_reports.sql
overnighter/supabase/migrations/004_create_overpass_cache.sql
overnighter/supabase/seed.sql
