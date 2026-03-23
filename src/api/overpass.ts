// Client-side wrapper for GET /api/overpass — never calls Overpass directly (NFR-I2, AC3)

export interface OverpassResponse {
  elements: Array<{
    type: 'node' | 'way' | 'relation'
    id: number
    lat?: number
    lon?: number
    tags?: Record<string, string>
  }>
}

export async function fetchOverpassData(bbox: string): Promise<OverpassResponse> {
  const res = await fetch(`/api/overpass?bbox=${encodeURIComponent(bbox)}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { message?: string }).message ?? `Overpass proxy error ${res.status}`)
  }
  return res.json() as Promise<OverpassResponse>
}
