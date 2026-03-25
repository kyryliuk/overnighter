import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Pin } from '@/types/pin'
import RouteBuilderSheet from './RouteBuilderSheet'

const mockUsePinsQuery = vi.fn()

vi.mock('@/hooks/usePinsQuery', () => ({
  usePinsQuery: () => mockUsePinsQuery(),
}))

const PINS: Pin[] = [
  {
    id: 'pin-dest',
    name: 'Quartzsite',
    description: null,
    latitude: 33.6639,
    longitude: -114.229,
    pinType: 'community',
    sourceId: null,
    maxLengthFt: null,
    maxHeightFt: null,
    website: null,
    phone: null,
    elevationM: null,
    amenities: {
      water: false,
      dump: false,
      electric: false,
      shower: false,
      fuel: false,
      propane: false,
      overnight: true,
      toilets: false,
      pets: true,
      wifi: false,
      kitchen: false,
      restaurant: false,
      big_rig: true,
      tent: true,
      hiking: false,
      fishing: false,
      swimming: false,
      boating: false,
      biking: false,
      ohv: false,
      climbing: false,
      winter_sports: false,
      hunting: false,
      wildlife: false,
      horseback: false,
      hot_springs: false,
    },
    badgeState: 'green',
    lastCheckInAt: null,
    recentCheckInCount: 0,
    isVerified: true,
    isFlagged: false,
    createdAt: '2026-03-25T00:00:00.000Z',
    updatedAt: '2026-03-25T00:00:00.000Z',
  },
  {
    id: 'pin-origin',
    name: 'Flagstaff',
    description: null,
    latitude: 35.1983,
    longitude: -111.6513,
    pinType: 'community',
    sourceId: null,
    maxLengthFt: null,
    maxHeightFt: null,
    website: null,
    phone: null,
    elevationM: null,
    amenities: {
      water: false,
      dump: false,
      electric: false,
      shower: false,
      fuel: false,
      propane: false,
      overnight: true,
      toilets: false,
      pets: true,
      wifi: false,
      kitchen: false,
      restaurant: false,
      big_rig: true,
      tent: true,
      hiking: false,
      fishing: false,
      swimming: false,
      boating: false,
      biking: false,
      ohv: false,
      climbing: false,
      winter_sports: false,
      hunting: false,
      wildlife: false,
      horseback: false,
      hot_springs: false,
    },
    badgeState: 'green',
    lastCheckInAt: null,
    recentCheckInCount: 0,
    isVerified: true,
    isFlagged: false,
    createdAt: '2026-03-25T00:00:00.000Z',
    updatedAt: '2026-03-25T00:00:00.000Z',
  },
]

describe('RouteBuilderSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePinsQuery.mockReturnValue({ data: PINS, isLoading: false })
  })

  it('opens and closes accessibly', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<RouteBuilderSheet isOpen onClose={onClose} onSave={vi.fn()} />)

    expect(screen.getByRole('dialog', { name: /create route/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders destination search results and updates the draft when selected', async () => {
    const user = userEvent.setup()

    render(<RouteBuilderSheet isOpen onClose={vi.fn()} onSave={vi.fn()} />)

    await user.type(screen.getByLabelText(/destination/i), 'quartz')
    await user.click(screen.getByRole('button', { name: /quartzsite/i }))

    expect(screen.getByText('Quartzsite')).toBeInTheDocument()
  })

  it('blocks save without a destination', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()

    render(<RouteBuilderSheet isOpen onClose={vi.fn()} onSave={onSave} />)

    expect(screen.getByRole('button', { name: /save route/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /save route/i }))

    expect(onSave).not.toHaveBeenCalled()
  })

  it('allows blank titles through to the mutation layer', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<RouteBuilderSheet isOpen onClose={vi.fn()} onSave={onSave} />)

    await user.type(screen.getByLabelText(/destination/i), 'quartz')
    await user.click(screen.getByRole('button', { name: /quartzsite/i }))
    await user.type(screen.getByLabelText(/notes/i), 'Need a fuel stop')
    await user.click(screen.getByRole('button', { name: /save route/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      title: '',
      notes: 'Need a fuel stop',
      origin: null,
      destination: {
        id: 'pin-dest',
        name: 'Quartzsite',
        latitude: 33.6639,
        longitude: -114.229,
      },
    }))
  })
})
