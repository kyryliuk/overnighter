import { useState, useEffect } from 'react'
import { useGeolocation } from '@/hooks/useGeolocation'

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

interface SearchBarProps {
  mapRef: React.RefObject<unknown>
}

// NOTE: For production, proxy Nominatim via /api/geocode to respect usage policy
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

const GEO_ERROR_MESSAGES: Record<string, string> = {
  denied: 'Location access denied \u2014 search for a place to get started',
  'no-api': 'Location not available \u2014 search for a place instead',
  unavailable: 'Could not get location \u2014 try again or search for a place',
}

export default function SearchBar({ mapRef }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [geoError, setGeoError] = useState<string | null>(null)
  const [geoState, requestGeo] = useGeolocation()

  // React to geolocation state changes
  useEffect(() => {
    if (geoState.coords) {
      const { latitude, longitude } = geoState.coords
      const map = mapRef.current as { setView?: (center: [number, number], zoom: number) => void } | null
      map?.setView?.([latitude, longitude], 12)
      setGeoError(null)
    }
    if (geoState.error) {
      setGeoError(GEO_ERROR_MESSAGES[geoState.error] ?? 'Location error')
    }
  }, [geoState, mapRef])

  // Debounced Nominatim search
  useEffect(() => {
    if (query.length < 3) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=5`,
          { headers: { Accept: 'application/json' } },
        )
        if (!res.ok) throw new Error('search failed')
        const data: NominatimResult[] = await res.json()
        setResults(data)
      } catch {
        setResults([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  function selectResult(result: NominatimResult) {
    const map = mapRef.current as { setView?: (center: [number, number], zoom: number) => void } | null
    map?.setView?.([parseFloat(result.lat), parseFloat(result.lon)], 12)
    setQuery(result.display_name.split(', ')[0])
    setResults([])
  }

  function handleNearMe() {
    setGeoError(null)
    requestGeo()
  }

  function handleClear() {
    setQuery('')
    setResults([])
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="search"
            role="combobox"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search destination..."
            className="w-full bg-surface border border-border rounded-full px-4 py-2 pr-10 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            aria-label="Search destination"
            aria-autocomplete="list"
            aria-controls="search-results"
            aria-expanded={results.length > 0}
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground min-w-[24px] min-h-[24px]"
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleNearMe}
          disabled={geoState.isLoading}
          className="bg-surface border border-border rounded-full px-4 py-2 text-sm text-foreground min-h-[44px] whitespace-nowrap disabled:opacity-50"
          aria-label={geoState.isLoading ? 'Getting location...' : 'Use my current location'}
        >
          {geoState.isLoading ? '...' : '\ud83d\udccd Near Me'}
        </button>
      </div>

      {geoError && (
        <p className="text-sm text-muted-foreground mt-1 px-2" role="alert">
          {geoError}
        </p>
      )}

      {results.length > 0 && (
        <ul
          id="search-results"
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg overflow-hidden z-20 shadow-lg"
        >
          {results.map((result, idx) => (
            <li key={`${result.lat}-${result.lon}-${idx}`} role="option">
              <button
                type="button"
                onClick={() => selectResult(result)}
                className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-surface-raised min-h-[44px]"
              >
                {result.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
