import { useState } from 'react'
import { useAmenityFilterStore } from '@/store/amenityFilterStore'
import { useSourceFilterStore, type SourceGroup } from '@/store/sourceFilterStore'
import type { PinAmenities } from '@/types/pin'

const AMENITY_CHIPS: Array<{ key: keyof PinAmenities; label: string; emoji: string }> = [
  { key: 'overnight',  label: 'Overnight',  emoji: '🏕' },
  { key: 'tent',       label: 'Tent',       emoji: '⛺' },
  { key: 'big_rig',   label: 'Big Rig',    emoji: '🚐' },
  { key: 'water',      label: 'Water',      emoji: '💧' },
  { key: 'dump',       label: 'Dump',       emoji: '🗑' },
  { key: 'electric',   label: 'Electric',   emoji: '⚡' },
  { key: 'wifi',       label: 'WiFi',       emoji: '📶' },
  { key: 'shower',     label: 'Shower',     emoji: '🚿' },
  { key: 'fuel',       label: 'Fuel',       emoji: '⛽' },
  { key: 'propane',    label: 'Propane',    emoji: '🔵' },
  { key: 'pets',       label: 'Pets OK',    emoji: '🐾' },
]

const SOURCE_CHIPS: Array<{ key: SourceGroup; label: string; emoji: string }> = [
  { key: 'gov',       label: 'Gov. Campgrounds', emoji: '🏛' },
  { key: 'osm',       label: 'OpenStreetMap',    emoji: '🗺' },
  { key: 'community', label: 'Community',         emoji: '👥' },
]

interface AmenityFilterBarProps {
  isSearchExpanded?: boolean
}

export default function AmenityFilterBar({ isSearchExpanded }: AmenityFilterBarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const toggleFilter = useAmenityFilterStore((state) => state.toggleFilter)
  const activeFilters = useAmenityFilterStore((state) => state.activeFilters)
  const clearFilters = useAmenityFilterStore((state) => state.clearFilters)
  const toggleGroup = useSourceFilterStore((state) => state.toggleGroup)
  const activeGroups = useSourceFilterStore((state) => state.activeGroups)
  const clearGroups = useSourceFilterStore((state) => state.clearGroups)

  const activeCount = activeFilters.length + activeGroups.length

  if (isSearchExpanded) return null

  return (
    <div className="relative">
      {/* Filter icon button */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center shadow-md relative flex-shrink-0"
        style={{
          background: activeCount > 0 ? 'rgba(14,165,233,0.15)' : 'rgba(30,41,59,0.95)',
          border: `1px solid ${activeCount > 0 ? '#0ea5e9' : '#334155'}`,
        }}
        aria-label={`Filters${activeCount > 0 ? ` (${activeCount} active)` : ''}`}
        aria-expanded={isOpen}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={activeCount > 0 ? '#38bdf8' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="6" x2="20" y2="6"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
          <line x1="11" y1="18" x2="13" y2="18"/>
        </svg>
        {activeCount > 0 && (
          <span
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
            style={{ background: '#0ea5e9' }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {/* Filter panel */}
      {isOpen && (
        <div
          className="absolute left-0 top-[52px] z-20 rounded-2xl"
          style={{
            background: 'rgba(15,23,42,0.98)',
            border: '1px solid #334155',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            minWidth: 280,
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <span className="text-[10px] font-semibold tracking-widest uppercase border-l-2 pl-2" style={{ color: 'rgba(148,163,184,0.6)', borderColor: 'rgba(148,163,184,0.3)' }}>
              Filter spots
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground min-w-[24px] min-h-[24px] flex items-center justify-center"
              aria-label="Close filters"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Source chips */}
          <div className="px-3 pb-2">
            <p className="text-[10px] font-semibold tracking-widest uppercase mb-2 pl-1" style={{ color: 'rgba(148,163,184,0.4)' }}>Source</p>
            <div className="flex flex-wrap gap-2">
              {SOURCE_CHIPS.map(({ key, label, emoji }) => {
                const isActive = activeGroups.includes(key)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleGroup(key)}
                    aria-pressed={isActive}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap min-h-[36px]"
                    style={{
                      background: isActive ? 'rgba(14,165,233,0.12)' : 'rgba(30,41,59,0.6)',
                      border: `1px solid ${isActive ? '#0ea5e9' : '#334155'}`,
                      color: isActive ? '#38bdf8' : '#94a3b8',
                    }}
                  >
                    <span aria-hidden="true">{emoji}</span>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mx-3 border-t mb-2" style={{ borderColor: 'rgba(51,65,85,0.5)' }} />

          {/* Amenity chips */}
          <div className="px-3 pb-3">
            <p className="text-[10px] font-semibold tracking-widest uppercase mb-2 pl-1" style={{ color: 'rgba(148,163,184,0.4)' }}>Amenities</p>
            <div className="flex flex-wrap gap-2">
              {AMENITY_CHIPS.map(({ key, label, emoji }) => {
                const isActive = activeFilters.includes(key)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleFilter(key)}
                    aria-pressed={isActive}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap min-h-[36px]"
                    style={{
                      background: isActive ? 'rgba(14,165,233,0.12)' : 'rgba(30,41,59,0.6)',
                      border: `1px solid ${isActive ? '#0ea5e9' : '#334155'}`,
                      color: isActive ? '#38bdf8' : '#94a3b8',
                    }}
                  >
                    <span aria-hidden="true">{emoji}</span>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {activeCount > 0 && (
            <div className="px-3 pb-3">
              <button
                type="button"
                onClick={() => { clearFilters(); clearGroups() }}
                className="w-full h-9 rounded-lg text-sm text-muted-foreground"
                style={{ background: 'none', border: '1px solid #334155' }}
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
