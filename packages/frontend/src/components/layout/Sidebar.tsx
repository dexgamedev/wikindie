import { PanelLeftClose, PanelLeftOpen, Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { getPageDragPayload, hasPageDragPayload } from '../../lib/pageDrag'
import { findTreeNode, pagePathFromLocation, pageUrl } from '../../lib/paths'
import { canWrite, useAuthStore, useFilesStore } from '../../lib/store'
import { PageIcon } from '../ui/PageIcon'
import { TreeItem } from './TreeItem'

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
  const role = useAuthStore((state) => state.role)
  const navigate = useNavigate()
  const location = useLocation()
  const mayWrite = canWrite(role)

  const [creating, setCreating] = useState<null | 'page' | 'board'>(null)
  const [createValue, setCreateValue] = useState('')
  const [createAtRoot, setCreateAtRoot] = useState(false)
  const [newFileOpen, setNewFileOpen] = useState(false)
  const [pageDragActive, setPageDragActive] = useState(false)
  const [rootDragOver, setRootDragOver] = useState(false)

  const selectedPath = useMemo(() => pagePathFromLocation(location.pathname), [location.pathname])
  const selectedNode = useMemo(() => (selectedPath ? findTreeNode(tree, selectedPath) : undefined), [selectedPath, tree])

  const refreshTree = async () => setTree((await api.tree()).tree)

  const setPageDragging = (active: boolean) => {
    setPageDragActive(active)
    if (!active) setRootDragOver(false)
  }

  const startCreate = (type: 'page' | 'board') => {
    if (collapsed) onToggleCollapsed()
    setNewFileOpen(false)
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

  return (
    <>
      {mobileOpen && <button className="fixed inset-0 z-30 bg-overlay lg:hidden" onClick={onCloseMobile} aria-label="Close sidebar" />}
      <aside className={`panel fixed left-0 top-0 z-40 flex h-dvh w-[min(300px,calc(100vw-1.5rem))] flex-col p-4 transition-[transform,width,padding] duration-200 lg:static lg:z-auto lg:h-auto lg:min-h-0 lg:shrink-0 ${collapsed ? 'lg:w-[72px] lg:p-3' : 'lg:w-[300px] lg:p-4'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className={`mb-3 flex items-center gap-2 ${collapsed ? 'justify-between lg:justify-center' : 'justify-between'}`}>
          <span className={`text-xs font-semibold uppercase tracking-wide text-text-muted ${collapsed ? 'lg:hidden' : ''}`}>Workspace</span>
          <button
            className="hidden rounded p-1 text-text-muted hover:bg-accent/10 hover:text-text lg:block"
            onClick={onToggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button className="rounded p-1 text-text-muted hover:bg-accent/10 hover:text-text lg:hidden" onClick={onCloseMobile} title="Close">
            <X size={18} />
          </button>
        </div>
        <nav
          className={`workspace-scroll mt-1 min-h-0 flex-1 overflow-auto rounded-lg ${collapsed ? 'pr-1 lg:pr-0' : 'pr-1'} ${rootDragOver ? 'bg-accent/10 ring-1 ring-accent' : ''}`}
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
            <div className={`mt-2 rounded-lg border border-dashed border-border px-3 py-2 text-center text-xs text-text-muted ${collapsed ? 'lg:hidden' : ''}`}>
              Drop here to move page to workspace root
            </div>
          )}
        </nav>

        {mayWrite && (
          <div className="relative mt-3 border-t border-border pt-3">
            {newFileOpen && !creating && (
              <div className={`absolute bottom-full mb-2 rounded-lg border border-border bg-input p-2 shadow-2xl ${collapsed ? 'left-0 w-[220px]' : 'left-0 right-0'}`}>
                <NewFileOption icon="page" title="New page" onClick={() => startCreate('page')} />
                <NewFileOption icon="board" title="New board" onClick={() => startCreate('board')} />
              </div>
            )}

            {creating && (
              <form
                className={`mb-2 rounded-lg bg-surface/50 p-2 ${collapsed ? 'lg:hidden' : ''}`}
                onSubmit={(event) => {
                  event.preventDefault()
                  void createItem()
                }}
              >
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    className="min-w-0 flex-1 rounded-lg border border-accent bg-input px-2 py-1.5 text-sm text-text outline-none"
                    value={createValue}
                    onChange={(event) => setCreateValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') cancelCreate()
                    }}
                    placeholder={creating === 'board' ? 'Board title' : 'Page title'}
                  />
                  <button className="rounded-lg border border-control-border bg-control px-2 py-1.5 text-sm text-accent hover:bg-control-hover" type="submit">Add</button>
                  <button className="rounded-lg p-1.5 text-text-muted hover:bg-accent/10 hover:text-text" type="button" onClick={cancelCreate} aria-label="Cancel create">
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
                      className="shrink-0 rounded border border-control-border bg-control px-1.5 py-0.5 text-text-muted hover:border-accent hover:bg-control-hover hover:text-text"
                      onClick={() => setCreateAtRoot((v) => !v)}
                    >
                      {createAtRoot ? 'Set selected' : 'Set root'}
                    </button>
                  )}
                </div>
              </form>
            )}

            <button
              className={`flex w-full items-center rounded-lg border border-control-border bg-control py-2 text-left text-sm font-medium text-text transition hover:border-accent hover:bg-control-hover ${collapsed ? 'gap-3 px-3 lg:justify-center lg:px-0' : 'gap-3 px-3'}`}
              onClick={() => {
                setNewFileOpen((open) => !open)
                if (creating) cancelCreate()
              }}
              title={collapsed ? 'New file' : undefined}
            >
              <Plus size={16} className="shrink-0" />
              <span className={`min-w-0 flex-1 truncate ${collapsed ? 'lg:hidden' : ''}`}>New File</span>
            </button>
          </div>
        )}

      </aside>
    </>
  )
}

function NewFileOption({ icon, title, onClick }: { icon: string; title: string; onClick: () => void }) {
  return (
    <button
      className="flex w-full items-center gap-3 rounded-lg bg-control px-3 py-2 text-left transition hover:bg-control-hover"
      onClick={onClick}
    >
      <span className="grid size-7 shrink-0 place-items-center text-lg">
        <PageIcon icon={icon} />
      </span>
      <span className="min-w-0 truncate text-sm font-medium text-text">{title}</span>
    </button>
  )
}
