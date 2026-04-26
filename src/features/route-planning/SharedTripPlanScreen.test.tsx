import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SharedTripPlanScreen from './SharedTripPlanScreen'

const getPublicTripPlanByToken = vi.fn()
const getTripPlanComments = vi.fn()
const createTripPlanComment = vi.fn()
const deleteTripPlanComment = vi.fn()
const getTripPlanReactionSummary = vi.fn()
const setTripPlanHelpfulReaction = vi.fn()
const mockImportMutateAsync = vi.fn()

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

let mockAuthState = {
  isAuthenticated: true,
  session: { user: { id: 'user-1' }, access_token: 'tok' },
  isLoading: false,
}

vi.mock('@/features/account/AuthContext', () => ({
  useAuth: () => mockAuthState,
}))

let mockSubscriptionState = { isPremium: true, isTrial: false, status: 'premium', isLoading: false }

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => mockSubscriptionState,
}))

let mockImportMutationState: { mutateAsync: typeof mockImportMutateAsync; isPending: boolean; error: Error | null } = {
  mutateAsync: mockImportMutateAsync,
  isPending: false,
  error: null,
}

vi.mock('./useCreateTripMutation', () => ({
  useCreateTripMutation: () => mockImportMutationState,
}))

vi.mock('@/lib/supabase/tripPlans', () => ({
  getPublicTripPlanByToken: (...args: unknown[]) => getPublicTripPlanByToken(...args),
}))

vi.mock('@/lib/supabase/tripPlanComments', () => ({
  getTripPlanComments: (...args: unknown[]) => getTripPlanComments(...args),
  createTripPlanComment: (...args: unknown[]) => createTripPlanComment(...args),
  deleteTripPlanComment: (...args: unknown[]) => deleteTripPlanComment(...args),
}))

vi.mock('@/lib/supabase/tripPlanReactions', () => ({
  getTripPlanReactionSummary: (...args: unknown[]) => getTripPlanReactionSummary(...args),
  setTripPlanHelpfulReaction: (...args: unknown[]) => setTripPlanHelpfulReaction(...args),
}))

// PremiumGate: renders children for premium users; renders upsell stub for others.
// The real PremiumGate is unit-tested separately.
vi.mock('@/components/PremiumGate', () => ({
  PremiumGate: ({ children, feature }: { children: ReactNode; feature: string }) => {
    if (mockSubscriptionState.isPremium) return <>{children}</>
    return <div data-testid="premium-gate-upsell">{feature}</div>
  },
}))

