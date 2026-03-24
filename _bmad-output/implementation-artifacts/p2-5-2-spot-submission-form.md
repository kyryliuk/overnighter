# Story 5.2: Spot Submission Form

Status: ready-for-dev

## Story

As a **signed-in user**,
I want to submit a new spot that's missing from the map via a multi-step form,
So that the community can benefit from locations I've discovered.

## Acceptance Criteria

**AC1 — Form accessible from account screen**
Given a signed-in user taps the "Suggest spot" button on the Account screen
When the `/suggest-spot` route loads
Then the SpotSubmissionSheet opens showing Step 1 of 3
And a step indicator displays the current step and total steps (e.g. "Step 1 of 3")
And the user must be authenticated (`AuthRequired` wrapper remains)

**AC2 — Step 1: Spot type & location**
Given the user is on Step 1
When the step loads
Then spot type chips (Overnight, Dump Station, Water, Fuel) are displayed for quick amenity selection
And a "Spot name" text input is visible and required
And GPS coordinates are auto-filled from the device location via `useGeolocation`
And a "Detect my location" button is available to re-request GPS
And latitude/longitude fields are shown as editable text inputs
And tapping a spot type chip toggles the corresponding amenity in the form state

**AC3 — Step 1 validation**
Given the user taps Next on Step 1
When step-level validation runs
Then an inline error is shown if the name is empty ("Name is required")
And an inline error is shown if latitude or longitude is missing or outside the supported region (lat 24–49, lng −125 to −66)
And the user cannot advance to Step 2 until all required fields pass validation

**AC4 — Step 2: Details & amenities**
Given the user completes Step 1 and taps Next
When Step 2 is shown
Then the full amenity checkbox grid is visible (grouped by Infrastructure / Activities, using `SPOT_AMENITY_LABELS`)
And amenities toggled via spot type chips in Step 1 are pre-checked
And optional fields are visible: description (textarea, max 2000 chars), website, phone, max rig length, max rig height
And tapping Back returns to Step 1 with all entered data preserved

**AC5 — Step 2 validation**
Given the user taps Next on Step 2
When step-level validation runs
Then an inline error is shown if no amenities are selected ("Select at least one amenity or activity")
And an inline error is shown if website is provided but not a valid URL
And the user cannot advance to Step 3 until validation passes

**AC6 — Step 3: Photo & submit**
Given the user completes Step 2 and taps Next
When Step 3 is shown
Then a summary of the entered spot name and coordinates is visible
And the optional `PhotoUpload` component is visible (reusing Story 5.1 infrastructure)
And a "Submit for review" button is visible
And tapping Back returns to Step 2 with all data preserved

**AC7 — Successful submission**
Given the user taps "Submit for review" with valid data
When `POST /api/spot-submissions` is called with the JWT
Then a `spot_submissions` record is created with `status = 'pending'`
And the form resets and navigates back (or shows a success view)
And a toast/success message shows: "Submitted — your spot is under review"
And the `spot-submissions` query cache is invalidated

**AC8 — Auth requirement**
Given an unauthenticated user navigates to `/suggest-spot`
When the route loads
Then the `AuthRequired` wrapper redirects them to sign in
And after signing in they are returned to the suggest spot form

**AC9 — My Submissions list**
Given the user scrolls below the form (or after submitting)
When the "My submissions" section is visible
Then the user's past submissions are fetched via `GET /api/spot-submissions`
And each submission displays name, coordinates, status pill (pending/approved/rejected/changes requested), and admin feedback if present

## Tasks / Subtasks

