import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import EditPinForm from './EditPinForm'
import type { Pin } from '@/types/pin'

const ADMIN_TOKEN = 'test-admin-token'

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

function renderForm(
  pin: Pin = STUB_PIN,
  onSuccess = vi.fn(),
  onCancel = vi.fn(),
  queryClient = freshClient(),
) {
  const wrapper = makeWrapper(queryClient)
  return render(
    <EditPinForm pin={pin} adminToken={ADMIN_TOKEN} onSuccess={onSuccess} onCancel={onCancel} />,
    { wrapper },
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── Fixtures ─────────────────────────────────────────────────────────────────

const STUB_PIN: Pin = {
  id: 'pin-edit-123',
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

describe('EditPinForm', () => {
  it('form fields are pre-populated from pin prop (6.4)', () => {
    renderForm()
    expect((screen.getByLabelText(/name \*/i) as HTMLInputElement).value).toBe('Test Campsite')
    expect((screen.getByLabelText(/latitude \*/i) as HTMLInputElement).value).toBe('37.5')
    expect((screen.getByLabelText(/longitude \*/i) as HTMLInputElement).value).toBe('-107.5')
    expect((screen.getByLabelText('Water') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Overnight') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Dump') as HTMLInputElement).checked).toBe(false)
  })

  it('shows required error when name is cleared on submit (6.5)', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/name \*/i), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    expect(screen.getByText(/name is required/i)).toBeInTheDocument()
  })

  it('shows coordinates error for out-of-bounds lat/lng on submit (6.6)', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/latitude \*/i), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText(/longitude \*/i), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    expect(screen.getAllByText(/coordinates appear to be outside the supported region/i).length).toBeGreaterThan(0)
  })

  it('calls PATCH /api/pins/:id with correct payload and Authorization header (6.7)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)

    await act(async () => {
      renderForm()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    })

    await waitFor(() => {
      const patchCalls = fetchMock.mock.calls.filter(
        ([url, opts]: [string, RequestInit]) => opts?.method === 'PATCH' && url.includes('/api/pins/'),
      )
      expect(patchCalls.length).toBeGreaterThan(0)
      const [, opts] = patchCalls[0] as [string, RequestInit]
      expect((opts.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${ADMIN_TOKEN}`)
      const body = JSON.parse(opts.body as string)
      expect(body.name).toBe('Test Campsite')
      expect(body.latitude).toBe(37.5)
      expect(body.longitude).toBe(-107.5)
      expect(body.amenities.water).toBe(true)
      expect(body.pin_type).toBe('community')
    })
  })

  it('uses pin.id in the PATCH URL (6.8)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)

    await act(async () => {
      renderForm()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    })

    await waitFor(() => {
      const patchCalls = fetchMock.mock.calls.filter(
        ([, opts]: [string, RequestInit]) => opts?.method === 'PATCH',
      )
      expect(patchCalls.length).toBeGreaterThan(0)
      const [url] = patchCalls[0] as [string, RequestInit]
      expect(url).toContain('/api/pins/pin-edit-123')
    })
  })

  it('calls onSuccess when PATCH returns ok (6.9)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)
    const onSuccess = vi.fn()

    await act(async () => {
      renderForm(STUB_PIN, onSuccess)
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    })

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  it('calls onCancel when Cancel is clicked; no fetch called (6.10)', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const onCancel = vi.fn()
    renderForm(STUB_PIN, vi.fn(), onCancel)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('"Save Changes" and "Cancel" buttons are disabled while mutation is pending (6.11)', async () => {
    let resolveUpdate!: (value: unknown) => void
    const fetchMock = vi.fn().mockReturnValueOnce(
      new Promise((resolve) => { resolveUpdate = resolve }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await act(async () => {
      renderForm()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
    })

    await act(async () => {
      resolveUpdate({ ok: true, json: async () => ({ ok: true }) })
    })
  })

  it('shows error message when PATCH fails (6.12)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    )

    await act(async () => {
      renderForm()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    })

    await waitFor(() => {
      expect(screen.getByText(/failed to update pin/i)).toBeInTheDocument()
    })
  })

  it('renders fee and notes as disabled display-only fields (M1)', () => {
    renderForm()
    const feeInput = screen.getByLabelText(/fee/i) as HTMLInputElement
    const notesInput = screen.getByLabelText(/notes/i) as HTMLTextAreaElement
    expect(feeInput).toBeInTheDocument()
    expect(feeInput.disabled).toBe(true)
    expect(notesInput).toBeInTheDocument()
    expect(notesInput.disabled).toBe(true)
  })

  it('pre-populates maxLengthFt and maxHeightFt when non-null (L2)', () => {
    const pinWithConstraints: Pin = {
      ...STUB_PIN,
      maxLengthFt: 40,
      maxHeightFt: 13.5,
    }
    renderForm(pinWithConstraints)
    expect((screen.getByLabelText(/max rig length/i) as HTMLInputElement).value).toBe('40')
    expect((screen.getByLabelText(/max rig height/i) as HTMLInputElement).value).toBe('13.5')
  })

  it('buttons have min-h-[44px] class (NFR-A4) (6.13)', () => {
    renderForm()
    const saveBtn = screen.getByRole('button', { name: /save changes/i })
    const cancelBtn = screen.getByRole('button', { name: /cancel/i })
    expect(saveBtn.className).toContain('min-h-[44px]')
    expect(cancelBtn.className).toContain('min-h-[44px]')
  })
})
