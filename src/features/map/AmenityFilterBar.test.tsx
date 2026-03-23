import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AmenityFilterBar from './AmenityFilterBar'
import { useAmenityFilterStore } from '@/store/amenityFilterStore'

beforeEach(() => {
  useAmenityFilterStore.setState({ activeFilters: [] })
})

describe('AmenityFilterBar', () => {
  it('renders all 7 chips by name', () => {
    render(<AmenityFilterBar />)
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
    const waterBtn = screen.getByRole('button', { name: /water/i })
    expect(waterBtn).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(waterBtn)
    expect(waterBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('tapping an active chip deactivates it (aria-pressed=false)', () => {
    render(<AmenityFilterBar />)
    const dumpBtn = screen.getByRole('button', { name: /dump/i })
    fireEvent.click(dumpBtn) // activate
    expect(dumpBtn).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(dumpBtn) // deactivate
    expect(dumpBtn).toHaveAttribute('aria-pressed', 'false')
  })

  it('tapping two chips activates both (AND state visible)', () => {
    render(<AmenityFilterBar />)
    const waterBtn = screen.getByRole('button', { name: /water/i })
    const dumpBtn = screen.getByRole('button', { name: /dump/i })
    fireEvent.click(waterBtn)
    fireEvent.click(dumpBtn)
    expect(waterBtn).toHaveAttribute('aria-pressed', 'true')
    expect(dumpBtn).toHaveAttribute('aria-pressed', 'true')
  })
})
