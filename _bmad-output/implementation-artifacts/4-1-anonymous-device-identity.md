# Story 4.1: Anonymous Device Identity

Status: done

## Story

As the system,
I want to assign each device a persistent anonymous UUID on first app load,
so that check-ins can be attributed to a device without collecting any personally identifiable information.

## Acceptance Criteria

**AC1 — UUID generated and stored on first app load**
Given a user opens the app for the first time
When the app initializes
Then `crypto.randomUUID()` is called once and the result is stored in localStorage under key `'device-id'` (separate from the rig profile key `'rig-profile'`)

**AC2 — UUID persists across sessions**
Given a device UUID has been generated and stored
When the user closes and reopens the app
Then the same UUID is retrieved from localStorage — a new UUID is never generated for an existing device

**AC3 — Always accessed via `useDeviceId` hook**
Given the device UUID is read
When any component or hook accesses it
Then it is always read via the `useDeviceId` hook — never directly from localStorage in components

**AC4 — No PII stored**
Given the device UUID in localStorage
When it is inspected
Then it contains no rig profile data, no location data, and no user-identifiable information (NFR-S2)

**AC5 — `crypto.randomUUID()` only — no fingerprinting**
Given the anonymous UUID method
When it is implemented
Then `crypto.randomUUID()` is used — no canvas fingerprinting, no third-party fingerprinting library (NFR-S3)

## Tasks / Subtasks

- [x] Task 1: Create `src/hooks/useDeviceId.ts` (AC1, AC2, AC3, AC5)
  - [x] 1.1: Define the localStorage key constant:
    ```typescript
    const DEVICE_ID_KEY = 'device-id'
    ```
    CRITICAL: Key must differ from `'rig-profile'` (rigStore persist key).
  - [x] 1.2: Implement private `getOrCreateDeviceId()` helper:
    ```typescript
    function getOrCreateDeviceId(): string {
      const existing = localStorage.getItem(DEVICE_ID_KEY)
      if (existing) return existing
      const id = crypto.randomUUID()
      localStorage.setItem(DEVICE_ID_KEY, id)
      return id
    }
    ```
  - [x] 1.3: Implement `useDeviceId` hook with `useState` lazy initializer:
    ```typescript
    import { useState } from 'react'

    export function useDeviceId(): string {
      const [deviceId] = useState<string>(getOrCreateDeviceId)
      return deviceId
    }
    ```
    Note: Pass `getOrCreateDeviceId` as a **function reference** (not `getOrCreateDeviceId()`) — lazy initializer runs once per mount, not every render.

- [x] Task 2: Initialize device ID on app load in `src/App.tsx` (AC1)
  - [x] 2.1: Add import: `import { useDeviceId } from '@/hooks/useDeviceId'`
  - [x] 2.2: Call hook at top of `App()` function body (before `return`):
    ```typescript
    export default function App() {
      useDeviceId() // Initialize anonymous device ID on first app load (Story 4.1)
      return (
        // ALL existing JSX unchanged
      )
    }
    ```
    Why `App` and not a route? All routes are `lazy()`-loaded; `App` is always mounted synchronously.

- [x] Task 3: Create `src/hooks/useDeviceId.test.ts` (AC1, AC2, AC5)
  - [x] 3.1: Setup with `vi.stubGlobal('crypto', ...)` + `localStorage.clear()` in beforeEach
  - [x] 3.2: Test — generates UUID and stores in localStorage under `'device-id'`
  - [x] 3.3: Test — calls `crypto.randomUUID()` exactly once when no existing UUID
  - [x] 3.4: Test — returns existing UUID from localStorage without calling `randomUUID`
  - [x] 3.5: Test — same UUID returned on subsequent mounts (simulates app reopen)
  - [x] 3.6: Test — `'device-id'` key is separate from `'rig-profile'` key
  - [x] 3.7: Test — always returns a non-empty string

## Dev Notes

### Critical: File location is `src/hooks/useDeviceId.ts`

Architecture explicitly names this path (`src/hooks/useDeviceId.ts — crypto.randomUUID() init + localStorage`). NOT in `src/store/` or `src/lib/`. It's a React hook that uses `useState`.

### Critical: localStorage key is `'device-id'`

- `'device-id'` — this story's key
- `'rig-profile'` — taken by Zustand rigStore persist (`{ name: 'rig-profile' }`)
- Do NOT reuse existing keys

Architecture constraint note: "Zustand stores own all client-persisted state — no direct localStorage outside `src/store/` and `src/lib/storage/`" — **documented exception**: `useDeviceId.ts` is explicitly in the architecture file tree spec as the localStorage handler for device identity. Device ID is immutable after creation and doesn't need Zustand reactivity.

