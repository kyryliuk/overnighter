import { useState, useEffect, useRef } from 'react'

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

export default function SearchBar({ mapRef }: SearchBarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input when search opens
  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

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
    setQuery('')
    setResults([])
    setIsOpen(false)
  }

  function handleClear() {
    setQuery('')
    setResults([])
  }

  function handleClose() {
    setIsOpen(false)
    setQuery('')
    setResults([])
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="bg-surface border border-border rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center shadow-sm text-foreground text-lg"
        aria-label="Open search"
      >
        🔍
      </button>
    )
  }

  return (
    <div className="relative">
      <div className="flex gap-2 items-center">
        <button
          type="button"
          onClick={handleClose}
          className="bg-surface border border-border rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center text-foreground flex-shrink-0"
          aria-label="Close search"
        >
          ←
        </button>
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') handleClose() }}
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
      </div>

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