const TRIP_DATA = {
  id: 'trip-1',
  title: 'Desert handoff',
  notes: 'Best for a quiet overnight stop after dark.',
  destination: { id: 'dest', name: 'Quartzsite', latitude: 33.6639, longitude: -114.2297 },
  stops: [],
  isPublic: true,
  shareToken: 'share-123',
  sourceTrip: null,
  createdAt: '2026-03-23T00:00:00.000Z',
  updatedAt: '2026-03-23T00:00:00.000Z',
}

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/shared-trip/share-123']}>
        <Routes>
          <Route path="/shared-trip/:shareToken" element={<SharedTripPlanScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SharedTripPlanScreen', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockImportMutateAsync.mockReset()
    getPublicTripPlanByToken.mockReset()
    getTripPlanComments.mockReset()
    createTripPlanComment.mockReset()
    deleteTripPlanComment.mockReset()
    getTripPlanReactionSummary.mockReset()
    setTripPlanHelpfulReaction.mockReset()

    // Default: authenticated premium user
    mockAuthState = { isAuthenticated: true, session: { user: { id: 'user-1' }, access_token: 'tok' }, isLoading: false }
    mockSubscriptionState = { isPremium: true, isTrial: false, status: 'premium', isLoading: false }
    mockImportMutationState = { mutateAsync: mockImportMutateAsync, isPending: false, error: null }

    getPublicTripPlanByToken.mockResolvedValue(TRIP_DATA)
    getTripPlanReactionSummary.mockResolvedValue({ helpfulCount: 2, hasReacted: false })
    getTripPlanComments.mockResolvedValue([
      {
        id: 'comment-1',
        authorLabel: 'Roadrunner',
        body: 'Fuel up before the last stretch.',
        createdAt: '2026-03-23T00:00:00.000Z',
        canDelete: true,
      },
    ])
    createTripPlanComment.mockResolvedValue(undefined)
    deleteTripPlanComment.mockResolvedValue(undefined)
    setTripPlanHelpfulReaction.mockResolvedValue(undefined)
    mockImportMutateAsync.mockResolvedValue({ id: 'new-trip-1' })
  })

  it('shows trip notes, comments, and public helpful feedback count', async () => {
    renderScreen()

    expect(await screen.findByText('Trip note')).toBeInTheDocument()
    expect(screen.getByText('Best for a quiet overnight stop after dark.')).toBeInTheDocument()
    expect(screen.getByText('2 travelers found this helpful.')).toBeInTheDocument()
    expect(screen.getByText('Fuel up before the last stretch.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mark as helpful/i })).toBeInTheDocument()
  })

  it('saves a helpful reaction for signed-in viewers', async () => {
    renderScreen()

    fireEvent.click(await screen.findByRole('button', { name: /mark as helpful/i }))

    await waitFor(() => {
      expect(setTripPlanHelpfulReaction).toHaveBeenCalledWith('share-123', 'user-1', true)
    })
  })

  it('posts a new comment for signed-in viewers', async () => {
    renderScreen()

    fireEvent.change(await screen.findByLabelText(/comment display name/i), {
      target: { value: 'Camp Scout' },
    })
    fireEvent.change(screen.getByLabelText(/comment body/i), {
      target: { value: 'Quiet lot after 9pm, but arrive before midnight.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /post comment/i }))

    await waitFor(() => {
      expect(createTripPlanComment).toHaveBeenCalledWith({
        shareToken: 'share-123',
        userId: 'user-1',
        authorLabel: 'Camp Scout',
        body: 'Quiet lot after 9pm, but arrive before midnight.',
      })
    })
  })

  it('allows owners or authors to remove a comment', async () => {
    renderScreen()

    fireEvent.click(await screen.findByRole('button', { name: /delete/i }))

    await waitFor(() => {
      expect(deleteTripPlanComment).toHaveBeenCalledWith('comment-1')
    })
  })

  it('"Open planner" button navigates to /trips', async () => {
    renderScreen()

    fireEvent.click(await screen.findByRole('button', { name: /open planner/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/trips')
  })

  describe('premium import', () => {
    it('premium user: import creates trip with correct payload and navigates to /trips (AC3)', async () => {
      renderScreen()

      fireEvent.click(await screen.findByRole('button', { name: /save a copy to my planner/i }))

      await waitFor(() => {
        expect(mockImportMutateAsync).toHaveBeenCalledWith({
          title: 'Desert handoff',
          notes: 'Best for a quiet overnight stop after dark.',
          destination: { id: 'dest', name: 'Quartzsite', latitude: 33.6639, longitude: -114.2297 },
          stops: [],
          sourceTripId: 'trip-1',
        })
      })

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/trips')
      })
    })

    it('premium user: import maps waypoint stops with source=imported and correct stopOrder', async () => {
      getPublicTripPlanByToken.mockResolvedValue({
        ...TRIP_DATA,
        stops: [
          { id: 'stop-1', name: 'Blythe', latitude: 33.6, longitude: -114.5 },
          { id: 'stop-2', name: 'Parker', latitude: 34.1, longitude: -114.3 },
        ],
      })

      renderScreen()

      fireEvent.click(await screen.findByRole('button', { name: /save a copy to my planner/i }))

      await waitFor(() => {
        expect(mockImportMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            stops: [
              { stopOrder: 1, source: 'imported', pinId: null, place: { id: 'stop-1', name: 'Blythe', latitude: 33.6, longitude: -114.5 }, notes: '' },
              { stopOrder: 2, source: 'imported', pinId: null, place: { id: 'stop-2', name: 'Parker', latitude: 34.1, longitude: -114.3 }, notes: '' },
            ],
          }),
        )
      })
    })

    it('non-premium authenticated user sees PremiumGate upsell, not the import button (AC2)', async () => {
      mockSubscriptionState = { isPremium: false, isTrial: false, status: 'free', isLoading: false }

      renderScreen()

      expect(await screen.findByTestId('premium-gate-upsell')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /save a copy to my planner/i })).not.toBeInTheDocument()
    })

    it('non-authenticated user sees PremiumGate upsell — gate handles auth redirect (AC2)', async () => {
      mockAuthState = { isAuthenticated: false, session: null as never, isLoading: false }
      mockSubscriptionState = { isPremium: false, isTrial: false, status: 'free', isLoading: false }

      renderScreen()

      expect(await screen.findByTestId('premium-gate-upsell')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /save a copy to my planner/i })).not.toBeInTheDocument()
    })

    it('shows error alert when import mutation has an error', async () => {
      mockImportMutationState = {
        mutateAsync: mockImportMutateAsync,
        isPending: false,
        error: new Error('Unable to save your route right now.'),
      }

      renderScreen()

      expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save your route right now.')
    })

    it('shows loading state and disables button while import is pending', async () => {
      mockImportMutationState = {
        mutateAsync: mockImportMutateAsync,
        isPending: true,
        error: null,
      }

      renderScreen()

      const button = await screen.findByRole('button', { name: /saving to planner/i })
      expect(button).toBeDisabled()
    })
  })
})
