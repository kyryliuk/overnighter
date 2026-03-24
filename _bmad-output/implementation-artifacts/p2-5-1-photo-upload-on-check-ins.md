# Story 5.1: Photo Upload on Check-Ins

Status: ready-for-dev

## Story

As a **signed-in user**,
I want to attach a photo when submitting a check-in,
So that I can give the community a current visual of the spot's condition.

## Acceptance Criteria

**AC1 — Camera CTA on check-in form (authenticated users only)**
Given a signed-in user opens the check-in submission sheet
When they view the check-in form
Then a camera icon CTA is visible above the note field as the primary photo action
And unauthenticated users see the standard check-in form without the photo CTA

**AC2 — Photo selection via native file picker**
Given the user taps the camera icon
When the native file picker opens and they select an image
Then only JPEG, PNG, and HEIC files are accepted (`accept="image/jpeg,image/png,image/heic"`)
And client-side validation rejects files over 5 MB or unsupported formats with the message: "Photo must be JPEG, PNG, or HEIC and under 5MB"

**AC3 — Client-side compression**
Given the user selects a valid image file
When the file is accepted
Then it is compressed client-side to ≤ 1 MB before upload using `browser-image-compression`
And the original file is not modified

**AC4 — Signed URL upload flow**
Given a compressed image is ready for upload
When `POST /api/photos/upload-url` is called with `{ pinId, checkInId, fileType }` and a valid JWT
Then the API validates file type and size constraints
And returns `{ uploadUrl, cdnUrl, storagePath }` — a signed Supabase Storage PUT URL
And the client PUTs the file directly to the signed URL (not through the Vercel function)
And a progress bar with `aria-valuenow` shows upload progress from first byte

**AC5 — Photo record storage**
Given the upload completes successfully
When the check-in is submitted
Then a row is inserted into `pin_photos` with `check_in_id`, `user_id`, `storage_path`, and `cdn_url`
And a thumbnail of the uploaded photo is visible in the check-in confirmation state
And a maximum of 1 photo per check-in is enforced (single photo, not gallery)

**AC6 — Upload validation on server**
Given the user selects a file over 5 MB or a non-JPEG/PNG/HEIC format
When the upload URL endpoint validates the request
Then a `400` error is returned: `{ error: "INVALID_BODY", message: "Photo must be JPEG, PNG, or HEIC and under 5MB" }`
And missing/invalid JWT returns `401 { error: "UNAUTHORIZED" }`

**AC7 — Upload error handling with auto-retry**
Given the upload fails due to a network error
When the failure occurs
Then a silent auto-retry fires once
And if the retry also fails, an error state shows: "Photo upload failed — tap to retry"
And the user can still submit the check-in without a photo (photo is optional)

**AC8 — Photo display in pin detail**
Given a pin has check-ins with attached photos
When a user views the pin detail sheet
Then the most recent check-in photo is displayed as a thumbnail in the check-in history section
And tapping the thumbnail opens the full-resolution image via the CDN URL
And photos use `<img src={photo.cdnUrl} />` — never construct Storage paths in components

**AC9 — Offline behavior**
Given the user is offline and submits a check-in with a photo selected
When the check-in is queued offline
Then the check-in is saved to the offline queue (text data only — status + note)
And the photo is discarded with a toast: "Photo will not be included — you're offline"
And the photo CTA is visually disabled when offline

## Tasks / Subtasks

- [ ] Task 1: Create `POST /api/photos/upload-url` endpoint (AC: 4, 6)
  - [ ] 1.1 Create file `api/photos/upload-url.ts`:
    - Export default async handler with `VercelRequest`/`VercelResponse` types
    - Only allow `POST` method; return `405 { error: "METHOD_NOT_ALLOWED" }` for others
    - Call `requireUserAuth(req, res)` from `../_auth` — return early if null (401)
    - Validate body with Zod schema:
      ```typescript
      const UploadUrlBody = z.object({
        pinId: z.string().uuid(),
        checkInId: z.string().uuid(),
        fileType: z.enum(['image/jpeg', 'image/png', 'image/heic']),
      })
      ```
    - On validation failure, return `400 { error: "INVALID_BODY", message: "Photo must be JPEG, PNG, or HEIC and under 5MB" }`
    - Generate storage path: `${pinId}/${checkInId}/${crypto.randomUUID()}.${ext}` where ext is derived from fileType
    - Call `createServiceClient()` from `../_supabase`
    - Create signed upload URL via Supabase Storage:
      ```typescript
      const { data, error } = await supabase.storage
        .from('pin-photos')
        .createSignedUploadUrl(storagePath)
      ```
    - Construct CDN URL: `${process.env.VITE_SUPABASE_URL}/storage/v1/object/public/pin-photos/${storagePath}`
    - Return `200 { uploadUrl: data.signedUrl, cdnUrl, storagePath }`
    - On Storage error, log and return `500 { error: "INTERNAL_ERROR" }`

