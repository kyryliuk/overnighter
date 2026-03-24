import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import SpotSubmissionList from './SpotSubmissionList'

// Mock HTMLDialogElement methods (jsdom doesn't implement them)
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
})

const ADMIN_TOKEN = 'test-admin-token'

function makeSubmission(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'submission-1',
    userId: 'user-1',
    name: 'Creek pullout',
    description: 'Quiet gravel area',
    latitude: 37.5123,
    longitude: -107.5678,
    amenities: { overnight: true, water: false, dump: true },
    maxLengthFt: 40,
    maxHeightFt: 12.5,
    website: 'https://example.com',
    phone: '555-1234',
    status: 'pending',
    adminNotes: null,
    reviewedAt: null,
    publishedPinId: null,
    createdAt: '2026-03-23T00:00:00.000Z',
    updatedAt: '2026-03-23T00:00:00.000Z',
    ...overrides,
  }
}

const STUB_COUNTS = {
  all: 5,
  pending: 3,
  approved: 1,
  rejected: 1,
  changes_requested: 0,
}

function makePaginatedResponse(submissions: unknown[], total?: number, hasMore = false) {
  return {
    submissions,
    total: total ?? submissions.length,
    page: 1,
    pageSize: 20,
    hasMore,
  }
}

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
  return render(<SpotSubmissionList adminToken={ADMIN_TOKEN} />, { wrapper })
}

