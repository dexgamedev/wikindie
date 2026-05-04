import { ListChecks, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type BoardSummary } from '../../lib/api'
import { pageUrl } from '../../lib/paths'
import type { WikiEvent } from '../../lib/websocket'
import { PageIcon } from '../ui/PageIcon'

function completion(done: number, total: number) {
  return total > 0 ? Math.round((done / total) * 100) : 0
}

function isChildBoardEvent(pagePath: string, changedPath?: string) {
  if (!changedPath) return false
  return changedPath.startsWith(`${pagePath}/`) && changedPath.endsWith('.md')
}

export function TaskPanel({ pagePath }: { pagePath: string }) {
  const [boards, setBoards] = useState<BoardSummary[]>([])
  const [filterPath, setFilterPath] = useState('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setFilterPath('all')
  }, [pagePath])

  useEffect(() => {
    if (filterPath !== 'all' && !boards.some((board) => board.path === filterPath)) setFilterPath('all')
  }, [boards, filterPath])

  useEffect(() => {
    if (!pagePath) {
      setBoards([])
      setError('')
      setLoading(false)
      return
    }

    let cancelled = false
    const loadBoards = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await api.childBoards(pagePath)
        if (!cancelled) setBoards(result.boards)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load task overview')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadBoards()
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<WikiEvent>).detail
      if (detail.type === 'tree:changed' || (detail.type === 'file:changed' && isChildBoardEvent(pagePath, detail.path))) void loadBoards()
    }
    window.addEventListener('wikindie:event', handler)
    return () => {
      cancelled = true
      window.removeEventListener('wikindie:event', handler)
    }
  }, [pagePath])

  const visibleBoards = useMemo(() => (filterPath === 'all' ? boards : boards.filter((board) => board.path === filterPath)), [boards, filterPath])
  const totals = useMemo(() => {
    const totalCards = boards.reduce((sum, board) => sum + board.totalCards, 0)
    const doneCards = boards.reduce((sum, board) => sum + board.doneCards, 0)
    return { totalCards, doneCards, percent: completion(doneCards, totalCards) }
  }, [boards])

  return (
    <aside className="panel hidden w-[320px] shrink-0 flex-col overflow-hidden xl:flex">
      <div className="border-b border-border p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <ListChecks size={14} /> Task overview
            </p>
            <h2 className="text-2xl font-semibold text-text">{totals.percent}% complete</h2>
          </div>
          {loading && <RefreshCw size={16} className="mt-1 animate-spin text-text-muted" />}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Boards" value={boards.length} />
          <Stat label="Tasks" value={totals.totalCards} />
          <Stat label="Done" value={totals.doneCards} />
        </div>

        {boards.length > 1 && (
          <select
            className="mt-3 w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-text outline-none transition focus:border-accent"
            value={filterPath}
            onChange={(event) => setFilterPath(event.target.value)}
          >
            <option value="all">All child boards</option>
            {boards.map((board) => (
              <option key={board.path} value={board.path}>{board.title}</option>
            ))}
          </select>
        )}
      </div>

      <div className="workspace-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {!pagePath && (
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-text-muted">
            Task summaries appear when a workspace page is open.
          </div>
        )}
        {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
        {!error && pagePath && !loading && boards.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-text-muted">
            No child boards yet. Create board pages below this page to see their task progress here.
          </div>
        )}
        <div className="space-y-3">
          {visibleBoards.map((board) => {
            const percent = completion(board.doneCards, board.totalCards)
            return (
              <Link key={board.path} to={pageUrl(board.path)} className="block rounded-2xl border border-border bg-surface/70 p-3 transition hover:border-accent hover:bg-surface-hover">
                <div className="mb-3 flex min-w-0 items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <PageIcon icon={board.icon} fallback="board" className="size-5 shrink-0" />
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-text">{board.title}</h3>
                      <p className="truncate text-xs text-text-muted">{board.path}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-border bg-slate-950 px-2 py-0.5 text-xs text-text-muted">{percent}%</span>
                </div>

                <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-950">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
                </div>

                <div className="space-y-1.5">
                  {board.columns.map((column) => (
                    <div key={column.title} className="flex items-center justify-between gap-2 text-xs text-text-muted">
                      <span className="min-w-0 truncate">{column.title}</span>
                      <span className="shrink-0 text-text">{column.done}/{column.total}</span>
                    </div>
                  ))}
                  {!board.columns.length && <p className="text-xs text-text-muted">No columns yet.</p>}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-slate-950/60 px-2 py-2">
      <div className="text-base font-semibold text-text">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-text-muted">{label}</div>
    </div>
  )
}
