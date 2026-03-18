import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RigEditScreen from './RigEditScreen'
import { useRigStore } from '@/store/rigStore'
import { DEFAULT_RIG_PROFILE } from '@/types/rigProfile'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('RigEditScreen', () => {
  beforeEach(() => {
    localStorage.clear()
    useRigStore.setState({ rigProfile: DEFAULT_RIG_PROFILE })
    mockNavigate.mockClear()
  })

  // Seed a saved profile before tests that need it
  function seedProfile() {
    useRigStore.getState().setRigProfile({
      rigType: 'Class A',
      lengthFt: 35,
      heightFt: 12.5,
    })
  }

  // AC2: All 5 rig class chips rendered as radio buttons
  it('renders all 5 rig class options as radio buttons', () => {
    seedProfile()
    render(<RigEditScreen />, { wrapper: MemoryRouter })
    expect(screen.getByRole('radio', { name: /class a/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /class b/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /class c/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /travel trailer/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /5th wheel/i })).toBeInTheDocument()
  })

  // AC2: Pre-populated selectedRigType from store (aria-checked="true" on saved class)
  it('pre-populates selected rig class from store (aria-checked="true")', () => {
    seedProfile()
    render(<RigEditScreen />, { wrapper: MemoryRouter })
    expect(screen.getByRole('radio', { name: /class a/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /class b/i })).toHaveAttribute('aria-checked', 'false')
  })

  // AC2: Pre-populated length input from store value
  it('pre-populates length input from store value', () => {
    seedProfile()
    render(<RigEditScreen />, { wrapper: MemoryRouter })
    expect(screen.getByRole('spinbutton', { name: /rig length in feet/i })).toHaveValue(35)
  })

  // AC2: Pre-populated height ft and inches from store value (12.5 → 12ft 6in)
  it('pre-populates height feet from store value', () => {
    seedProfile()
    render(<RigEditScreen />, { wrapper: MemoryRouter })
    expect(screen.getByRole('spinbutton', { name: /height feet/i })).toHaveValue(12)
  })

  it('pre-populates height inches from store value (12.5 → 6 inches)', () => {
    seedProfile()
    render(<RigEditScreen />, { wrapper: MemoryRouter })
    expect(screen.getByRole('spinbutton', { name: /height inches/i })).toHaveValue(6)
  })

  // AC3: "Save Changes" with changed values updates store and navigates to /
  it('saves updated rig profile to store and navigates to / on Save Changes', () => {
    seedProfile()
    render(<RigEditScreen />, { wrapper: MemoryRouter })
    // Change rig class to Class B (defaults: lengthFt=20, heightFt=7.0)
    fireEvent.click(screen.getByRole('radio', { name: /class b/i }))
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    const profile = useRigStore.getState().rigProfile
    expect(profile.rigType).toBe('Class B')
    expect(profile.lengthFt).toBe(20)
    expect(profile.heightFt).toBe(7.0) // M2: verify all 3 fields saved (AC3)
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  // AC4: "Cancel" navigates to / without changing store
  it('navigates to / on Cancel without changing store', () => {
    seedProfile()
    render(<RigEditScreen />, { wrapper: MemoryRouter })
    // Change rig class locally (do not save)
    fireEvent.click(screen.getByRole('radio', { name: /class b/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    // Store must still have all original Class A profile values unchanged (AC4, L2)
    const profile = useRigStore.getState().rigProfile
    expect(profile.rigType).toBe('Class A')
    expect(profile.lengthFt).toBe(35)
    expect(profile.heightFt).toBe(12.5)
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  // M1: Validation error clears when user selects a class chip after seeing the error
  it('clears validation error when user selects a rig class after failed save', () => {
    render(<RigEditScreen />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /class a/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  // AC7 pattern: Validation error shown when rigType cleared then Save attempted
  it('shows validation error when Save Changes is clicked with no rig class selected', () => {
    // No profile seeded — rigType is null
    render(<RigEditScreen />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/please select your rig class/i)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  // M2: Height 16ft max clamp — inches reset to 0 when feet set to 16
  it('clamps height inches to 0 when feet is set to maximum (16ft)', () => {
    seedProfile()
    render(<RigEditScreen />, { wrapper: MemoryRouter })
    const heightFtInput = screen.getByRole('spinbutton', { name: /height feet/i })
    const heightInInput = screen.getByRole('spinbutton', { name: /height inches/i })
    fireEvent.change(heightFtInput, { target: { value: '16' } })
    fireEvent.blur(heightFtInput)
    expect(heightInInput).toHaveValue(0)
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    expect(useRigStore.getState().rigProfile.heightFt).toBe(16.0)
  })

  // AC3: Length stepper clamps at 10 min and 65 max
  it('– button does not decrease length below 10ft', () => {
    useRigStore.getState().setRigProfile({ rigType: 'Class B', lengthFt: 20, heightFt: 7.0 })
    render(<RigEditScreen />, { wrapper: MemoryRouter })
    const decreaseBtn = screen.getByRole('button', { name: /decrease length/i })
    for (let i = 0; i < 15; i++) fireEvent.click(decreaseBtn)
    expect(screen.getByRole('spinbutton', { name: /rig length in feet/i })).toHaveValue(10)
  })

  it('+ button does not increase length above 65ft', () => {
    seedProfile()
    render(<RigEditScreen />, { wrapper: MemoryRouter })
    const increaseBtn = screen.getByRole('button', { name: /increase length/i })
    for (let i = 0; i < 40; i++) fireEvent.click(increaseBtn)
    expect(screen.getByRole('spinbutton', { name: /rig length in feet/i })).toHaveValue(65)
  })
})
