import React, { Component, ErrorInfo, ReactNode, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Sidebar from './components/Sidebar'

// ── Eager imports (always needed) ─────────────────────────────────────────────
import Landing  from './pages/Landing'
import Login    from './pages/Login'
import Register from './pages/Register'

// ── Lazy imports (loaded on demand) ──────────────────────────────────────────
const FieldSetup       = lazy(() => import('./pages/FieldSetup'))
const Dashboard        = lazy(() => import('./pages/Dashboard'))
const YieldDetail      = lazy(() => import('./pages/YieldDetail'))
const MarketPrices     = lazy(() => import('./pages/MarketPrices'))
const History          = lazy(() => import('./pages/History'))
const NdviIndex        = lazy(() => import('./pages/NdviIndex'))
const FertilizerAdvisor= lazy(() => import('./pages/FertilizerAdvisor'))
const Profitability    = lazy(() => import('./pages/Profitability'))
const CropIntelligence = lazy(() => import('./pages/CropIntelligence'))
const WeatherIntel     = lazy(() => import('./pages/WeatherIntel'))

// ── Error Boundary ────────────────────────────────────────────────────────────
interface EBProps  { children: ReactNode }
interface EBState  { hasError: boolean; error: Error | null }

class ErrorBoundary extends Component<EBProps, EBState> {
  constructor(props: EBProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AgriIQ ErrorBoundary:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="container section-sm" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
          <div className="card" style={{ maxWidth: 600, margin: '0 auto', border: '1px solid var(--color-danger)' }}>
            <h3 style={{ color: 'var(--color-danger)', marginBottom: '1rem' }}>Something went wrong</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              className="btn btn-primary"
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Route helpers ─────────────────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <span className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  )
}

// ── Layout wrapper — decides sidebar vs. bare ─────────────────────────────────
function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const token    = useAuthStore(s => s.token)

  const isPublicRoute = ['/', '/login', '/register'].includes(location.pathname)
  const showSidebar   = token && !isPublicRoute

  return (
    <div className={showSidebar ? 'app-with-sidebar' : ''}>
      <Sidebar />
      <main className={showSidebar ? 'sidebar-main' : ''}>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            {children}
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  )
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const token = useAuthStore(s => s.token)

  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          {/* Public */}
          <Route path="/"         element={<Landing />} />
          <Route path="/login"    element={token ? <Navigate to="/dashboard" /> : <Login />} />
          <Route path="/register" element={token ? <Navigate to="/dashboard" /> : <Register />} />
          <Route path="/market"   element={<MarketPrices />} />

          {/* Protected */}
          <Route path="/fields/new"             element={<ProtectedRoute><FieldSetup /></ProtectedRoute>} />
          <Route path="/dashboard"              element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/dashboard/:fieldId"     element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/yield/:fieldId/:crop"   element={<ProtectedRoute><YieldDetail /></ProtectedRoute>} />
          <Route path="/history"                element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="/ndvi"                   element={<ProtectedRoute><NdviIndex /></ProtectedRoute>} />
          <Route path="/fertilizer"             element={<ProtectedRoute><FertilizerAdvisor /></ProtectedRoute>} />
          <Route path="/profitability"          element={<ProtectedRoute><Profitability /></ProtectedRoute>} />
          <Route path="/crop"                   element={<ProtectedRoute><CropIntelligence /></ProtectedRoute>} />
          <Route path="/weather-intel"          element={<ProtectedRoute><WeatherIntel /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  )
}
