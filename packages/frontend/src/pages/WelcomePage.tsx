import { useAuthStore } from '../lib/store'
import { RecentPages } from '../components/welcome/RecentPages'

const highlights = [
  { label: 'Plain Markdown', value: 'Pages and sections stay portable on disk.' },
  { label: 'Boards included', value: 'Kanban workflows live beside your notes.' },
]

export function WelcomePage() {
  const username = useAuthStore((s) => s.username) ?? 'there'

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto overflow-x-hidden p-3 sm:gap-4 sm:p-4 md:p-6">
      <header className="overflow-hidden rounded-2xl border border-border bg-[radial-gradient(circle_at_top_left,var(--color-content-glow),var(--color-surface)_62%)] p-4 shadow-lg shadow-black/10 md:rounded-3xl md:p-6 md:shadow-xl">
        <div className="grid gap-4 lg:grid-cols-[1fr_22rem] lg:items-stretch">
          <div className="flex min-w-0 flex-col justify-center gap-3 md:gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Workspace home</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-text-heading md:mt-2 md:text-4xl">
                Welcome back, <span className="break-words text-accent">{username}</span>
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted md:text-base">
                Keep your pages, boards, and structured notes close at hand with a workspace that stays readable as plain files.
              </p>
            </div>
          </div>

          <aside className="flex flex-col justify-between rounded-xl border border-accent/25 bg-accent/10 p-3 md:rounded-2xl md:p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Automation ready</p>
              <h2 className="mt-2 text-xl font-bold text-text-heading">Full REST API</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                AI-friendly content automation for pages, sections, kanban boards, and workspace workflows.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {['/api/page', '/api/sections', '/api/kanban'].map((endpoint) => (
                <span key={endpoint} className="rounded-lg border border-border bg-surface/70 px-2.5 py-1 font-mono text-xs text-text-muted">
                  {endpoint}
                </span>
              ))}
            </div>
          </aside>
        </div>
      </header>

      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        {highlights.map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-surface/80 p-3 md:rounded-2xl md:p-4">
            <p className="text-sm font-semibold text-text-heading">{item.label}</p>
            <p className="mt-1 text-sm leading-5 text-text-muted">{item.value}</p>
          </div>
        ))}
      </div>

      <section className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Recent Pages</h2>
          <span className="text-xs text-text-muted">Latest edits first</span>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-2 shadow-lg shadow-black/5">
          <RecentPages />
        </div>
      </section>
    </div>
  )
}