- [ ] Task 2: Create photo upload client library (AC: 3, 4, 7)
  - [ ] 2.1 Install `browser-image-compression` package:
    - Run `npm install browser-image-compression`
    - This is the de-facto library for client-side image compression in browsers
  - [ ] 2.2 Create file `src/lib/photoUpload.ts`:
    - This is the ONLY place the PUT upload is executed client-side (architecture boundary)
    - Export constants:
      ```typescript
      export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic'] as const
      export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024   // 5 MB raw input limit
      export const MAX_COMPRESSED_SIZE_MB = 1               // 1 MB post-compression target
      ```
    - Export `validateFile(file: File): string | null` — returns error message string or null if valid. Check file.type against ALLOWED_TYPES and file.size against MAX_FILE_SIZE_BYTES.
    - Export `compressImage(file: File): Promise<File>`:
      ```typescript
      import imageCompression from 'browser-image-compression'

      export async function compressImage(file: File): Promise<File> {
        return imageCompression(file, {
          maxSizeMB: MAX_COMPRESSED_SIZE_MB,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: 'image/jpeg',  // normalize HEIC → JPEG
        })
      }
      ```
    - Export `requestUploadUrl(params: { pinId: string; checkInId: string; fileType: string }, token: string): Promise<{ uploadUrl: string; cdnUrl: string; storagePath: string }>`:
      - POST to `/api/photos/upload-url` with JSON body and `Authorization: Bearer ${token}`
      - Throw on non-200 response with parsed error message
    - Export `uploadToSignedUrl(uploadUrl: string, file: File, onProgress?: (pct: number) => void): Promise<void>`:
      - Use `XMLHttpRequest` (not fetch) to support `upload.onprogress` for progress tracking
      - Set `Content-Type` to file.type
      - On network error, auto-retry once (silent)
      - If retry also fails, throw `PhotoUploadError` with `retryable: true`
    - Export custom error class:
      ```typescript
      export class PhotoUploadError extends Error {
        constructor(message: string, public retryable: boolean) {
          super(message)
          this.name = 'PhotoUploadError'
        }
      }
      ```

- [ ] Task 3: Create `usePhotoUpload` hook (AC: 4, 5, 7)
  - [ ] 3.1 Create file `src/hooks/usePhotoUpload.ts`:
    - Export `usePhotoUpload()` hook that manages the upload lifecycle
    - State: `idle | compressing | uploading | success | error`
    - Track `progress: number` (0–100) for upload progress bar
    - Track `thumbnailUrl: string | null` for preview after success
    - Track `errorMessage: string | null` for error display
    - Track `cdnUrl: string | null` and `storagePath: string | null` for form submission
    - Use `supabase.auth.getSession()` from `@/lib/supabase/client` to get JWT token
    - Expose methods:
      ```typescript
      startUpload(file: File, pinId: string, checkInId: string): Promise<void>
      retry(): Promise<void>   // re-attempt with last file
      reset(): void            // clear state back to idle
      ```
    - `startUpload` flow:
      1. Validate file via `validateFile()` — set error state if invalid
      2. Set state to `compressing`, call `compressImage()`
      3. Set state to `uploading`, call `requestUploadUrl()` with JWT
      4. Call `uploadToSignedUrl()` with progress callback → update `progress`
      5. On success: set state to `success`, store `cdnUrl`, `storagePath`, create object URL for `thumbnailUrl`
      6. On error: set state to `error`, store error message
    - `retry` re-calls `startUpload` with the stored file/pinId/checkInId

