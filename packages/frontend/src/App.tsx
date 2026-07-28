import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { api } from './lib/api'
import { pageUrl } from './lib/paths'
import { useAuthStore, useRuntimeConfigStore } from './lib/store'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { WelcomePage } from './pages/WelcomePage'

const ConnectPage = lazy(() => import('./pages/ConnectPage').then((module) => ({ default: module.ConnectPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const PageView = lazy(() => import('./pages/PageView').then((module) => ({ default: module.PageView })))

function RouteFallback() {
  return <div className="grid h-full place-items-center p-6 text-sm text-text-muted">Loading…</div>
}

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

function Protected({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token)
  const config = useRuntimeConfigStore((state) => state.config)
  return token || config?.publicReadonly ? children : <Navigate to="/login" replace />
}

function SignedIn({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token)
  return token ? children : <Navigate to="/login" replace />
}

function HomeRoute() {
  const defaultPage = useRuntimeConfigStore((state) => state.config?.publicDefaultPage)
  if (defaultPage) return <Navigate to={pageUrl(defaultPage)} replace />
  return <WelcomePage />
}

export default function App() {
  const config = useRuntimeConfigStore((state) => state.config)
  const setConfig = useRuntimeConfigStore((state) => state.setConfig)
  const [configLoaded, setConfigLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .config()
      .then((result) => {
        if (!cancelled) setConfig(result)
      })
      .catch(() => {
        if (!cancelled) setConfig({ publicReadonly: false, publicDefaultPage: '', oidcEnabled: false, oidcButtonLabel: '' })
      })
      .finally(() => {
        if (!cancelled) setConfigLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [setConfig])

  if (!configLoaded || !config) return <RouteFallback />

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <AppLayout>
              <HomeRoute />
            </AppLayout>
          </Protected>
        }
      />
      <Route
        path="/page/*"
        element={
          <Protected>
            <AppLayout>
              <LazyRoute>
                <PageView />
              </LazyRoute>
            </AppLayout>
          </Protected>
        }
      />
      <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/connect"
        element={
          <SignedIn>
            <AppLayout>
              <LazyRoute>
                <ConnectPage />
              </LazyRoute>
            </AppLayout>
          </SignedIn>
        }
      />
      <Route
        path="/dashboard"
        element={
          <SignedIn>
            <AppLayout>
              <LazyRoute>
                <DashboardPage />
              </LazyRoute>
            </AppLayout>
          </SignedIn>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
