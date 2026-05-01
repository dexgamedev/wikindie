import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Editor } from '../components/editor/Editor'
import { KanbanBoard } from '../components/kanban/KanbanBoard'
import { Spinner } from '../components/ui/Spinner'
import { api, type PageBundle } from '../lib/api'

function paramToPath(value = '') {
  return value.split('/').filter(Boolean).map(decodeURIComponent).join('/')
}

const pageCache = new Map<string, PageBundle>()

function isCurrentPageEvent(currentPath: string, changedFilePath?: string) {
  if (!changedFilePath) return false
  if (changedFilePath === `${currentPath}.md`) return true
  if (changedFilePath === `${currentPath}/_Index.md`) return true
  if (changedFilePath.startsWith(`${currentPath}/_sections/`)) return true
  return false
}

export function PageView() {
  const params = useParams()
  const path = useMemo(() => paramToPath(params['*']), [params])
  const [page, setPage] = useState<PageBundle | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const cached = pageCache.get(path)
    setPage(cached ?? null)
    setError('')

    api
      .page(path)
      .then((result) => {
        if (cancelled) return
        pageCache.set(path, result)
        setPage(result)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load page'))

    return () => {
      cancelled = true
    }
  }, [path])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { type: string; path?: string }
      if (detail.type !== 'file:changed' || !isCurrentPageEvent(path, detail.path)) return
      void api.page(path).then((fresh) => {
        pageCache.set(path, fresh)
        setPage(fresh)
      })
    }
    window.addEventListener('wikindie:event', handler)
    return () => window.removeEventListener('wikindie:event', handler)
  }, [path])

  if (error) return <div className="p-8 text-red-300">{error}</div>
  if (!page) return <div className="p-8"><Spinner /></div>
  if (page.type === 'board' && page.board) return <KanbanBoard path={page.path} initial={page.board} />
  return <Editor page={page} onPageChange={(next) => { pageCache.set(next.path, next); setPage(next) }} />
}
