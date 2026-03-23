import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import AdminPinList from './AdminPinList'
import type { Pin } from '@/types/pin'

// ── Mock setup ──────────────────────────────────────────────────────────────

const { mockGetAllPins } = vi.hoisted(() => {
  const mockGetAllPins = vi.fn()
  return { mockGetAllPins }
})

vi.mock('@/lib/supabase/pins', () => ({
  getAllPins: mockGetAllPins,
}))

// ── Helpers ─────────────────────────────────────────────────────────────────

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

function renderList(onSelect = vi.fn(), queryClient = freshClient()) {
  const wrapper = makeWrapper(queryClient)
  return render(<AdminPinList onSelect={onSelect} />, { wrapper })
}

const STUB_PIN: Pin = {
  id: 'pin-1',
  name: 'Test Campsite',
  description: null,
  latitude: 37.5,
  longitude: -107.5,
  pinType: 'community',
  sourceId: null,
  maxLengthFt: null,
  maxHeightFt: null,
  amenities: { water: true, dump: false, electric: false, shower: false, fuel: false, propane: false, overnight: true },
  badgeState: 'green',
  lastCheckInAt: null,
  recentCheckInCount: 0,
  isVerified: true,
  isFlagged: false,
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AdminPinList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAllPins.mockResolvedValue([])
  })

  it('shows "Loading pins..." while query is pending (4.3)', async () => {
    mockGetAllPins.mockReturnValue(new Promise(() => {}))
    await act(async () => {
      renderList()
    })
    expect(screen.getByText(/loading pins/i)).toBeInTheDocument()
  })

  it('shows "Failed to load pins." on getAllPins rejection (4.4)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockGetAllPins.mockRejectedValue(new Error('Network error'))
    await act(async () => {
      renderList()
    })
    await waitFor(() => {
      expect(screen.getByText('Failed to load pins.')).toBeInTheDocument()
    })
    consoleSpy.mockRestore()
  })

  it('shows "No pins found." when getAllPins returns empty array (4.5)', async () => {
    mockGetAllPins.mockResolvedValue([])
    await act(async () => {
      renderList()
    })
    await waitFor(() => {
      expect(screen.getByText('No pins found.')).toBeInTheDocument()
    })
  })

  it('renders pin name and Edit button for each pin (4.6)', async () => {
    mockGetAllPins.mockResolvedValue([STUB_PIN])
    await act(async () => {
      renderList()
    })
    await waitFor(() => {
      expect(screen.getByText('Test Campsite')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /edit test campsite/i })).toBeInTheDocument()
    })
  })

  it('clicking Edit calls onSelect with the correct pin object (4.7)', async () => {
    const onSelect = vi.fn()
    mockGetAllPins.mockResolvedValue([STUB_PIN])
    await act(async () => {
      renderList(onSelect)
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit test campsite/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /edit test campsite/i }))
    expect(onSelect).toHaveBeenCalledWith(STUB_PIN)
  })

  it('Edit buttons have min-h-[44px] class (NFR-A4) (4.8)', async () => {
    mockGetAllPins.mockResolvedValue([STUB_PIN])
    await act(async () => {
      renderList()
    })
    await waitFor(() => {
      const editBtn = screen.getByRole('button', { name: /edit test campsite/i })
      expect(editBtn.className).toContain('min-h-[44px]')
    })
  })
})
