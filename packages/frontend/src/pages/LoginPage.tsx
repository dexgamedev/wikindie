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
    <main className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(ellipse_at_top,var(--color-content-glow),var(--color-body)_58%)] px-4 py-5 text-text sm:px-6">
      <div className="absolute right-3 top-3">
        <ThemeToggle />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[linear-gradient(120deg,var(--color-accent-soft),transparent_65%)] opacity-70" />

      <section className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-5xl flex-col items-center justify-between gap-8 pt-12 sm:pt-16">
        <header className="flex flex-col items-center text-center">
          <img src={logoUrl} alt="" className="h-24 w-auto drop-shadow-2xl sm:h-28 md:h-32" />
          <h1 className="mt-4 text-4xl font-black tracking-tight text-text-heading sm:text-5xl">Wikindie</h1>
          <p className="mt-3 max-w-md text-balance text-sm leading-6 text-text-muted sm:text-base">
            Your personal wiki for Markdown pages, project boards, and plain-file knowledge.
          </p>
        </header>

        <form
          onSubmit={submit}
          className="w-full max-w-md rounded-3xl border border-border bg-surface/90 p-5 shadow-2xl shadow-black/20 backdrop-blur-sm sm:p-6"
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
            <Button className="w-full justify-center bg-accent font-semibold text-white hover:opacity-90" type="submit">
              Sign in
            </Button>
          </div>
        </form>

        <ul className="grid w-full max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <li key={feature.label} className="rounded-2xl border border-border bg-surface/75 p-4 shadow-lg shadow-black/10 backdrop-blur-sm">
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
