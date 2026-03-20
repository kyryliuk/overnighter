import { useQuery } from '@tanstack/react-query'
import { getAllPins } from '@/lib/supabase/pins'
import type { Pin } from '@/types/pin'

interface Props {
  onSelect: (pin: Pin) => void
}

const PIN_TYPE_LABELS: Record<string, string> = {
  blm: 'BLM',
  usfs: 'Nat. Forest',
  nps: 'Nat. Park',
  overpass: 'OpenStreetMap',
  community: 'Community',
}

export default function AdminPinList({ onSelect }: Props) {
  const { data: pins = [], isLoading, isError } = useQuery({
    queryKey: ['admin', 'all-pins'],
    queryFn: getAllPins,
  })

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading pins…</p>
  if (isError) return <p className="text-sm text-red-400">Failed to load pins.</p>
  if (pins.length === 0) return <p className="text-sm text-muted-foreground">No pins found.</p>

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Type</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Coordinates</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {pins.map((pin, i) => (
            <tr
              key={pin.id}
              className={`border-b border-border last:border-0 ${i % 2 === 0 ? 'bg-background' : 'bg-secondary/20'}`}
            >
              <td className="px-4 py-3 text-foreground font-medium truncate max-w-[200px]">{pin.name}</td>
              <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                {PIN_TYPE_LABELS[pin.pinType] ?? pin.pinType}
              </td>
              <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden md:table-cell">
                {pin.latitude.toFixed(4)}, {pin.longitude.toFixed(4)}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  aria-label={`Edit ${pin.name}`}
                  className="min-h-[44px] px-3 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                  onClick={() => onSelect(pin)}
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
