import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import CreatePinForm from './CreatePinForm'

const ADMIN_TOKEN = 'test-admin-token'

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
  onSuccess = vi.fn(),
  onCancel = vi.fn(),
  queryClient = freshClient(),
) {
  const wrapper = makeWrapper(queryClient)
  return render(
    <CreatePinForm adminToken={ADMIN_TOKEN} onSuccess={onSuccess} onCancel={onCancel} />,
    { wrapper },
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// Helper: fill in valid form fields
function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test Spot' } })
  fireEvent.change(screen.getByLabelText(/latitude/i), { target: { value: '37.5' } })
  fireEvent.change(screen.getByLabelText(/longitude/i), { target: { value: '-107.5' } })
  fireEvent.click(screen.getByLabelText('Water'))
}

describe('CreatePinForm', () => {
  it('renders all required form fields (4.3)', () => {
    renderForm()
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/latitude/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/longitude/i)).toBeInTheDocument()
    // Amenity checkboxes
    expect(screen.getByLabelText('Water')).toBeInTheDocument()
    expect(screen.getByLabelText('Dump Station')).toBeInTheDocument()
    expect(screen.getByLabelText('Overnight')).toBeInTheDocument()
    // Buttons
    expect(screen.getByRole('button', { name: /publish pin/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('shows required field error when name is empty on submit (4.4)', () => {
    renderForm()
    // Fill lat/lng and amenity but leave name empty
    fireEvent.change(screen.getByLabelText(/latitude/i), { target: { value: '37.5' } })
    fireEvent.change(screen.getByLabelText(/longitude/i), { target: { value: '-107.5' } })
    fireEvent.click(screen.getByLabelText('Water'))
    fireEvent.click(screen.getByRole('button', { name: /publish pin/i }))
    expect(screen.getByText(/name is required/i)).toBeInTheDocument()
  })

  it('shows coordinate bounds error for lat=0 lng=0 (4.5)', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test Spot' } })
    fireEvent.change(screen.getByLabelText(/latitude/i), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText(/longitude/i), { target: { value: '0' } })
    fireEvent.click(screen.getByLabelText('Water'))
    fireEvent.click(screen.getByRole('button', { name: /publish pin/i }))
    expect(screen.getAllByText(/coordinates appear to be outside the supported region/i).length).toBeGreaterThan(0)
  })

  it('shows error when no amenity is checked (4.6)', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test Spot' } })
    fireEvent.change(screen.getByLabelText(/latitude/i), { target: { value: '37.5' } })
    fireEvent.change(screen.getByLabelText(/longitude/i), { target: { value: '-107.5' } })
    fireEvent.click(screen.getByRole('button', { name: /publish pin/i }))
    expect(screen.getByText(/at least one amenity is required/i)).toBeInTheDocument()
  })

  it('calls POST /api/admin/pins with correct payload and Authorization header (4.7)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'new-pin-uuid' }) })
    vi.stubGlobal('fetch', fetchMock)

    await act(async () => {
      renderForm()
    })

    fillValidForm()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /publish pin/i }))
    })

    await waitFor(() => {
      const postCalls = fetchMock.mock.calls.filter(
        ([url, opts]: [string, RequestInit]) => opts?.method === 'POST' && url.includes('/api/admin/pins'),
      )
      expect(postCalls.length).toBeGreaterThan(0)
      const [, opts] = postCalls[0] as [string, RequestInit]
      expect((opts.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${ADMIN_TOKEN}`)
      const body = JSON.parse(opts.body as string)
      expect(body.name).toBe('Test Spot')
      expect(body.latitude).toBe(37.5)
      expect(body.longitude).toBe(-107.5)
      expect(body.amenities.water).toBe(true)
      expect(body.pin_type).toBe('community') // L3: default pin_type must be community
    })
  })

  it('calls onSuccess when POST returns ok (4.8)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'new-pin-uuid' }) })
    vi.stubGlobal('fetch', fetchMock)
    const onSuccess = vi.fn()

    await act(async () => {
      renderForm(onSuccess)
    })

    fillValidForm()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /publish pin/i }))
    })

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  it('"Publish Pin" button is disabled while mutation is pending (4.9)', async () => {
    let resolveCreate!: (value: unknown) => void
    const fetchMock = vi.fn().mockReturnValueOnce(
      new Promise((resolve) => { resolveCreate = resolve }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await act(async () => {
      renderForm()
    })

    fillValidForm()

    const publishButton = screen.getByRole('button', { name: /publish pin/i })
    await act(async () => {
      fireEvent.click(publishButton)
    })

    await waitFor(() => {
      expect(publishButton).toBeDisabled()
    })

    await act(async () => {
      resolveCreate({ ok: true, json: async () => ({ id: 'new-pin-uuid' }) })
    })
  })

  it('calls onCancel when Cancel button is clicked (4.10)', () => {
    const onCancel = vi.fn()
    renderForm(vi.fn(), onCancel)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('"Cancel" button is disabled while mutation is pending (M1)', async () => {
    let resolveCreate!: (value: unknown) => void
    const fetchMock = vi.fn().mockReturnValueOnce(
      new Promise((resolve) => { resolveCreate = resolve }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await act(async () => {
      renderForm()
    })

    fillValidForm()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /publish pin/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
    })

    await act(async () => {
      resolveCreate({ ok: true, json: async () => ({ id: 'new-pin-uuid' }) })
    })
  })

  it('shows error message when POST fails (L1)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    )

    await act(async () => {
      renderForm()
    })

    fillValidForm()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /publish pin/i }))
    })

    await waitFor(() => {
      expect(screen.getByText(/failed to create pin/i)).toBeInTheDocument()
    })
  })

  it('action buttons have min-h-[44px] class (NFR-A4) (4.11)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ([]) }))

    await act(async () => {
      renderForm()
    })

    const publishBtn = screen.getByRole('button', { name: /publish pin/i })
    const cancelBtn = screen.getByRole('button', { name: /cancel/i })
    expect(publishBtn.className).toContain('min-h-[44px]')
    expect(cancelBtn.className).toContain('min-h-[44px]')
  })
})
