import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('browser-image-compression', () => ({
  default: vi.fn().mockResolvedValue(
    new File(['compressed'], 'compressed.jpg', { type: 'image/jpeg' }),
  ),
}))

import {
  validateFile,
  compressImage,
  requestUploadUrl,
  uploadToSignedUrl,
  PhotoUploadError,
  ALLOWED_TYPES,
  MAX_FILE_SIZE_BYTES,
} from './photoUpload'

// ── Helpers ────────────────────────────────────────────────────────────────

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes)
  return new File([content], name, { type })
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('photoUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validateFile', () => {
    it('returns null for valid JPEG under 5MB', () => {
      const file = makeFile('photo.jpg', 'image/jpeg', 1024 * 1024)
      expect(validateFile(file)).toBeNull()
    })

    it('returns null for valid PNG under 5MB', () => {
      const file = makeFile('photo.png', 'image/png', 1024 * 1024)
      expect(validateFile(file)).toBeNull()
    })

    it('returns null for valid HEIC under 5MB', () => {
      const file = makeFile('photo.heic', 'image/heic', 1024 * 1024)
      expect(validateFile(file)).toBeNull()
    })

    it('returns error string for GIF', () => {
      const file = makeFile('photo.gif', 'image/gif', 1024)
      expect(validateFile(file)).toBe('Photo must be JPEG, PNG, or HEIC and under 5MB')
    })

    it('returns error string for SVG', () => {
      const file = makeFile('image.svg', 'image/svg+xml', 1024)
      expect(validateFile(file)).toBe('Photo must be JPEG, PNG, or HEIC and under 5MB')
    })

    it('returns error string for files over 5MB', () => {
      const file = makeFile('photo.jpg', 'image/jpeg', MAX_FILE_SIZE_BYTES + 1)
      expect(validateFile(file)).toBe('Photo must be JPEG, PNG, or HEIC and under 5MB')
    })

    it('exports correct ALLOWED_TYPES', () => {
      expect(ALLOWED_TYPES).toEqual(['image/jpeg', 'image/png', 'image/heic'])
    })
  })

  describe('compressImage', () => {
    it('calls browser-image-compression with correct options', async () => {
      const imageCompression = (await import('browser-image-compression')).default
      const file = makeFile('photo.jpg', 'image/jpeg', 1024)
      await compressImage(file)
      expect(imageCompression).toHaveBeenCalledWith(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/jpeg',
      })
    })
  })

  describe('requestUploadUrl', () => {
    it('sends correct POST body and auth header', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ uploadUrl: 'https://url', cdnUrl: 'https://cdn', storagePath: 'path/file.jpg' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const params = { pinId: 'pin-1', checkInId: 'ci-1', fileType: 'image/jpeg' }
      const result = await requestUploadUrl(params, 'my-token')

      expect(mockFetch).toHaveBeenCalledWith('/api/photos/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer my-token',
        },
        body: JSON.stringify(params),
      })
      expect(result).toEqual({ uploadUrl: 'https://url', cdnUrl: 'https://cdn', storagePath: 'path/file.jpg' })

      vi.unstubAllGlobals()
    })

    it('throws PhotoUploadError on non-200 response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Bad request' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      await expect(requestUploadUrl({ pinId: 'p', checkInId: 'c', fileType: 'image/jpeg' }, 'tok'))
        .rejects.toThrow('Bad request')

      vi.unstubAllGlobals()
    })
  })

  describe('uploadToSignedUrl', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    function createXHRMock(onSend: (instance: Record<string, unknown>) => void) {
      const XHRClass = function (this: Record<string, unknown>) {
        this.open = vi.fn()
        this.setRequestHeader = vi.fn()
        this.upload = { onprogress: null }
        this.onload = null
        this.onerror = null
        this.status = 0
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this
        this.send = vi.fn(() => onSend(self))
      } as unknown as typeof XMLHttpRequest
      vi.stubGlobal('XMLHttpRequest', XHRClass)
    }

    it('uses XHR with progress tracking', async () => {
      const progressFn = vi.fn()
      const file = makeFile('photo.jpg', 'image/jpeg', 1024)

      createXHRMock((instance) => {
        const upload = instance.upload as { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null }
        upload.onprogress?.({ lengthComputable: true, loaded: 512, total: 1024 })
        instance.status = 200
        ;(instance.onload as (() => void))?.()
      })

      await uploadToSignedUrl('https://signed-url', file, progressFn).promise
      expect(progressFn).toHaveBeenCalledWith(50)
    })

    it('retries once on network error then succeeds', async () => {
      const file = makeFile('photo.jpg', 'image/jpeg', 1024)
      let callCount = 0

      createXHRMock((instance) => {
        callCount++
        if (callCount === 1) {
          ;(instance.onerror as (() => void))?.()
        } else {
          instance.status = 200
          ;(instance.onload as (() => void))?.()
        }
      })

      await uploadToSignedUrl('https://signed-url', file).promise
      expect(callCount).toBe(2)
    })

    it('throws PhotoUploadError on second failure', async () => {
      const file = makeFile('photo.jpg', 'image/jpeg', 1024)

      createXHRMock((instance) => {
        ;(instance.onerror as (() => void))?.()
      })

      await expect(uploadToSignedUrl('https://signed-url', file).promise)
        .rejects.toThrow(PhotoUploadError)
    })
  })
})
