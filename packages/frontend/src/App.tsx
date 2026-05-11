import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { useAuthStore } from './lib/store'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { WelcomePage } from './pages/WelcomePage'

const AdminPage = lazy(() => import('./pages/AdminPage').then((module) => ({ default: module.AdminPage })))
const PageView = lazy(() => import('./pages/PageView').then((module) => ({ default: module.PageView })))

function RouteFallback() {
  return <div className="grid h-full place-items-center p-6 text-sm text-text-muted">Loading…</div>
}

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

function Protected({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token)
  return token ? children : <Navigate to="/login" replace />
}

function AdminOnly({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token)
  const role = useAuthStore((state) => state.role)
  if (!token) return <Navigate to="/login" replace />
  return role === 'admin' ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <AppLayout>
              <WelcomePage />
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
      <Route
        path="/admin"
        element={
          <AdminOnly>
            <AppLayout>
              <LazyRoute>
                <AdminPage />
              </LazyRoute>
            </AppLayout>
          </AdminOnly>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
