import * as L from 'leaflet'
import type { Pin } from '@/types/pin'
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

type BadgeColor = 'green' | 'yellow' | 'red' | 'grey'

const RING_COLORS: Record<BadgeColor, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  grey: '#6b7280',
}

const FILL_COLORS: Record<BadgeColor, string> = {
  green: 'rgba(34,197,94,0.15)',
  yellow: 'rgba(234,179,8,0.15)',
  red: 'rgba(239,68,68,0.15)',
  grey: 'rgba(107,114,128,0.1)',
}

const BADGE_LABELS: Record<BadgeColor, string> = {
  green: 'fresh',
  yellow: 'recent',
  red: 'stale',
  grey: 'unknown',
}

function getCategoryEmoji(pin: Pin): { emoji: string; label: string } {
  const a = pin.amenities
  // Priority: overnight > dump > water > fuel > propane > electric > shower > fallback
  if (a.overnight) return { emoji: '🏕', label: 'overnight' }
  if (a.dump)      return { emoji: '🚽', label: 'dump' }
  if (a.water)     return { emoji: '💧', label: 'water' }
  if (a.fuel)      return { emoji: '⛽', label: 'fuel' }
  if (a.propane)   return { emoji: '🔵', label: 'propane' }
  if (a.electric)  return { emoji: '⚡', label: 'electric' }
  if (a.shower)    return { emoji: '🚿', label: 'shower' }
  return { emoji: '📍', label: 'stop' }
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
  const fillColor = fits ? (FILL_COLORS[badge] ?? FILL_COLORS.grey) : FILL_COLORS.grey

  const { emoji, label } = getCategoryEmoji(pin)
  const recency = BADGE_LABELS[badge] ?? 'unknown'
  const ariaLabel = `${escapeHtml(pin.name)}: ${label}, verified ${recency}`

  const unfitStyles = fits ? '' : 'filter:grayscale(1);opacity:0.5;'

  const html =
    `<div ` +
    `style="width:36px;height:36px;border-radius:50%;border:3px solid ${ringColor};` +
    `background:${fillColor};display:flex;align-items:center;justify-content:center;` +
    `font-size:16px;cursor:pointer;${unfitStyles}" ` +
    `role="img" ` +
    `aria-label="${ariaLabel}"` +
    `>${emoji}</div>`

  return {
    html,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
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
