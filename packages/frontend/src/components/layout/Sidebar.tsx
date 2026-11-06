import { Github, PanelLeftClose, PanelLeftOpen, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import logoUrl from '../../assets/wikindie_logo.png'
import { api } from '../../lib/api'
import { getPageDragPayload, hasPageDragPayload } from '../../lib/pageDrag'
import { findTreeNode, pagePathFromLocation, pageUrl } from '../../lib/paths'
import { canWrite, useAuthStore, useFilesStore } from '../../lib/store'
import { appVersion, githubUrl } from '../../lib/version'
import { PageIcon } from '../ui/PageIcon'

import { AccountMenu } from './AccountMenu'
import { TreeItem } from './TreeItem'

const sidebarWidthKey = 'wikindie:sidebar-width'
const defaultSidebarWidth = 300
const minSidebarWidth = 200
const maxSidebarWidth = 560

function clampSidebarWidth(value: number) {
  return Math.min(maxSidebarWidth, Math.max(minSidebarWidth, Math.round(value)))
}

function readStoredSidebarWidth() {
  const stored = Number(localStorage.getItem(sidebarWidthKey))
  return Number.isFinite(stored) && stored > 0 ? clampSidebarWidth(stored) : defaultSidebarWidth
}

export function Sidebar({
  mobileOpen,
  onCloseMobile,
  collapsed,
  onToggleCollapsed,
  onSearchOpen,
}: {
  mobileOpen: boolean
  onCloseMobile: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
  onSearchOpen: () => void
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
  const [width, setWidth] = useState(readStoredSidebarWidth)
  const [resizing, setResizing] = useState(false)
  const widthRef = useRef(width)
  const asideRef = useRef<HTMLElement>(null)

  useEffect(() => {
    widthRef.current = width
  }, [width])

  const setLiveWidth = (next: number) => {
    const clamped = clampSidebarWidth(next)
    widthRef.current = clamped
    asideRef.current?.style.setProperty('--sidebar-width', `${clamped}px`)
  }

  const persistWidth = () => {
    localStorage.setItem(sidebarWidthKey, String(widthRef.current))
  }

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (collapsed || event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const startWidth = widthRef.current
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    setResizing(true)
    document.body.classList.add('wikindie-resizing')

    const onMove = (moveEvent: PointerEvent) => setLiveWidth(startWidth + moveEvent.clientX - startX)
    const onUp = () => {
      handle.releasePointerCapture?.(event.pointerId)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.body.classList.remove('wikindie-resizing')
      setResizing(false)
      setWidth(widthRef.current)
      persistWidth()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const nudgeWidth = (delta: number) => {
    setLiveWidth(widthRef.current + delta)
    setWidth(widthRef.current)
    persistWidth()
  }

  const resetWidth = () => {
    setLiveWidth(defaultSidebarWidth)
    setWidth(widthRef.current)
    persistWidth()
  }

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
      <aside
        className={`bg-sidebar fixed left-0 top-0 z-40 flex h-dvh w-[min(300px,calc(100vw-1.5rem))] flex-col border-r border-border shadow-lg shadow-heavy lg:relative lg:z-auto lg:h-auto lg:min-h-0 lg:shrink-0 lg:border-0 lg:shadow-none ${collapsed ? 'lg:w-[72px]' : 'lg:w-[var(--sidebar-width)]'} ${resizing ? 'transition-none' : 'transition-[transform,width,padding] duration-200'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        ref={asideRef}
        style={{ '--sidebar-width': `${width}px` } as React.CSSProperties}
      >
        {!collapsed && (
          <div
            aria-label="Resize sidebar"
            aria-orientation="vertical"
            aria-valuemax={maxSidebarWidth}
            aria-valuemin={minSidebarWidth}
            aria-valuenow={width}
            className={`absolute inset-y-0 right-0 z-50 hidden w-2 translate-x-1/2 cursor-col-resize touch-none select-none lg:block ${resizing ? 'bg-accent/30' : 'bg-transparent hover:bg-accent/25'}`}
            onDoubleClick={resetWidth}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') {
                event.preventDefault()
                nudgeWidth(-16)
              }
              if (event.key === 'ArrowRight') {
                event.preventDefault()
                nudgeWidth(16)
              }
              if (event.key === 'Home') {
                event.preventDefault()
                resetWidth()
              }
            }}
            onPointerDown={startResize}
            role="separator"
            tabIndex={0}
            title="Drag to resize, double-click to reset"
          />
        )}

        {/* Zone A: Logo + desktop collapse toggle */}
        <div className={`hidden items-center lg:flex ${collapsed ? 'justify-center px-2 py-2' : 'justify-between gap-2 px-2.5 py-2'}`}>
          {!collapsed && (
            <Link to="/" className="flex min-w-0 items-center gap-2 rounded-md transition hover:opacity-80">
              <img src={logoUrl} alt="" className="block h-6 w-auto shrink-0" />
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className="block truncate text-sm font-semibold leading-none tracking-tight text-text-heading">Wikindie</span>
                <span className="block shrink-0 font-mono text-[10px] leading-none text-text-muted">{appVersion}</span>
              </span>
            </Link>
          )}
          <button
            className="grid size-7 shrink-0 place-items-center rounded-md text-text-muted transition hover:bg-surface-hover hover:text-text"
            onClick={onToggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            type="button"
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {/* Zone B: New File + create flow */}
        {mayWrite && (
          <div className="relative px-2 py-1">
            {newFileOpen && !creating && (
              <div className={`absolute top-full z-10 mt-1 rounded-lg border border-border bg-popover p-1 shadow-[0_8px_24px_var(--color-shadow-heavy)] ${collapsed ? 'left-0 w-[220px]' : 'left-2 right-2'}`}>
                <NewFileOption icon="page" title="New page" onClick={() => startCreate('page')} />
                <NewFileOption icon="board" title="New board" onClick={() => startCreate('board')} />
              </div>
            )}

            {creating && (
              <form
                className={`mb-1 rounded-md bg-surface/50 p-2 ${collapsed ? 'lg:hidden' : ''}`}
                onSubmit={(event) => {
                  event.preventDefault()
                  void createItem()
                }}
              >
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    className="min-w-0 flex-1 rounded-md border border-accent bg-input px-2 py-1 text-sm text-text outline-none"
                    value={createValue}
                    onChange={(event) => setCreateValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') cancelCreate()
                    }}
                    placeholder={creating === 'board' ? 'Board title' : 'Page title'}
                  />
                  <button className="h-7 rounded-md border border-border bg-panel px-2 text-sm text-text hover:bg-surface-hover" type="submit">Add</button>
                  <button className="rounded-md p-1 text-text-muted hover:bg-surface-hover hover:text-text" type="button" onClick={cancelCreate} aria-label="Cancel create">
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
                      className="shrink-0 rounded border border-border bg-surface px-1.5 py-0.5 text-text-muted hover:border-text-muted/40 hover:text-text"
                      onClick={() => setCreateAtRoot((v) => !v)}
                    >
                      {createAtRoot ? 'Set selected' : 'Set root'}
                    </button>
                  )}
                </div>
              </form>
            )}

            <button
              className={`flex w-full items-center rounded-md text-text-muted transition hover:bg-surface-hover hover:text-text ${collapsed ? 'h-7 justify-center px-0' : 'h-7 gap-2 px-2'}`}
              onClick={() => {
                setNewFileOpen((open) => !open)
                if (creating) cancelCreate()
              }}
              title={collapsed ? 'New file' : undefined}
            >
              <Plus size={16} className="shrink-0" />
              <span className={`min-w-0 flex-1 truncate text-left text-sm ${collapsed ? 'hidden' : ''}`}>New File</span>
            </button>
          </div>
        )}

        {/* Zone C: Vault heading + mobile close toggle */}
        <div className={`flex items-center justify-between px-3 pb-1 pt-3 ${collapsed ? 'lg:hidden' : ''}`}>
          <span className="text-[11px] font-medium text-text-muted">Vault</span>
          <button className="rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text lg:hidden" onClick={onCloseMobile} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Zone D: Nav tree */}
        <nav
          className={`workspace-scroll min-h-0 flex-1 overflow-auto px-1.5 pt-0.5 ${collapsed ? 'lg:px-1' : ''} ${rootDragOver ? 'bg-accent/10 ring-1 ring-accent' : ''}`}
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
            <TreeItem key={node.path} node={node} collapsed={collapsed} siblings={tree} onRefresh={refreshTree} onPageDragChange={setPageDragging} />
          ))}
          {mayWrite && pageDragActive && (
            <div className={`mt-2 rounded-md border border-dashed border-border px-3 py-2 text-center text-xs text-text-muted ${collapsed ? 'lg:hidden' : ''}`}>
              Drop here to move page to workspace root
            </div>
          )}
        </nav>

        {/* Zone E: Footer toolbar (desktop only) */}
        <div className={`hidden items-center lg:flex ${collapsed ? 'justify-center px-2 py-2' : 'gap-1.5 px-2 py-2'}`}>
          <button
            className={`flex min-w-0 flex-1 items-center rounded-md text-text-muted transition hover:bg-surface-hover hover:text-text ${collapsed ? 'hidden' : 'h-7 gap-2 px-2'}`}
            onClick={onSearchOpen}
            title="Search pages (Ctrl+K)"
            type="button"
          >
            <Search size={14} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left text-sm">Search</span>
            <kbd className="shrink-0 rounded border border-border bg-input px-1.5 py-0.5 font-mono text-[10px] text-text-muted">Ctrl K</kbd>
          </button>
          <a
            className="grid size-7 shrink-0 place-items-center rounded-md text-text-muted transition hover:bg-surface-hover hover:text-text"
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            title="GitHub repository"
            aria-label="GitHub repository"
          >
            <Github size={16} />
          </a>
          {!collapsed && <AccountMenu direction="up" />}
        </div>

      </aside>
    </>
  )
}

function NewFileOption({ icon, title, onClick }: { icon: string; title: string; onClick: () => void }) {
  return (
    <button
      className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-text transition hover:bg-surface-hover"
      onClick={onClick}
    >
      <span className="grid size-4 shrink-0 place-items-center text-base">
        <PageIcon icon={icon} />
      </span>
      <span className="min-w-0 truncate">{title}</span>
    </button>
  )
}
