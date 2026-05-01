import { KanbanSquare, LogOut, Search, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type TreeNode } from '../../lib/api'
import { useAuthStore, useFilesStore } from '../../lib/store'
import { Button } from '../ui/Button'
import { TreeItem } from './TreeItem'

function pageUrl(path: string) {
  return `/page/${path.split('/').map(encodeURIComponent).join('/')}`
}

function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const list: TreeNode[] = []
  const walk = (items: TreeNode[]) => {
    for (const item of items) {
      list.push(item)
      if (item.children?.length) walk(item.children)
    }
  }
  walk(nodes)
  return list
}

export function Sidebar({ mobileOpen, onCloseMobile }: { mobileOpen: boolean; onCloseMobile: () => void }) {
  const tree = useFilesStore((state) => state.tree)
  const setTree = useFilesStore((state) => state.setTree)
  const logout = useAuthStore((state) => state.logout)
  const username = useAuthStore((state) => state.username)
  const navigate = useNavigate()

  const [creating, setCreating] = useState<null | 'page' | 'board'>(null)
  const [createValue, setCreateValue] = useState('')
  const [rootDragOver, setRootDragOver] = useState(false)
  const [quickFindOpen, setQuickFindOpen] = useState(false)
  const [query, setQuery] = useState('')

  const refreshTree = async () => setTree((await api.tree()).tree)

  const startCreate = (type: 'page' | 'board') => {
    setCreating(type)
    setCreateValue('')
  }

  const createItem = async () => {
    if (!creating) return
    const clean = createValue.trim()
    if (!clean) return
    const created = await api.createPage(clean, undefined, creating)
    await refreshTree()
    navigate(pageUrl(created.path))
    setCreating(null)
    setCreateValue('')
    onCloseMobile()
  }

  const dropOnRoot = async (event: React.DragEvent) => {
    event.preventDefault()
    setRootDragOver(false)
    const payload = JSON.parse(event.dataTransfer.getData('application/json') || 'null') as { path: string } | null
    if (!payload) return
    const newPath = payload.path.split('/').pop() ?? payload.path
    if (newPath === payload.path) return
    await api.movePage(payload.path, newPath)
    await refreshTree()
    navigate(pageUrl(newPath))
  }

  const allNodes = useMemo(() => flattenTree(tree), [tree])
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return allNodes.slice(0, 30)
    return allNodes.filter((node) => `${node.title} ${node.path} ${node.icon ?? ''}`.toLowerCase().includes(term)).slice(0, 30)
  }, [allNodes, query])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setQuickFindOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      {mobileOpen && <button className="fixed inset-0 z-30 bg-black/45 md:hidden" onClick={onCloseMobile} aria-label="Close sidebar" />}
      <aside className={`fixed left-0 top-0 z-40 flex h-dvh w-[300px] flex-col border-r border-border bg-sidebar p-3 transition ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Wikindie</h1>
            <p className="text-xs text-text-muted">{username}</p>
          </div>
          <button className="rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text md:hidden" onClick={onCloseMobile} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="mb-3 rounded-xl border border-border bg-surface/60 p-2">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Workspace</span>
            <button className="text-text-muted hover:text-text" onClick={() => setQuickFindOpen(true)} title="Quick find">
              <Search size={15} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => startCreate('page')} title="New page">
              <Sparkles size={14} />
              <span className="ml-1">Page</span>
            </Button>
            <Button onClick={() => startCreate('board')} title="New board">
              <KanbanSquare size={14} />
              <span className="ml-1">Board</span>
            </Button>
          </div>
          {creating && (
            <form
              className="mt-2 flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void createItem()
              }}
            >
              <input
                autoFocus
                className="min-w-0 flex-1 rounded border border-accent bg-slate-950 px-2 py-1.5 text-sm text-text outline-none"
                value={createValue}
                onChange={(event) => setCreateValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setCreating(null)
                }}
                placeholder={creating === 'board' ? 'Board title' : 'Page title'}
              />
              <button className="rounded px-2 py-1 text-sm text-accent" type="submit">Add</button>
            </form>
          )}
        </div>

        <nav
          className={`workspace-scroll mt-1 min-h-0 flex-1 overflow-auto rounded-lg pr-1 ${rootDragOver ? 'bg-accent/10 ring-1 ring-accent' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setRootDragOver(true)
          }}
          onDragLeave={() => setRootDragOver(false)}
          onDrop={dropOnRoot}
        >
          {tree.map((node) => (
            <TreeItem key={node.path} node={node} onRefresh={refreshTree} />
          ))}
          <div className="mt-2 rounded-lg border border-dashed border-border px-3 py-2 text-center text-xs text-text-muted">
            Drop here to move page to workspace root
          </div>
        </nav>

        <div className="mt-auto border-t border-border pt-3">
          <Button className="w-full justify-center" onClick={logout}>
            <LogOut size={14} />
            <span className="ml-1">Logout</span>
          </Button>
        </div>
      </aside>

      {quickFindOpen && (
        <div className="fixed inset-0 z-50 grid place-items-start bg-black/55 p-3 md:place-items-center" onClick={() => setQuickFindOpen(false)}>
          <div className="mt-10 w-full max-w-xl rounded-2xl border border-border bg-slate-950 p-3 shadow-2xl md:mt-0" onClick={(event) => event.stopPropagation()}>
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
              <Search size={16} className="text-text-muted" />
              <input
                autoFocus
                className="w-full bg-transparent text-sm text-text outline-none"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Quick find pages and boards"
              />
            </div>
            <div className="max-h-[60vh] overflow-auto">
              {filtered.map((node) => (
                <button
                  key={node.path}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-text-muted hover:bg-surface-hover hover:text-text"
                  onClick={() => {
                    navigate(pageUrl(node.path))
                    setQuickFindOpen(false)
                    onCloseMobile()
                  }}
                >
                  <span>{node.icon ?? '📄'}</span>
                  <span className="font-medium text-text">{node.title}</span>
                  <span className="min-w-0 truncate text-xs text-text-muted">{node.path}</span>
                </button>
              ))}
              {!filtered.length && <p className="px-2 py-4 text-sm text-text-muted">No results.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
