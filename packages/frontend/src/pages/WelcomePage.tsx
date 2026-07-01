import { CheckCircle2, ChevronDown, CircleDot, FileText, HardDrive, Image as ImageIcon, Layout } from 'lucide-react'
import { useEffect, useState } from 'react'
import { RecentPages } from '../components/welcome/RecentPages'
import { api, type WorkspaceStats } from '../lib/api'
import { useAuthStore } from '../lib/store'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function StatsCard() {
  const [stats, setStats] = useState<WorkspaceStats | null>(null)
  const [breakdownOpen, setBreakdownOpen] = useState(false)

  useEffect(() => {
    api.stats().then(({ stats }) => setStats(stats)).catch(console.error)
  }, [])

  const openTasks = stats ? stats.totalTasks - stats.doneTasks : 0

  return (
    <div className="flex flex-1 flex-col px-3 py-2">
      <ul className="space-y-0.5">
        <StatRow icon={<FileText size={14} />} label="Pages" value={stats?.totalPages} />
        <StatRow icon={<Layout size={14} />} label="Boards" value={stats?.totalBoards} />
        <StatRow icon={<ImageIcon size={14} />} label="Images" value={stats?.imageCount} />
        <StatRow icon={<CircleDot size={14} />} label="Open tasks" value={stats ? openTasks : undefined} accent />
        <StatRow icon={<CheckCircle2 size={14} />} label="In Done" value={stats?.doneTasks} />
      </ul>

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setBreakdownOpen((open) => !open)}
          aria-expanded={breakdownOpen}
          className="inline-flex items-center gap-2 rounded-md bg-accent/8 px-2.5 py-2 text-xs text-text-muted transition hover:bg-accent/10 hover:text-text"
        >
          <HardDrive size={13} className="shrink-0 text-accent" />
          <span className="font-medium">{stats ? formatBytes(stats.diskSizeBytes + stats.imageDiskSizeBytes) : '–'}</span>
          <span>on disk</span>
          <ChevronDown size={13} className={`shrink-0 transition-transform ${breakdownOpen ? 'rotate-180' : ''}`} />
        </button>
        {breakdownOpen && (
          <ul className="mt-2 space-y-1 px-1 text-[11px] text-text-muted">
            <li className="flex items-center gap-1.5">
              <FileText size={11} className="shrink-0" />
              <span>Content</span>
              <span className="font-medium tabular-nums text-text">{stats ? formatBytes(stats.diskSizeBytes) : '–'}</span>
            </li>
            <li className="flex items-center gap-1.5">
              <ImageIcon size={11} className="shrink-0" />
              <span>Images</span>
              <span className="font-medium tabular-nums text-text">{stats ? formatBytes(stats.imageDiskSizeBytes) : '–'}</span>
            </li>
          </ul>
        )}
      </div>
    </div>
  )
}

function StatRow({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value?: number; accent?: boolean }) {
  return (
    <li className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
      <span className="text-text-muted">{icon}</span>
      <span className="flex-1 text-sm text-text">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${accent ? 'text-accent-warm' : 'text-text-heading'}`}>{value ?? '–'}</span>
    </li>
  )
}

export function WelcomePage() {
  const username = useAuthStore((s) => s.username) ?? 'there'

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">Workspace home</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-text-heading md:text-3xl">
          Welcome back, <span className="text-accent-warm">{username}</span>
        </h1>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-surface shadow-sm shadow-shadow">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Recent Pages</h2>
            <span className="text-[11px] text-text-muted">Latest edits first</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <RecentPages />
          </div>
        </section>

        <section className="flex flex-col overflow-hidden rounded-md border border-border bg-surface shadow-sm shadow-shadow">
          <div className="border-b border-border px-3 py-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Wiki Status</h2>
          </div>
          <StatsCard />
        </section>
      </div>
    </div>
  )
}
