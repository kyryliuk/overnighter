import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MapView from './MapView'
import { useRigStore } from '@/store/rigStore'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('MapView redirect guard', () => {
  beforeEach(() => {
    localStorage.clear()
    useRigStore.getState().clearRigProfile() // M3: restore Story 1.2 established pattern
    mockNavigate.mockClear()
  })

  it('redirects to /onboarding when no rig profile is set', () => {
    render(<MapView />, { wrapper: MemoryRouter })
    expect(mockNavigate).toHaveBeenCalledWith('/onboarding', { replace: true })
  })

  it('does not redirect when rig profile is set', () => {
    useRigStore.getState().setRigProfile({ rigType: 'Class A', lengthFt: 35, heightFt: 12.5 })
    render(<MapView />, { wrapper: MemoryRouter })
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

describe('MapView rig context indicator', () => {
  beforeEach(() => {
    localStorage.clear()
    useRigStore.getState().clearRigProfile() // M3: consistent with redirect guard describe
    mockNavigate.mockClear()
  })

  it('shows rig context indicator when rig profile is saved', () => {
    useRigStore.getState().setRigProfile({ rigType: 'Class A', lengthFt: 35, heightFt: 12.5 })
    render(<MapView />, { wrapper: MemoryRouter })
    expect(screen.getByRole('button', { name: /filtering for/i })).toBeInTheDocument()
  })

  it('rig context indicator text contains rig class and length', () => {
    useRigStore.getState().setRigProfile({ rigType: 'Class A', lengthFt: 35, heightFt: 12.5 })
    render(<MapView />, { wrapper: MemoryRouter })
    expect(screen.getByRole('button', { name: /filtering for/i })).toHaveTextContent('Filtering for: Class A, 35ft')
  })

  it('does not show rig context indicator when no rig profile set', () => {
    // No profile — redirect fires, but indicator must not render
    render(<MapView />, { wrapper: MemoryRouter })
    expect(screen.queryByRole('button', { name: /filtering for/i })).not.toBeInTheDocument()
  })

  it('rig context indicator navigates to /rig-edit on click', () => {
    useRigStore.getState().setRigProfile({ rigType: 'Travel Trailer', lengthFt: 25, heightFt: 10.0 })
    render(<MapView />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('button', { name: /filtering for/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/rig-edit')
  })
})
