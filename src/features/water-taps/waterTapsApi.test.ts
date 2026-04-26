/**
 * waterTapsApi.test.ts
 *
 * NOTE (Story 6.6 code review — M2): The `fetchWaterTapsByViewport` and
 * `useWaterTapViewportQuery` exports were removed from waterTapsApi.ts because
 * water tap pins are already included in the unified `map_pins` view queried
 * by `usePinsQuery`.  The tests for those functions have been removed along
 * with the functions themselves.
 *
 * Remaining coverage for waterTapsApi is provided by:
 *   - src/features/water-taps/TapPinDetailSheet.test.tsx  (useWaterTapQuery)
 *   - api/pins.test.ts  (search_water_taps_by_radius via merged radius search)
 */
import { describe, it } from 'vitest'

describe('waterTapsApi', () => {
  it('viewport query removed: water tap pins are served via usePinsQuery (map_pins view)', () => {
    // fetchWaterTapsByViewport and useWaterTapViewportQuery were removed in Story 6.6
    // code review (M2).  Water tap pins are already part of the map_pins unified view
    // queried by usePinsQuery — a separate viewport hook is redundant.
    // Coverage lives in api/pins.test.ts (search_water_taps_by_radius integration).
  })
})
