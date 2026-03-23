import { useState } from 'react'

export interface GeolocationState {
  isLoading: boolean
  coords: GeolocationCoordinates | null
  error: 'denied' | 'no-api' | 'unavailable' | null
}

export function useGeolocation(): [GeolocationState, () => void] {
  const [state, setState] = useState<GeolocationState>({
    isLoading: false,
    coords: null,
    error: null,
  })

  function request() {
    if (!navigator.geolocation) {
      setState({ isLoading: false, coords: null, error: 'no-api' })
      return
    }
    setState({ isLoading: true, coords: null, error: null })
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({ isLoading: false, coords: position.coords, error: null })
      },
      (err) => {
        setState({
          isLoading: false,
          coords: null,
          error: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable',
        })
      },
      { timeout: 10000, maximumAge: 0 },
    )
  }

  return [state, request]
}
