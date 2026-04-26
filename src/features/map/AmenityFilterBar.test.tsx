import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AmenityFilterBar from './AmenityFilterBar'
import { useAmenityFilterStore } from '@/store/amenityFilterStore'

beforeEach(() => {
  useAmenityFilterStore.setState({ activeFilters: [] })
})

function openFilterPanel() {
  const filterBtn = screen.getByRole('button', { name: /filters/i })
  fireEvent.click(filterBtn)
}

describe('AmenityFilterBar', () => {
  it('renders a collapsed filter button by default', () => {
    render(<AmenityFilterBar />)
    expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /water/i })).not.toBeInTheDocument()
  })

  it('opens panel and renders all chips when filter button is clicked', () => {
    render(<AmenityFilterBar />)
    openFilterPanel()
    expect(screen.getByRole('button', { name: /water/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dump/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /overnight/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /fuel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /propane/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /electric/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /shower/i })).toBeInTheDocument()
  })

  it('tapping an inactive chip sets it active (aria-pressed=true)', () => {
    render(<AmenityFilterBar />)
    openFilterPanel()
    const waterBtn = screen.getByRole('button', { name: /water/i })
    expect(waterBtn).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(waterBtn)
    expect(waterBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('tapping an active chip deactivates it (aria-pressed=false)', () => {
    render(<AmenityFilterBar />)
    openFilterPanel()
    const dumpBtn = screen.getByRole('button', { name: /dump/i })
    fireEvent.click(dumpBtn) // activate
    expect(dumpBtn).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(dumpBtn) // deactivate
    expect(dumpBtn).toHaveAttribute('aria-pressed', 'false')
  })

  it('tapping two chips activates both (AND state visible)', () => {
    render(<AmenityFilterBar />)
    openFilterPanel()
    const waterBtn = screen.getByRole('button', { name: /water/i })
    const dumpBtn = screen.getByRole('button', { name: /dump/i })
    fireEvent.click(waterBtn)
    fireEvent.click(dumpBtn)
    expect(waterBtn).toHaveAttribute('aria-pressed', 'true')
    expect(dumpBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows active count badge on filter button when filters are active', () => {
    useAmenityFilterStore.setState({ activeFilters: ['water', 'dump'] })
    render(<AmenityFilterBar />)
    expect(screen.getByRole('button', { name: /filters \(2 active\)/i })).toBeInTheDocument()
  })

  it('returns null when isSearchExpanded is true', () => {
    const { container } = render(<AmenityFilterBar isSearchExpanded={true} />)
    expect(container.firstChild).toBeNull()
  })
})
