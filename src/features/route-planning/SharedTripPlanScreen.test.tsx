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

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/features/account/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    session: { user: { id: 'user-1' } },
  }),
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

describe('SharedTripPlanScreen reactions', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    getPublicTripPlanByToken.mockReset()
    getTripPlanComments.mockReset()
    createTripPlanComment.mockReset()
    deleteTripPlanComment.mockReset()
    getTripPlanReactionSummary.mockReset()
    setTripPlanHelpfulReaction.mockReset()

    getPublicTripPlanByToken.mockResolvedValue({
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
    })
    getTripPlanReactionSummary.mockResolvedValue({
      helpfulCount: 2,
      hasReacted: false,
    })
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

  it('"Open planner" button navigates to /trips (AC4)', async () => {
    renderScreen()

    fireEvent.click(await screen.findByRole('button', { name: /open planner/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/trips')
  })

  it('"Copy to planner" button navigates to /trips (AC4)', async () => {
    renderScreen()

    fireEvent.click(await screen.findByRole('button', { name: /save a copy to my planner/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/trips')
    })
  })
})
