import { describe, it, expect, beforeEach } from 'vitest'
import { useAmenityFilterStore } from './amenityFilterStore'

beforeEach(() => {
  useAmenityFilterStore.setState({ activeFilters: [] })
})

describe('useAmenityFilterStore', () => {
  it('starts with empty activeFilters', () => {
    const { activeFilters } = useAmenityFilterStore.getState()
    expect(activeFilters).toEqual([])
  })

  it('toggleFilter adds amenity when not active', () => {
    useAmenityFilterStore.getState().toggleFilter('water')
    expect(useAmenityFilterStore.getState().activeFilters).toEqual(['water'])
  })

  it('toggleFilter removes amenity when already active', () => {
    useAmenityFilterStore.setState({ activeFilters: ['water'] })
    useAmenityFilterStore.getState().toggleFilter('water')
    expect(useAmenityFilterStore.getState().activeFilters).toEqual([])
  })

  it('toggleFilter adds multiple filters independently (AND state)', () => {
    useAmenityFilterStore.getState().toggleFilter('water')
    useAmenityFilterStore.getState().toggleFilter('dump')
    expect(useAmenityFilterStore.getState().activeFilters).toEqual(['water', 'dump'])
  })

  it('toggleFilter removes only the targeted filter, leaving others intact', () => {
    useAmenityFilterStore.setState({ activeFilters: ['water', 'dump', 'fuel'] })
    useAmenityFilterStore.getState().toggleFilter('dump')
    expect(useAmenityFilterStore.getState().activeFilters).toEqual(['water', 'fuel'])
  })

  it('clearFilters resets activeFilters to empty', () => {
    useAmenityFilterStore.setState({ activeFilters: ['water', 'dump'] })
    useAmenityFilterStore.getState().clearFilters()
    expect(useAmenityFilterStore.getState().activeFilters).toEqual([])
  })

  it('clearFilters on already-empty store is a no-op', () => {
    useAmenityFilterStore.getState().clearFilters()
    expect(useAmenityFilterStore.getState().activeFilters).toEqual([])
  })

  it('isFilterActive returns true for an active filter', () => {
    useAmenityFilterStore.setState({ activeFilters: ['water'] })
    expect(useAmenityFilterStore.getState().isFilterActive('water')).toBe(true)
  })

  it('isFilterActive returns false for an inactive filter', () => {
    useAmenityFilterStore.setState({ activeFilters: ['dump'] })
    expect(useAmenityFilterStore.getState().isFilterActive('water')).toBe(false)
  })

  it('isFilterActive returns false when no filters active', () => {
    expect(useAmenityFilterStore.getState().isFilterActive('fuel')).toBe(false)
  })
})
