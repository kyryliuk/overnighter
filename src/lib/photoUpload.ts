import imageCompression from 'browser-image-compression'

export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic'] as const
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB raw input limit
export const MAX_COMPRESSED_SIZE_MB = 1 // 1 MB post-compression target

export class PhotoUploadError extends Error {
  retryable: boolean
  constructor(message: string, retryable: boolean) {
    super(message)
    this.name = 'PhotoUploadError'
    this.retryable = retryable
  }
}

export function validateFile(file: File): string | null {
  if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return 'Photo must be JPEG, PNG, or HEIC and under 5MB'
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'Photo must be JPEG, PNG, or HEIC and under 5MB'
  }
  return null
}

export async function compressImage(file: File): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: MAX_COMPRESSED_SIZE_MB,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/jpeg',
  })
}

export async function requestUploadUrl(
  params: { pinId: string; checkInId: string; fileType: string },
  token: string,
): Promise<{ uploadUrl: string; cdnUrl: string; storagePath: string }> {
  const resp = await fetch('/api/photos/upload-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new PhotoUploadError(
      (err as { message?: string }).message ?? 'Failed to get upload URL',
      false,
    )
  }

  return resp.json() as Promise<{ uploadUrl: string; cdnUrl: string; storagePath: string }>
}

export interface UploadHandle {
  promise: Promise<void>
  abort: () => void
}

export function uploadToSignedUrl(
  uploadUrl: string,
  file: File,
  onProgress?: (pct: number) => void,
): UploadHandle {
  let activeXhr: XMLHttpRequest | null = null

  const promise = new Promise<void>((resolve, reject) => {
    let retried = false

    function attempt() {
      const xhr = new XMLHttpRequest()
      activeXhr = xhr

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          activeXhr = null
          resolve()
        } else {
          if (!retried) {
            retried = true
            attempt()
          } else {
            activeXhr = null
            reject(new PhotoUploadError('Photo upload failed — tap to retry', true))
          }
        }
      }

      xhr.onerror = () => {
        if (!retried) {
          retried = true
          attempt()
        } else {
          activeXhr = null
          reject(new PhotoUploadError('Photo upload failed — tap to retry', true))
        }
      }

      xhr.open('PUT', uploadUrl)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.send(file)
    }

    attempt()
  })

  return {
    promise,
    abort: () => {
      if (activeXhr) {
        activeXhr.abort()
        activeXhr = null
      }
    },
  }
}