- [ ] Task 1: Refactor `SuggestSpotScreen` to multi-step form layout (AC: 1, 2, 4, 6)
  - [ ] 1.1 Modify `src/features/spot-submissions/SuggestSpotScreen.tsx`:
    - Add step state: `const [step, setStep] = useState<1 | 2 | 3>(1)`
    - Add a `StepIndicator` component at the top of the form section:
      ```tsx
      function StepIndicator({ current, total }: { current: number; total: number }) {
        return (
          <div className="flex items-center justify-center gap-2 mb-6">
            {Array.from({ length: total }, (_, i) => (
              <div
                key={i}
                className={[
                  'h-2 rounded-full transition-all',
                  i + 1 === current ? 'w-8 bg-primary' : i + 1 < current ? 'w-2 bg-primary/60' : 'w-2 bg-muted',
                ].join(' ')}
                aria-label={`Step ${i + 1} of ${total}${i + 1 === current ? ' (current)' : ''}`}
              />
            ))}
            <span className="ml-2 text-xs text-muted-foreground">Step {current} of {total}</span>
          </div>
        )
      }
      ```
    - Conditionally render step content based on `step`:
      - `step === 1` → Step1 content (name, location, spot type chips)
      - `step === 2` → Step2 content (amenities, description, optional fields)
      - `step === 3` → Step3 content (summary, photo upload, submit button)
    - Add Next/Back buttons for navigation between steps
    - Keep "My submissions" section always visible below the form (outside the step container)

  - [ ] 1.2 Auto-detect location on mount:
    - Call `requestGeo()` in a `useEffect` on mount (once) to auto-fill coordinates
    - When `geoState.coords` changes and `lat`/`lng` are empty, auto-populate them:
      ```tsx
      useEffect(() => {
        if (geoState.coords && !lat && !lng) {
          setLat(geoState.coords.latitude.toFixed(6))
          setLng(geoState.coords.longitude.toFixed(6))
        }
      }, [geoState.coords])
      ```

- [ ] Task 2: Implement Step 1 — Spot type & location (AC: 2, 3)
  - [ ] 2.1 Add spot type chip quick-select in Step 1:
    - Define spot type chip options:
      ```tsx
      const SPOT_TYPE_CHIPS: Array<{ key: keyof PinAmenities; label: string }> = [
        { key: 'overnight', label: 'Overnight' },
        { key: 'dump', label: 'Dump Station' },
        { key: 'water', label: 'Water' },
        { key: 'fuel', label: 'Fuel' },
      ]
      ```
    - Render as toggle chip buttons (similar to CheckInForm status chips):
      ```tsx
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Spot type">
        {SPOT_TYPE_CHIPS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            aria-pressed={amenities[chip.key]}
            onClick={() => handleAmenityToggle(chip.key)}
            className={[
              'min-h-[44px] rounded-lg border text-sm font-medium px-4 transition-colors',
              amenities[chip.key]
                ? 'bg-sky-500 text-white border-sky-500'
                : 'bg-background border-border text-foreground',
            ].join(' ')}
          >
            {chip.label}
          </button>
        ))}
      </div>
      ```
    - Toggling a chip updates the `amenities` state (same `handleAmenityToggle` function)
  - [ ] 2.2 Step 1 fields: Spot name input, Latitude input, Longitude input, Detect my location button
    - Move existing name/lat/lng inputs and geo detection into Step 1 content
  - [ ] 2.3 Implement Step 1 validation function:
    ```tsx
    function validateStep1(): Record<string, string> {
      const nextErrors: Record<string, string> = {}
      const latNum = parseFloat(lat)
      const lngNum = parseFloat(lng)
      if (!name.trim()) nextErrors.name = 'Name is required'
      if (!lat || Number.isNaN(latNum)) nextErrors.latitude = 'Latitude is required'
      else if (latNum < 24 || latNum > 49) nextErrors.latitude = 'Coordinates appear to be outside the supported region'
      if (!lng || Number.isNaN(lngNum)) nextErrors.longitude = 'Longitude is required'
      else if (lngNum < -125 || lngNum > -66) nextErrors.longitude = 'Coordinates appear to be outside the supported region'
      return nextErrors
    }
    ```
  - [ ] 2.4 Next button handler for Step 1:
    ```tsx
    function handleStep1Next() {
      const stepErrors = validateStep1()
      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors)
        return
      }
      setErrors({})
      setStep(2)
    }
    ```

