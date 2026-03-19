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
    flag_count: 4,
    latest_report_type: 'dump_closed',
  },
  {
    id: 'pin-2',
    name: 'No Overnight',
    latitude: 38.0,
    longitude: -108.0,
    badge_state: 'red',
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
    expect(screen.getByText('No Overnight')).toBeInTheDocument()
    expect(screen.getByText(/flags: 4/i)).toBeInTheDocument()
    expect(screen.getByText(/dump_closed/i)).toBeInTheDocument()
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

  it('clicking "Override Badge — Mark Verified" calls PATCH with { action: "verify" } (13.7)', async () => {
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
      fireEvent.click(screen.getAllByRole('button', { name: /override badge/i })[0])
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

  it('clicking "Dismiss Flag" calls PATCH with { action: "dismiss" } (13.8)', async () => {
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
      fireEvent.click(screen.getAllByRole('button', { name: /dismiss flag/i })[0])
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
})
