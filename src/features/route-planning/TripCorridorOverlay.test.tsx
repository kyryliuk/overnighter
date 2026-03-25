import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { TripCorridorOverlay } from './TripCorridorOverlay'
import type { TripCorridorPreview } from './routePlanning'

const mockPolylineAddTo = vi.fn()
const mockPolylineRemove = vi.fn()
const mockLayerGroupAddTo = vi.fn()
const mockLayerGroupRemove = vi.fn()
const mockMarker = vi.fn()
const mockDivIcon = vi.fn((options) => options)
const mockPolyline = vi.fn(() => ({
  addTo: mockPolylineAddTo.mockReturnThis(),
  remove: mockPolylineRemove,
}))
const mockLayerGroup = vi.fn(() => ({
  addTo: mockLayerGroupAddTo.mockReturnThis(),
  remove: mockLayerGroupRemove,
}))

vi.mock('leaflet', () => ({
  polyline: mockPolyline,
  marker: mockMarker,
  divIcon: mockDivIcon,
  layerGroup: mockLayerGroup,
}))

const PREVIEW: TripCorridorPreview = {
  linePoints: [
    { latitude: 35.1983, longitude: -111.6513 },
    { latitude: 34.4839, longitude: -114.3225 },
    { latitude: 35.1894, longitude: -114.053 },
    { latitude: 33.6639, longitude: -114.229 },
  ],
  stopMarkers: [
    { stopOrder: 0, name: 'Lake Havasu', latitude: 34.4839, longitude: -114.3225 },
    { stopOrder: 1, name: 'Kingman Fuel', latitude: 35.1894, longitude: -114.053 },
  ],
}

describe('TripCorridorOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMarker.mockReturnValue({})
  })

  it('renders ordered polyline points and numbered stop markers', async () => {
    const mapRef = { current: {} }

    render(<TripCorridorOverlay mapRef={mapRef} preview={PREVIEW} />)

    await waitFor(() => expect(mockPolyline).toHaveBeenCalledWith([
      [35.1983, -111.6513],
      [34.4839, -114.3225],
      [35.1894, -114.053],
      [33.6639, -114.229],
    ], expect.objectContaining({ color: '#38bdf8' })))

    expect(mockMarker).toHaveBeenNthCalledWith(1, [34.4839, -114.3225], expect.objectContaining({
      title: 'Stop 1: Lake Havasu',
    }))
    expect(mockMarker).toHaveBeenNthCalledWith(2, [35.1894, -114.053], expect.objectContaining({
      title: 'Stop 2: Kingman Fuel',
    }))
    expect(mockDivIcon).toHaveBeenCalledTimes(2)
    expect(mockLayerGroup).toHaveBeenCalledTimes(1)
  })

  it('cleans up Leaflet layers on unmount', async () => {
    const mapRef = { current: {} }
    const view = render(<TripCorridorOverlay mapRef={mapRef} preview={PREVIEW} />)

    await waitFor(() => expect(mockPolylineAddTo).toHaveBeenCalled())
    view.unmount()

    expect(mockPolylineRemove).toHaveBeenCalled()
    expect(mockLayerGroupRemove).toHaveBeenCalled()
  })
})