function stubFetch(submissionsResponse: unknown, countsResponse: unknown = STUB_COUNTS) {
  return vi.fn().mockImplementation((url: string) => {
    if (url.includes('/counts')) {
      return Promise.resolve({
        ok: true,
        json: async () => countsResponse,
      })
    }
    return Promise.resolve({
      ok: true,
      json: async () => submissionsResponse,
    })
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SpotSubmissionList', () => {
  it('renders all 5 status filter buttons', async () => {
    vi.stubGlobal('fetch', stubFetch(makePaginatedResponse([])))
    await act(async () => {
      renderList()
    })
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /all/i })).toBeInTheDocument()
    })
    expect(screen.getByRole('tab', { name: /^pending/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^approved/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^rejected/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /changes requested/i })).toBeInTheDocument()
  })

  it('has Pending filter selected by default', async () => {
    vi.stubGlobal('fetch', stubFetch(makePaginatedResponse([])))
    await act(async () => {
      renderList()
    })
    await waitFor(() => {
      const pendingTab = screen.getByRole('tab', { name: /^pending/i })
      expect(pendingTab.getAttribute('aria-selected')).toBe('true')
    })
  })

  it('shows status count badges for each filter', async () => {
    vi.stubGlobal('fetch', stubFetch(makePaginatedResponse([]), STUB_COUNTS))
    await act(async () => {
      renderList()
    })
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /all/i })).toHaveTextContent('(5)')
    })
    expect(screen.getByRole('tab', { name: /^pending/i })).toHaveTextContent('(3)')
    expect(screen.getByRole('tab', { name: /^approved/i })).toHaveTextContent('(1)')
  })

  it('fetches with correct status query param when filter is clicked', async () => {
    const fetchMock = stubFetch(makePaginatedResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    await act(async () => {
      renderList()
    })

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /^approved/i })).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /^approved/i }))
    })

    await waitFor(() => {
      const submissionCalls = fetchMock.mock.calls.filter(
        ([url]: [string]) => url.includes('/api/admin/spot-submissions') && !url.includes('/counts'),
      )
      const lastCall = submissionCalls[submissionCalls.length - 1]
      expect(lastCall[0]).toContain('status=approved')
    })
  })

  it('shows submission card with name, coordinates, date, and status pill', async () => {
    const sub = makeSubmission()
    vi.stubGlobal('fetch', stubFetch(makePaginatedResponse([sub])))

    await act(async () => {
      renderList()
    })

    await waitFor(() => {
      expect(screen.getByText('Creek pullout')).toBeInTheDocument()
    })
    expect(screen.getByText('37.5123, -107.5678')).toBeInTheDocument()
    expect(screen.getByText(/submitted/i)).toBeInTheDocument()
    expect(screen.getByText('pending')).toBeInTheDocument()
  })

  it('shows correct status pill styles', async () => {
    const sub = makeSubmission({ status: 'approved' })
    vi.stubGlobal('fetch', stubFetch(makePaginatedResponse([sub])))

    await act(async () => {
      renderList()
    })

    await waitFor(() => {
      const pill = screen.getByText('approved')
      expect(pill.className).toContain('bg-green-500/15')
    })
  })

  it('expands card on click to show full details', async () => {
    const sub = makeSubmission()
    vi.stubGlobal('fetch', stubFetch(makePaginatedResponse([sub])))

    await act(async () => {
      renderList()
    })

    await waitFor(() => {
      expect(screen.getByText('Creek pullout')).toBeInTheDocument()
    })

    // Before expanding — description should not be in detail block
    expect(screen.queryByText('Max length')).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByText('Creek pullout'))
    })

    await waitFor(() => {
      expect(screen.getByText('Description')).toBeInTheDocument()
    })
    expect(screen.getByText('Quiet gravel area')).toBeInTheDocument()
    expect(screen.getByText('Max length')).toBeInTheDocument()
    expect(screen.getByText('40 ft')).toBeInTheDocument()
    expect(screen.getByText('Max height')).toBeInTheDocument()
    expect(screen.getByText('12.5 ft')).toBeInTheDocument()
    expect(screen.getByText('https://example.com')).toBeInTheDocument()
    expect(screen.getByText('555-1234')).toBeInTheDocument()
  })

  it('collapses expanded card on second click', async () => {
    const sub = makeSubmission()
    vi.stubGlobal('fetch', stubFetch(makePaginatedResponse([sub])))

    await act(async () => {
      renderList()
    })

    await waitFor(() => {
      expect(screen.getByText('Creek pullout')).toBeInTheDocument()
    })

    // Expand
    await act(async () => {
      fireEvent.click(screen.getByText('Creek pullout'))
    })
    await waitFor(() => {
      expect(screen.getByText('Description')).toBeInTheDocument()
    })

    // Collapse
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /creek pullout/i }))
    })
    await waitFor(() => {
      expect(screen.queryByText('Description')).not.toBeInTheDocument()
    })
  })

  it('shows expanded amenities', async () => {
    const sub = makeSubmission()
    vi.stubGlobal('fetch', stubFetch(makePaginatedResponse([sub])))

    await act(async () => {
      renderList()
    })

    await waitFor(() => {
      expect(screen.getByText('Creek pullout')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Creek pullout'))
    })

    await waitFor(() => {
      expect(screen.getByText('Amenities')).toBeInTheDocument()
    })
    expect(screen.getByText('overnight')).toBeInTheDocument()
    expect(screen.getByText('dump')).toBeInTheDocument()
  })

  it('shows admin notes in expanded card when present on reviewed submission', async () => {
    const sub = makeSubmission({ status: 'rejected', adminNotes: 'Check coordinates', reviewedAt: '2026-03-24T00:00:00.000Z' })
    vi.stubGlobal('fetch', stubFetch(makePaginatedResponse([sub])))

    await act(async () => {
      renderList()
    })

    await waitFor(() => {
      expect(screen.getByText('Creek pullout')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Creek pullout'))
    })

    await waitFor(() => {
      expect(screen.getByText('Review Result')).toBeInTheDocument()
    })
    expect(screen.getByText('Check coordinates')).toBeInTheDocument()
  })

  it('shows published pin link in expanded card when present', async () => {
    const sub = makeSubmission({ status: 'approved', publishedPinId: 'pin-abc-123', reviewedAt: '2026-03-24T00:00:00.000Z' })
    vi.stubGlobal('fetch', stubFetch(makePaginatedResponse([sub])))

    await act(async () => {
      renderList()
    })

    await waitFor(() => {
      expect(screen.getByText('Creek pullout')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Creek pullout'))
    })

    await waitFor(() => {
      const link = screen.getByText('View Pin →')
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/pin/pin-abc-123')
    })
  })

  it('shows review controls only for pending submissions', async () => {
    const sub = makeSubmission({ status: 'pending' })
    vi.stubGlobal('fetch', stubFetch(makePaginatedResponse([sub])))

    await act(async () => {
      renderList()
    })

    await waitFor(() => {
      expect(screen.getByText('Creek pullout')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Creek pullout'))
    })

    await waitFor(() => {
      const approveButtons = screen.getAllByRole('button', { name: /approve & publish/i })
      const actualButton = approveButtons.find((el) => el.tagName === 'BUTTON')
      expect(actualButton).toBeInTheDocument()
    })
  })

  it('hides review controls for approved submissions', async () => {
    const sub = makeSubmission({ status: 'approved' })
    vi.stubGlobal('fetch', stubFetch(makePaginatedResponse([sub])))

    await act(async () => {
      renderList()
    })

    await waitFor(() => {
      expect(screen.getByText('Creek pullout')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Creek pullout'))
    })

    await waitFor(() => {
      expect(screen.getByText('Amenities')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /approve & publish/i })).not.toBeInTheDocument()
  })

  it('shows "Load more" button when hasMore is true', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/counts')) {
        return Promise.resolve({ ok: true, json: async () => STUB_COUNTS })
      }
      return Promise.resolve({
        ok: true,
        json: async () => makePaginatedResponse([makeSubmission()], 25, true),
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await act(async () => {
      renderList()
    })

    await waitFor(() => {
      expect(screen.getByText('Creek pullout')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument()
  })

  it('hides "Load more" button when all submissions are loaded', async () => {
    vi.stubGlobal('fetch', stubFetch(makePaginatedResponse([makeSubmission()], 1, false)))

    await act(async () => {
      renderList()
    })

    await waitFor(() => {
      expect(screen.getByText('Creek pullout')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
  })

  it('shows loading text while initial fetch is pending', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise(() => {})),
    )
    renderList()
    expect(screen.getByText(/loading spot submissions/i)).toBeInTheDocument()
  })

  it('shows error state with retry button on fetch failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/counts')) {
          return Promise.resolve({ ok: true, json: async () => STUB_COUNTS })
        }
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) })
      }),
    )

    await act(async () => {
      renderList()
    })

    await waitFor(() => {
      expect(screen.getByText(/failed to load spot submissions/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/try again/i)).toBeInTheDocument()
  })

  it('shows contextual empty state message for pending filter', async () => {
    vi.stubGlobal('fetch', stubFetch(makePaginatedResponse([])))

    await act(async () => {
      renderList()
    })

    await waitFor(() => {
      expect(screen.getByText(/no pending submissions/i)).toBeInTheDocument()
    })
  })

  it('shows contextual empty state message for approved filter', async () => {
    vi.stubGlobal('fetch', stubFetch(makePaginatedResponse([])))

    await act(async () => {
      renderList()
    })

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /^approved/i })).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /^approved/i }))
    })

    await waitFor(() => {
      expect(screen.getByText(/no approved submissions/i)).toBeInTheDocument()
    })
  })

  it('invalidates both submissions and counts on mutation success', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/counts')) {
        return Promise.resolve({ ok: true, json: async () => STUB_COUNTS })
      }
      if (url.includes('/spot-submissions/') && !url.includes('?')) {
        // PATCH mutation
        return Promise.resolve({ ok: true, json: async () => ({ id: 'submission-1', status: 'approved', publishedPinId: null }) })
      }
      return Promise.resolve({ ok: true, json: async () => makePaginatedResponse([makeSubmission()]) })
    })

    vi.stubGlobal('fetch', fetchMock)
    const qc = freshClient()

    await act(async () => {
      renderList(qc)
    })

    await waitFor(() => {
      expect(screen.getByText('Creek pullout')).toBeInTheDocument()
    })

    // Expand card
    await act(async () => {
      fireEvent.click(screen.getByText('Creek pullout'))
    })

    await waitFor(() => {
      const approveButtons = screen.getAllByRole('button', { name: /approve & publish/i })
      const actualButton = approveButtons.find((el) => el.tagName === 'BUTTON')
      expect(actualButton).toBeInTheDocument()
    })

    // Click approve — opens dialog
    await act(async () => {
      const approveButtons = screen.getAllByRole('button', { name: /approve & publish/i })
      const actualButton = approveButtons.find((el) => el.tagName === 'BUTTON')!
      fireEvent.click(actualButton)
    })

    // Confirm the dialog
    await waitFor(() => {
      expect(screen.getByText('Confirm Approval')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Confirm Approval'))
    })

    // Verify PATCH was called
    await waitFor(() => {
      const patchCalls = fetchMock.mock.calls.filter(
        ([, opts]: [string, RequestInit]) => opts?.method === 'PATCH',
      )
      expect(patchCalls.length).toBeGreaterThan(0)
    })
  })

  it('shows review controls for changes_requested submissions', async () => {
    const sub = makeSubmission({ status: 'changes_requested' })
    vi.stubGlobal('fetch', stubFetch(makePaginatedResponse([sub])))

    await act(async () => {
      renderList()
    })

    // Switch to changes_requested filter
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /changes requested/i })).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /changes requested/i }))
    })

    await waitFor(() => {
      expect(screen.getByText('Creek pullout')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Creek pullout'))
    })

    await waitFor(() => {
      const approveButtons = screen.getAllByRole('button', { name: /approve & publish/i })
      const actualButton = approveButtons.find((el) => el.tagName === 'BUTTON')
      expect(actualButton).toBeInTheDocument()
    })
  })

  // Story 6.2 — Dialog-based review flow

  it('opens approve dialog with correct title when Approve & Publish is clicked', async () => {
    const sub = makeSubmission()
    vi.stubGlobal('fetch', stubFetch(makePaginatedResponse([sub])))

    await act(async () => {
      renderList()
    })

    await waitFor(() => {
      expect(screen.getByText('Creek pullout')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Creek pullout'))
    })

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /approve & publish/i }).find((el) => el.tagName === 'BUTTON')).toBeInTheDocument()
    })

    await act(async () => {
      const btn = screen.getAllByRole('button', { name: /approve & publish/i }).find((el) => el.tagName === 'BUTTON')!
      fireEvent.click(btn)
    })

    await waitFor(() => {
      expect(screen.getByText('Approve Submission?')).toBeInTheDocument()
      expect(screen.getByText(/create a new pin from "Creek pullout"/)).toBeInTheDocument()
    })
  })

  it('opens reject dialog with required notes when Reject is clicked', async () => {
    const sub = makeSubmission()
    vi.stubGlobal('fetch', stubFetch(makePaginatedResponse([sub])))

    await act(async () => {
      renderList()
    })

    await waitFor(() => {
      expect(screen.getByText('Creek pullout')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Creek pullout'))
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^reject$/i })).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^reject$/i }))
    })

    await waitFor(() => {
      expect(screen.getByText('Reject Submission?')).toBeInTheDocument()
      expect(screen.getByText('Confirm Rejection')).toBeDisabled()
    })
  })

  it('pre-fills dialog notes from inline textarea', async () => {
    const sub = makeSubmission()
    vi.stubGlobal('fetch', stubFetch(makePaginatedResponse([sub])))

    await act(async () => {
      renderList()
    })

    await waitFor(() => {
      expect(screen.getByText('Creek pullout')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Creek pullout'))
    })

    // Type in inline textarea
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/optional reviewer feedback/i)).toBeInTheDocument()
    })
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/optional reviewer feedback/i), { target: { value: 'Pre-filled note' } })
    })

    // Open approve dialog
    await act(async () => {
      const btn = screen.getAllByRole('button', { name: /approve & publish/i }).find((el) => el.tagName === 'BUTTON')!
      fireEvent.click(btn)
    })

    await waitFor(() => {
      const dialogTextarea = screen.getByLabelText('Admin notes') as HTMLTextAreaElement
      expect(dialogTextarea.value).toBe('Pre-filled note')
    })
  })

  it('shows reviewed_at relative time for reviewed submissions', async () => {
    const sub = makeSubmission({ status: 'approved', reviewedAt: '2026-03-24T00:00:00.000Z', publishedPinId: 'pin-1' })
    vi.stubGlobal('fetch', stubFetch(makePaginatedResponse([sub])))

    await act(async () => {
      renderList()
    })

    await waitFor(() => {
      expect(screen.getByText('Creek pullout')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Creek pullout'))
    })

    await waitFor(() => {
      expect(screen.getByText('Review Result')).toBeInTheDocument()
      // reviewedAt text is present with relative time suffix
      expect(screen.getByText(/reviewed/i)).toBeInTheDocument()
    })
  })

  it('shows previous feedback section for changes_requested with admin notes', async () => {
    const sub = makeSubmission({
      status: 'changes_requested',
      adminNotes: 'Please add better photos',
      reviewedAt: '2026-03-23T12:00:00.000Z',
    })
    vi.stubGlobal('fetch', stubFetch(makePaginatedResponse([sub])))

    await act(async () => {
      renderList()
    })

    await waitFor(() => {
      expect(screen.getByText('Creek pullout')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Creek pullout'))
    })

    await waitFor(() => {
      expect(screen.getByText('Previous feedback')).toBeInTheDocument()
      expect(screen.getByText('Please add better photos')).toBeInTheDocument()
    })
  })

  it('shows error alert on mutation failure', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/counts')) {
        return Promise.resolve({ ok: true, json: async () => STUB_COUNTS })
      }
      if (opts?.method === 'PATCH') {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) })
      }
      return Promise.resolve({ ok: true, json: async () => makePaginatedResponse([makeSubmission()]) })
    })

    vi.stubGlobal('fetch', fetchMock)
    const qc = freshClient()

    await act(async () => {
      renderList(qc)
    })

    await waitFor(() => {
      expect(screen.getByText('Creek pullout')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Creek pullout'))
    })

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /approve & publish/i }).find((el) => el.tagName === 'BUTTON')).toBeInTheDocument()
    })

    // Open dialog
    await act(async () => {
      const btn = screen.getAllByRole('button', { name: /approve & publish/i }).find((el) => el.tagName === 'BUTTON')!
      fireEvent.click(btn)
    })
    await waitFor(() => {
      expect(screen.getByText('Confirm Approval')).toBeInTheDocument()
    })

    // Confirm — triggers mutation
    await act(async () => {
      fireEvent.click(screen.getByText('Confirm Approval'))
    })

    // Error alert should appear after mutation fails
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/action failed/i)
  })
})
