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

// Pill text colors — contrast-compliant (≥4.5:1) per NFR-A6:
// green/yellow/red: dark #0f172a on colored background
// grey: white #ffffff on grey #6b7280
const PILL_TEXT_COLORS: Record<BadgeColor, string> = {
  green: '#0f172a',
  yellow: '#0f172a',
  red: '#0f172a',
  grey: '#ffffff',
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

  // Pill text color: dark text on colored backgrounds for green/yellow/red;
  // white text on grey — all meet NFR-A6 4.5:1 contrast requirement
  const pillTextColor = fits ? (PILL_TEXT_COLORS[badge] ?? '#ffffff') : '#ffffff'

  const html =
    `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">` +
      `<div ` +
        `style="width:36px;height:36px;border-radius:50%;border:3px solid ${ringColor};` +
        `background:${fillColor};display:flex;align-items:center;justify-content:center;` +
        `font-size:16px;cursor:pointer;${unfitStyles}" ` +
        `role="img" ` +
        `aria-label="${ariaLabel}"` +
      `>${emoji}</div>` +
      `<span style="font-size:9px;font-weight:700;padding:1px 4px;border-radius:3px;` +
        `background:${ringColor};color:${pillTextColor};line-height:1.2;cursor:pointer;${unfitStyles}"` +
      `>${recency}</span>` +
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
