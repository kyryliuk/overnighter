import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BboxPreviewOverlay } from './BboxPreviewOverlay'
import type { BBox } from '@/lib/tileMath'
import { createRef } from 'react'

vi.mock('leaflet', () => ({
  rectangle: vi.fn(() => ({
    addTo: vi.fn(),
    remove: vi.fn(),
  })),
}))

const testBbox: BBox = {
  north: 29,
  south: 28,
  east: -81,
  west: -82,
}

describe('BboxPreviewOverlay', () => {
  it('renders the overlay with tile count', () => {
    render(
      <BboxPreviewOverlay
        bbox={testBbox}
        mapRef={createRef()}
        estimatedTiles={250}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByTestId('bbox-preview-overlay')).toBeInTheDocument()
    expect(screen.getByText(/250 tiles/)).toBeInTheDocument()
  })

  it('renders Download and Cancel buttons', () => {
    render(
      <BboxPreviewOverlay
        bbox={testBbox}
        mapRef={createRef()}
        estimatedTiles={100}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByTestId('bbox-confirm')).toHaveTextContent('Download')
    expect(screen.getByTestId('bbox-cancel')).toHaveTextContent('Cancel')
  })

  it('calls onConfirm when Download is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <BboxPreviewOverlay
        bbox={testBbox}
        mapRef={createRef()}
        estimatedTiles={100}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('bbox-confirm'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn()
    render(
      <BboxPreviewOverlay
        bbox={testBbox}
        mapRef={createRef()}
        estimatedTiles={100}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    )
    fireEvent.click(screen.getByTestId('bbox-cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('shows large download warning when estimated tiles > 500', () => {
    render(
      <BboxPreviewOverlay
        bbox={testBbox}
        mapRef={createRef()}
        estimatedTiles={600}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText(/large download/i)).toBeInTheDocument()
  })

  it('does not show large download warning for small tile counts', () => {
    render(
      <BboxPreviewOverlay
        bbox={testBbox}
        mapRef={createRef()}
        estimatedTiles={100}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.queryByText(/large download/i)).not.toBeInTheDocument()
  })

  it('shows approximate download size in MB', () => {
    render(
      <BboxPreviewOverlay
        bbox={testBbox}
        mapRef={createRef()}
        estimatedTiles={1024}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText(/~15 MB/)).toBeInTheDocument()
  })
})
