import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type RecentPage } from '../../lib/api'
import { pageUrl } from '../../lib/paths'
import { Spinner } from '../ui/Spinner'

function timeAgo(isoDate: string) {
  const diff = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function RecentPages() {
  const [pages, setPages] = useState<RecentPage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .recents(8)
      .then(({ pages }) => setPages(pages))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl px-4 py-8 text-text-muted">
        <Spinner />
        <span className="text-sm">Loading recent pages…</span>
      </div>
    )
  }

  if (!pages.length) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
        <p className="font-medium text-text-heading">No pages yet</p>
        <p className="mt-1 text-sm text-text-muted">Create your first page from the sidebar to start building your wiki.</p>
      </div>
    )
  }

  return (
    <ul className="space-y-1">
      {pages.map((page) => (
        <li key={page.path}>
          <Link
            to={pageUrl(page.path)}
            className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-sm transition hover:bg-surface-hover"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-sm text-text-muted">
                {page.type === 'board' ? '⬜' : '📄'}
              </span>
              <div className="min-w-0">
                <span className="block truncate font-medium text-text">{page.title}</span>
                <span className="block truncate text-xs text-text-muted">{page.path}</span>
              </div>
            </div>
            <span className="shrink-0 text-xs text-text-muted">{timeAgo(page.mtime)}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