- [ ] Task 3: Implement Step 2 — Details & amenities (AC: 4, 5)
  - [ ] 3.1 Move existing amenities fieldset (infrastructure + activities grid) into Step 2 content
    - Amenities toggled via spot type chips in Step 1 remain checked (shared `amenities` state)
  - [ ] 3.2 Move existing optional fields into Step 2: description textarea, website, phone, max rig length, max rig height
  - [ ] 3.3 Implement Step 2 validation function:
    ```tsx
    function validateStep2(): Record<string, string> {
      const nextErrors: Record<string, string> = {}
      if (!Object.values(amenities).some(Boolean)) {
        nextErrors.amenities = 'Select at least one amenity or activity'
      }
      if (website.trim()) {
        try { new URL(website.trim()) }
        catch { nextErrors.website = 'Website must be a valid URL' }
      }
      return nextErrors
    }
    ```
  - [ ] 3.4 Next button handler for Step 2:
    ```tsx
    function handleStep2Next() {
      const stepErrors = validateStep2()
      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors)
        return
      }
      setErrors({})
      setStep(3)
    }
    ```
  - [ ] 3.5 Back button returns to Step 1 — `setStep(1)` — preserving all form state

- [ ] Task 4: Implement Step 3 — Photo & submit (AC: 6, 7)
  - [ ] 4.1 Add submission summary at top of Step 3:
    ```tsx
    <div className="rounded-lg border border-border bg-background p-4 mb-4">
      <p className="font-semibold">{name}</p>
      <p className="text-xs text-muted-foreground">{lat}, {lng}</p>
      <p className="text-xs text-muted-foreground mt-1">
        {Object.entries(amenities).filter(([, v]) => v).length} amenities selected
      </p>
    </div>
    ```
  - [ ] 4.2 Integrate `PhotoUpload` component (reuse from Story 5.1):
    - Import `PhotoUpload` from `@/features/check-in/PhotoUpload`
    - NOTE: `PhotoUpload` currently requires `pinId` and `checkInId` for the storage path. For spot submissions there is no pinId yet (the submission creates a pending record, not a pin). Two options:
      - **Option A (recommended):** Generate a temporary UUID for the upload path: `const [tempUploadId] = useState(() => crypto.randomUUID())` and pass it as both `pinId` and `checkInId`. The photos are stored under this temporary path and can be associated with the submission record after creation.
      - **Option B:** Skip photo upload in this story and defer to Story 5.3. Only use Option B if photo upload URL endpoint cannot accept arbitrary UUIDs.
    - Add state for photo tracking:
      ```tsx
      const [photoCdnUrl, setPhotoCdnUrl] = useState<string | null>(null)
      const [photoStoragePath, setPhotoStoragePath] = useState<string | null>(null)
      const [tempUploadId] = useState(() => crypto.randomUUID())
      ```
    - Render `<PhotoUpload>` with:
      ```tsx
      <PhotoUpload
        pinId={tempUploadId}
        checkInId={tempUploadId}
        disabled={!isOnline}
        onUploadComplete={(cdn, path) => {
          setPhotoCdnUrl(cdn)
          setPhotoStoragePath(path)
        }}
        onUploadClear={() => {
          setPhotoCdnUrl(null)
          setPhotoStoragePath(null)
        }}
      />
      ```
  - [ ] 4.3 Submit button sends full form data to `POST /api/spot-submissions`:
    - Existing `submitMutation` already handles the POST
    - On success: reset form, show success toast, keep user on page
  - [ ] 4.4 Add success toast/message:
    - After `onSuccess` in mutation, set a success message state:
      ```tsx
      const [successMsg, setSuccessMsg] = useState<string | null>(null)
      ```
    - In `onSuccess` callback: `setSuccessMsg('Submitted — your spot is under review')`
    - Render success message as a temporary banner:
      ```tsx
      {successMsg && (
        <div role="status" className="rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          ✓ {successMsg}
        </div>
      )}
      ```
    - Clear success message after 5 seconds with `setTimeout`
    - On success, also reset step to 1: `setStep(1)`
  - [ ] 4.5 Back button returns to Step 2 — `setStep(2)` — preserving all form state

