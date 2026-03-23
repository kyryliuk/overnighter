import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TripPlan, TripPlanPlace, TripPlanSource } from '@/types/tripPlan'

interface SaveTripPlanInput {
  id?: string
  title: string
  notes?: string
  destination: TripPlanPlace
  stops: TripPlanPlace[]
  isPublic?: boolean
  shareToken?: string | null
  sourceTrip?: TripPlanSource | null
}

interface TripPlansStore {
  tripPlans: TripPlan[]
  hasHydrated: boolean
  saveTripPlan: (input: SaveTripPlanInput) => string
  removeTripPlan: (planId: string) => void
  replaceTripPlans: (tripPlans: TripPlan[]) => void
  markHydrated: () => void
}

function createTripPlanId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `trip-${Date.now()}`
}

export const useTripPlansStore = create<TripPlansStore>()(
  persist(
    (set, get) => ({
      tripPlans: [],
      hasHydrated: false,
      saveTripPlan: ({ id, title, notes, destination, stops, isPublic, shareToken, sourceTrip }) => {
        const now = new Date().toISOString()
        const planId = id ?? createTripPlanId()
        const existing = get().tripPlans.find((plan) => plan.id === planId)

        const nextPlan: TripPlan = {
          id: planId,
          title,
          notes: notes === undefined ? existing?.notes ?? '' : notes,
          destination,
          stops,
          isPublic: isPublic ?? existing?.isPublic ?? false,
          shareToken: shareToken === undefined ? existing?.shareToken ?? null : shareToken,
          sourceTrip: sourceTrip === undefined ? existing?.sourceTrip ?? null : sourceTrip,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }

        set((state) => ({
          tripPlans: [nextPlan, ...state.tripPlans.filter((plan) => plan.id !== planId)],
        }))

        return planId
      },
      removeTripPlan: (planId) =>
        set((state) => ({
          tripPlans: state.tripPlans.filter((plan) => plan.id !== planId),
        })),
      replaceTripPlans: (tripPlans) => set({ tripPlans }),
      markHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: 'trip-plans',
      partialize: (state) => ({
        tripPlans: state.tripPlans,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated()
      },
    },
  ),
)
