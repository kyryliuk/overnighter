import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  validateFile,
  compressImage,
  requestUploadUrl,
  uploadToSignedUrl,
  type UploadHandle,
} from '@/lib/photoUpload'

export type UploadState = 'idle' | 'compressing' | 'uploading' | 'success' | 'error'

interface PhotoUploadState {
  state: UploadState
  progress: number
  thumbnailUrl: string | null
  errorMessage: string | null
  cdnUrl: string | null
  storagePath: string | null
}

export function usePhotoUpload() {
  const [uploadState, setUploadState] = useState<PhotoUploadState>({
    state: 'idle',
    progress: 0,
    thumbnailUrl: null,
    errorMessage: null,
    cdnUrl: null,
    storagePath: null,
  })

  const lastFileRef = useRef<File | null>(null)
  const lastPinIdRef = useRef<string>('')
  const lastCheckInIdRef = useRef<string>('')
  const uploadHandleRef = useRef<UploadHandle | null>(null)

  // Abort active upload on unmount
  useEffect(() => {
    return () => {
      uploadHandleRef.current?.abort()
    }
  }, [])

  const startUpload = useCallback(async (file: File, pinId: string, checkInId: string) => {
    lastFileRef.current = file
    lastPinIdRef.current = pinId
    lastCheckInIdRef.current = checkInId

    const validationError = validateFile(file)
    if (validationError) {
      setUploadState({
        state: 'error',
        progress: 0,
        thumbnailUrl: null,
        errorMessage: validationError,
        cdnUrl: null,
        storagePath: null,
      })
      return
    }

    try {
      // Compress
      setUploadState((s) => ({ ...s, state: 'compressing', progress: 0, errorMessage: null }))
      const compressed = await compressImage(file)

      // Get JWT
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        setUploadState({
          state: 'error',
          progress: 0,
          thumbnailUrl: null,
          errorMessage: 'You must be signed in to upload photos',
          cdnUrl: null,
          storagePath: null,
        })
        return
      }

      // Request signed URL
      setUploadState((s) => ({ ...s, state: 'uploading', progress: 0 }))
      const { uploadUrl, cdnUrl, storagePath } = await requestUploadUrl(
        { pinId, checkInId, fileType: compressed.type },
        token,
      )

      // Upload
      const handle = uploadToSignedUrl(uploadUrl, compressed, (pct) => {
        setUploadState((s) => ({ ...s, progress: pct }))
      })
      uploadHandleRef.current = handle
      await handle.promise
      uploadHandleRef.current = null

      // Success
      const thumbnailUrl = URL.createObjectURL(compressed)
      setUploadState({
        state: 'success',
        progress: 100,
        thumbnailUrl,
        errorMessage: null,
        cdnUrl,
        storagePath,
      })
    } catch (err) {
      setUploadState({
        state: 'error',
        progress: 0,
        thumbnailUrl: null,
        errorMessage: err instanceof Error ? err.message : 'Photo upload failed — tap to retry',
        cdnUrl: null,
        storagePath: null,
      })
    }
  }, [])

  const retry = useCallback(async () => {
    if (lastFileRef.current && lastPinIdRef.current && lastCheckInIdRef.current) {
      await startUpload(lastFileRef.current, lastPinIdRef.current, lastCheckInIdRef.current)
    }
  }, [startUpload])

  const reset = useCallback(() => {
    setUploadState({
      state: 'idle',
      progress: 0,
      thumbnailUrl: null,
      errorMessage: null,
      cdnUrl: null,
      storagePath: null,
    })
    lastFileRef.current = null
  }, [])

  return {
    ...uploadState,
    startUpload,
    retry,
    reset,
  }
}