### Critical: `useState` lazy initializer syntax

```typescript
// ✅ CORRECT — function reference (lazy initializer, runs once per mount)
const [deviceId] = useState<string>(getOrCreateDeviceId)

// ❌ WRONG — function call (runs every render)
const [deviceId] = useState<string>(getOrCreateDeviceId())
```

### Critical: App.tsx structure (READ FIRST)

Current `src/App.tsx`: all routes are `lazy()`-loaded, wrapped in `<QueryClientProvider>` + `<BrowserRouter>`. `App` itself is always mounted synchronously. Hook call goes at the very TOP of the function body before `return`. No other changes to App.tsx.

### Testing: `vi.stubGlobal('crypto', ...)` pattern

```typescript
const STUB_UUID = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => STUB_UUID) })
})
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})
```

jsdom provides `crypto.randomUUID()` natively but stub it for deterministic tests.

### `useDeviceId` will be consumed in Stories 4.3 and 4.4

Not used for anything yet beyond initialization. Stories 4.3 (check-in) and 4.4 (issue report) will call `useDeviceId()` inside their components to get `deviceId` for POST request payloads.

### Project Structure Notes

**Files to create:**
- `src/hooks/useDeviceId.ts` — NEW (~15 lines)
- `src/hooks/useDeviceId.test.ts` — NEW (7 tests)

**Files to modify:**
- `src/App.tsx` — add `useDeviceId()` call + import (2-line change)

**No changes to:**
- `src/store/` — no Zustand store for device ID
- Any feature component files
- `src/types/` — UUID is `string`

### References

- Story requirements: [epics.md — Epic 4, Story 4.1](_bmad-output/planning-artifacts/epics.md)
- Architecture device identity: [architecture.md](_bmad-output/planning-artifacts/architecture.md) — "crypto.randomUUID() called once on first app load, stored under a separate key from rig profile"
- Architecture file tree: [architecture.md](_bmad-output/planning-artifacts/architecture.md) — `src/hooks/useDeviceId.ts # crypto.randomUUID() init + localStorage`
- rigStore key: [src/store/rigStore.ts](overnighter/src/store/rigStore.ts) — `persist({ name: 'rig-profile' })`
- Current App.tsx: [src/App.tsx](overnighter/src/App.tsx) — read before modifying
- Story 3.3 learnings: mock type annotations (`null as X | null`), `vi.restoreAllMocks()` in afterEach

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Implemented `useDeviceId` hook using `useState` lazy initializer pattern — `getOrCreateDeviceId` runs once per mount, reads from localStorage or calls `crypto.randomUUID()` on first app load
- Hook initialized eagerly in `App.tsx` (always-mounted component) to satisfy AC1 "when the app initializes"
- 7 unit tests covering: UUID generation, localStorage persistence, no-duplicate-generation, session simulation, key isolation, return type, empty-string edge case
- Code review: exported `DEVICE_ID_KEY`, fixed UUID stub format, added `vi.unstubAllGlobals()`, added App integration test
- 343 tests pass, `tsc -b` clean

### File List

**Created:**
- `src/hooks/useDeviceId.ts` — NEW hook (~16 lines, `DEVICE_ID_KEY` exported)
- `src/hooks/useDeviceId.test.ts` — NEW test file (7 tests)
- `src/App.test.tsx` — NEW integration test for AC1 App initialization

**Modified:**
- `src/App.tsx` — added `useDeviceId()` call + import

## Code Review Record

### Review Date: 2026-03-19

### Reviewer: claude-sonnet-4-6

### Findings: 0H / 1M / 5L

- **M1 (FIXED)** — No test coverage for App.tsx Task 2: `useDeviceId()` call in App had zero tests; added `src/App.test.tsx` with AC1 integration test guarding the initialization path
- **L1 (FIXED)** — `STUB_UUID` was not a valid UUID4 format; updated to `'f47ac10b-58cc-4372-a567-0e02b2c3d479'` for future API validation compatibility
- **L2 (FIXED)** — `afterEach` used `vi.restoreAllMocks()` but not `vi.unstubAllGlobals()`; added proper global cleanup
- **L3 (FIXED)** — `DEVICE_ID_KEY` not exported; future story 4.3/4.4 test files need the key constant to avoid hardcoded string typos
- **L4 (FIXED)** — Empty string in localStorage not tested; added edge case test (falsy check correctly triggers UUID regeneration)
- **L5 (FIXED)** — Dev Agent completion notes said "6 tests" inconsistently; updated to 7 tests

### Outcome: APPROVED — all issues resolved. 343 tests pass. `tsc -b` clean.
