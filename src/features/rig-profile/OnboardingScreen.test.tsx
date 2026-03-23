import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import OnboardingScreen from './OnboardingScreen'
import { useRigStore } from '@/store/rigStore'
import { DEFAULT_RIG_PROFILE } from '@/types/rigProfile'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('OnboardingScreen', () => {
  beforeEach(() => {
    localStorage.clear()
    useRigStore.getState().clearRigProfile()
    mockNavigate.mockClear()
  })

  // AC2: Five rig class chips rendered as radio buttons
  it('renders all 5 rig class options as radio buttons', () => {
    render(<OnboardingScreen />, { wrapper: MemoryRouter })
    // M4: chips are role="radio", not buttons
    expect(screen.getByRole('radio', { name: /class a/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /class b/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /class c/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /travel trailer/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /5th wheel/i })).toBeInTheDocument()
  })

  // AC2: Selected chip shows aria-checked=true (M4: was aria-pressed)
  it('marks selected rig class chip as aria-checked', () => {
    render(<OnboardingScreen />, { wrapper: MemoryRouter })
    const classABtn = screen.getByRole('radio', { name: /class a/i })
    expect(classABtn).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(classABtn)
    expect(classABtn).toHaveAttribute('aria-checked', 'true')
  })

  // AC2: Only one chip is checked at a time
  it('unchecks previous chip when a new one is selected', () => {
    render(<OnboardingScreen />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('radio', { name: /class a/i }))
    fireEvent.click(screen.getByRole('radio', { name: /class b/i }))
    expect(screen.getByRole('radio', { name: /class a/i })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: /class b/i })).toHaveAttribute('aria-checked', 'true')
  })

  // AC3 + Task 3: Selecting a class pre-fills length with class default
  it('pre-fills length with class default when Class A is selected', () => {
    render(<OnboardingScreen />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('radio', { name: /class a/i }))
    expect(screen.getByRole('spinbutton', { name: /rig length in feet/i })).toHaveValue(35)
  })

  it('pre-fills length with class default when Class B is selected', () => {
    render(<OnboardingScreen />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('radio', { name: /class b/i }))
    expect(screen.getByRole('spinbutton', { name: /rig length in feet/i })).toHaveValue(20)
  })

  // AC4 + Task 3: Height defaults pre-filled by class (12ft 6in = 12.5 for Class A)
  it('pre-fills height feet with class default when Class A is selected', () => {
    render(<OnboardingScreen />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('radio', { name: /class a/i }))
    expect(screen.getByRole('spinbutton', { name: /height feet/i })).toHaveValue(12)
  })

  it('pre-fills height inches with class default when Class A is selected (12ft 6in)', () => {
    render(<OnboardingScreen />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('radio', { name: /class a/i }))
    expect(screen.getByRole('spinbutton', { name: /height inches/i })).toHaveValue(6)
  })

  // AC7: Save without rig class shows validation error
  it('shows validation error when Save is clicked without selecting a rig class', () => {
    render(<OnboardingScreen />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('button', { name: /save my rig/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/please select your rig class/i)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  // AC7: setRigProfile NOT called when rig class is missing
  it('does not call setRigProfile when Save is clicked without a rig class', () => {
    render(<OnboardingScreen />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('button', { name: /save my rig/i }))
    expect(useRigStore.getState().rigProfile.rigType).toBeNull()
  })

  // M1: Validation error clears when user selects a class chip after seeing the error
  it('clears validation error when user selects a rig class after failed save', () => {
    render(<OnboardingScreen />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('button', { name: /save my rig/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /class a/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  // AC5: Save with valid inputs saves to store and navigates to /
  it('saves rig profile to store and navigates to / on Save My Rig', () => {
    render(<OnboardingScreen />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('radio', { name: /class a/i }))
    fireEvent.click(screen.getByRole('button', { name: /save my rig/i }))
    const profile = useRigStore.getState().rigProfile
    expect(profile.rigType).toBe('Class A')
    expect(profile.lengthFt).toBe(35)
    expect(profile.heightFt).toBe(12.5)
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  // AC6: Skip navigates to / without saving
  it('navigates to / on Skip without saving rig profile', () => {
    render(<OnboardingScreen />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/')
    expect(useRigStore.getState().rigProfile.rigType).toBeNull()
  })

  // AC6: Skip does NOT call setRigProfile
  it('does not call setRigProfile on Skip', () => {
    render(<OnboardingScreen />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }))
    expect(useRigStore.getState().rigProfile).toEqual(DEFAULT_RIG_PROFILE)
  })

  // Task 4: Height stored as decimal feet (12ft 6in → 12.5)
  it('stores height as decimal feet when saving (Class A: 12ft 6in → 12.5)', () => {
    render(<OnboardingScreen />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('radio', { name: /class a/i }))
    fireEvent.click(screen.getByRole('button', { name: /save my rig/i }))
    expect(useRigStore.getState().rigProfile.heightFt).toBe(12.5)
  })

  // Task 4: Custom height via input with blur-to-commit (M3)
  it('stores updated height correctly after user changes to 10ft 0in', () => {
    render(<OnboardingScreen />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('radio', { name: /class c/i })) // default 11ft
    const heightFtInput = screen.getByRole('spinbutton', { name: /height feet/i })
    const heightInInput = screen.getByRole('spinbutton', { name: /height inches/i })
    fireEvent.change(heightFtInput, { target: { value: '10' } })
    fireEvent.blur(heightFtInput) // M3: blur commits the value
    fireEvent.change(heightInInput, { target: { value: '0' } })
    fireEvent.blur(heightInInput) // M3: blur commits the value
    fireEvent.click(screen.getByRole('button', { name: /save my rig/i }))
    expect(useRigStore.getState().rigProfile.heightFt).toBe(10.0)
  })

  // M2: Height cannot exceed 16ft — 16ft Xin is clamped to 16ft 0in
  it('clamps height inches to 0 when feet is at maximum (16ft)', () => {
    render(<OnboardingScreen />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('radio', { name: /class a/i }))
    const heightFtInput = screen.getByRole('spinbutton', { name: /height feet/i })
    const heightInInput = screen.getByRole('spinbutton', { name: /height inches/i })
    fireEvent.change(heightFtInput, { target: { value: '16' } })
    fireEvent.blur(heightFtInput)
    // inches should auto-reset to 0 when feet hits max
    expect(heightInInput).toHaveValue(0)
    fireEvent.click(screen.getByRole('button', { name: /save my rig/i }))
    // stored height should be exactly 16.0, not 16.916...
    expect(useRigStore.getState().rigProfile.heightFt).toBe(16.0)
  })

  // AC3: Length stepper clamping at boundaries
  it('– button does not decrease length below 10ft', () => {
    render(<OnboardingScreen />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('radio', { name: /class b/i })) // default 20ft
    const decreaseBtn = screen.getByRole('button', { name: /decrease length/i })
    for (let i = 0; i < 15; i++) fireEvent.click(decreaseBtn)
    expect(screen.getByRole('spinbutton', { name: /rig length in feet/i })).toHaveValue(10)
  })

  it('+ button does not increase length above 65ft', () => {
    render(<OnboardingScreen />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('radio', { name: /class a/i })) // default 35ft
    const increaseBtn = screen.getByRole('button', { name: /increase length/i })
    for (let i = 0; i < 40; i++) fireEvent.click(increaseBtn)
    expect(screen.getByRole('spinbutton', { name: /rig length in feet/i })).toHaveValue(65)
  })

  // AC5: Travel Trailer defaults
  it('saves Travel Trailer profile with correct defaults', () => {
    render(<OnboardingScreen />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('radio', { name: /travel trailer/i }))
    fireEvent.click(screen.getByRole('button', { name: /save my rig/i }))
    const profile = useRigStore.getState().rigProfile
    expect(profile.rigType).toBe('Travel Trailer')
    expect(profile.lengthFt).toBe(25)
    expect(profile.heightFt).toBe(10.0)
  })

  // L3: 5th Wheel defaults (previously untested)
  it('saves 5th Wheel profile with correct defaults', () => {
    render(<OnboardingScreen />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('radio', { name: /5th wheel/i }))
    fireEvent.click(screen.getByRole('button', { name: /save my rig/i }))
    const profile = useRigStore.getState().rigProfile
    expect(profile.rigType).toBe('5th Wheel')
    expect(profile.lengthFt).toBe(30)
    expect(profile.heightFt).toBe(12.0)
  })

  // AC8: Save My Rig and Skip buttons are present
  it('renders Save My Rig and Skip for now as buttons', () => {
    render(<OnboardingScreen />, { wrapper: MemoryRouter })
    expect(screen.getByRole('button', { name: /save my rig/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /skip for now/i })).toBeInTheDocument()
  })
})
