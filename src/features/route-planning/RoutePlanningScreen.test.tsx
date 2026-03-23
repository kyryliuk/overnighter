import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DEFAULT_RIG_PROFILE } from '@/types/rigProfile'
import { useRigStore } from '@/store/rigStore'
import { useSpotsStore } from '@/store/spotsStore'
import { useTripPlansStore } from '@/store/tripPlansStore'
import RoutePlanningScreen from './RoutePlanningScreen'

const clipboardWriteText = vi.fn<() => Promise<void>>()
const revokeTripPlanShare = vi.fn<() => Promise<void>>()
const getTripPlanCommentSummaries = vi.fn()
const getTripPlanHelpfulCounts = vi.fn()

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RoutePlanningScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function seedTripPlans() {
  useTripPlansStore.setState({
    tripPlans: [{
      id: 'trip-1',
      title: 'Snowbird Run',
      notes: 'Existing shared route note',
      destination: { id: 'dest', name: 'Quartzsite', latitude: 33.6639, longitude: -114.2297 },
      stops: [],
      isPublic: true,
      shareToken: 'share-123',
      sourceTrip: null,
      createdAt: '2026-03-23T00:00:00.000Z',
      updatedAt: '2026-03-23T00:00:00.000Z',
    }],
    hasHydrated: true,
  })
}

vi.mock('@/hooks/usePinsQuery', () => ({
  usePinsQuery: () => ({ data: [], isLoading: false }),
}))

vi.mock('@/hooks/useGeolocation', () => ({
  useGeolocation: () => [{ coords: null, error: 'denied' }, vi.fn()],
}))

vi.mock('@/features/account/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    session: { user: { id: 'user-1' } },
  }),
}))

vi.mock('@/lib/supabase/tripPlans', () => ({
  ensureTripPlanShareToken: vi.fn(),
  revokeTripPlanShare: (...args: unknown[]) => revokeTripPlanShare(...args),
}))

vi.mock('@/lib/supabase/tripPlanComments', () => ({
  getTripPlanCommentSummaries: (...args: unknown[]) => getTripPlanCommentSummaries(...args),
}))

vi.mock('@/lib/supabase/tripPlanReactions', () => ({
  getTripPlanHelpfulCounts: (...args: unknown[]) => getTripPlanHelpfulCounts(...args),
}))

describe('RoutePlanningScreen sharing UX', () => {
  beforeEach(() => {
    localStorage.clear()
    clipboardWriteText.mockReset()
    clipboardWriteText.mockResolvedValue(undefined)
    revokeTripPlanShare.mockReset()
    revokeTripPlanShare.mockResolvedValue(undefined)
    getTripPlanCommentSummaries.mockReset()
    getTripPlanCommentSummaries.mockResolvedValue({
      'share-123': {
        count: 2,
        latestComment: {
          authorLabel: 'Roadrunner',
          body: 'Fuel up before the long desert stretch.',
          createdAt: '2026-03-23T00:00:00.000Z',
        },
      },
    })
    getTripPlanHelpfulCounts.mockReset()
    getTripPlanHelpfulCounts.mockResolvedValue({ 'share-123': 3 })

    seedTripPlans()
    useSpotsStore.setState({ savedSpots: [], hasHydrated: true })
    useRigStore.setState({
      rigProfile: DEFAULT_RIG_PROFILE,
      onboardingDismissed: false,
      updatedAt: null,
      hasHydrated: true,
    })

    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: clipboardWriteText },
    })
  })

  it('shows link-management controls and feedback summaries for shared trip drafts', async () => {
    renderScreen()

    expect(screen.getByText('Public trip link is live.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open link/i })).toHaveAttribute(
      'href',
      `${window.location.origin}/shared-trip/share-123`,
    )
    expect(await screen.findByText('3 travelers found this helpful.')).toBeInTheDocument()
    expect(await screen.findByText('2 comments on this shared trip.')).toBeInTheDocument()
    expect(await screen.findByText('Latest: Roadrunner — Fuel up before the long desert stretch.')).toBeInTheDocument()
  })

  it('copies the existing public trip link from the planner', async () => {
    renderScreen()

    fireEvent.click(screen.getByRole('button', { name: /copy link/i }))

    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(`${window.location.origin}/shared-trip/share-123`)
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      `Public trip link copied. ${window.location.origin}/shared-trip/share-123`,
    )
  })

  it('requires confirmation before revoking a public trip link', async () => {
    const confirmMock = vi.fn(() => false)
    vi.stubGlobal('confirm', confirmMock)

    renderScreen()

    fireEvent.click(screen.getByRole('button', { name: /unshare/i }))

    expect(confirmMock).toHaveBeenCalledWith(
      'Disable this public trip link? Anyone using the current link will lose access.',
    )
    expect(revokeTripPlanShare).not.toHaveBeenCalled()
  })

  it('shows remix attribution and an original-link shortcut for imported drafts', () => {
    useTripPlansStore.setState({
      tripPlans: [{
        id: 'trip-2',
        title: 'Snowbird Run (copy)',
        notes: 'Imported route note',
        destination: { id: 'dest', name: 'Quartzsite', latitude: 33.6639, longitude: -114.2297 },
        stops: [],
        isPublic: false,
        shareToken: null,
        sourceTrip: {
          shareToken: 'source-share-456',
          title: 'Original Snowbird Run',
        },
        createdAt: '2026-03-23T00:00:00.000Z',
        updatedAt: '2026-03-23T00:00:00.000Z',
      }],
      hasHydrated: true,
    })

    renderScreen()

    expect(screen.getByText('Remixed from a shared trip.')).toBeInTheDocument()
    expect(screen.getByText('Source: Original Snowbird Run')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open original shared trip/i })).toHaveAttribute(
      'href',
      `${window.location.origin}/shared-trip/source-share-456`,
    )
  })
})
