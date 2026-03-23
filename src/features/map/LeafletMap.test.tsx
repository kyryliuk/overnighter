import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import LeafletMap from './LeafletMap'
import { DEFAULT_RIG_PROFILE } from '@/types/rigProfile'
import type { Pin } from '@/types/pin'

// ---------------------------------------------------------------------------
// Leaflet mock — must appear before component import is evaluated by Vitest
// ---------------------------------------------------------------------------
const mockMapRemove = vi.fn()
const mockMapSetView = vi.fn()
const mockMapHasLayer = vi.fn().mockReturnValue(true)
const mockMap = {
  remove: mockMapRemove,
  setView: mockMapSetView,
  hasLayer: mockMapHasLayer,
}

const mockTileLayerOn = vi.fn().mockReturnThis()
const mockTileLayerAddTo = vi.fn().mockReturnThis()
const mockTileLayerRemove = vi.fn()
const mockTileLayer = {
  on: mockTileLayerOn,
  addTo: mockTileLayerAddTo,
  remove: mockTileLayerRemove,
}

vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => mockMap),
    tileLayer: vi.fn(() => mockTileLayer),
  },
  map: vi.fn(() => mockMap),
  tileLayer: vi.fn(() => mockTileLayer),
}))

// PinLayer also imports leaflet — mock it to avoid double-init issues
vi.mock('./PinLayer', () => ({
  default: vi.fn(() => null),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makePin(overrides: Partial<Pin> = {}): Pin {
  return {
    id: 'pin-1',
    name: 'Test Spot',
    description: null,
    latitude: 40.0,
    longitude: -90.0,
    pinType: 'community',
    sourceId: null,
    maxLengthFt: null,
    maxHeightFt: null,
    amenities: {
      water: false,
      dump: false,
      electric: false,
      shower: false,
      fuel: false,
      propane: false,
      overnight: true,
    },
    badgeState: 'grey',
    lastCheckInAt: null,
    recentCheckInCount: 0,
    isVerified: false,
    isFlagged: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks()
  // jsdom does not implement matchMedia — provide a minimal stub
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  })
})

describe('LeafletMap', () => {
  it('renders map container with 100dvh height', () => {
    render(
      <LeafletMap pins={[]} isLoading={false} rigProfile={DEFAULT_RIG_PROFILE} />,
    )

    const container = screen.getByLabelText('Map of camping spots')
    // The outer wrapper div has height: 100dvh
    const outerWrapper = container.parentElement
    expect(outerWrapper?.style.height).toBe('100dvh')
  })

  it('renders accessible map div with correct aria-label', () => {
    render(
      <LeafletMap pins={[]} isLoading={false} rigProfile={DEFAULT_RIG_PROFILE} />,
    )
    expect(screen.getByLabelText('Map of camping spots')).toBeInTheDocument()
  })

  it('initializes Leaflet map with tap:false on mount', async () => {
    const L = await import('leaflet')
    render(
      <LeafletMap pins={[]} isLoading={false} rigProfile={DEFAULT_RIG_PROFILE} />,
    )
    expect(L.map).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ tap: false }),
    )
  })

  it('adds CartoDB Voyager tile layer', async () => {
    const L = await import('leaflet')
    render(
      <LeafletMap pins={[]} isLoading={false} rigProfile={DEFAULT_RIG_PROFILE} />,
    )
    expect(L.tileLayer).toHaveBeenCalledWith(
      expect.stringContaining('basemaps.cartocdn.com/rastertiles/voyager'),
      expect.any(Object),
    )
  })

  it('CartoDB tile URL contains {r} retina placeholder', async () => {
    const L = await import('leaflet')
    render(
      <LeafletMap pins={[]} isLoading={false} rigProfile={DEFAULT_RIG_PROFILE} />,
    )
    const firstCall = (L.tileLayer as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(firstCall).toContain('{r}')
  })

  it('renders PinLayer once map is ready', async () => {
    const { default: PinLayer } = await import('./PinLayer')
    const pins = [makePin()]
    render(
      <LeafletMap pins={pins} isLoading={false} rigProfile={DEFAULT_RIG_PROFILE} />,
    )
    expect(PinLayer).toHaveBeenCalled()
  })

  it('disables zoom and fade animations when prefers-reduced-motion is active (AC6)', async () => {
    // Override matchMedia to report prefers-reduced-motion: reduce
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    })
    const L = await import('leaflet')
    render(
      <LeafletMap pins={[]} isLoading={false} rigProfile={DEFAULT_RIG_PROFILE} />,
    )
    expect(L.map).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ zoomAnimation: false, fadeAnimation: false }),
    )
  })

  it('enables animations when prefers-reduced-motion is not active', async () => {
    // matchMedia returns matches: false (set in beforeEach — default state)
    const L = await import('leaflet')
    render(
      <LeafletMap pins={[]} isLoading={false} rigProfile={DEFAULT_RIG_PROFILE} />,
    )
    expect(L.map).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ zoomAnimation: true, fadeAnimation: true }),
    )
  })
})
