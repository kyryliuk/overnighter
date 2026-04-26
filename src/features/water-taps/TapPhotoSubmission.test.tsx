import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import TapPhotoSubmission from './TapPhotoSubmission'
import type { TapSubmitResponse } from './waterTapsApi'

// Mock waterTapsApi — control mutation state from tests
const mockMutate = vi.fn()

const { mockUseTapSubmitMutation } = vi.hoisted(() => ({
  mockUseTapSubmitMutation: vi.fn(() => ({
    mutate: mockMutate,
    isPending: false,
    data: undefined as TapSubmitResponse | undefined,
    isSuccess: false,
    isError: false,
  })),
}))

vi.mock('./waterTapsApi', () => ({
  useTapSubmitMutation: mockUseTapSubmitMutation,
  useWaterTapQuery: vi.fn(() => ({ data: null, isLoading: false, error: null })),
  useTapVerifyMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}))

vi.mock('@/hooks/useDeviceId', () => ({
  useDeviceId: () => 'test-device-id',
  DEVICE_ID_KEY: 'device-id',
}))

function renderComponent(tapPinId = 'tap-1', tapPinLocation: [number, number] = [24.7, -80.5]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TapPhotoSubmission tapPinId={tapPinId} tapPinLocation={tapPinLocation} />
    </QueryClientProvider>,
  )
}

function makeImageFile(name = 'tap.jpg', type = 'image/jpeg', sizeKb = 100): File {
  const content = new Uint8Array(sizeKb * 1024).fill(0)
  return new File([content], name, { type })
}