- [ ] Task 4: Create `PhotoUpload` UI component (AC: 1, 2, 3, 7)
  - [ ] 4.1 Create file `src/features/check-in/PhotoUpload.tsx`:
    - Accept props: `pinId: string`, `checkInId: string`, `disabled?: boolean`, `onUploadComplete: (cdnUrl: string, storagePath: string) => void`, `onUploadClear: () => void`
    - Render a visually-hidden `<input type="file" accept="image/jpeg,image/png,image/heic" capture="environment">` behind a styled camera icon button
    - Use `usePhotoUpload()` hook for all upload logic
    - **Idle state:** Camera icon button (min 44×44px touch target) with "Add photo" label
    - **Compressing state:** Spinner overlay with "Compressing…" text
    - **Uploading state:** Progress bar with `role="progressbar"` and `aria-valuenow={progress}`, cancel option
    - **Success state:** Thumbnail preview with remove (×) button, calls `onUploadComplete` with cdnUrl and storagePath
    - **Error state:** Error message + "Tap to retry" button, calls `retry()` from hook
    - When disabled (offline), show muted camera icon with no click handler

- [ ] Task 5: Integrate `PhotoUpload` into `CheckInForm` (AC: 1, 5, 9)
  - [ ] 5.1 Modify `src/features/check-in/CheckInForm.tsx`:
    - Import `PhotoUpload` from `./PhotoUpload`
    - Import `useSession` (or check `supabase.auth.getSession()`) to detect authenticated state
    - Add state: `photoCdnUrl: string | null`, `photoStoragePath: string | null`, `tempCheckInId: string` (generate UUID upfront with `crypto.randomUUID()`)
    - Generate a `tempCheckInId` on mount with `useState(() => crypto.randomUUID())` — this ID is used for the Storage path and becomes the check-in ID
    - Conditionally render `<PhotoUpload>` above the `<textarea>` when user is authenticated
    - Hide `<PhotoUpload>` when `!isOnline` or user is not authenticated
    - Update `handleSubmit`:
      - Include `photoCdnUrl` and `photoStoragePath` in the mutation payload (if present)
      - Pass `checkInId: tempCheckInId` to the API so the check-in gets the pre-generated UUID
    - Offline path: if photo was selected but user goes offline, discard photo data and show toast "Photo will not be included — you're offline"

- [ ] Task 6: Update check-in mutation and API to handle photos (AC: 5)
  - [ ] 6.1 Modify `src/hooks/useCheckInMutation.ts`:
    - Extend `CheckInPayload` interface:
      ```typescript
      export interface CheckInPayload {
        pinId: string
        deviceId: string
        status: CheckInStatus
        note?: string
        checkInId?: string        // pre-generated UUID for photo linking
        photoCdnUrl?: string      // CDN URL of uploaded photo
        photoStoragePath?: string  // Storage path for pin_photos record
      }
      ```
    - Pass `checkInId`, `photoCdnUrl`, and `photoStoragePath` through to the API body
  - [ ] 6.2 Modify `api/checkin.ts`:
    - Extend Zod schema with optional photo fields:
      ```typescript
      checkInId: z.string().uuid().optional(),
      photoCdnUrl: z.string().url().optional(),
      photoStoragePath: z.string().min(1).optional(),
      ```
    - If `checkInId` is provided, use it as the check-in's `id` in the insert (instead of auto-generating)
    - After check-in insert, if `photoCdnUrl` and `photoStoragePath` are present:
      - Extract `user_id` from JWT (call `requireUserAuth` only when photo fields present — check-in itself is still anonymous via deviceId)
      - Insert into `pin_photos`: `{ check_in_id, user_id, storage_path: photoStoragePath, cdn_url: photoCdnUrl }`
      - If pin_photos insert fails, log error but DO NOT fail the check-in — photo is best-effort

