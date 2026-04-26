import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdminAuth } from './_middleware'
import { classifyImageUrl } from './_sagemaker'
import { createServiceClient } from './_supabase'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Confidence threshold for auto-publishing a water tap pin (FR42) */
export const CONFIDENCE_THRESHOLD = 0.75

/** Delay between external API calls to respect published rate limits (NFR-ML4) */
export const RATE_LIMIT_DELAY_MS = 200

/** Maximum photos fetched per location (FR40) */
export const MAX_PHOTOS_PER_LOCATION = 5

/** Maximum locations per invocation — enforces an upper safety cap on the limit param */
export const MAX_LOCATIONS_PER_INVOCATION = 200

/**
 * device_id written to tap_verification_events for ML batch scan rows.
 * Distinguishes batch-pipeline events from user-submitted events.
 */
export const ML_BATCH_DEVICE_ID = 'ml_batch_cron'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BBox {
  north: number
  south: number
  east: number
  west: number
}

export interface OverpassNode {
  id: number
  type: string
  lat: number
  lon: number
  tags?: Record<string, string>
}

export interface ScanResult {
  processed: number
  created: number
  updated: number
  skipped: number
  nextOffset: number
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Delay between external API calls to respect rate limits (NFR-ML4).
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Build the Overpass QL query for ML scan locations within a bounding box.
 * Targets: amenity=fuel, amenity=campsite, tourism=camp_site (FR39).
 */
export function buildMlScanOverpassQuery(bbox: BBox): string {
  const { south, west, north, east } = bbox
  return `[out:json][timeout:60];
(
  node["amenity"="fuel"](${south},${west},${north},${east});
  node["amenity"="campsite"](${south},${west},${north},${east});
  node["tourism"="camp_site"](${south},${west},${north},${east});
);
out body;`
}

/**
 * Server-side fetch of Overpass API locations within the bounding box (FR39).
 * No client-to-Overpass calls occur (NFR-I2).
 */
export async function fetchOverpassLocations(bbox: BBox): Promise<OverpassNode[]> {
  const query = buildMlScanOverpassQuery(bbox)
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(90000),
  })
  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`)
  }
  const data = (await response.json()) as { elements?: OverpassNode[] }
  return (data.elements ?? []).filter(el => el.type === 'node')
}

/**
 * Fetch up to 5 street-level photos from Mapillary for a location (FR40).
 * Returns empty array on rate-limit (429) or missing token — skip + log, no failure.
 */
export async function fetchMapillaryPhotos(lat: number, lon: number): Promise<string[]> {
  const token = process.env.MAPILLARY_ACCESS_TOKEN
  if (!token) return []

  // ~50m bounding box around the location
  const delta = 0.0005
  const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`

  try {
    const url = `https://graph.mapillary.com/images?access_token=${token}&fields=id,thumb_original_url&bbox=${bbox}&limit=${MAX_PHOTOS_PER_LOCATION}`
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) })

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('[ml-scan] Mapillary rate limit (429) — skipping location')
        return []
      }
      console.warn(`[ml-scan] Mapillary API error: ${response.status}`)
      return []
    }

    const data = (await response.json()) as { data?: Array<{ thumb_original_url?: string }> }
    return (data.data ?? [])
      .map(img => img.thumb_original_url)
      .filter((u): u is string => typeof u === 'string')
      .slice(0, MAX_PHOTOS_PER_LOCATION)
  } catch (err) {
    console.warn('[ml-scan] Mapillary fetch failed:', err)
    return []
  }
}

/**
 * Fetch up to 5 photos from Google Places API for a location (FR40 fallback).
 * Returns empty array on rate-limit (429) or missing key — skip + log, no failure.
 */
export async function fetchGooglePlacesPhotos(lat: number, lon: number): Promise<string[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return []

  try {
    const searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=50&key=${apiKey}`
    const searchResponse = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) })

    if (!searchResponse.ok) {
      if (searchResponse.status === 429) {
        console.warn('[ml-scan] Google Places rate limit (429) — skipping location')
        return []
      }
      console.warn(`[ml-scan] Google Places search error: ${searchResponse.status}`)
      return []
    }

    const searchData = (await searchResponse.json()) as {
      results?: Array<{ photos?: Array<{ photo_reference: string }> }>
    }
    const places = (searchData.results ?? []).slice(0, 2)

    const photoUrls: string[] = []
    for (const place of places) {
      for (const photo of (place.photos ?? [])) {
        if (photoUrls.length >= MAX_PHOTOS_PER_LOCATION) break
        const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${apiKey}`
        photoUrls.push(photoUrl)
      }
      if (photoUrls.length >= MAX_PHOTOS_PER_LOCATION) break
    }
    return photoUrls
  } catch (err) {
    console.warn('[ml-scan] Google Places fetch failed:', err)
    return []
  }
}