- [ ] Task 5: Add `useOnlineStatus` check (AC: 6)
  - [ ] 5.1 Import and use `useOnlineStatus` from `@/hooks/useOnlineStatus`:
    ```tsx
    const isOnline = useOnlineStatus()
    ```
  - [ ] 5.2 Disable the submit button and photo upload when offline
  - [ ] 5.3 Show offline banner when `!isOnline`:
    ```tsx
    {!isOnline && (
      <p role="status" className="text-sm text-amber-400 text-center mb-4">
        Offline — you need a connection to submit spots.
      </p>
    )}
    ```

- [ ] Task 6: Wire up navigation buttons (AC: 1, 2, 4, 6)
  - [ ] 6.1 Render step-specific navigation at the bottom of each step:
    - Step 1: `[Next]` button only
    - Step 2: `[Back]` + `[Next]` buttons
    - Step 3: `[Back]` + `[Submit for review]` buttons
  - [ ] 6.2 Button styling follows existing patterns (min-h-[44px], rounded-lg, etc.)
  - [ ] 6.3 All buttons use `type="button"` (except submit which uses the existing `handleSubmit` click handler)

- [ ] Task 7: Create component tests (AC: 1–9)
  - [ ] 7.1 Create or update `src/features/spot-submissions/SuggestSpotScreen.test.tsx`:
    - Test: Step indicator shows "Step 1 of 3" on initial render
    - Test: Spot type chips toggle amenity state
    - Test: Step 1 validation blocks advancement when name is empty
    - Test: Step 1 validation blocks advancement when coordinates are missing
    - Test: Clicking Next on valid Step 1 advances to Step 2
    - Test: Back button on Step 2 returns to Step 1 with data preserved
    - Test: Step 2 validation blocks advancement when no amenities are selected
    - Test: Step 2 validation blocks advancement when website is invalid URL
    - Test: Clicking Next on valid Step 2 advances to Step 3
    - Test: Step 3 shows summary of spot name and coordinates
    - Test: Step 3 renders PhotoUpload component
    - Test: Back button on Step 3 returns to Step 2 with data preserved
    - Test: Successful submission shows toast "Submitted — your spot is under review"
    - Test: Successful submission resets form to Step 1
    - Test: Submit button is disabled while mutation is pending
    - Test: My submissions section renders past submissions with status pills
    - Test: Offline banner shown and submit disabled when offline
  - [ ] 7.2 Follow existing test patterns:
    - Mock `useAuth` to return an authenticated session
    - Mock `fetch` for API calls
    - Mock `useGeolocation` for GPS coordinates
    - Use `@testing-library/react` with `render`, `screen`, `fireEvent`, `waitFor`

- [ ] Task 8: Final validation (all ACs)
  - [ ] 8.1 Run `npm run lint` — no new lint errors
  - [ ] 8.2 Run `npm run test -- --reporter=verbose` — all existing + new tests pass
  - [ ] 8.3 Run `npm run build` — build succeeds
  - [ ] 8.4 Manual verification:
    - Navigate to Account screen → tap "Suggest spot" → verify multi-step flow
    - Fill Step 1 → Next → verify Step 2 loads with amenities pre-checked
    - Back → verify Step 1 data preserved
    - Complete Step 2 → Next → verify Step 3 summary and PhotoUpload
    - Submit → verify success toast and form reset
    - Verify My Submissions section loads

## Dev Notes

### Context Summary

