if (import.meta.env.MODE === 'development' && typeof window !== 'undefined') {
  if (!('$RefreshReg$' in window)) {
    ;(window as typeof window & { $RefreshReg$?: (type: unknown, id: string) => void }).$RefreshReg$ = () => {}
  }

  if (!('$RefreshSig$' in window)) {
    ;(window as typeof window & { $RefreshSig$?: () => <T>(type: T) => T }).$RefreshSig$ = () => (type) => type
  }
}