describe('TapPhotoSubmission', () => {
  beforeEach(() => {
    mockMutate.mockClear()
    mockUseTapSubmitMutation.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      data: undefined,
      isSuccess: false,
      isError: false,
    })
  })

  // ── AC 8: File input ───────────────────────────────────────────────────────

  it('renders file input with accept="image/*"', () => {
    renderComponent()
    const input = screen.getByLabelText(/select a photo of the water tap/i)
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('accept', 'image/*')
    expect(input).toHaveAttribute('type', 'file')
  })

  it('renders submit button', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: /submit tap photo/i })).toBeInTheDocument()
  })

  // ── AC 11: 44px touch target ──────────────────────────────────────────────

  it('submit button has min 44px touch target (min-h-[44px])', () => {
    renderComponent()
    const btn = screen.getByRole('button', { name: /submit tap photo/i })
    expect(btn.className).toMatch(/min-h-\[44px\]/)
  })

  // ── Submit button disabled when no file ───────────────────────────────────

  it('submit button is disabled when no file is selected', () => {
    renderComponent()
    const btn = screen.getByRole('button', { name: /submit tap photo/i })
    expect(btn).toBeDisabled()
  })

  it('submit button is enabled after a file is selected', () => {
    renderComponent()
    const input = screen.getByLabelText(/select a photo of the water tap/i)
    fireEvent.change(input, { target: { files: [makeImageFile()] } })
    const btn = screen.getByRole('button', { name: /submit tap photo/i })
    expect(btn).not.toBeDisabled()
  })

  // ── Photo preview ─────────────────────────────────────────────────────────

  it('shows preview img element after file is selected', () => {
    // Mock URL.createObjectURL
    const mockUrl = 'blob:http://localhost/test-preview'
    vi.stubGlobal('URL', { createObjectURL: () => mockUrl, revokeObjectURL: vi.fn() })

    renderComponent()
    const input = screen.getByLabelText(/select a photo of the water tap/i)
    fireEvent.change(input, { target: { files: [makeImageFile()] } })

    const preview = screen.getByAltText(/selected tap photo preview/i)
    expect(preview).toBeInTheDocument()
    expect(preview).toHaveAttribute('src', mockUrl)

    vi.unstubAllGlobals()
  })

  // ── AC 8: Pending state ───────────────────────────────────────────────────

  it('shows "Checking photo..." when mutation isPending', () => {
    mockUseTapSubmitMutation.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
      data: undefined,
      isSuccess: false,
      isError: false,
    })
    renderComponent()
    expect(screen.getByText(/checking photo\.\.\./i)).toBeInTheDocument()
  })

  it('does not show file input when mutation isPending', () => {
    mockUseTapSubmitMutation.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
      data: undefined,
      isSuccess: false,
      isError: false,
    })
    renderComponent()
    expect(screen.queryByLabelText(/select a photo/i)).not.toBeInTheDocument()
  })

  // ── AC 9: Success states ──────────────────────────────────────────────────

  it('shows success message on "created" status', () => {
    // Simulate: mutation fires onSuccess with created status
    mockMutate.mockImplementation((_fd: FormData, opts: { onSuccess?: (data: TapSubmitResponse) => void }) => {
      opts?.onSuccess?.({ pinId: 'tap-new', confidence: 0.9, status: 'created' })
    })
    renderComponent()
    const input = screen.getByLabelText(/select a photo of the water tap/i)
    fireEvent.change(input, { target: { files: [makeImageFile()] } })
    fireEvent.click(screen.getByRole('button', { name: /submit tap photo/i }))
    expect(screen.getByText(/photo added! this tap is now on the map\./i)).toBeInTheDocument()
  })

  it('shows success message on "confirmed" status', () => {
    mockMutate.mockImplementation((_fd: FormData, opts: { onSuccess?: (data: TapSubmitResponse) => void }) => {
      opts?.onSuccess?.({ pinId: 'tap-1', confidence: 0.85, status: 'confirmed' })
    })
    renderComponent()
    const input = screen.getByLabelText(/select a photo of the water tap/i)
    fireEvent.change(input, { target: { files: [makeImageFile()] } })
    fireEvent.click(screen.getByRole('button', { name: /submit tap photo/i }))
    expect(screen.getByText(/photo added! this tap is now on the map\./i)).toBeInTheDocument()
  })

  // ── AC 10: below_threshold ────────────────────────────────────────────────

  it('shows neutral message on "below_threshold" status', () => {
    mockMutate.mockImplementation((_fd: FormData, opts: { onSuccess?: (data: TapSubmitResponse) => void }) => {
      opts?.onSuccess?.({ pinId: null, confidence: 0.42, status: 'below_threshold' })
    })
    renderComponent()
    const input = screen.getByLabelText(/select a photo of the water tap/i)
    fireEvent.change(input, { target: { files: [makeImageFile()] } })
    fireEvent.click(screen.getByRole('button', { name: /submit tap photo/i }))
    expect(
      screen.getByText(/our model couldn't confirm a tap in that photo/i),
    ).toBeInTheDocument()
  })

  it('shows "Try again" link after below_threshold result', () => {
    mockMutate.mockImplementation((_fd: FormData, opts: { onSuccess?: (data: TapSubmitResponse) => void }) => {
      opts?.onSuccess?.({ pinId: null, confidence: 0.3, status: 'below_threshold' })
    })
    renderComponent()
    const input = screen.getByLabelText(/select a photo of the water tap/i)
    fireEvent.change(input, { target: { files: [makeImageFile()] } })
    fireEvent.click(screen.getByRole('button', { name: /submit tap photo/i }))
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  // ── Submit calls mutate with FormData ─────────────────────────────────────

  it('calls mutate with a FormData containing photo, location, and deviceId', () => {
    renderComponent('tap-1', [24.7, -80.5])
    const input = screen.getByLabelText(/select a photo of the water tap/i)
    const file = makeImageFile()
    fireEvent.change(input, { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: /submit tap photo/i }))

    expect(mockMutate).toHaveBeenCalledTimes(1)
    const [formData] = mockMutate.mock.calls[0]
    expect(formData).toBeInstanceOf(FormData)
    expect(formData.get('photo')).toBe(file)
    expect(formData.get('location')).toBe('[24.7,-80.5]')
    expect(formData.get('deviceId')).toBe('test-device-id')
  })
})
