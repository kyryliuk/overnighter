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

const CHIP_BASE = 'flex items-center gap-1 px-3 rounded-full border text-sm font-medium whitespace-nowrap min-h-[44px] min-w-fit'
const CHIP_ACTIVE = 'bg-sky-500 text-white border-sky-500'
const CHIP_INACTIVE = 'bg-background/80 text-muted-foreground border-border'

export default function AmenityFilterBar() {
  const toggleFilter = useAmenityFilterStore((state) => state.toggleFilter)
  const activeFilters = useAmenityFilterStore((state) => state.activeFilters)
  const toggleGroup = useSourceFilterStore((state) => state.toggleGroup)
  const activeGroups = useSourceFilterStore((state) => state.activeGroups)

  return (
    <div className="flex flex-col gap-1">
      <div className="overflow-x-auto flex flex-nowrap gap-2 px-1 py-1">
        {SOURCE_CHIPS.map(({ key, label, emoji }) => {
          const isActive = activeGroups.includes(key)
          return (
            <button
              key={key}
              onClick={() => toggleGroup(key)}
              aria-pressed={isActive}
              className={[CHIP_BASE, isActive ? CHIP_ACTIVE : CHIP_INACTIVE].join(' ')}
            >
              <span aria-hidden="true">{emoji}</span>
              {label}
            </button>
          )
        })}
      </div>
      <div className="overflow-x-auto flex flex-nowrap gap-2 px-1 py-1">
        {AMENITY_CHIPS.map(({ key, label, emoji }) => {
          const isActive = activeFilters.includes(key)
          return (
            <button
              key={key}
              onClick={() => toggleFilter(key)}
              aria-pressed={isActive}
              className={[CHIP_BASE, isActive ? CHIP_ACTIVE : CHIP_INACTIVE].join(' ')}
            >
              <span aria-hidden="true">{emoji}</span>
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
