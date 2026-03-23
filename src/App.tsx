import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useDeviceId } from '@/hooks/useDeviceId'
import { useUIStore } from '@/store/uiStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
    mutations: {
      retry: 3, // NFR-SC4: no silent data loss on check-in/report
    },
  },
})

// Lazy-loaded routes — Leaflet and Admin excluded from main bundle (NFR-P5)
const CheckInForm = lazy(() => import('@/features/check-in/CheckInForm'))
const IssueReportSheet = lazy(() => import('@/features/issue-report/IssueReportSheet'))
const MapView = lazy(() => import('@/features/map/MapView'))
const OnboardingScreen = lazy(() => import('@/features/rig-profile/OnboardingScreen'))
const RigEditScreen = lazy(() => import('@/features/rig-profile/RigEditScreen'))
const PinDetailSheet = lazy(() => import('@/features/pin-detail/PinDetailSheet'))
const SavedSpotsScreen = lazy(() => import('@/features/saved-spots/SavedSpotsScreen'))
const AdminDashboard = lazy(() => import('@/features/admin/AdminDashboard'))

export default function App() {
  useDeviceId() // Initialize anonymous device ID on first app load (Story 4.1)
  const pendingCheckIn = useUIStore((state) => state.pendingCheckIn)
  const setPendingCheckIn = useUIStore((state) => state.setPendingCheckIn)
  const pendingReport = useUIStore((state) => state.pendingReport)
  const setPendingReport = useUIStore((state) => state.setPendingReport)
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
          <Routes>
            <Route path="/" element={<MapView />}>
              <Route path="pin/:id" element={<PinDetailSheet />} />
            </Route>
            <Route path="/onboarding" element={<OnboardingScreen />} />
            <Route path="/rig-edit" element={<RigEditScreen />} />
            <Route path="/saved" element={<SavedSpotsScreen />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      {pendingCheckIn && (
        <Suspense fallback={null}>
          <CheckInForm
            pinId={pendingCheckIn.pinId}
            onClose={() => setPendingCheckIn(null)}
          />
        </Suspense>
      )}
      {pendingReport && (
        <Suspense fallback={null}>
          <IssueReportSheet
            pinId={pendingReport.pinId}
            onClose={() => setPendingReport(null)}
          />
        </Suspense>
      )}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
