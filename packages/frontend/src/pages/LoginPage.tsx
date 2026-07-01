import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import logoUrl from '../assets/wikindie_logo.png'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { PasswordInput } from '../components/ui/PasswordInput'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { api } from '../lib/api'
import { useAuthStore, useRuntimeConfigStore } from '../lib/store'

const features = [
  { icon: '📝', label: 'Markdown wiki', desc: 'Plain .md files on disk. Grep it, git it, back it up.' },
  { icon: '🗂️', label: 'Kanban boards', desc: 'Columns, cards, labels, comments. All Markdown.' },
  { icon: '🤖', label: 'AI-native MCP', desc: 'Claude Code, Cursor, OpenCode plug in directly.' },
  { icon: '💾', label: 'No database', desc: 'One folder, no lock-in, no SaaS. Just files.' },
]

export function LoginPage() {
  const token = useAuthStore((state) => state.token)
  const setSession = useAuthStore((state) => state.setSession)
  const publicReadonly = useRuntimeConfigStore((state) => state.config?.publicReadonly)
  const [username, setUsername] = useState(import.meta.env.DEV ? 'dev' : '')
  const [password, setPassword] = useState(import.meta.env.DEV ? 'dev' : '')
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
          <p className="mt-3 max-w-md text-balance text-base leading-6 text-text sm:text-lg">
            Your wiki. Your files. Your AI.
          </p>
          <p className="mt-2 max-w-lg text-balance text-sm leading-6 text-text-muted sm:text-base">
            Self-hosted, MCP-native Markdown wiki and kanban. One folder of plain files, no database, no SaaS.
          </p>
        </header>

        <form
          onSubmit={submit}
          className="w-full max-w-md rounded-md border border-border bg-surface p-5 shadow-lg shadow-shadow sm:p-6"
        >
          <div className="mb-5 text-center">
            <h2 className="text-xl font-bold text-text-heading">Sign in</h2>
            <p className="mt-1 text-sm text-text-muted">
              {publicReadonly ? 'Public visitors can browse in read-only mode. Sign in to edit.' : 'Enter your workspace credentials.'}
            </p>
          </div>
          <div className="space-y-3">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="username"
              className="w-full"
            />
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
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
          <a className="font-medium text-accent transition hover:opacity-80" href="https://github.com/dexgamedev/wikindie" target="_blank" rel="noreferrer">
            GitHub
          </a>
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
