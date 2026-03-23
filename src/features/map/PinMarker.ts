import * as L from 'leaflet'
import type { Pin, BadgeColor } from '@/types/pin'
import type { RigProfile } from '@/types/rigProfile'
import { doesPinFitRig } from './PinLayer'
import { useUIStore } from '@/store/uiStore'

// ---------------------------------------------------------------------------
// Pure config builder — does not call Leaflet APIs; testable without Leaflet-specific mocks
// (Note: this file imports L for createPinMarker below; the function itself is Leaflet-free)
// ---------------------------------------------------------------------------

export interface PinIconConfig {
  html: string
  iconSize: [number, number]
  iconAnchor: [number, number]
  className: string
}

const RING_COLORS: Record<BadgeColor, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  grey: '#6b7280',
}


const BADGE_LABELS: Record<BadgeColor, string> = {
  green: 'fresh',
  yellow: 'recent',
  red: 'stale',
  grey: 'unknown',
}

// Pill text colors — contrast-compliant (≥4.5:1) per NFR-A6:
// green/yellow/red: dark #0f172a on colored background
// grey: white #ffffff on grey #6b7280
const PILL_TEXT_COLORS: Record<BadgeColor, string> = {
  green: '#0f172a',
  yellow: '#0f172a',
  red: '#0f172a',
  grey: '#ffffff',
}

// SVG tree icon for gov pins — renders identically on all OS/browsers (no emoji font variance)
const GOV_SVG =
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">` +
    `<polygon points="12,2 3,13 21,13" fill="#15803d"/>` +
    `<polygon points="12,8 4,17 20,17" fill="#166534"/>` +
    `<rect x="10" y="17" width="4" height="5" rx="1" fill="#92400e"/>` +
  `</svg>`

function getCategoryEmoji(pin: Pin): { icon: string; label: string } {
  if (pin.pinType === 'blm' || pin.pinType === 'usfs' || pin.pinType === 'nps') {
    return { icon: GOV_SVG, label: 'gov campground' }
  }
  const a = pin.amenities
  if (a.overnight) return { icon: '🏕', label: 'overnight' }
  if (a.dump)      return { icon: '🚽', label: 'dump' }
  if (a.water)     return { icon: '💧', label: 'water' }
  if (a.fuel)      return { icon: '⛽', label: 'fuel' }
  if (a.propane)   return { icon: '🔵', label: 'propane' }
  if (a.electric)  return { icon: '⚡', label: 'electric' }
  if (a.shower)    return { icon: '🚿', label: 'shower' }
  return { icon: '📍', label: 'stop' }
}

/** HTML-escape a string to prevent XSS injection via pin names from the database */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Creates the DivIcon configuration object for a pin marker.
 * Pure function — does not call any Leaflet APIs; testable without Leaflet mocks.
 */
export function createPinIconConfig(pin: Pin, rigProfile: RigProfile): PinIconConfig {
  const fits = doesPinFitRig(pin, rigProfile)
  const badge = pin.badgeState as BadgeColor

  const ringColor = fits ? (RING_COLORS[badge] ?? RING_COLORS.grey) : RING_COLORS.grey

  const { icon, label } = getCategoryEmoji(pin)
  const recency = BADGE_LABELS[badge] ?? 'unknown'
  const ariaLabel = `${escapeHtml(pin.name)}: ${label}, verified ${recency}`

  // NFR-A6 (4.5:1 contrast) applies to fit pins. Unfit pins are intentionally dimmed —
  // grayscale+opacity signals "rig won't fit here" at a glance; contrast is secondary.
  // Applied to the outer wrapper so a single style controls the whole marker.
  const unfitStyles = fits ? '' : 'filter:grayscale(1);opacity:0.5;'

  // Pill text color: dark text on colored backgrounds for green/yellow/red;
  // white text on grey — all meet NFR-A6 4.5:1 contrast requirement
  const pillTextColor = fits ? (PILL_TEXT_COLORS[badge] ?? '#ffffff') : '#ffffff'

  const isGovPin = pin.pinType === 'blm' || pin.pinType === 'usfs' || pin.pinType === 'nps'

  const circleRing  = isGovPin ? '#9ca3af' : ringColor   // grey border for gov
  const circleBg    = isGovPin ? '#f3f4f6' : '#ffffff'   // light grey fill so emoji shows

  const pill = isGovPin
    ? ''
    : `<span style="font-size:9px;font-weight:700;padding:1px 4px;border-radius:3px;` +
        `background:${ringColor};color:${pillTextColor};line-height:1.2;cursor:pointer;"` +
      `>${recency}</span>`

  const html =
    `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;${unfitStyles}">` +
      `<div ` +
        `style="width:36px;height:36px;border-radius:50%;border:3px solid ${circleRing};` +
        `background:${circleBg};box-shadow:0 1px 4px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;` +
        `font-size:18px;cursor:pointer;" ` +
        `role="img" ` +
        `aria-label="${ariaLabel}"` +
      `>${icon}</div>` +
      pill +
    `</div>`

  return {
    html,
    // iconSize [44, 54]: wider to accommodate label pill, taller for circle (36) + gap (2) + pill (~14)
    iconSize: [44, 54],
    // iconAnchor [22, 18]: horizontally centered (22 = 44/2); vertically at circle center (18 = 36/2)
    // so the pin's lat/lng coordinate aligns with the center of the circle, not the pill
    iconAnchor: [22, 18],
    className: '', // MUST be '' — Leaflet's default adds a white square background div
  }
}

// ---------------------------------------------------------------------------
// Marker factory — wraps Leaflet; only used at runtime (not in tests)
// ---------------------------------------------------------------------------

/**
 * Creates a Leaflet Marker with the styled RecencyPin DivIcon and click handler
 * wired to useUIStore.setSelectedPin (Story 3.1 will build the detail sheet on top of this).
 */
export function createPinMarker(pin: Pin, rigProfile: RigProfile): L.Marker {
  const icon = L.divIcon(createPinIconConfig(pin, rigProfile))
  const marker = L.marker([pin.latitude, pin.longitude], {
    icon,
    // keyboard: false — the inner div has role="img"; keyboard navigation to the
    // pin detail sheet will be implemented in Story 3.1 via the PinDetailSheet component
    keyboard: false,
  })
  marker.on('click', () => {
    // Must use .getState() here — Leaflet callbacks run outside React render context
    // so useUIStore() hook cannot be used directly (hooks are React-only)
    useUIStore.getState().setSelectedPin(pin.id)
  })
  return marker
}