- [ ] Task 7: Display photos in Pin Detail Sheet (AC: 8)
  - [ ] 7.1 Create file `src/hooks/usePinPhotos.ts`:
    - Export `usePinPhotos(pinId: string)` hook
    - Query `pin_photos` table joined with `check_ins` where `check_ins.pin_id = pinId`
    - Order by `pin_photos.created_at DESC`, limit 5
    - Use `@tanstack/react-query` with key `['pin-photos', pinId]`
    - Return `{ data: PinPhoto[], isLoading, error }`
    - Type:
      ```typescript
      export interface PinPhoto {
        id: string
        checkInId: string
        cdnUrl: string
        createdAt: string
      }
      ```
  - [ ] 7.2 Create file `src/types/photo.ts`:
    - Export `PinPhoto` interface (as above)
    - Export `PhotoUploadRequest` type: `{ pinId: string; checkInId: string; fileType: string }`
  - [ ] 7.3 Add `DbPinPhoto` to `src/lib/supabase/types.ts`:
    ```typescript
    export interface DbPinPhoto {
      id: string
      check_in_id: string
      user_id: string
      storage_path: string
      cdn_url: string
      created_at: string
    }
    ```
  - [ ] 7.4 Modify `src/features/pin-detail/PinDetailSheet.tsx`:
    - Import `usePinPhotos` hook
    - Add a "Recent Photos" section below the description / above check-in history
    - Show up to 5 thumbnail images in a horizontal scroll row
    - Each thumbnail: 80×80px, rounded corners, `object-fit: cover`
    - Tapping a thumbnail opens the full `cdnUrl` in a new tab / lightbox view
    - If no photos exist, do not render the section (no empty state)

- [ ] Task 8: Supabase Storage bucket setup (AC: 4)
  - [ ] 8.1 Create migration file `supabase/migrations/024_create_pin_photos_storage_bucket.sql`:
    - NOTE: Supabase Storage buckets are typically created via the dashboard or Supabase CLI, not SQL migrations. This migration serves as documentation and can be run via Supabase management API.
    - Document the bucket configuration:
      ```sql
      -- Bucket: pin-photos
      -- Visibility: public (CDN-served, no auth required for reads)
      -- Max file size: 5MB
      -- Allowed MIME types: image/jpeg, image/png, image/heic
      -- File path convention: {pin_id}/{check_in_id}/{uuid}.jpg
      --
      -- Create via Supabase Dashboard > Storage > New Bucket:
      --   Name: pin-photos
      --   Public: true
      --   File size limit: 5242880 (5MB)
      --   Allowed MIME types: image/jpeg, image/png, image/heic
      --
      -- Or via Supabase CLI:
      --   supabase storage create pin-photos --public --file-size-limit 5242880
      --
      -- Storage policies (applied via Dashboard or API):
      -- Allow authenticated users to upload:
      INSERT INTO storage.policies (name, bucket_id, operation, definition)
      VALUES (
        'Authenticated users can upload pin photos',
        'pin-photos',
        'INSERT',
        '(auth.role() = ''authenticated'')'
      ) ON CONFLICT DO NOTHING;
      -- Allow public reads:
      INSERT INTO storage.policies (name, bucket_id, operation, definition)
      VALUES (
        'Public can read pin photos',
        'pin-photos',
        'SELECT',
        'true'
      ) ON CONFLICT DO NOTHING;
      ```

- [ ] Task 9: Create API tests for upload-url endpoint (AC: 4, 6)
  - [ ] 9.1 Create file `api/photos/upload-url.test.ts`:
    - Returns 405 for non-POST methods (GET, PUT, DELETE)
    - Returns 401 for missing/invalid JWT (mock `requireUserAuth` returning null)
    - Returns 400 for invalid body:
      - Missing pinId
      - Missing checkInId
      - Missing fileType
      - Invalid fileType (e.g., `image/gif`)
      - Non-UUID pinId/checkInId
    - Returns 200 with `{ uploadUrl, cdnUrl, storagePath }` on valid request
    - Returns 500 on Supabase Storage error
    - Verify storagePath follows pattern `{pinId}/{checkInId}/{uuid}.{ext}`
    - Verify cdnUrl includes the bucket name and storage path
    - Mock `createServiceClient` per existing patterns in `api/_supabase.test.ts`
    - Mock `requireUserAuth` per existing patterns in `api/_auth.test.ts`

