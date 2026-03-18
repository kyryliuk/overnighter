import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MapView from './MapView'
import { useRigStore } from '@/store/rigStore'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Avoid Leaflet DOM dependency in jsdom
vi.mock('./LeafletMap', () => ({
  default: vi.fn(() => <div data-testid="leaflet-map" />),
}))

// Avoid Supabase calls in tests
vi.mock('@/hooks/usePinsQuery', () => ({
  usePinsQuery: vi.fn(() => ({ data: [], isLoading: false, error: null })),
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('MapView redirect guard', () => {
  beforeEach(() => {
    localStorage.clear()
    useRigStore.getState().clearRigProfile()
    useRigStore.setState({ onboardingDismissed: false })
    mockNavigate.mockClear()
  })

  it('redirects to /onboarding when no rig profile and onboarding not dismissed', () => {
    render(<MapView />, { wrapper: Wrapper })
    expect(mockNavigate).toHaveBeenCalledWith('/onboarding', { replace: true })
  })

  it('does not redirect when rig profile is set', () => {
    useRigStore.getState().setRigProfile({ rigType: 'Class A', lengthFt: 35, heightFt: 12.5 })
    render(<MapView />, { wrapper: Wrapper })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('does not redirect when onboardingDismissed is true (skip path)', () => {
    useRigStore.setState({ onboardingDismissed: true })
    render(<MapView />, { wrapper: Wrapper })
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

describe('MapView rig context indicator', () => {
  beforeEach(() => {
    localStorage.clear()
    useRigStore.getState().clearRigProfile()
    useRigStore.setState({ onboardingDismissed: false })
    mockNavigate.mockClear()
  })

  it('shows "Filtering for" indicator when rig profile is saved', () => {
    useRigStore.getState().setRigProfile({ rigType: 'Class A', lengthFt: 35, heightFt: 12.5 })
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.getByRole('button', { name: /filtering for/i })).toBeInTheDocument()
  })

  it('rig context indicator text contains rig class and length', () => {
    useRigStore.getState().setRigProfile({ rigType: 'Class A', lengthFt: 35, heightFt: 12.5 })
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.getByRole('button', { name: /filtering for/i })).toHaveTextContent(
      'Filtering for: Class A, 35ft',
    )
  })

  it('shows "No rig profile" indicator when no profile and onboarding dismissed', () => {
    useRigStore.setState({ onboardingDismissed: true })
    render(<MapView />, { wrapper: Wrapper })
    expect(
      screen.getByRole('button', { name: /no rig profile/i }),
    ).toBeInTheDocument()
  })

  it('does not show "Filtering for" indicator when no rig profile', () => {
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.queryByRole('button', { name: /filtering for/i })).not.toBeInTheDocument()
  })

  it('rig context indicator navigates to /rig-edit on click', () => {
    useRigStore.getState().setRigProfile({ rigType: 'Travel Trailer', lengthFt: 25, heightFt: 10.0 })
    render(<MapView />, { wrapper: Wrapper })
    fireEvent.click(screen.getByRole('button', { name: /filtering for/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/rig-edit')
  })

  it('"No rig profile" indicator navigates to /onboarding on click', () => {
    useRigStore.setState({ onboardingDismissed: true })
    render(<MapView />, { wrapper: Wrapper })
    fireEvent.click(screen.getByRole('button', { name: /no rig profile/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/onboarding')
  })

  it('renders LeafletMap when rig profile is set', () => {
    useRigStore.getState().setRigProfile({ rigType: 'Class C', lengthFt: 28, heightFt: 11 })
    render(<MapView />, { wrapper: Wrapper })
    expect(screen.getByTestId('leaflet-map')).toBeInTheDocument()
  })
})
