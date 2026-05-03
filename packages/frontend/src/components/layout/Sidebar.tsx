import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, type TreeNode } from '../../lib/api'
import { getPageDragPayload, hasPageDragPayload } from '../../lib/pageDrag'
import { findTreeNode, pageUrl } from '../../lib/paths'
import { canWrite, useAuthStore, useFilesStore } from '../../lib/store'
import { PageIcon } from '../ui/PageIcon'
import { AccountMenu } from './AccountMenu'
import { TreeItem } from './TreeItem'

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

function pagePathFromLocation(pathname: string) {
  if (!pathname.startsWith('/page/')) return ''
  try {
    return pathname.slice('/page/'.length).split('/').filter(Boolean).map(decodeURIComponent).join('/')
  } catch {
    return ''
  }
}

export function Sidebar({
  mobileOpen,
  onCloseMobile,
  collapsed,
  onToggleCollapsed,
}: {
  mobileOpen: boolean
  onCloseMobile: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  const tree = useFilesStore((state) => state.tree)
  const setTree = useFilesStore((state) => state.setTree)
  const username = useAuthStore((state) => state.username)
  const role = useAuthStore((state) => state.role)
  const navigate = useNavigate()
  const location = useLocation()
  const mayWrite = canWrite(role)

  const [creating, setCreating] = useState<null | 'page' | 'board'>(null)
  const [createValue, setCreateValue] = useState('')
  const [createAtRoot, setCreateAtRoot] = useState(false)
  const [pageDragActive, setPageDragActive] = useState(false)
  const [rootDragOver, setRootDragOver] = useState(false)
  const [quickFindOpen, setQuickFindOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selectedPath = useMemo(() => pagePathFromLocation(location.pathname), [location.pathname])
  const selectedNode = useMemo(() => (selectedPath ? findTreeNode(tree, selectedPath) : undefined), [selectedPath, tree])

  const refreshTree = async () => setTree((await api.tree()).tree)

  const setPageDragging = (active: boolean) => {
    setPageDragActive(active)
    if (!active) setRootDragOver(false)
  }

  const startCreate = (type: 'page' | 'board') => {
    if (collapsed) onToggleCollapsed()
    setCreating(type)
    setCreateValue('')
    setCreateAtRoot(!selectedNode)
  }

  const cancelCreate = () => {
    setCreating(null)
    setCreateValue('')
    setCreateAtRoot(false)
  }

  const createItem = async () => {
    if (!creating || !mayWrite) return
    const clean = createValue.trim()
    if (!clean) return
    const parentPath = createAtRoot ? undefined : selectedNode?.path
    const created = await api.createPage(clean, parentPath, creating)
    await refreshTree()
    navigate(pageUrl(created.path))
    setCreating(null)
    setCreateValue('')
    onCloseMobile()
  }

  const dropOnRoot = async (event: React.DragEvent) => {
    event.preventDefault()
    if (!mayWrite) return
    setRootDragOver(false)
    setPageDragging(false)
    const payload = getPageDragPayload(event.dataTransfer)
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
      <aside className={`fixed left-0 top-0 z-40 flex h-dvh w-[300px] flex-col border-r border-border bg-sidebar p-3 transition-[transform,width,padding] duration-200 ${collapsed ? 'md:w-[72px] md:p-2' : 'md:w-[300px] md:p-3'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className={`mb-4 flex items-center gap-3 ${collapsed ? 'justify-between md:justify-center' : 'justify-between'}`}>
          <div className={collapsed ? 'md:hidden' : ''}>
            <h1 className="text-lg font-semibold tracking-tight">Wikindie</h1>
            <p className="text-xs text-text-muted">{username}</p>
          </div>
          <button
            className="hidden rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text md:block"
            onClick={onToggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <button className="rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text md:hidden" onClick={onCloseMobile} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="mb-3 space-y-1">
          <button
            className={`flex w-full items-center rounded-xl py-2 text-left text-sm text-text-muted transition hover:bg-surface-hover hover:text-text ${collapsed ? 'gap-3 px-3 md:gap-0 md:justify-center md:px-0' : 'gap-3 px-3'}`}
            onClick={() => setQuickFindOpen(true)}
            title={collapsed ? 'Search pages' : undefined}
          >
            <Search size={15} className="shrink-0" />
            <span className={`min-w-0 flex-1 truncate ${collapsed ? 'md:hidden' : ''}`}>Search pages...</span>
          </button>
          {mayWrite && (
            <>
              <ActionButton icon="page" title="New page" collapsed={collapsed} onClick={() => startCreate('page')} />
              <ActionButton icon="board" title="New board" collapsed={collapsed} onClick={() => startCreate('board')} />
            </>
          )}
          {mayWrite && creating && (
            <form
              className={`rounded-xl bg-surface/50 p-2 ${collapsed ? 'md:hidden' : ''}`}
              onSubmit={(event) => {
                event.preventDefault()
                void createItem()
              }}
            >
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  className="min-w-0 flex-1 rounded-lg border border-accent bg-slate-950 px-2 py-1.5 text-sm text-text outline-none"
                  value={createValue}
                  onChange={(event) => setCreateValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') cancelCreate()
                  }}
                  placeholder={creating === 'board' ? 'Board title' : 'Page title'}
                />
                <button className="rounded-lg px-2 py-1.5 text-sm text-accent hover:bg-surface-hover" type="submit">Add</button>
                <button className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover hover:text-text" type="button" onClick={cancelCreate} aria-label="Cancel create">
                  <X size={15} />
                </button>
              </div>
              <div className="mt-1 flex items-center gap-2 px-1 text-xs text-text-muted">
                <span className="min-w-0 truncate">
                  {createAtRoot || !selectedNode ? '📁 Root' : `📂 ${selectedNode.title}`}
                </span>
                {selectedNode && (
                  <button
                    type="button"
                    className="shrink-0 rounded border border-border px-1.5 py-0.5 text-text-muted hover:border-accent hover:text-text"
                    onClick={() => setCreateAtRoot((v) => !v)}
                  >
                    {createAtRoot ? 'Set selected' : 'Set root'}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        <nav
          className={`workspace-scroll mt-1 min-h-0 flex-1 overflow-auto rounded-lg ${collapsed ? 'pr-1 md:pr-0' : 'pr-1'} ${rootDragOver ? 'bg-accent/10 ring-1 ring-accent' : ''}`}
          onDragOver={(event) => {
            if (!mayWrite) return
            if (!pageDragActive && !hasPageDragPayload(event.dataTransfer)) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            setPageDragging(true)
            setRootDragOver(true)
          }}
          onDragLeave={() => setRootDragOver(false)}
          onDrop={dropOnRoot}
        >
          {tree.map((node) => (
            <TreeItem key={node.path} node={node} collapsed={collapsed} onRefresh={refreshTree} onPageDragChange={setPageDragging} />
          ))}
          {mayWrite && pageDragActive && (
            <div className={`mt-2 rounded-lg border border-dashed border-border px-3 py-2 text-center text-xs text-text-muted ${collapsed ? 'md:hidden' : ''}`}>
              Drop here to move page to workspace root
            </div>
          )}
        </nav>

        <div className="mt-auto border-t border-border pt-3">
          <AccountMenu collapsed={collapsed} />
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
                  <PageIcon icon={node.icon} fallback={node.type === 'board' ? 'board' : 'page'} />
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

function ActionButton({ icon, title, collapsed, onClick }: { icon: string; title: string; collapsed: boolean; onClick: () => void }) {
  return (
    <button
      className={`flex w-full items-center rounded-xl py-2 text-left transition hover:bg-surface-hover ${collapsed ? 'gap-3 px-3 md:gap-0 md:justify-center md:px-0' : 'gap-3 px-3'}`}
      onClick={onClick}
      title={collapsed ? title : undefined}
    >
      <span className="grid size-7 shrink-0 place-items-center text-lg">
        <PageIcon icon={icon} />
      </span>
      <span className={`min-w-0 truncate text-sm font-medium text-text ${collapsed ? 'md:hidden' : ''}`}>{title}</span>
    </button>
  )
}
