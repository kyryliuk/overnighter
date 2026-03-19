import { useQuery } from '@tanstack/react-query'
import { getAllPins } from '@/lib/supabase/pins'
import type { Pin } from '@/types/pin'

interface Props {
  onSelect: (pin: Pin) => void
}

export default function AdminPinList({ onSelect }: Props) {
  const { data: pins = [], isLoading, isError } = useQuery({
    queryKey: ['admin', 'all-pins'],
    queryFn: getAllPins,
  })

  if (isLoading) return <p>Loading pins...</p>
  if (isError) return <p>Failed to load pins.</p>
  if (pins.length === 0) return <p>No pins found.</p>

  return (
    <ul>
      {pins.map((pin) => (
        <li key={pin.id}>
          <span>{pin.name}</span>
          <span> ({pin.pinType}, {pin.latitude}, {pin.longitude})</span>
          <button
            aria-label={`Edit ${pin.name}`}
            className="min-h-[44px] min-w-[44px]"
            onClick={() => onSelect(pin)}
          >
            Edit
          </button>
        </li>
      ))}
    </ul>
  )
}
