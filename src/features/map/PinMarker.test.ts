import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinIconConfig, createPinMarker } from './PinMarker'
import type { Pin } from '@/types/pin'
import type { RigProfile } from '@/types/rigProfile'

// ---------------------------------------------------------------------------
// Mocks for createPinMarker tests (hoisted so vi.mock factory can reference them)
// createPinIconConfig tests do NOT call L.* — these mocks don't affect them
// ---------------------------------------------------------------------------

const markerMocks = vi.hoisted(() => {
  let clickHandler: (() => void) | null = null
  const mockOn = vi.fn((event: string, fn: () => void) => {
    if (event === 'click') clickHandler = fn
    return markerInstance
  })
  const markerInstance = { on: mockOn }
  return {
    mockOn,
    markerInstance,
    mockMarker: vi.fn(() => markerInstance),
    mockDivIcon: vi.fn((cfg: unknown) => cfg),
    getClickHandler: () => clickHandler,
    resetClickHandler: () => { clickHandler = null },
  }
})

const storeMocks = vi.hoisted(() => {
  const mockSetSelectedPin = vi.fn()
  return {
    mockSetSelectedPin,
    mockGetState: vi.fn(() => ({ setSelectedPin: mockSetSelectedPin })),
  }
})

vi.mock('leaflet', () => ({
  default: { marker: markerMocks.mockMarker, divIcon: markerMocks.mockDivIcon },
  marker: markerMocks.mockMarker,
  divIcon: markerMocks.mockDivIcon,
}))

