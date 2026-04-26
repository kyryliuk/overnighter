import formidable = require('formidable')
import * as fs from 'fs'
import type { VercelRequest } from '@vercel/node'

/** Parsed result from a tap-submit multipart/form-data request. */
export interface TapSubmitFormData {
  /** Raw photo bytes */
  photoBuffer: Buffer
  /** MIME type of the photo (e.g. 'image/jpeg') */
  mimeType: string
  /** Size of the photo in bytes */
  sizeBytes: number
  /** Original filename, if provided by the client */
  originalFilename: string | null
  /** [latitude, longitude] submitted by the client */
  location: [number, number]
  /** Device identifier submitted by the client */
  deviceId: string
}

/**
 * Parse a multipart/form-data request from the tap-submit endpoint.
 *
 * Expected fields:
 *   - photo     — File (required)
 *   - location  — JSON string "[lat, lng]" (required)
 *   - deviceId  — string (required)
 *
 * @throws {Error} If required fields are missing or malformed.
 */
export async function parseTapSubmitForm(req: VercelRequest): Promise<TapSubmitFormData> {
  const form = formidable({
    // NOTE: We deliberately do NOT set maxFileSize here.
    // File size validation is performed explicitly in the handler (tap-submit.ts)
    // so that the correct INVALID_FILE error code is returned to the caller.
    // If formidable's maxFileSize threw here, the handler would return INVALID_BODY
    // instead of the AC 2-required INVALID_FILE error.
    //
    // formidable writes uploaded files to the OS temp directory by default.
    // After parsing, we read the bytes from photoFile.filepath.
  })

  return new Promise((resolve, reject) => {
    form.parse(req as Parameters<typeof form.parse>[0], (err, fields, files) => {
      if (err) {
        reject(err)
        return
      }

      // Extract photo file
      const rawPhoto = files['photo']
      const photoFile = Array.isArray(rawPhoto) ? rawPhoto[0] : rawPhoto
      if (!photoFile) {
        reject(new Error('Missing photo field in multipart form'))
        return
      }

      // Extract raw bytes — formidable writes to OS temp dir by default.
      // filepath is the path to the temp file created by formidable.
      let photoBuffer: Buffer
      try {
        photoBuffer = fs.readFileSync(photoFile.filepath)
      } catch (readErr) {
        reject(new Error(`Failed to read uploaded file: ${readErr}`))
        return
      }

      // Extract text fields (formidable v3 returns arrays for all fields)
      const rawLocation = Array.isArray(fields['location'])
        ? fields['location'][0]
        : fields['location']
      const rawDeviceId = Array.isArray(fields['deviceId'])
        ? fields['deviceId'][0]
        : fields['deviceId']

      if (!rawLocation || !rawDeviceId) {
        reject(new Error('Missing required fields: location and deviceId'))
        return
      }

      let location: [number, number]
      try {
        const parsed = JSON.parse(rawLocation) as unknown
        if (
          !Array.isArray(parsed) ||
          parsed.length !== 2 ||
          typeof parsed[0] !== 'number' ||
          typeof parsed[1] !== 'number'
        ) {
          throw new Error('location must be [lat, lng] number array')
        }
        location = [parsed[0] as number, parsed[1] as number]
      } catch (parseErr) {
        reject(new Error(`Invalid location format: ${parseErr}`))
        return
      }

      resolve({
        photoBuffer,
        mimeType: photoFile.mimetype ?? 'application/octet-stream',
        sizeBytes: photoFile.size,
        originalFilename: photoFile.originalFilename,
        location,
        deviceId: rawDeviceId,
      })
    })
  })
}
