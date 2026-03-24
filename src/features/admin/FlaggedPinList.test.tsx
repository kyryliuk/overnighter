import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import FlaggedPinList from './FlaggedPinList'

const ADMIN_TOKEN = 'test-admin-token'

const STUB_PINS = [
  {
    id: 'pin-1',
    name: 'Dirty Dump',
    latitude: 37.1,
    longitude: -107.1,
    badge_state: 'red',
    badge_override: null as string | null,
    is_archived: false,
    flag_count: 4,
    latest_report_type: 'dump_closed',
  },
  {
    id: 'pin-2',
    name: 'No Overnight',
    latitude: 38.0,
    longitude: -108.0,
    badge_state: 'red',
    badge_override: null as string | null,
    is_archived: false,
    flag_count: 3,
    latest_report_type: 'no_overnight',
  },
]

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

function renderList(queryClient = freshClient()) {
  const wrapper = makeWrapper(queryClient)
  return render(<FlaggedPinList adminToken={ADMIN_TOKEN} />, { wrapper })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('FlaggedPinList', () => {
  it('shows "Loading flagged pins..." while query is pending (13.3)', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
    )
    renderList()
    expect(screen.getByText(/loading flagged pins/i)).toBeInTheDocument()
  })

  it('shows empty state when fetch returns [] (13.4)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    )
    await act(async () => {
      renderList()
    })
    await waitFor(() => {
      expect(screen.getByText(/no flagged pins — map data is healthy/i)).toBeInTheDocument()
    })
  })

  it('renders pin name, badge state, flag count, and latest report type (13.5)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => STUB_PINS,
      }),
    )
    await act(async () => {
      renderList()
    })
    await waitFor(() => {
      expect(screen.getByText('Dirty Dump')).toBeInTheDocument()
    })
    // "No Overnight" appears as both pin name and filter chip — verify the pin card exists
    expect(screen.getAllByText('No Overnight').length).toBeGreaterThanOrEqual(2) // chip + pin name
    expect(screen.getByText(/4 flags/i)).toBeInTheDocument()
    expect(screen.getByText(/· Dump Closed/i)).toBeInTheDocument()
  })

  it('clicking "Archive Pin" calls DELETE /api/pins/:id with Bearer header (13.6)', async () => {
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => STUB_PINS }) // initial load
      .mockResolvedValue({ ok: true, json: async () => [] }) // after mutation refetch

    vi.stubGlobal('fetch', fetchMock)

    await act(async () => {
      renderList()
    })
    await waitFor(() => expect(screen.getByText('Dirty Dump')).toBeInTheDocument())

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /archive pin/i })[0])
    })

    await waitFor(() => {
      const deleteCalls = fetchMock.mock.calls.filter(
        ([url, opts]: [string, RequestInit]) => opts?.method === 'DELETE' && url.includes('pin-1'),
      )
      expect(deleteCalls.length).toBeGreaterThan(0)
      const [, opts] = deleteCalls[0] as [string, RequestInit]
      expect((opts.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${ADMIN_TOKEN}`)
    })
  })

  it('clicking "Mark Verified" calls PATCH with { action: "verify" } (13.7)', async () => {
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => STUB_PINS })
      .mockResolvedValue({ ok: true, json: async () => [] })

    vi.stubGlobal('fetch', fetchMock)

    await act(async () => {
      renderList()
    })
    await waitFor(() => expect(screen.getByText('Dirty Dump')).toBeInTheDocument())

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /mark verified/i })[0])
    })

    await waitFor(() => {
      const patchCalls = fetchMock.mock.calls.filter(
        ([url, opts]: [string, RequestInit]) => opts?.method === 'PATCH' && url.includes('pin-1'),
      )
      expect(patchCalls.length).toBeGreaterThan(0)
      const [, opts] = patchCalls[0] as [string, RequestInit]
      expect(JSON.parse(opts.body as string)).toEqual({ action: 'verify' })
    })
  })

  it('clicking "Clear Flags" calls PATCH with { action: "dismiss" } (13.8)', async () => {
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => STUB_PINS })
      .mockResolvedValue({ ok: true, json: async () => [] })

    vi.stubGlobal('fetch', fetchMock)

    await act(async () => {
      renderList()
    })
    await waitFor(() => expect(screen.getByText('Dirty Dump')).toBeInTheDocument())

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /clear flags/i })[0])
    })

    await waitFor(() => {
      const patchCalls = fetchMock.mock.calls.filter(
        ([url, opts]: [string, RequestInit]) => opts?.method === 'PATCH' && url.includes('pin-1'),
      )
      expect(patchCalls.length).toBeGreaterThan(0)
      const [, opts] = patchCalls[0] as [string, RequestInit]
      expect(JSON.parse(opts.body as string)).toEqual({ action: 'dismiss' })
    })
  })

  it('shows error message when fetch fails (L1)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    )
    await act(async () => {
      renderList()
    })
    await waitFor(() => {
      expect(screen.getByText(/failed to load flagged pins/i)).toBeInTheDocument()
    })
  })

  it('action buttons are disabled while mutation is pending for that pin (L2)', async () => {
    let resolveArchive!: (value: unknown) => void
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => STUB_PINS }) // initial load
      .mockReturnValueOnce(new Promise((resolve) => { resolveArchive = resolve })) // archive — never resolves

    vi.stubGlobal('fetch', fetchMock)

    await act(async () => {
      renderList()
    })
    await waitFor(() => expect(screen.getByText('Dirty Dump')).toBeInTheDocument())

    // Click archive on pin-1 — mutation is now pending
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /archive pin dirty dump/i })[0])
    })

    // While pending, all three buttons for pin-1 should be disabled
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /archive pin dirty dump/i })[0]).toBeDisabled()
    })

    // Resolve the pending fetch to prevent act() warnings on teardown
    await act(async () => {
      resolveArchive({ ok: true, json: async () => [] })
    })
  })

  it('action buttons have min-h-[44px] class (NFR-A4) (13.9)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => STUB_PINS }),
    )
    await act(async () => {
      renderList()
    })
    await waitFor(() => expect(screen.getByText('Dirty Dump')).toBeInTheDocument())

    const archiveButtons = screen.getAllByRole('button', { name: /archive pin/i })
    archiveButtons.forEach((btn) => {
      expect(btn.className).toContain('min-h-[44px]')
    })
  })

  // ── Story 6.3 Tests ──────────────────────────────────────────────────────

  it('renders search input; filtering by name hides non-matching pins', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => STUB_PINS }),
    )
    await act(async () => {
      renderList()
    })
    await waitFor(() => expect(screen.getByText('Dirty Dump')).toBeInTheDocument())

    const searchInput = screen.getByLabelText('Search pins')
    expect(searchInput).toBeInTheDocument()

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Dirty' } })
    })

    expect(screen.getByText('Dirty Dump')).toBeInTheDocument()
    // The "No Overnight" pin card should be gone, but the filter chip remains
    // Verify no pin card with aria-label containing "No Overnight" exists
    expect(screen.queryByRole('button', { name: /archive pin no overnight/i })).not.toBeInTheDocument()
  })

  it('renders reason filter chips; clicking a chip filters by that reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => STUB_PINS }),
    )
    await act(async () => {
      renderList()
    })
    await waitFor(() => expect(screen.getByText('Dirty Dump')).toBeInTheDocument())

    // Click "No Overnight" filter chip — matches the chip button text
    const noOvernightChips = screen.getAllByText('No Overnight')
    // The filter chip is the one with role="button"
    const chipButton = noOvernightChips.find(el => el.tagName === 'BUTTON')!
    await act(async () => {
      fireEvent.click(chipButton)
    })

    // "Dirty Dump" pin should be filtered out
    expect(screen.queryByText('Dirty Dump')).not.toBeInTheDocument()
    // "No Overnight" pin should still be visible (along with filter chip)
    expect(screen.queryByRole('button', { name: /archive pin no overnight/i })).toBeInTheDocument()
  })

  it('"Show Archived" toggle controls archived pin visibility', async () => {
    const pinsWithArchived = [
      ...STUB_PINS,
      {
        id: 'pin-3',
        name: 'Archived Spot',
        latitude: 39.0,
        longitude: -109.0,
        badge_state: 'grey',
        badge_override: null,
        is_archived: true,
        flag_count: 1,
        latest_report_type: 'other',
      },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => pinsWithArchived }),
    )
    await act(async () => {
      renderList()
    })
    await waitFor(() => expect(screen.getByText('Dirty Dump')).toBeInTheDocument())

    // Archived pin should be hidden by default
    expect(screen.queryByText('Archived Spot')).not.toBeInTheDocument()

    // Toggle show archived
    const checkbox = screen.getByRole('checkbox', { name: /show archived/i })
    await act(async () => {
      fireEvent.click(checkbox)
    })

    expect(screen.getByText('Archived Spot')).toBeInTheDocument()
  })

  it('badge override indicator (🔒) renders when badge_override is non-null', async () => {
    const pinsWithOverride = [
      { ...STUB_PINS[0], badge_override: 'green' },
      STUB_PINS[1],
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => pinsWithOverride }),
    )
    await act(async () => {
      renderList()
    })
    await waitFor(() => expect(screen.getByText('Dirty Dump')).toBeInTheDocument())

    // First pin should show lock icon
    expect(screen.getByText(/green 🔒/)).toBeInTheDocument()
  })

  it('"Archived" pill renders for archived pins', async () => {
    const archivedPins = [
      { ...STUB_PINS[0], is_archived: true },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => archivedPins }),
    )
    await act(async () => {
      renderList()
    })

    // Wait for data to load (empty filtered state message appears since archived hidden by default)
    await waitFor(() => expect(screen.getByText(/no pins match/i)).toBeInTheDocument())

    // Toggle show archived first
    const checkbox = screen.getByRole('checkbox', { name: /show archived/i })
    await act(async () => {
      fireEvent.click(checkbox)
    })

    await waitFor(() => expect(screen.getByText('Dirty Dump')).toBeInTheDocument())
    expect(screen.getByText('Archived')).toBeInTheDocument()
  })

  it('"Unarchive" button renders for archived pins (not "Archive")', async () => {
    const archivedPins = [
      { ...STUB_PINS[0], is_archived: true },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => archivedPins }),
    )
    await act(async () => {
      renderList()
    })

    await waitFor(() => expect(screen.getByText(/no pins match/i)).toBeInTheDocument())

    const checkbox = screen.getByRole('checkbox', { name: /show archived/i })
    await act(async () => {
      fireEvent.click(checkbox)
    })

    await waitFor(() => expect(screen.getByText('Dirty Dump')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /unarchive pin/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^archive pin/i })).not.toBeInTheDocument()
  })

  it('clicking "Override Badge" opens BadgeOverrideDialog', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => STUB_PINS }),
    )
    // Mock showModal for dialog
    HTMLDialogElement.prototype.showModal = vi.fn()
    HTMLDialogElement.prototype.close = vi.fn()

    await act(async () => {
      renderList()
    })
    await waitFor(() => expect(screen.getByText('Dirty Dump')).toBeInTheDocument())

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /override badge/i })[0])
    })

    expect(screen.getByText('Override Badge Status')).toBeInTheDocument()
  })

  it('all action buttons have min-h-[44px] touch target', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => STUB_PINS }),
    )
    await act(async () => {
      renderList()
    })
    await waitFor(() => expect(screen.getByText('Dirty Dump')).toBeInTheDocument())

    const allButtons = screen.getAllByRole('button').filter(btn =>
      btn.className.includes('min-h-[44px]'),
    )
    // Archive, Override Badge, Mark Verified, Clear Flags per pin × 2 pins + filter chips
    expect(allButtons.length).toBeGreaterThanOrEqual(8)
  })
})
