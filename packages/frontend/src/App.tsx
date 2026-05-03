import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { useAuthStore } from './lib/store'
import { AdminPage } from './pages/AdminPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PageView } from './pages/PageView'

function Protected({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((state) => state.token)
  return token ? children : <Navigate to="/login" replace />
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((state) => state.token)
  const role = useAuthStore((state) => state.role)
  if (!token) return <Navigate to="/login" replace />
  return role === 'admin' ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/page/Workspace" replace />} />
      <Route
        path="/page/*"
        element={
          <Protected>
            <AppLayout>
              <PageView />
            </AppLayout>
          </Protected>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminOnly>
            <AppLayout>
              <AdminPage />
            </AppLayout>
          </AdminOnly>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
