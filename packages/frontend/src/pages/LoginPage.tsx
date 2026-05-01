import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../lib/store'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export function LoginPage() {
  const token = useAuthStore((state) => state.token)
  const setSession = useAuthStore((state) => state.setSession)
  const [username, setUsername] = useState('dev')
  const [password, setPassword] = useState('dev')
  const [error, setError] = useState('')

  if (token) return <Navigate to="/" replace />

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      const session = await api.login(username, password)
      setSession(session.token, session.user.username)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#1e1b4b,#020617_55%)] px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-surface/90 p-6 shadow-2xl">
        <h1 className="mb-1 text-2xl font-semibold">Wikindie</h1>
        <p className="mb-6 text-sm text-text-muted">Sign in with `WIKINDIE_USER` credentials.</p>
        <div className="space-y-3">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="w-full" />
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" className="w-full" />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button className="w-full justify-center bg-accent font-medium" type="submit">
            Sign in
          </Button>
        </div>
      </form>
    </main>
  )
}