vi.mock('@/store/uiStore', () => ({
  useUIStore: { getState: storeMocks.mockGetState },
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
    badgeState: 'green',
    lastCheckInAt: null,
    recentCheckInCount: 0,
    isVerified: false,
    isFlagged: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const fitProfile: RigProfile = { rigType: 'Class A', lengthFt: 30, heightFt: 12 }
const noProfile: RigProfile = { rigType: null, lengthFt: null, heightFt: null }
const bigRig: RigProfile = { rigType: 'Class A', lengthFt: 50, heightFt: 14 }

// ---------------------------------------------------------------------------
// Icon config structure
// ---------------------------------------------------------------------------
describe('createPinIconConfig — structure', () => {
  it('returns iconSize [36, 36]', () => {
    const config = createPinIconConfig(makePin(), fitProfile)
    expect(config.iconSize).toEqual([36, 36])
  })

  it('returns iconAnchor [18, 18]', () => {
    const config = createPinIconConfig(makePin(), fitProfile)
    expect(config.iconAnchor).toEqual([18, 18])
  })

  it('returns className as empty string', () => {
    const config = createPinIconConfig(makePin(), fitProfile)
    expect(config.className).toBe('')
  })

  it('html contains a div element', () => {
    const config = createPinIconConfig(makePin(), fitProfile)
    expect(config.html).toContain('<div')
    expect(config.html).toContain('</div>')
  })
})

// ---------------------------------------------------------------------------
// Ring colours for fit pins
// ---------------------------------------------------------------------------
describe('createPinIconConfig — ring colours (fit pin)', () => {
  it('uses green ring colour for green badge', () => {
    const config = createPinIconConfig(makePin({ badgeState: 'green' }), fitProfile)
    expect(config.html).toContain('#22c55e')
  })

  it('uses yellow ring colour for yellow badge', () => {
    const config = createPinIconConfig(makePin({ badgeState: 'yellow' }), fitProfile)
    expect(config.html).toContain('#eab308')
  })

  it('uses red ring colour for red badge', () => {
    const config = createPinIconConfig(makePin({ badgeState: 'red' }), fitProfile)
    expect(config.html).toContain('#ef4444')
  })

  it('uses grey ring colour for grey badge', () => {
    const config = createPinIconConfig(makePin({ badgeState: 'grey' }), fitProfile)
    expect(config.html).toContain('#6b7280')
  })
})

// ---------------------------------------------------------------------------
// Unfit pin (rig constraints exceeded)
// ---------------------------------------------------------------------------
describe('createPinIconConfig — unfit pin styling', () => {
  const tinyPin = makePin({ maxLengthFt: 20, maxHeightFt: 10 })

  it('uses grey ring colour regardless of badge state (green badge → grey ring)', () => {
    const config = createPinIconConfig(
      makePin({ maxLengthFt: 20, badgeState: 'green' }),
      bigRig,
    )
    expect(config.html).toContain('#6b7280')
    expect(config.html).not.toContain('#22c55e')
  })

  it('uses grey ring colour for yellow badge on unfit pin', () => {
    const config = createPinIconConfig(
      makePin({ maxLengthFt: 20, badgeState: 'yellow' }),
      bigRig,
    )
    expect(config.html).toContain('#6b7280')
    expect(config.html).not.toContain('#eab308')
  })

  it('includes grayscale filter for unfit pin', () => {
    const config = createPinIconConfig(tinyPin, bigRig)
    expect(config.html).toContain('grayscale(1)')
  })

  it('includes opacity:0.5 for unfit pin', () => {
    const config = createPinIconConfig(tinyPin, bigRig)
    expect(config.html).toContain('opacity:0.5')
  })

  it('does NOT include grayscale for fit pin', () => {
    const config = createPinIconConfig(makePin(), fitProfile)
    expect(config.html).not.toContain('grayscale')
  })

  it('does NOT include opacity:0.5 for fit pin', () => {
    const config = createPinIconConfig(makePin(), fitProfile)
    expect(config.html).not.toContain('opacity:0.5')
  })

  it('no-profile pin is always treated as fit (no greying)', () => {
    const config = createPinIconConfig(
      makePin({ maxLengthFt: 10, maxHeightFt: 10 }),
      noProfile,
    )
    expect(config.html).not.toContain('grayscale')
  })
})

// ---------------------------------------------------------------------------
// Category emoji
// ---------------------------------------------------------------------------
describe('createPinIconConfig — category emoji selection', () => {
  function makeAmenities(active: (keyof ReturnType<typeof makePin>['amenities'])[]) {
    return {
      water: active.includes('water'),
      dump: active.includes('dump'),
      electric: active.includes('electric'),
      shower: active.includes('shower'),
      fuel: active.includes('fuel'),
      propane: active.includes('propane'),
      overnight: active.includes('overnight'),
    }
  }

  it('overnight → 🏕', () => {
    const config = createPinIconConfig(
      makePin({ amenities: makeAmenities(['overnight']) }),
      noProfile,
    )
    expect(config.html).toContain('🏕')
  })

  it('dump → 🚽', () => {
    const config = createPinIconConfig(
      makePin({ amenities: makeAmenities(['dump']) }),
      noProfile,
    )
    expect(config.html).toContain('🚽')
  })

  it('water → 💧', () => {
    const config = createPinIconConfig(
      makePin({ amenities: makeAmenities(['water']) }),
      noProfile,
    )
    expect(config.html).toContain('💧')
  })

  it('fuel → ⛽', () => {
    const config = createPinIconConfig(
      makePin({ amenities: makeAmenities(['fuel']) }),
      noProfile,
    )
    expect(config.html).toContain('⛽')
  })

  it('propane → 🔵', () => {
    const config = createPinIconConfig(
      makePin({ amenities: makeAmenities(['propane']) }),
      noProfile,
    )
    expect(config.html).toContain('🔵')
  })

  it('electric → ⚡', () => {
    const config = createPinIconConfig(
      makePin({ amenities: makeAmenities(['electric']) }),
      noProfile,
    )
    expect(config.html).toContain('⚡')
  })

  it('shower → 🚿', () => {
    const config = createPinIconConfig(
      makePin({ amenities: makeAmenities(['shower']) }),
      noProfile,
    )
    expect(config.html).toContain('🚿')
  })

  it('no amenities → 📍 fallback', () => {
    const config = createPinIconConfig(
      makePin({ amenities: makeAmenities([]) }),
      noProfile,
    )
    expect(config.html).toContain('📍')
  })

  it('overnight wins over dump (priority: overnight first)', () => {
    const config = createPinIconConfig(
      makePin({ amenities: makeAmenities(['overnight', 'dump']) }),
      noProfile,
    )
    expect(config.html).toContain('🏕')
    expect(config.html).not.toContain('🚽')
  })

  it('dump wins over water when overnight absent', () => {
    const config = createPinIconConfig(
      makePin({ amenities: makeAmenities(['dump', 'water']) }),
      noProfile,
    )
    expect(config.html).toContain('🚽')
    expect(config.html).not.toContain('💧')
  })
})

// ---------------------------------------------------------------------------
// aria-label format (NFR-A2)
// ---------------------------------------------------------------------------
describe('createPinIconConfig — aria-label', () => {
  it('contains spot name in aria-label', () => {
    const config = createPinIconConfig(
      makePin({ name: 'Mojave Site' }),
      noProfile,
    )
    expect(config.html).toContain('aria-label="Mojave Site:')
  })

  it('contains category label in aria-label', () => {
    const config = createPinIconConfig(
      makePin({ amenities: { water: true, dump: false, electric: false, shower: false, fuel: false, propane: false, overnight: false } }),
      noProfile,
    )
    expect(config.html).toContain('water, verified')
  })

  it('contains recency "fresh" for green badge', () => {
    const config = createPinIconConfig(makePin({ badgeState: 'green' }), noProfile)
    expect(config.html).toContain('verified fresh')
  })

  it('contains recency "recent" for yellow badge', () => {
    const config = createPinIconConfig(makePin({ badgeState: 'yellow' }), noProfile)
    expect(config.html).toContain('verified recent')
  })

  it('contains recency "stale" for red badge', () => {
    const config = createPinIconConfig(makePin({ badgeState: 'red' }), noProfile)
    expect(config.html).toContain('verified stale')
  })

  it('contains recency "unknown" for grey badge', () => {
    const config = createPinIconConfig(makePin({ badgeState: 'grey' }), noProfile)
    expect(config.html).toContain('verified unknown')
  })

  it('full format: "[SpotName]: [category], verified [recency]"', () => {
    const config = createPinIconConfig(
      makePin({ name: 'Mojave Site', badgeState: 'green', amenities: { overnight: true, dump: false, water: false, fuel: false, propane: false, electric: false, shower: false } }),
      noProfile,
    )
    expect(config.html).toContain('aria-label="Mojave Site: overnight, verified fresh"')
  })
})

// ---------------------------------------------------------------------------
// XSS safety — HTML escaping in aria-label
// ---------------------------------------------------------------------------
describe('createPinIconConfig — XSS safety', () => {
  it('escapes < and > in pin name', () => {
    const config = createPinIconConfig(makePin({ name: '<script>' }), noProfile)
    expect(config.html).not.toContain('<script>')
    expect(config.html).toContain('&lt;script&gt;')
  })

  it('escapes & in pin name', () => {
    const config = createPinIconConfig(makePin({ name: 'Dump & Water' }), noProfile)
    expect(config.html).not.toContain('Dump & Water')
    expect(config.html).toContain('Dump &amp; Water')
  })

  it('escapes " in pin name', () => {
    const config = createPinIconConfig(makePin({ name: 'Say "hello"' }), noProfile)
    expect(config.html).not.toContain('"hello"')
    expect(config.html).toContain('&quot;hello&quot;')
  })

  it('escapes \' in pin name', () => {
    const config = createPinIconConfig(makePin({ name: "Sarah's Spot" }), noProfile)
    expect(config.html).toContain('&#39;')
  })
})

// ---------------------------------------------------------------------------
// createPinMarker — click handler (AC3)
// ---------------------------------------------------------------------------
describe('createPinMarker — click handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    markerMocks.resetClickHandler()
  })

  it('creates an L.marker at the pin coordinates with keyboard:false', () => {
    const pin = makePin({ latitude: 36.0, longitude: -112.0 })
    createPinMarker(pin, noProfile)
    expect(markerMocks.mockMarker).toHaveBeenCalledWith(
      [36.0, -112.0],
      expect.objectContaining({ keyboard: false }),
    )
  })

  it('registers a click event listener on the marker', () => {
    createPinMarker(makePin(), noProfile)
    expect(markerMocks.mockOn).toHaveBeenCalledWith('click', expect.any(Function))
  })

  it('click handler calls useUIStore.getState().setSelectedPin(pin.id)', () => {
    const pin = makePin({ id: 'pin-xyz' })
    createPinMarker(pin, noProfile)
    const handler = markerMocks.getClickHandler()
    expect(handler).not.toBeNull()
    handler!()
    expect(storeMocks.mockGetState).toHaveBeenCalled()
    expect(storeMocks.mockSetSelectedPin).toHaveBeenCalledWith('pin-xyz')
  })

  it('click handler uses getState() not the React hook (calls getState exactly once per click)', () => {
    createPinMarker(makePin({ id: 'abc' }), noProfile)
    markerMocks.getClickHandler()!()
    // getState() should have been called once — Zustand non-React pattern
    expect(storeMocks.mockGetState).toHaveBeenCalledTimes(1)
  })

  it('click handler on unfit pin still calls setSelectedPin (greyed pins are still tappable)', () => {
    const unfitPin = makePin({ id: 'unfit-1', maxLengthFt: 10 })
    createPinMarker(unfitPin, bigRig) // bigRig exceeds maxLengthFt: 10
    markerMocks.getClickHandler()!()
    expect(storeMocks.mockSetSelectedPin).toHaveBeenCalledWith('unfit-1')
  })
})
