import { useAmenityFilterStore } from '@/store/amenityFilterStore'
import type { PinAmenities } from '@/types/pin'

const CHIPS: Array<{ key: keyof PinAmenities; label: string; emoji: string }> = [
  { key: 'water',     label: 'Water',    emoji: '💧' },
  { key: 'dump',      label: 'Dump',     emoji: '🚽' },
  { key: 'overnight', label: 'Overnight',emoji: '🏕' },
  { key: 'fuel',      label: 'Fuel',     emoji: '⛽' },
  { key: 'propane',   label: 'Propane',  emoji: '🔵' },
  { key: 'electric',  label: 'Electric', emoji: '⚡' },
  { key: 'shower',    label: 'Shower',   emoji: '🚿' },
]

export default function AmenityFilterBar() {
  const toggleFilter = useAmenityFilterStore((state) => state.toggleFilter)
  const activeFilters = useAmenityFilterStore((state) => state.activeFilters)

  return (
    <div className="overflow-x-auto flex flex-nowrap gap-2 px-1 py-1">
      {CHIPS.map(({ key, label, emoji }) => {
        const isActive = activeFilters.includes(key)
        return (
          <button
            key={key}
            onClick={() => toggleFilter(key)}
            aria-pressed={isActive}
            className={[
              'flex items-center gap-1 px-3 rounded-full border text-sm font-medium whitespace-nowrap',
              'min-h-[44px] min-w-fit',
              isActive
                ? 'bg-sky-500 text-white border-sky-500'
                : 'bg-background/80 text-muted-foreground border-border',
            ].join(' ')}
          >
            <span aria-hidden="true">{emoji}</span>
            {label}
          </button>
        )
      })}
    </div>
  )
}
