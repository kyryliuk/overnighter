import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockValidateFile, mockCompressImage, mockRequestUploadUrl, mockUploadToSignedUrl } = vi.hoisted(() => ({
  mockValidateFile: vi.fn().mockReturnValue(null),
  mockCompressImage: vi.fn().mockResolvedValue(new File(['compressed'], 'compressed.jpg', { type: 'image/jpeg' })),
  mockRequestUploadUrl: vi.fn().mockResolvedValue({
    uploadUrl: 'https://signed-url',
    cdnUrl: 'https://cdn/photo.jpg',
    storagePath: 'pin/ci/uuid.jpg',
  }),
  mockUploadToSignedUrl: vi.fn().mockReturnValue({ promise: Promise.resolve(), abort: vi.fn() }),
}))

vi.mock('@/lib/photoUpload', () => ({
  validateFile: mockValidateFile,
  compressImage: mockCompressImage,
  requestUploadUrl: mockRequestUploadUrl,
  uploadToSignedUrl: mockUploadToSignedUrl,
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-jwt-token' } },
      }),
    },
  },
}))

// Mock URL.createObjectURL
vi.stubGlobal('URL', {
  ...globalThis.URL,
  createObjectURL: vi.fn().mockReturnValue('blob:preview-url'),
})

import { usePhotoUpload } from './usePhotoUpload'

// ── Helpers ────────────────────────────────────────────────────────────────

function makeFile(): File {
  return new File(['test'], 'test.jpg', { type: 'image/jpeg' })
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('usePhotoUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateFile.mockReturnValue(null)
    mockCompressImage.mockResolvedValue(new File(['compressed'], 'compressed.jpg', { type: 'image/jpeg' }))
    mockRequestUploadUrl.mockResolvedValue({
      uploadUrl: 'https://signed-url',
      cdnUrl: 'https://cdn/photo.jpg',
      storagePath: 'pin/ci/uuid.jpg',
    })
    mockUploadToSignedUrl.mockReturnValue({ promise: Promise.resolve(), abort: vi.fn() })
  })

  it('starts in idle state', () => {
    const { result } = renderHook(() => usePhotoUpload())
    expect(result.current.state).toBe('idle')
    expect(result.current.progress).toBe(0)
    expect(result.current.thumbnailUrl).toBeNull()
    expect(result.current.errorMessage).toBeNull()
  })

  it('transitions idle → compressing → uploading → success', async () => {
    const { result } = renderHook(() => usePhotoUpload())

    await act(async () => {
      await result.current.startUpload(makeFile(), 'pin-1', 'ci-1')
    })

    expect(result.current.state).toBe('success')
    expect(result.current.cdnUrl).toBe('https://cdn/photo.jpg')
    expect(result.current.storagePath).toBe('pin/ci/uuid.jpg')
    expect(result.current.thumbnailUrl).toBe('blob:preview-url')
    expect(result.current.progress).toBe(100)
  })

  it('transitions to error state on validation failure', async () => {
    mockValidateFile.mockReturnValue('File too large')
    const { result } = renderHook(() => usePhotoUpload())

    await act(async () => {
      await result.current.startUpload(makeFile(), 'pin-1', 'ci-1')
    })

    expect(result.current.state).toBe('error')
    expect(result.current.errorMessage).toBe('File too large')
  })

  it('transitions to error state on upload failure', async () => {
    mockUploadToSignedUrl.mockReturnValue({ promise: Promise.reject(new Error('Network error')), abort: vi.fn() })
    const { result } = renderHook(() => usePhotoUpload())

    await act(async () => {
      await result.current.startUpload(makeFile(), 'pin-1', 'ci-1')
    })

    expect(result.current.state).toBe('error')
    expect(result.current.errorMessage).toBe('Network error')
  })

  it('retry re-enters uploading state and can succeed', async () => {
    mockUploadToSignedUrl.mockReturnValueOnce({ promise: Promise.reject(new Error('Network error')), abort: vi.fn() })
    const { result } = renderHook(() => usePhotoUpload())

    await act(async () => {
      await result.current.startUpload(makeFile(), 'pin-1', 'ci-1')
    })
    expect(result.current.state).toBe('error')

    mockUploadToSignedUrl.mockReturnValue({ promise: Promise.resolve(), abort: vi.fn() })
    await act(async () => {
      await result.current.retry()
    })
    expect(result.current.state).toBe('success')
  })

  it('reset returns to idle', async () => {
    const { result } = renderHook(() => usePhotoUpload())

    await act(async () => {
      await result.current.startUpload(makeFile(), 'pin-1', 'ci-1')
    })
    expect(result.current.state).toBe('success')

    act(() => {
      result.current.reset()
    })
    expect(result.current.state).toBe('idle')
    expect(result.current.cdnUrl).toBeNull()
    expect(result.current.storagePath).toBeNull()
    expect(result.current.thumbnailUrl).toBeNull()
  })

  it('tracks progress during upload', async () => {
    mockUploadToSignedUrl.mockImplementation((_url: string, _file: File, onProgress?: (pct: number) => void) => {
      onProgress?.(50)
      onProgress?.(100)
      return { promise: Promise.resolve(), abort: vi.fn() }
    })

    const { result } = renderHook(() => usePhotoUpload())

    await act(async () => {
      await result.current.startUpload(makeFile(), 'pin-1', 'ci-1')
    })

    // After completion, progress should be 100
    expect(result.current.progress).toBe(100)
  })
})
