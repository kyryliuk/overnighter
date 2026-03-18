import { describe, it, expect, beforeEach } from 'vitest'
import { useRigStore } from './rigStore'
import type { RigProfile } from '@/types/rigProfile'

// Reset store and localStorage between tests
beforeEach(() => {
  localStorage.clear()
  useRigStore.getState().clearRigProfile()
})

describe('useRigStore', () => {
  it('starts with empty rig profile', () => {
    const { rigProfile } = useRigStore.getState()
    expect(rigProfile.rigType).toBeNull()
    expect(rigProfile.lengthFt).toBeNull()
    expect(rigProfile.heightFt).toBeNull()
  })

  it('hasRigProfile returns false when no rig type set', () => {
    const { hasRigProfile } = useRigStore.getState()
    expect(hasRigProfile()).toBe(false)
  })

  it('sets rig profile correctly', () => {
    const profile: RigProfile = { rigType: 'Class A', lengthFt: 40, heightFt: 13.5 }
    useRigStore.getState().setRigProfile(profile)

    const { rigProfile } = useRigStore.getState()
    expect(rigProfile.rigType).toBe('Class A')
    expect(rigProfile.lengthFt).toBe(40)
    expect(rigProfile.heightFt).toBe(13.5)
  })

  it('hasRigProfile returns true after profile is set', () => {
    useRigStore.getState().setRigProfile({ rigType: 'Travel Trailer', lengthFt: 28, heightFt: 12 })
    expect(useRigStore.getState().hasRigProfile()).toBe(true)
  })

  it('clearRigProfile resets to defaults', () => {
    useRigStore.getState().setRigProfile({ rigType: 'Class B', lengthFt: 22, heightFt: 11 })
    useRigStore.getState().clearRigProfile()

    const { rigProfile } = useRigStore.getState()
    expect(rigProfile.rigType).toBeNull()
    expect(rigProfile.lengthFt).toBeNull()
    expect(rigProfile.heightFt).toBeNull()
  })

  it('state update is immutable — does not mutate previous state reference', () => {
    const before = useRigStore.getState().rigProfile
    useRigStore.getState().setRigProfile({ rigType: '5th Wheel', lengthFt: 35, heightFt: 13 })
    const after = useRigStore.getState().rigProfile
    // Should be different object references (immutable update)
    expect(before).not.toBe(after)
  })
})