- [ ] Task 10: Create client-side tests (AC: 1, 2, 3, 7, 9)
  - [ ] 10.1 Create file `src/lib/photoUpload.test.ts`:
    - `validateFile` returns null for valid JPEG/PNG/HEIC under 5MB
    - `validateFile` returns error string for invalid types (GIF, SVG, etc.)
    - `validateFile` returns error string for files over 5MB
    - `compressImage` calls `browser-image-compression` with correct options
    - `requestUploadUrl` sends correct POST body and auth header
    - `uploadToSignedUrl` uses XHR with progress tracking
    - `uploadToSignedUrl` retries once on network error
    - `uploadToSignedUrl` throws `PhotoUploadError` on second failure
  - [ ] 10.2 Update `src/features/check-in/CheckInForm.test.tsx`:
    - Add test: PhotoUpload component is rendered when user is authenticated
    - Add test: PhotoUpload component is NOT rendered when user is unauthenticated
    - Add test: PhotoUpload is disabled/hidden when offline
    - Add test: Check-in submits successfully without photo (existing behavior preserved)
    - Add test: Check-in submits with photo data when photo upload completes
    - Add test: Check-in mutation payload includes checkInId, photoCdnUrl, photoStoragePath when photo is attached
  - [ ] 10.3 Create file `src/hooks/usePhotoUpload.test.ts`:
    - Test state transitions: idle → compressing → uploading → success
    - Test state transitions: idle → compressing → uploading → error
    - Test retry re-enters uploading state
    - Test reset returns to idle
    - Test progress updates during upload

- [ ] Task 11: Update checkin API tests (AC: 5)
  - [ ] 11.1 Update `api/checkin.test.ts`:
    - Add test: accepts optional `checkInId`, `photoCdnUrl`, `photoStoragePath` fields
    - Add test: uses provided `checkInId` as the check-in row ID when present
    - Add test: inserts into `pin_photos` when photo fields are provided
    - Add test: check-in succeeds even if `pin_photos` insert fails (best-effort)
    - Add test: existing check-in behavior is unchanged when photo fields are absent

- [ ] Task 12: Final validation (all ACs)
  - [ ] 12.1 Run `npm run lint` — no new lint errors
  - [ ] 12.2 Run `npm run test -- --reporter=verbose` — all existing + new tests pass
  - [ ] 12.3 Run `npm run typecheck:api` — no type errors in API code
  - [ ] 12.4 Run `npm run build` — build succeeds

## Dev Notes

### Context Summary

This is the first story in Phase 2 Epic 5 (Community Contributions). It adds the ability for authenticated users to attach a single photo when submitting a check-in, giving the community a visual of the spot's current condition. The photo is compressed client-side, uploaded to Supabase Storage via a signed URL (bypassing the 4.5 MB Vercel function body limit), and the CDN URL is stored in the existing `pin_photos` table. Photos are displayed as thumbnails in the pin detail sheet.

Check-ins themselves remain anonymous (deviceId-based), but photo attachment requires authentication because the `pin_photos` table references `auth.users(id)`. The photo CTA is conditionally shown only to signed-in users. Stories 5.2 (Spot Submission Form) and 5.3 (Submission Status Tracking) build further community contribution features on top of this foundation.

### Current Repository Reality

**Database — `pin_photos` table (already exists via migration 022):**
```sql
CREATE TABLE IF NOT EXISTS pin_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_in_id UUID NOT NULL REFERENCES check_ins(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  cdn_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pin_photos_check_in_id ON pin_photos (check_in_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pin_photos_user_id ON pin_photos (user_id, created_at DESC);
-- RLS: public can read all; authenticated users can insert/update/delete their own
```

