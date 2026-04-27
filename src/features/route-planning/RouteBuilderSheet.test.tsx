import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSpotsStore } from '@/store/spotsStore'
import { useRigStore } from '@/store/rigStore'
import { useTripDraftStore, INITIAL_TRIP_DRAFT_STATE } from '@/store/tripDraftStore'
import {
  appendPendingTripMutation,
  clearPendingTripMutations,
} from '@/lib/offline/pendingTripMutations'
import type { Pin } from '@/types/pin'
import { DEFAULT_RIG_PROFILE } from '@/types/rigProfile'
import type { Trip } from '@/types/trip'
import RouteBuilderSheet from './RouteBuilderSheet'
import { MAX_TRIP_STOPS_MESSAGE } from './routePlanning'
import { GOOGLE_MAPS_MAX_WAYPOINTS } from '@/lib/maps/googleMaps'

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
  {
    id: 'pin-waypoint',
    name: 'Kingman Fuel',
    description: null,
    latitude: 35.1894,
    longitude: -114.053,
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
      fuel: true,
      propane: false,
      overnight: false,
      toilets: false,
      pets: true,
      wifi: false,
      kitchen: false,
      restaurant: false,
      big_rig: true,
      tent: false,
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
    id: 'pin-saved',
    name: 'Lake Havasu',
    description: null,
    latitude: 34.4839,
    longitude: -114.3225,
    pinType: 'community',
    sourceId: null,
    maxLengthFt: null,
    maxHeightFt: null,
    website: null,
    phone: null,
    elevationM: null,
    amenities: {
      water: true,
      dump: false,
      electric: false,
      shower: false,
      fuel: false,
      propane: false,
      overnight: true,
      toilets: true,
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
    id: 'pin-suggested',
    name: 'Desert Oasis',
    description: null,
    latitude: 34.95,
    longitude: -113.65,
    pinType: 'community',
    sourceId: null,
    maxLengthFt: null,
    maxHeightFt: null,
    website: null,
    phone: null,
    elevationM: null,
    amenities: {
      water: true,
      dump: false,
      electric: false,
      shower: false,
      fuel: true,
      propane: false,
      overnight: true,
      toilets: true,
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
    badgeState: 'yellow',
    lastCheckInAt: null,
    recentCheckInCount: 0,
    isVerified: true,
    isFlagged: false,
    createdAt: '2026-03-25T00:00:00.000Z',
    updatedAt: '2026-03-25T00:00:00.000Z',
  },
]

const RESTORED_TRIP: Trip = {
  id: 'trip-123',
  title: 'Desert Loop',
  notes: 'Camp by the river',
  status: 'draft',
  origin: { id: 'pin-origin', name: 'Flagstaff', latitude: 35.1983, longitude: -111.6513 },
  destination: { id: 'pin-dest', name: 'Quartzsite', latitude: 33.6639, longitude: -114.229 },
  routeMode: 'corridor',
  stopCount: 2,
  revision: 1,
  isPublic: false,
  shareToken: null,
  sourceTripId: null,
  sourceShareToken: null,
  createdAt: '2026-03-25T00:00:00.000Z',
  updatedAt: '2026-03-25T00:00:00.000Z',
  stops: [
    {
      id: 'stop-1',
      stopOrder: 0,
      stopKind: 'waypoint',
      source: 'saved',
      pinId: 'pin-saved',
      place: { id: 'pin-saved', name: 'Lake Havasu', latitude: 34.4839, longitude: -114.3225 },
      notes: 'Fuel up before leaving town',
      createdAt: '2026-03-25T00:00:00.000Z',
      updatedAt: '2026-03-25T00:00:00.000Z',
    },
    {
      id: 'stop-2',
      stopOrder: 1,
      stopKind: 'destination',
      source: 'manual',
      pinId: null,
      place: { id: 'pin-dest', name: 'Quartzsite', latitude: 33.6639, longitude: -114.229 },
      notes: '',
      createdAt: '2026-03-25T00:00:00.000Z',
      updatedAt: '2026-03-25T00:00:00.000Z',
    },
  ],
}

const RESTORED_TRIP_WITH_MULTIPLE_WAYPOINTS: Trip = {
  ...RESTORED_TRIP,
  stopCount: 3,
  stops: [
    RESTORED_TRIP.stops[0],
    {
      id: 'stop-3',
      stopOrder: 1,
      stopKind: 'waypoint',
      source: 'manual',
      pinId: 'pin-waypoint',
      place: { id: 'pin-waypoint', name: 'Kingman Fuel', latitude: 35.1894, longitude: -114.053 },
      notes: 'Stretch break',
      createdAt: '2026-03-25T00:00:00.000Z',
      updatedAt: '2026-03-25T00:00:00.000Z',
    },
    {
      ...RESTORED_TRIP.stops[1],
      stopOrder: 2,
    },
  ],
}

function buildTripWithMaxWaypoints(): Trip {
  return {
    ...RESTORED_TRIP,
    id: 'trip-max',
    stopCount: 12,
    stops: [
      ...Array.from({ length: 11 }, (_, index) => ({
        id: `stop-${index + 1}`,
        stopOrder: index,
        stopKind: 'waypoint' as const,
        source: 'manual' as const,
        pinId: `pin-max-${index + 1}`,
        place: {
          id: `pin-max-${index + 1}`,
          name: `Stop ${index + 1}`,
          latitude: 30 + index,
          longitude: -110 - index,
        },
        notes: '',
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      })),
      {
        id: 'stop-destination',
        stopOrder: 11,
        stopKind: 'destination' as const,
        source: 'manual' as const,
        pinId: null,
        place: RESTORED_TRIP.destination,
        notes: '',
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ],
  }
}

function buildTripJustOverHandoffLimit(): Trip {
  const overLimitCount = GOOGLE_MAPS_MAX_WAYPOINTS + 1
  return {
    ...RESTORED_TRIP,
    id: 'trip-over-limit',
    stopCount: overLimitCount + 1,
    stops: [
      ...Array.from({ length: overLimitCount }, (_, index) => ({
        id: `stop-${index + 1}`,
        stopOrder: index,
        stopKind: 'waypoint' as const,
        source: 'manual' as const,
        pinId: `pin-over-${index + 1}`,
        place: {
          id: `pin-over-${index + 1}`,
          name: `Stop ${index + 1}`,
          latitude: 30 + index,
          longitude: -110 - index,
        },
        notes: '',
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      })),
      {
        id: 'stop-destination',
        stopOrder: overLimitCount,
        stopKind: 'destination' as const,
        source: 'manual' as const,
        pinId: null,
        place: RESTORED_TRIP.destination,
        notes: '',
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ],
  }
}

describe('RouteBuilderSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePinsQuery.mockReturnValue({ data: PINS, isLoading: false })
    useSpotsStore.setState({ savedSpots: [PINS[3]] })
    useTripDraftStore.setState({ ...INITIAL_TRIP_DRAFT_STATE })
    clearPendingTripMutations()
    useRigStore.setState({
      rigProfile: DEFAULT_RIG_PROFILE,
      onboardingDismissed: false,
      updatedAt: null,
      hasHydrated: true,
    })
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
      stops: [],
    }))
  })

  it('calls markClean after a successful save in resume mode', async () => {
    useTripDraftStore.setState({ ...INITIAL_TRIP_DRAFT_STATE, dirtyTripIds: [RESTORED_TRIP.id] })
    const onSave = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<RouteBuilderSheet isOpen onClose={vi.fn()} onSave={onSave} trip={RESTORED_TRIP} />)

    await user.click(screen.getByRole('button', { name: /update route/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(useTripDraftStore.getState().dirtyTripIds).not.toContain(RESTORED_TRIP.id)
  })

  it('does not call markClean when onSave throws OFFLINE_QUEUED_ERROR — draft stays dirty', async () => {
    useTripDraftStore.setState({ ...INITIAL_TRIP_DRAFT_STATE, dirtyTripIds: [RESTORED_TRIP.id] })
    const onSave = vi.fn().mockRejectedValue(new Error('OFFLINE_QUEUED'))
    const user = userEvent.setup()

    render(<RouteBuilderSheet isOpen onClose={vi.fn()} onSave={onSave} trip={RESTORED_TRIP} />)

    await user.click(screen.getByRole('button', { name: /update route/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    // Draft must remain dirty — markClean must not be called for offline-queued saves
    expect(useTripDraftStore.getState().dirtyTripIds).toContain(RESTORED_TRIP.id)
    // No error alert should appear for the OFFLINE_QUEUED sentinel
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('hydrates an existing trip into the planner sheet', () => {
    render(<RouteBuilderSheet isOpen onClose={vi.fn()} onSave={vi.fn()} trip={RESTORED_TRIP} />)

    expect(screen.getByRole('dialog', { name: /resume route/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/title/i)).toHaveValue('Desert Loop')
    expect(screen.getByLabelText(/notes/i)).toHaveValue('Camp by the river')
    expect(screen.getByText('Quartzsite')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /update route/i })).toBeInTheDocument()
  })

  it('shows sync badge in header in resume mode', () => {
    render(<RouteBuilderSheet isOpen onClose={vi.fn()} onSave={vi.fn()} trip={RESTORED_TRIP} />)

    expect(screen.getByTestId('trip-sync-indicator')).toHaveTextContent('Synced')
  })

  it('shows "Local draft" sync badge in resume mode when trip is dirty', () => {
    useTripDraftStore.setState({ ...INITIAL_TRIP_DRAFT_STATE, dirtyTripIds: [RESTORED_TRIP.id] })
    render(<RouteBuilderSheet isOpen onClose={vi.fn()} onSave={vi.fn()} trip={RESTORED_TRIP} />)

    expect(screen.getByTestId('trip-sync-indicator')).toHaveTextContent('Local draft')
  })

  it('shows "Sync pending" sync badge in resume mode when trip is dirty and has a queued mutation', () => {
    useTripDraftStore.setState({ ...INITIAL_TRIP_DRAFT_STATE, dirtyTripIds: [RESTORED_TRIP.id] })
    appendPendingTripMutation({
      id: 'mut-builder-1',
      kind: 'update',
      tripId: RESTORED_TRIP.id,
      queuedAt: '2026-04-02T12:00:00Z',
    })
    render(<RouteBuilderSheet isOpen onClose={vi.fn()} onSave={vi.fn()} trip={RESTORED_TRIP} />)

    expect(screen.getByTestId('trip-sync-indicator')).toHaveTextContent('Sync pending')
  })

  it('does not show sync badge in create mode (no trip prop)', () => {
    render(<RouteBuilderSheet isOpen onClose={vi.fn()} onSave={vi.fn()} />)

    expect(screen.queryByTestId('trip-sync-indicator')).not.toBeInTheDocument()
  })

  it('adds and removes stops while preserving sequential order in resume mode', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<RouteBuilderSheet isOpen onClose={vi.fn()} onSave={onSave} trip={RESTORED_TRIP} />)

    const stopList = screen.getByRole('list', { name: /route stops list/i })
    expect(within(stopList).getAllByRole('listitem')).toHaveLength(1)
    expect(within(stopList).getByText(/stop 1: lake havasu/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/add a stop/i), 'kingman')
    await user.click(screen.getByRole('button', { name: /kingman fuel/i }))

    expect(within(stopList).getAllByRole('listitem')).toHaveLength(2)
    expect(within(stopList).getByText(/stop 2: kingman fuel/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /remove lake havasu from route/i }))

    expect(within(stopList).getAllByRole('listitem')).toHaveLength(1)
    expect(within(stopList).getByText(/stop 1: kingman fuel/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /update route/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Desert Loop',
      destination: RESTORED_TRIP.destination,
      stops: [
        expect.objectContaining({
          stopOrder: 0,
          source: 'manual',
          pinId: 'pin-waypoint',
          place: expect.objectContaining({ id: 'pin-waypoint', name: 'Kingman Fuel' }),
        }),
      ],
    })))
  })

  it('exposes accessible reorder controls and submits reordered normalized stops', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<RouteBuilderSheet isOpen onClose={vi.fn()} onSave={onSave} trip={RESTORED_TRIP_WITH_MULTIPLE_WAYPOINTS} />)

    const stopList = screen.getByRole('list', { name: /route stops list/i })
    expect(within(stopList).getByText(/stop 1: lake havasu/i)).toBeInTheDocument()
    expect(within(stopList).getByText(/stop 2: kingman fuel/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /move stop 1 up/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /move stop 2 down/i })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /move stop 2 up/i }))

    const reorderedStops = within(stopList).getAllByRole('listitem')
    expect(within(reorderedStops[0]).getByText(/stop 1: kingman fuel/i)).toBeInTheDocument()
    expect(within(reorderedStops[1]).getByText(/stop 2: lake havasu/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /update route/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      stops: [
        expect.objectContaining({
          stopOrder: 0,
          pinId: 'pin-waypoint',
          source: 'manual',
          notes: 'Stretch break',
          place: expect.objectContaining({ id: 'pin-waypoint', name: 'Kingman Fuel' }),
        }),
        expect.objectContaining({
          stopOrder: 1,
          pinId: 'pin-saved',
          source: 'saved',
          notes: 'Fuel up before leaving town',
          place: expect.objectContaining({ id: 'pin-saved', name: 'Lake Havasu' }),
        }),
      ],
    })))
  })

  it('consumes pending stop intents from saved spots and clears the intent callback', async () => {
    const onPendingAddStopHandled = vi.fn()

    render(
      <RouteBuilderSheet
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        trip={RESTORED_TRIP}
        pendingAddStop={{ pinId: 'pin-waypoint', source: 'saved' }}
        onPendingAddStopHandled={onPendingAddStopHandled}
      />,
    )

    await waitFor(() => expect(screen.getByText(/stop 2: kingman fuel/i)).toBeInTheDocument())
    expect(onPendingAddStopHandled).toHaveBeenCalled()
  })

  it('blocks pending duplicate stop intents with inline feedback', async () => {
    const onPendingAddStopHandled = vi.fn()

    render(
      <RouteBuilderSheet
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        trip={RESTORED_TRIP}
        pendingAddStop={{ pinId: 'pin-saved', source: 'manual' }}
        onPendingAddStopHandled={onPendingAddStopHandled}
      />,
    )

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('That stop is already part of this route.'))
    expect(screen.getByRole('list', { name: /route stops list/i }).querySelectorAll('li')).toHaveLength(1)
    expect(onPendingAddStopHandled).toHaveBeenCalled()
  })

  it('blocks max-stop overflows before save', async () => {
    render(
      <RouteBuilderSheet
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        trip={buildTripWithMaxWaypoints()}
        pendingAddStop={{ pinId: 'pin-waypoint', source: 'manual' }}
        onPendingAddStopHandled={vi.fn()}
      />,
    )

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(MAX_TRIP_STOPS_MESSAGE))
  })

  it('renders corridor suggestions, excludes existing stops, and saves added suggestions with source metadata', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<RouteBuilderSheet isOpen onClose={vi.fn()} onSave={onSave} trip={RESTORED_TRIP} />)

    const suggestionList = screen.getByRole('list', { name: /suggested corridor stops/i })
    expect(within(suggestionList).getByText('Desert Oasis')).toBeInTheDocument()
    expect(within(suggestionList).queryByText('Lake Havasu')).not.toBeInTheDocument()
    expect(within(suggestionList).queryByText('Quartzsite')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /add desert oasis as a suggested stop/i }))

    const stopList = screen.getByRole('list', { name: /route stops list/i })
    expect(within(stopList).getByText(/stop 2: desert oasis/i)).toBeInTheDocument()
    expect(within(stopList).getByText('suggested')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /update route/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      stops: [
        expect.objectContaining({ stopOrder: 0, pinId: 'pin-saved', source: 'saved' }),
        expect.objectContaining({ stopOrder: 1, pinId: 'pin-suggested', source: 'suggested' }),
      ],
    })))
  })

  it('shows a quiet corridor-suggestions message when origin context is missing', () => {
    render(
      <RouteBuilderSheet
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        trip={{ ...RESTORED_TRIP, origin: null }}
      />,
    )

    expect(screen.getByText(/add an origin to review corridor suggestions/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/add a stop/i)).toBeInTheDocument()
  })

  it('shows a non-blocking message when no pin data is available for suggestions', () => {
    mockUsePinsQuery.mockReturnValue({ data: [], isLoading: false })

    render(<RouteBuilderSheet isOpen onClose={vi.fn()} onSave={vi.fn()} trip={RESTORED_TRIP} />)

    expect(screen.getByText(/suggestions are unavailable until map pins are loaded for this route/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/add a stop/i)).toBeInTheDocument()
  })

  it('shows a non-blocking message when the route is too short for corridor suggestions', () => {
    render(
      <RouteBuilderSheet
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        trip={{
          ...RESTORED_TRIP,
          destination: { id: 'pin-near', name: 'Near Place', latitude: 35.3, longitude: -111.8 },
        }}
      />,
    )

    expect(screen.getByText(/this route is too short for meaningful corridor suggestions/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/add a stop/i)).toBeInTheDocument()
  })

  it('shows a non-blocking empty-state message when no overnight stops score well for this corridor', () => {
    mockUsePinsQuery.mockReturnValue({
      data: [{ ...PINS[2], amenities: { ...PINS[2].amenities, overnight: false } }],
      isLoading: false,
    })

    render(<RouteBuilderSheet isOpen onClose={vi.fn()} onSave={vi.fn()} trip={RESTORED_TRIP} />)

    expect(screen.getByText(/no strong overnight suggestions were found on this corridor yet/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/add a stop/i)).toBeInTheDocument()
  })

  it('blocks adding a corridor suggestion when the route is already at max stop capacity', async () => {
    const user = userEvent.setup()

    render(<RouteBuilderSheet isOpen onClose={vi.fn()} onSave={vi.fn()} trip={buildTripWithMaxWaypoints()} />)

    await user.click(screen.getByRole('button', { name: /add desert oasis as a suggested stop/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(MAX_TRIP_STOPS_MESSAGE)
  })

  it('renders an Open in Google Maps link with the correct origin, destination, and waypoint coordinates', () => {
    render(<RouteBuilderSheet isOpen onClose={vi.fn()} onSave={vi.fn()} trip={RESTORED_TRIP} />)

    const link = screen.getByRole('link', { name: /open in google maps/i })
    const href = link.getAttribute('href') ?? ''

    expect(href).toContain('destination=33.6639%2C-114.229')
    expect(href).toContain('origin=35.1983%2C-111.6513')
    expect(href).toContain('waypoints=34.4839%2C-114.3225')
  })

  it('shows a waypoint-limit warning and no navigation link when the route exceeds Google Maps capacity', () => {
    render(<RouteBuilderSheet isOpen onClose={vi.fn()} onSave={vi.fn()} trip={buildTripWithMaxWaypoints()} />)

    expect(screen.getByRole('status')).toHaveTextContent(
      new RegExp(`more than ${GOOGLE_MAPS_MAX_WAYPOINTS} stops`, 'i'),
    )
    expect(screen.queryByRole('link', { name: /open in google maps/i })).not.toBeInTheDocument()
  })

  it('shows a waypoint-limit warning at the boundary of GOOGLE_MAPS_MAX_WAYPOINTS + 1 stops', () => {
    render(<RouteBuilderSheet isOpen onClose={vi.fn()} onSave={vi.fn()} trip={buildTripJustOverHandoffLimit()} />)

    expect(screen.getByRole('status')).toHaveTextContent(
      new RegExp(`more than ${GOOGLE_MAPS_MAX_WAYPOINTS} stops`, 'i'),
    )
    expect(screen.queryByRole('link', { name: /open in google maps/i })).not.toBeInTheDocument()
  })

  it('does not show the Google Maps link in create mode', () => {
    render(<RouteBuilderSheet isOpen onClose={vi.fn()} onSave={vi.fn()} />)

    expect(screen.queryByRole('link', { name: /open in google maps/i })).not.toBeInTheDocument()
  })

  it('updates the directions URL when waypoints are reordered', async () => {
    const user = userEvent.setup()

    render(
      <RouteBuilderSheet isOpen onClose={vi.fn()} onSave={vi.fn()} trip={RESTORED_TRIP_WITH_MULTIPLE_WAYPOINTS} />,
    )

    const initialHref = screen.getByRole('link', { name: /open in google maps/i }).getAttribute('href') ?? ''
    expect(initialHref).toContain('waypoints=34.4839%2C-114.3225%7C35.1894%2C-114.053')

    await user.click(screen.getByRole('button', { name: /move stop 2 up/i }))

    const updatedHref = screen.getByRole('link', { name: /open in google maps/i }).getAttribute('href') ?? ''
    expect(updatedHref).toContain('waypoints=35.1894%2C-114.053%7C34.4839%2C-114.3225')
  })
})
