import type { RigProfile } from '@/types/rigProfile'
import type { Pin } from '@/types/pin'

export interface MigrationPayload {
  rigProfile: RigProfile | null
  onboardingDismissed: boolean
  rigUpdatedAt: string | null
  savedSpots: Pin[]
}

export interface MigrationResult {
  migratedRigProfile: boolean
  migratedSpotsCount: number
}

export async function migrateLocalData(
  accessToken: string,
  payload: MigrationPayload,
): Promise<MigrationResult> {
  const response = await fetch('/api/auth/migrate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(
      (body as { message?: string }).message ?? `Migration failed (${response.status})`,
    )
  }

  return (await response.json()) as MigrationResult
}