This story refactors the existing `SuggestSpotScreen` from a single-page form into a multi-step wizard (3 steps) with step indicators, per-step validation, and optional photo attachment. The underlying API (`POST /api/spot-submissions`), database table (`spot_submissions`), routing (`/suggest-spot`), and types all already exist — the primary work is a UI refactor of `SuggestSpotScreen.tsx`.

### Current Repository Reality

**What already exists and works:**
- `src/features/spot-submissions/SuggestSpotScreen.tsx` — Full single-page form with all fields (name, lat, lng, description, amenities, website, phone, max length, max height), submit mutation, and "My submissions" list. This is the file to refactor.
- `api/spot-submissions.ts` — POST (create submission) and GET (list user submissions) endpoints with Zod validation. Already requires `requireUserAuth`.
- `api/_spot-submissions.ts` — `ApiDbSpotSubmission` interface and `mapSpotSubmission` mapper (snake_case → camelCase).
- `supabase/migrations/016_create_spot_submissions.sql` — `spot_submissions` table with RLS policies.
- `src/types/spotSubmission.ts` — `SpotSubmission` and `SpotSubmissionStatus` TypeScript types.
- `src/features/spots/spotFormConfig.ts` — `EMPTY_PIN_AMENITIES` (25 boolean keys) and `SPOT_AMENITY_LABELS` (25 labels grouped by 'infra'/'activity').
- Route in `src/App.tsx`: `/suggest-spot` wrapped in `<AuthRequired>`.
- Account screen button: `onClick={() => navigate('/suggest-spot')}` at line 289 of `AccountScreen.tsx`.

**Photo upload infrastructure (from Story 5.1 — already implemented):**
- `src/features/check-in/PhotoUpload.tsx` — Reusable component: file picker, compress, upload, preview, retry, remove.
- `src/hooks/usePhotoUpload.ts` — Hook managing upload lifecycle (idle→compressing→uploading→success/error).
- `src/lib/photoUpload.ts` — `validateFile`, `compressImage`, `requestUploadUrl`, `uploadToSignedUrl`.
- `api/photos/upload-url.ts` — Signed URL endpoint (requires JWT, validates fileType).
- Storage path convention: `{pinId}/{checkInId}/{uuid}.{ext}`.

**Existing patterns to follow:**
- `CheckInForm.tsx` — Bottom sheet with status chips, `PhotoUpload` integration, submit/error handling.
- `IssueReportSheet.tsx` — Bottom sheet with selection chips, textarea, online/offline check.
- Both use: fixed bottom-0, z-50, backdrop div, `role="dialog"`, aria-modal, min-h-[44px] touch targets.

### Architecture Guardrails

1. **Submissions never bypass moderation.** All spots go to `spot_submissions` with `status: 'pending'`. Only admin approval via `PATCH /api/admin/spot-submissions/:id` creates a pin in the `pins` table.
2. **Auth is required.** The `spot_submissions` table has `user_id NOT NULL REFERENCES auth.users(id)`. The route is wrapped in `<AuthRequired>`. The API calls `requireUserAuth`. Do NOT remove auth gating.
3. **Photo uploads use signed URLs.** Components never upload directly to Supabase Storage. Flow: request signed URL → PUT to signed URL → store CDN URL.
4. **Store CDN URL, never construct storage paths in components.** Use `photo.cdnUrl` from the API response.
5. **Zod validation on API boundary.** The server-side `SpotSubmissionSchema` validates all fields. Client-side validation is for UX only — the API is the source of truth.

### Implementation Notes

**Refactoring approach:** This is a refactor of `SuggestSpotScreen.tsx`, not a new file. All existing state, mutation, and query logic remains — the change is wrapping the form sections into step-gated conditional renders with navigation buttons and a step indicator.

