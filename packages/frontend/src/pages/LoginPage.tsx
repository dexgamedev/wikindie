import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import logoUrl from '../assets/wikindie_logo.png'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { api } from '../lib/api'
import { useAuthStore } from '../lib/store'

const features = [
  { icon: '📝', label: 'Markdown wiki', desc: 'Write durable notes as plain Markdown pages.' },
  { icon: '🗂️', label: 'Kanban boards', desc: 'Track projects with simple, flexible boards.' },
  { icon: '🔌', label: 'REST API', desc: 'Automate pages, sections, and workspace flows.' },
  { icon: '💾', label: 'Plain files', desc: 'No database, no lock-in, easy to back up.' },
]

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
      setSession(session.token, session.user.username, session.user.role)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-body px-4 py-5 text-text sm:px-6">
      <div className="absolute right-3 top-3">
        <ThemeToggle />
      </div>

      <section className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-5xl flex-col items-center justify-between gap-8 pt-12 sm:pt-16">
        <header className="flex flex-col items-center text-center">
          <img src={logoUrl} alt="" className="h-24 w-auto sm:h-28 md:h-32" />
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-text-heading sm:text-5xl">Wikindie</h1>
          <p className="mt-3 max-w-md text-balance text-sm leading-6 text-text-muted sm:text-base">
            Your personal wiki for Markdown pages, project boards, and plain-file knowledge.
          </p>
        </header>

        <form
          onSubmit={submit}
          className="w-full max-w-md rounded-md border border-border bg-surface p-5 shadow-lg shadow-shadow sm:p-6"
        >
          <div className="mb-5 text-center">
            <h2 className="text-xl font-bold text-text-heading">Sign in</h2>
            <p className="mt-1 text-sm text-text-muted">Enter your workspace credentials.</p>
          </div>
          <div className="space-y-3">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="username"
              className="w-full"
            />
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
              autoComplete="current-password"
              className="w-full"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button variant="primary" className="w-full justify-center" type="submit">
              Sign in
            </Button>
          </div>
        </form>

        <ul className="grid w-full max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <li key={feature.label} className="rounded-md border border-border bg-surface p-4 shadow-sm shadow-shadow">
              <span className="text-2xl leading-none">{feature.icon}</span>
              <p className="mt-3 font-semibold text-text-heading">{feature.label}</p>
              <p className="mt-1 text-sm leading-5 text-text-muted">{feature.desc}</p>
            </li>
          ))}
        </ul>

        <footer className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pb-1 text-center text-xs text-text-muted sm:text-sm">
          <span>
            Created by <span className="font-semibold text-text">Andy Lázaro</span>
          </span>
          <span aria-hidden="true">·</span>
          <a className="font-medium text-accent transition hover:opacity-80" href="https://x.com/dexgamedev" target="_blank" rel="noreferrer">
            @dexgamedev on X
          </a>
          <span aria-hidden="true">·</span>
          <a className="font-medium text-accent transition hover:opacity-80" href="https://www.tiktok.com/@dexgamedev" target="_blank" rel="noreferrer">
            TikTok
          </a>
        </footer>
      </section>
    </main>
  )
}