**Database — `check_ins` table (migration 002 + 006):**
```sql
CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'still_open' CHECK (status IN ('still_open', 'closed', 'changed')),
  notes TEXT,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Check-in form (`src/features/check-in/CheckInForm.tsx`):**
- Props: `{ pinId: string; onClose: () => void }`
- State: `status` (CheckInStatus | null), `note` (string), `errorMsg` (string | null)
- Uses hooks: `usePinsQuery`, `useDeviceId`, `useCheckInMutation`, `useOnlineStatus`
- Offline path: calls `appendPendingCheckin()` from `@/lib/offline/pendingCheckins`
- Renders: backdrop → dialog with status chips → textarea → offline banner → submit button → error
- NO photo infrastructure currently exists

**Check-in mutation (`src/hooks/useCheckInMutation.ts`):**
```typescript
export type CheckInStatus = 'still_open' | 'closed' | 'changed'
export interface CheckInPayload {
  pinId: string
  deviceId: string
  status: CheckInStatus
  note?: string
}
// Uses optimistic update on ['pins'] query cache
// POST to /api/checkin with { ...payload, timestamp }
```

**Check-in API (`api/checkin.ts`):**
- POST only, Zod validation, sanitizes HTML from notes
- Inserts into `check_ins` table (auto-generated UUID)
- Updates `pins` table (badge_state, last_check_in_at, recent_check_in_count)
- Fire-and-forget push notification
- Returns `200 { ok: true }`

**Pin Detail Sheet (`src/features/pin-detail/PinDetailSheet.tsx`):**
- Displays pin info, amenities, rig fit warnings, GPS coords, website/phone
- Has Get Directions CTA, Report an Issue, push notification toggle, bookmark
- NO photo gallery section currently exists

**Offline check-in queue (`src/lib/offline/pendingCheckins.ts`):**
```typescript
export interface PendingCheckIn {
  pinId: string; deviceId: string; status: CheckInStatus;
  note?: string; timestamp: string; queuedAt: string;
}
// Functions: readPendingCheckins, appendPendingCheckin, removePendingCheckin, clearPendingCheckins
// Uses localStorage key 'pendingCheckins'
```

**Auth middleware (`api/_auth.ts`):**
```typescript
export async function requireUserAuth(req: VercelRequest, res: VercelResponse): Promise<User | null>
// Extracts Bearer token, validates via supabase.auth.getUser()
// Returns User on success, sends 401 and returns null on failure
```

**Supabase client — server (`api/_supabase.ts`):**
```typescript
export function createServiceClient()
// Uses process.env.VITE_SUPABASE_URL + process.env.SUPABASE_SERVICE_ROLE_KEY
```

**Supabase client — browser (`src/lib/supabase/client.ts`):**
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
// Used for auth session checks: supabase.auth.getSession()
```

**DB types (`src/lib/supabase/types.ts`):**
- Has `DbPin`, `DbCheckIn`, `DbIssueReport`, `DbRigProfile`, `DbSavedSpot`, `DbTripPlan`, etc.
- Does NOT have `DbPinPhoto` yet — must be added

**Existing API directory structure:**
```
api/
├── checkin.ts / checkin.test.ts
├── report.ts / report.test.ts
├── _auth.ts / _auth.test.ts
├── _supabase.ts / _supabase.test.ts
├── _middleware.ts / _normalize.ts / _pushNotify.ts
├── admin/
├── auth/
├── pins/
├── push/    (vapid-key.ts, subscribe.ts, send.ts)
├── stripe/
├── photos/  ← NEW directory (create)
│   ├── upload-url.ts
│   └── upload-url.test.ts
```

**Existing hooks directory:**
```
src/hooks/
├── useCheckInMutation.ts     ← MODIFY (extend payload)
├── useDeviceId.ts
├── useGeolocation.ts
├── useOfflineCheckinQueue.ts
├── useOfflineMapDownload.ts
├── useOnlineStatus.ts
├── usePinsQuery.ts
├── usePushSubscription.ts
├── usePWAUpdate.ts
├── useReportMutation.ts
├── useSubscription.ts
├── usePhotoUpload.ts         ← NEW
├── usePinPhotos.ts           ← NEW
```

**Existing test patterns:**
- Vitest with `vi.mock()`, `vi.fn()`, `vi.hoisted()`
- `mockReq()` / `mockRes()` helpers for Vercel request/response
- React Testing Library for component tests
- Mock patterns: `vi.mock('../_supabase', ...)`, `vi.mock('../_auth', ...)`

### Architecture Guardrails

- **Components never upload directly to Supabase Storage.** Always request a signed URL from `/api/photos/upload-url` first, then PUT to that URL. [Source: architecture-phase2.md, Photo Upload Patterns]
- **`api/photos/upload-url.ts` is the ONLY place Supabase Storage upload URLs are issued.** [Source: architecture-phase2.md, Storage Boundaries]
- **`src/lib/photoUpload.ts` is the ONLY place the PUT upload is executed client-side.** [Source: architecture-phase2.md, Storage Boundaries]
- **Components only consume `cdnUrl` from `pin_photos` table — never construct Storage paths.** Use `<img src={photo.cdnUrl} />`. [Source: architecture-phase2.md, Photo Upload Patterns]
- **Always validate file type and size BEFORE requesting an upload URL** — client-side pre-validation. [Source: architecture-phase2.md, Photo Upload Patterns]
- **CDN URL stored in `pin_photos.cdn_url`** — components never construct Storage paths directly. [Source: architecture-phase2.md, Photo Storage]
- **Supabase Storage bucket: `pin-photos`** (public, CDN-served). File path: `{pin_id}/{checkin_id}/{uuid}.jpg`. Max 5MB enforced in `/api/photos/upload-url`. [Source: architecture-phase2.md, Photo Storage]
- **API error response format** — follow existing pattern: `{ error: "ERROR_CODE", message: "human-readable", status: <number> }`. [Source: existing API files]
- **Vercel Hobby tier** — minimize serverless function count. `api/photos/upload-url.ts` is one new function. [Source: architecture-phase2.md]
- **Photo upload is gated on authentication** — `POST /api/photos/upload-url` requires JWT. [Source: architecture-phase2.md, API Endpoints table]

