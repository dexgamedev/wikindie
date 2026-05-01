import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { useAuthStore } from './lib/store'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PageView } from './pages/PageView'

function Protected({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((state) => state.token)
  return token ? children : <Navigate to="/login" replace />
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
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