/**
 * Fetch up to 5 photos for a location: Mapillary first, Google Places fallback (FR40).
 * Applies rate-limit delay only when an API call was actually attempted (NFR-ML4).
 */
export async function fetchPhotosForLocation(lat: number, lon: number): Promise<string[]> {
  const mapillaryPhotos = await fetchMapillaryPhotos(lat, lon)
  // Only delay if an actual Mapillary API call was made (token configured)
  if (process.env.MAPILLARY_ACCESS_TOKEN) await delay(RATE_LIMIT_DELAY_MS)

  if (mapillaryPhotos.length >= MAX_PHOTOS_PER_LOCATION) {
    return mapillaryPhotos
  }

  const remaining = MAX_PHOTOS_PER_LOCATION - mapillaryPhotos.length
  const googlePhotos = await fetchGooglePlacesPhotos(lat, lon)
  // Only delay if an actual Google Places API call was made (key configured)
  if (process.env.GOOGLE_PLACES_API_KEY) await delay(RATE_LIMIT_DELAY_MS)

  return [...mapillaryPhotos, ...googlePhotos.slice(0, remaining)]
}

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * POST /api/ml-scan
 *
 * Admin-protected chunked ML batch scan endpoint.
 *
 * Pipeline:
 *   1. Validate Bearer token (NFR-S5)
 *   2. Check precision gate (NFR-ML2)
 *   3. Parse bbox + offset/limit
 *   4. Fetch Overpass locations (FR39)
 *   5. For each location: fetch photos (FR40) → classify (FR41) → upsert if ≥0.75 (FR42–FR44)
 *   6. Return { processed, created, updated, skipped, nextOffset }
 *
 * All credentials read from server-side process.env only — never VITE_ prefixed (NFR-ML5).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── Method guard ────────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only', status: 405 })
  }

  // ── AC 1: Bearer token authorization (NFR-S5) ───────────────────────────────
  if (!requireAdminAuth(req, res)) return

  // ── AC 10: Precision gate (NFR-ML2) ────────────────────────────────────────
  if (process.env.PRECISION_GATE_PASSED !== 'true') {
    return res.status(403).json({
      error: 'PRECISION_GATE_BLOCKED',
      message: 'Model precision below 80% threshold — production scan disabled',
    })
  }

  // ── AC 7: Parse offset/limit ────────────────────────────────────────────────
  const rawOffset = Array.isArray(req.query.offset) ? req.query.offset[0] : (req.query.offset ?? '0')
  const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : (req.query.limit ?? '50')
  const offset = Math.max(0, parseInt(rawOffset) || 0)
  // Cap limit at MAX_LOCATIONS_PER_INVOCATION to prevent runaway requests
  const limit = Math.min(MAX_LOCATIONS_PER_INVOCATION, Math.max(1, parseInt(rawLimit) || 50))

  // ── AC 2: Parse and validate bbox ──────────────────────────────────────────
  const body = req.body as { bbox?: BBox } | undefined
  const bbox = body?.bbox

  if (
    !bbox ||
    typeof bbox.north !== 'number' ||
    typeof bbox.south !== 'number' ||
    typeof bbox.east !== 'number' ||
    typeof bbox.west !== 'number'
  ) {
    return res.status(400).json({
      error: 'INVALID_BBOX',
      message: 'Request body must contain { bbox: { north, south, east, west } } with numeric values',
    })
  }

  try {
    // ── AC 2: FR39 — Overpass enumeration ──────────────────────────────────────
    const allLocations = await fetchOverpassLocations(bbox)

    // Slice the offset/limit window
    const windowLocations = allLocations.slice(offset, offset + limit)

    const supabase = createServiceClient()
    let created = 0
    let updated = 0
    let skipped = 0

    // ── AC 3–6: Process each location ──────────────────────────────────────────
    for (const location of windowLocations) {
      try {
        // AC 3: Fetch up to 5 photos (Mapillary → Google Places fallback)
        const photos = await fetchPhotosForLocation(location.lat, location.lon)

        if (photos.length === 0) {
          skipped++
          continue
        }

        // AC 4: Classify each photo via SageMaker; track highest confidence
        let highestConfidence = 0
        let highestPhotoUrl = ''
        let highestPhotoIsSafe = false  // true if URL does not contain API credentials

        for (const photoUrl of photos) {
          try {
            await delay(RATE_LIMIT_DELAY_MS) // NFR-ML4: rate limit delay before SageMaker call
            const { confidence } = await classifyImageUrl(photoUrl)
            // Clamp to [0, 1] before any comparison/storage (DB CHECK constraint requires this)
            const safeConfidence = Math.min(1.0, Math.max(0.0, confidence))
            if (safeConfidence > highestConfidence) {
              highestConfidence = safeConfidence
              highestPhotoUrl = photoUrl
              // Google Places photo URLs embed the API key — safe only for server-side classification,
              // never for persistent storage or client exposure (security fix: CR-6.5-1)
              highestPhotoIsSafe = !photoUrl.includes('maps.googleapis.com/maps/api/place/photo')
            }
          } catch (err) {
            console.warn('[ml-scan] SageMaker classify error for photo:', photoUrl, err)
          }
        }

        // AC 6: Skip if no photo meets threshold
        if (highestConfidence < CONFIDENCE_THRESHOLD) {
          skipped++
          continue
        }

        // URL stored in DB: only safe (non-credential-bearing) URLs; Google Places used for
        // classification only — pin is created without a stored photo URL in that case.
        const storedPhotoUrl = highestPhotoIsSafe ? highestPhotoUrl : ''

        // Resolve place metadata from OSM tags
        const tags = location.tags ?? {}
        const placeName =
          tags.name ?? tags['addr:housename'] ?? `OSM Node ${location.id}`
        const placeType: 'gas_station' | 'campground' | 'restaurant' =
          tags.amenity === 'campsite' || tags.tourism === 'camp_site' ? 'campground' : 'gas_station'
        const placeRef = `osm:node:${location.id}` // FR44: business location linking

        // AC 5: Upsert water_tap_pins (FR42, FR43, FR44)
        const { data: existing } = await supabase
          .from('water_tap_pins')
          .select('id, photos')
          .eq('place_ref', placeRef)
          .maybeSingle()

        if (existing) {
          // Update existing pin — append new photo URL if not already present
          const existingPhotos = (existing.photos as string[]) ?? []
          const updatedPhotos = storedPhotoUrl
            ? Array.from(new Set([...existingPhotos, storedPhotoUrl]))
            : existingPhotos

          await supabase
            .from('water_tap_pins')
            .update({
              confidence: highestConfidence,
              photos: updatedPhotos,
              updated_at: new Date().toISOString(),
              verified_date: new Date().toISOString(),
            })
            .eq('id', existing.id as string)

          await supabase.from('tap_verification_events').insert({
            tap_pin_id: existing.id,
            device_id: ML_BATCH_DEVICE_ID,
            event_type: 'ml_scan',
            confidence: highestConfidence,
            photo_url: storedPhotoUrl || null,
          })

          updated++
        } else {
          // Create new pin — access is NULL (unverified at creation per FR43)
          const { data: newPin } = await supabase
            .from('water_tap_pins')
            .insert({
              location: `SRID=4326;POINT(${location.lon} ${location.lat})`,
              place_name: placeName,
              place_type: placeType,
              access: null,
              confidence: highestConfidence,
              source: 'ml_batch',
              photos: storedPhotoUrl ? [storedPhotoUrl] : [],
              place_ref: placeRef,
              verified_date: new Date().toISOString(),
            })
            .select('id')
            .single()

          if (newPin) {
            await supabase.from('tap_verification_events').insert({
              tap_pin_id: newPin.id,
              device_id: ML_BATCH_DEVICE_ID,
              event_type: 'ml_scan',
              confidence: highestConfidence,
              photo_url: storedPhotoUrl || null,
            })
          }

          created++
        }
      } catch (err) {
        console.error('[ml-scan] Error processing location:', location.id, err)
        skipped++
      }
    }

    // AC 7: Return chunked response
    const result: ScanResult = {
      processed: windowLocations.length,
      created,
      updated,
      skipped,
      nextOffset: offset + limit,
    }

    return res.status(200).json(result)
  } catch (err) {
    console.error('[ml-scan] Pipeline error:', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'ML scan pipeline failed', status: 500 })
  }
}