### Implementation Notes For The Dev Agent

- **Pre-generated check-in UUID:** The check-in form generates a UUID upfront (`crypto.randomUUID()`) that serves as both the `check_in_id` for the Storage path and the actual check-in row ID. This is necessary because the photo upload happens BEFORE the check-in is submitted, so we need a stable ID. Modify the API insert to use this ID when provided: `.insert({ id: body.checkInId ?? crypto.randomUUID(), ... })`.
- **Photo upload bypasses Vercel body limit:** The signed URL approach is critical — the 4.5 MB Vercel request body limit means we cannot pipe files through the API. The client PUTs directly to Supabase Storage using the signed URL. Only the metadata (pinId, checkInId, fileType) goes through the API.
- **HEIC handling:** `browser-image-compression` handles HEIC → JPEG conversion. Set `fileType: 'image/jpeg'` in compression options to normalize all formats to JPEG before upload.
- **XHR for progress:** Use `XMLHttpRequest` (not `fetch`) in `uploadToSignedUrl` because the Fetch API does not support upload progress tracking. The progress callback feeds the `aria-valuenow` on the progress bar.
- **Auto-retry strategy:** On network error during PUT upload, retry once silently (same signed URL, same file). If the retry fails, surface the error UI. The signed URL has a limited TTL (default 60s from Supabase), so a quick retry is fine, but a delayed retry may need a new URL.
- **Offline photo discard:** Do NOT attempt to persist photos in localStorage for offline upload later — photo files are too large for localStorage (5 MB limit). Simply discard the photo with a user-facing message when offline. The `PendingCheckIn` interface is NOT modified — offline check-ins remain text-only.
- **Check-in remains anonymous:** The check-in insert itself still uses `device_id` (anonymous). Only the `pin_photos` insert requires `user_id` from the JWT. If the user is authenticated and attaches a photo, the API extracts the user ID from the JWT for the `pin_photos` row, but the `check_ins` row remains anonymous.
- **Best-effort photo storage:** If the `pin_photos` insert fails after a successful check-in insert, log the error but return `200 { ok: true }` — the check-in is the primary operation, the photo record is secondary. The photo file will exist in Storage (orphaned) but this is acceptable.
- **Pin Detail photo query:** Query `pin_photos` via the Supabase client (browser), joined through `check_ins.pin_id`. RLS allows public reads. Limit to 5 most recent photos, ordered by `created_at DESC`.
- **No new migration for schema:** The `pin_photos` table with all required columns, indexes, and RLS policies already exists from migration 022. The only infrastructure addition is the Supabase Storage bucket `pin-photos` which is configured via the dashboard or CLI (documented in migration 024).
- **`api/photos/` directory:** Create a new `photos/` subdirectory under `api/` following the same pattern as `api/push/` and `api/stripe/`. The file `upload-url.ts` maps to the route `POST /api/photos/upload-url`.

### Testing Requirements

- Minimum validation commands:
  - `npm run test` — all tests pass
  - `npm run typecheck:api` — no type errors in API code
  - `npm run lint` — no lint violations
  - `npm run build` — build succeeds
- Use `vitest` + existing mock patterns from `api/_auth.test.ts` and `api/checkin.test.ts`
- Mock `createServiceClient` and its storage methods for upload-url tests
- Mock `requireUserAuth` per existing patterns
- Mock `browser-image-compression` in client tests
- Mock `XMLHttpRequest` for upload progress tests
- Test all HTTP method guards (405 responses)
- Test auth failure paths (401 responses)
- Test validation failure paths (400 responses)
- Test success paths with expected return values
- Test offline behavior (photo CTA disabled, photo discarded on offline submit)
- Test that existing check-in tests pass unchanged when photo fields are absent
