import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { act } from '@testing-library/react'
import AdminAuth, { ADMIN_TOKEN_KEY } from './AdminAuth'

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

describe('AdminAuth', () => {
  it('renders password input and submit button (4.2)', () => {
    render(<AdminAuth onAuthenticated={vi.fn()} />)
    expect(screen.getByLabelText(/admin token/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('submit button is disabled when input is empty (4.3)', () => {
    render(<AdminAuth onAuthenticated={vi.fn()} />)
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled()
  })

  it('submit button is enabled after typing a token (4.4)', () => {
    render(<AdminAuth onAuthenticated={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/admin token/i), { target: { value: 'my-token' } })
    expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled()
  })

  it('on successful fetch → sessionStorage has ADMIN_TOKEN_KEY set (4.5)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
    render(<AdminAuth onAuthenticated={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/admin token/i), { target: { value: 'good-token' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    })
    expect(sessionStorage.getItem(ADMIN_TOKEN_KEY)).toBe('good-token')
  })

  it('on successful fetch → onAuthenticated callback is called (4.6)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
    const onAuthenticated = vi.fn()
    render(<AdminAuth onAuthenticated={onAuthenticated} />)
    fireEvent.change(screen.getByLabelText(/admin token/i), { target: { value: 'good-token' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    })
    expect(onAuthenticated).toHaveBeenCalledTimes(1)
  })

  it('on 401 response → shows role="alert" with "Invalid admin token" (4.7)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    render(<AdminAuth onAuthenticated={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/admin token/i), { target: { value: 'bad-token' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid admin token')
  })

  it('on network error → shows role="alert" with connection error message (4.8)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failure')))
    render(<AdminAuth onAuthenticated={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/admin token/i), { target: { value: 'any-token' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't verify token. Check connection.")
  })

  it('on non-200/non-401 HTTP response → shows connection error message (else branch)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    render(<AdminAuth onAuthenticated={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/admin token/i), { target: { value: 'any-token' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't verify token. Check connection.")
  })

  it('submit button shows "Verifying…" while isLoading is true (4.9)', async () => {
    let resolvePromise!: (value: unknown) => void
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise((resolve) => { resolvePromise = resolve })),
    )
    render(<AdminAuth onAuthenticated={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/admin token/i), { target: { value: 'token' } })

    // Click without awaiting — setIsLoading(true) fires synchronously before the await fetch()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    })
    expect(screen.getByRole('button', { name: /verifying/i })).toBeInTheDocument()

    // Resolve the pending fetch to prevent act() warnings on teardown
    await act(async () => {
      resolvePromise({ ok: true, status: 200 })
    })
  })
})