**Spot type chips vs full amenity list:** The spot type chips (Overnight, Dump, Water, Fuel) in Step 1 are quick-select toggles that set the corresponding `amenities` state key. The full amenity checkbox grid in Step 2 shows all 25 amenities including any already toggled by the chips. This is not a separate "type" field — it's a UX shortcut.

**Photo upload path workaround:** The `PhotoUpload` component requires `pinId` and `checkInId` for the storage path. Since spot submissions don't have a pin yet, generate a temporary UUID and pass it as both `pinId` and `checkInId`. This creates a valid storage path. If the submission is later approved and a pin is created, photos can be associated by adding a `photo_cdn_url` column to `spot_submissions` or via a separate linking step. For now, the photo URL can be logged but is NOT stored in the `spot_submissions` table (the migration doesn't have a photo column). Consider adding a `photo_cdn_url TEXT` column to `spot_submissions` if full photo persistence is needed — but that would require a new migration and is out of scope for this story unless explicitly requested.

**State preservation across steps:** All form state is managed via `useState` at the `SuggestSpotScreen` level. Navigating between steps with `setStep()` does NOT unmount/remount state — all values are preserved automatically.

**No new API changes needed.** The existing `POST /api/spot-submissions` and `GET /api/spot-submissions` endpoints handle everything. The Zod schema matches the form fields exactly.

**Existing validation logic:** The current `validate()` function in `SuggestSpotScreen.tsx` already validates name, lat, lng, amenities, and website. Refactor it into `validateStep1()` and `validateStep2()` by splitting the checks by step.

### Database Schema Reference

```sql
CREATE TABLE spot_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  amenities JSONB NOT NULL,
  max_length_ft INTEGER,
  max_height_ft DOUBLE PRECISION,
  website TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  admin_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  published_pin_id UUID REFERENCES pins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### API Validation Schema Reference

```typescript
// api/spot-submissions.ts — SpotSubmissionSchema
z.object({
  name: z.string().min(1),
  description: z.string().trim().max(2000).optional().nullable(),
  latitude: z.number().min(24).max(49),
  longitude: z.number().min(-125).max(-66),
  amenities: AmenitiesSchema, // all 25 boolean fields
  max_length_ft: z.number().int().positive().optional().nullable(),
  max_height_ft: z.number().positive().optional().nullable(),
  website: z.string().trim().url().optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
})
```

### Key Files to Modify

| File | Change |
|---|---|
| `src/features/spot-submissions/SuggestSpotScreen.tsx` | Refactor to multi-step wizard (primary work) |

### Key Files to Reference (read-only)

| File | Purpose |
|---|---|
| `src/features/check-in/CheckInForm.tsx` | Sheet pattern, PhotoUpload integration |
| `src/features/check-in/PhotoUpload.tsx` | Photo upload component to reuse in Step 3 |
| `src/hooks/usePhotoUpload.ts` | Upload hook (used by PhotoUpload) |
| `src/features/issue-report/IssueReportSheet.tsx` | Sheet pattern, chip selection, offline check |
| `src/features/spots/spotFormConfig.ts` | `EMPTY_PIN_AMENITIES`, `SPOT_AMENITY_LABELS` |
| `src/types/spotSubmission.ts` | `SpotSubmission`, `SpotSubmissionStatus` types |
| `api/spot-submissions.ts` | API endpoint (POST/GET) with Zod schema |
| `api/_spot-submissions.ts` | DB→client mapping helper |
| `src/hooks/useGeolocation.ts` | GPS detection hook |
| `src/hooks/useOnlineStatus.ts` | Offline detection hook |

### Testing Requirements

- Unit tests for step validation logic (validateStep1, validateStep2)
- Component tests for step navigation (forward, backward, data preservation)
- Component tests for spot type chip toggling
- Component tests for form submission success/error states
- Component tests for offline behavior (submit disabled, banner shown)
- Mock `useAuth`, `useGeolocation`, `useOnlineStatus`, and `fetch` per existing test patterns
- All existing tests must continue to pass
