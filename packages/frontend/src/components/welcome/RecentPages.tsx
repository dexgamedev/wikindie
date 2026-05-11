import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type RecentPage } from '../../lib/api'
import { pageUrl } from '../../lib/paths'
import { PageIcon } from '../ui/PageIcon'
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
      <div className="flex items-center justify-center gap-2 rounded-md px-4 py-8 text-text-muted">
        <Spinner />
        <span className="text-sm">Loading recent pages…</span>
      </div>
    )
  }

  if (!pages.length) {
    return (
      <div className="rounded-md border border-dashed border-border px-4 py-8 text-center">
        <p className="font-medium text-text-heading">No pages yet</p>
        <p className="mt-1 text-sm text-text-muted">Create your first page from the sidebar to start building your wiki.</p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-border">
      {pages.map((page) => (
        <li key={page.path}>
          <Link
            to={pageUrl(page.path)}
            className="flex items-center gap-2.5 px-2.5 py-2 text-sm transition hover:bg-surface-hover"
          >
            <span className="grid size-6 shrink-0 place-items-center text-base">
              <PageIcon icon={page.icon} fallback={page.type === 'board' ? 'board' : 'page'} />
            </span>
            <span className="min-w-0 flex-1 truncate font-medium text-text">{page.title}</span>
            <span className="shrink-0 text-[11px] text-text-muted">{timeAgo(page.mtime)}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
