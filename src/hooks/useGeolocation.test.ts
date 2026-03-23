import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGeolocation } from './useGeolocation'

describe('useGeolocation', () => {
  const mockGetCurrentPosition = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: mockGetCurrentPosition,
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns idle state initially (no auto-request)', () => {
    const { result } = renderHook(() => useGeolocation())
    const [state] = result.current

    expect(state.isLoading).toBe(false)
    expect(state.coords).toBeNull()
    expect(state.error).toBeNull()
    expect(mockGetCurrentPosition).not.toHaveBeenCalled()
  })

  it('sets isLoading to true when request() is called', () => {
    mockGetCurrentPosition.mockImplementation(() => {
      // Never resolves — simulates pending GPS
    })

    const { result } = renderHook(() => useGeolocation())

    act(() => {
      result.current[1]() // call request()
    })

    expect(result.current[0].isLoading).toBe(true)
    expect(result.current[0].coords).toBeNull()
    expect(result.current[0].error).toBeNull()
  })

  it('sets coords on successful geolocation', () => {
    mockGetCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({
        coords: {
          latitude: 40.7,
          longitude: -74.0,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition)
    })

    const { result } = renderHook(() => useGeolocation())

    act(() => {
      result.current[1]()
    })

    expect(result.current[0].isLoading).toBe(false)
    expect(result.current[0].coords?.latitude).toBe(40.7)
    expect(result.current[0].coords?.longitude).toBe(-74.0)
    expect(result.current[0].error).toBeNull()
  })

  it('sets error to "denied" when permission is denied', () => {
    mockGetCurrentPosition.mockImplementation(
      (_: PositionCallback, error: PositionErrorCallback) => {
        error({
          code: 1, // PERMISSION_DENIED
          message: 'User denied Geolocation',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        })
      },
    )

    const { result } = renderHook(() => useGeolocation())

    act(() => {
      result.current[1]()
    })

    expect(result.current[0].isLoading).toBe(false)
    expect(result.current[0].coords).toBeNull()
    expect(result.current[0].error).toBe('denied')
  })

  it('sets error to "unavailable" on position unavailable', () => {
    mockGetCurrentPosition.mockImplementation(
      (_: PositionCallback, error: PositionErrorCallback) => {
        error({
          code: 2, // POSITION_UNAVAILABLE
          message: 'Position unavailable',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        })
      },
    )

    const { result } = renderHook(() => useGeolocation())

    act(() => {
      result.current[1]()
    })

    expect(result.current[0].isLoading).toBe(false)
    expect(result.current[0].error).toBe('unavailable')
  })

  it('sets error to "unavailable" on timeout', () => {
    mockGetCurrentPosition.mockImplementation(
      (_: PositionCallback, error: PositionErrorCallback) => {
        error({
          code: 3, // TIMEOUT
          message: 'Timeout expired',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        })
      },
    )

    const { result } = renderHook(() => useGeolocation())

    act(() => {
      result.current[1]()
    })

    expect(result.current[0].isLoading).toBe(false)
    expect(result.current[0].error).toBe('unavailable')
  })

  it('sets error to "no-api" when navigator.geolocation is undefined', () => {
    vi.stubGlobal('navigator', { geolocation: undefined })

    const { result } = renderHook(() => useGeolocation())

    act(() => {
      result.current[1]()
    })

    expect(result.current[0].isLoading).toBe(false)
    expect(result.current[0].error).toBe('no-api')
  })

  it('passes correct options to getCurrentPosition', () => {
    mockGetCurrentPosition.mockImplementation(() => {})

    const { result } = renderHook(() => useGeolocation())

    act(() => {
      result.current[1]()
    })

    expect(mockGetCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { timeout: 10000, maximumAge: 0 },
    )
  })

  it('clears previous error and coords on new request', () => {
    // First call: denied
    mockGetCurrentPosition.mockImplementationOnce(
      (_: PositionCallback, error: PositionErrorCallback) => {
        error({
          code: 1,
          message: 'denied',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        })
      },
    )

    const { result } = renderHook(() => useGeolocation())

    act(() => {
      result.current[1]()
    })
    expect(result.current[0].error).toBe('denied')

    // Second call: pending (never resolves)
    mockGetCurrentPosition.mockImplementationOnce(() => {})

    act(() => {
      result.current[1]()
    })

    expect(result.current[0].isLoading).toBe(true)
    expect(result.current[0].error).toBeNull()
    expect(result.current[0].coords).toBeNull()
  })
})
