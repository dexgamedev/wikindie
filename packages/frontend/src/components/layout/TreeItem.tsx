import { ChevronRight, Pencil, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { api, type TreeNode } from '../../lib/api'
import { setDragPreview } from '../../lib/dragPreview'
import { getPageDragPayload, hasPageDragPayload, setPageDragPayload, type PageDragPayload } from '../../lib/pageDrag'
import { pageUrl, pagePathFromLocation } from '../../lib/paths'
import { canDelete, canWrite, useAuthStore } from '../../lib/store'
import { ActionMenu, ActionMenuItem } from '../ui/ActionMenu'
import { PageIcon } from '../ui/PageIcon'

function dirname(path: string) {
  const parts = path.split('/')
  parts.pop()
  return parts.join('/')
}
function basename(path: string) {
  return path.split('/').pop() ?? path
}

function joinPath(...parts: string[]) {
  return parts.filter(Boolean).join('/').replace(/\/+/g, '/')
}

function validMove(source: PageDragPayload, targetParent: string) {
  if (source.path === targetParent) return false
  if (targetParent.startsWith(`${source.path}/`)) return false
  return joinPath(targetParent, basename(source.path)) !== source.path
}

function validSiblingDrop(source: PageDragPayload, targetPath: string, targetParent: string) {
  if (source.path === targetPath) return false
  if (source.path === targetParent) return false
  if (targetParent.startsWith(`${source.path}/`)) return false
  return true
}

type TreeDropMode = 'before' | 'inside' | 'after'

export function TreeItem({
  node,
  depth = 0,
  collapsed,
  siblings,
  onRefresh,
  onPageDragChange,
}: {
  node: TreeNode
  depth?: number
  collapsed: boolean
  siblings: TreeNode[]
  onRefresh: () => Promise<void>
  onPageDragChange: (active: boolean) => void
}) {
  const [open, setOpen] = useState(() => localStorage.getItem(`wikindie:open:${node.path}`) !== 'false')
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(node.title)
  const [moving, setMoving] = useState(false)
  const [moveValue, setMoveValue] = useState(dirname(node.path))
  const [creating, setCreating] = useState<null | 'page' | 'board'>(null)
  const [createValue, setCreateValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dragMode, setDragMode] = useState<TreeDropMode | null>(null)
  const [dragging, setDragging] = useState(false)
  const renameFormRef = useRef<HTMLFormElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const role = useAuthStore((state) => state.role)
  const mayWrite = canWrite(role)
  const mayDelete = canDelete(role)

  const cancelRename = useCallback(() => {
    setRenameValue(node.title)
    setRenaming(false)
  }, [node.title])

  const startRename = useCallback(() => {
    setRenameValue(node.title)
    setRenaming(true)
  }, [node.title])

  const toggle = () => {
    localStorage.setItem(`wikindie:open:${node.path}`, String(!open))
    setOpen(!open)
  }

  const submitRename = useCallback(async () => {
    if (!mayWrite) return
    const clean = renameValue.trim()
    if (!clean) {
      cancelRename()
      return
    }
    const newBasename = clean.replaceAll('/', '-').replaceAll('\\', '-')
    const newPath = joinPath(dirname(node.path), newBasename)
    const pathChanged = newPath !== node.path
    const currentPath = pagePathFromLocation(location.pathname)
    const isCurrentOrAncestor = currentPath === node.path || currentPath.startsWith(`${node.path}/`)
    if (pathChanged) await api.movePage(node.path, newPath)
    await api.patchPageMeta(newPath, { title: clean })
    await onRefresh()
    if (pathChanged && isCurrentOrAncestor) {
      const remappedPath = currentPath === node.path ? newPath : `${newPath}${currentPath.slice(node.path.length)}`
      navigate(pageUrl(remappedPath))
    }
    setRenaming(false)
  }, [cancelRename, location.pathname, mayWrite, navigate, node.path, onRefresh, renameValue])

  useEffect(() => {
    if (!renaming) setRenameValue(node.title)
  }, [node.title, renaming])

  useEffect(() => {
    if (!renaming) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        cancelRename()
      }
      if (event.key === 'Enter') {
        if (document.activeElement && renameFormRef.current?.contains(document.activeElement)) return
        event.preventDefault()
        void submitRename()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cancelRename, renaming, submitRename])

  const submitCreate = async () => {
    if (!creating || !mayWrite) return
    const clean = createValue.trim()
    if (!clean) return
    const created = await api.createPage(clean, node.path, creating)
    await onRefresh()
    navigate(pageUrl(created.path))
    setCreating(null)
    setCreateValue('')
    setOpen(true)
  }

  const cancelCreate = () => {
    setCreating(null)
    setCreateValue('')
  }

  const submitMove = async () => {
    if (!mayWrite) return
    const parent = moveValue.trim().replace(/\/+$/, '')
    const newPath = joinPath(parent, basename(node.path))
    if (!newPath || newPath === node.path) {
      setMoving(false)
      return
    }
    await api.movePage(node.path, newPath)
    await onRefresh()
    navigate(pageUrl(newPath))
    setMoving(false)
  }

  const remove = async () => {
    if (!mayDelete) return
    await api.removePage(node.path)
    await onRefresh()
    navigate('/page/Home')
  }

  const patchSiblingOrder = async (orderedPaths: string[]) => {
    await Promise.all(orderedPaths.map((path, index) => api.patchPageMeta(path, { order: index })))
  }

  const dropAsSibling = async (payload: PageDragPayload, mode: 'before' | 'after') => {
    const targetParent = dirname(node.path)
    if (!validSiblingDrop(payload, node.path, targetParent)) return
    const newPath = joinPath(targetParent, basename(payload.path))
    if (newPath !== payload.path && siblings.some((item) => item.path === newPath)) return

    const orderedPaths = siblings.map((item) => item.path).filter((path) => path !== payload.path && path !== newPath)
    const targetIndex = orderedPaths.indexOf(node.path)
    if (targetIndex < 0) return
    orderedPaths.splice(mode === 'before' ? targetIndex : targetIndex + 1, 0, newPath)

    const followingMovedPage = newPath !== payload.path && pagePathFromLocation(location.pathname) === payload.path
    if (newPath !== payload.path) await api.movePage(payload.path, newPath)
    await patchSiblingOrder(orderedPaths)
    await onRefresh()
    if (followingMovedPage) navigate(pageUrl(newPath))
  }

  const dropModeFromEvent = (event: React.DragEvent): TreeDropMode => {
    const rect = rowRef.current?.getBoundingClientRect()
    if (!rect) return 'inside'
    const offset = event.clientY - rect.top
    if (offset < rect.height * 0.3) return 'before'
    if (offset > rect.height * 0.7) return 'after'
    return 'inside'
  }

  const startPageDrag = (event: React.DragEvent) => {
    if (!mayWrite) return
    event.stopPropagation()
    setPageDragPayload(event.dataTransfer, { path: node.path, type: node.type })
    setDragPreview(event.dataTransfer, 'Move page', node.title)
    setDragging(true)
    onPageDragChange(true)
  }

  const endPageDrag = () => {
    setDragging(false)
    setDragMode(null)
    onPageDragChange(false)
  }

  const dropOnNode = async (event: React.DragEvent) => {
    event.preventDefault()
    if (!mayWrite) return
    event.stopPropagation()
    const mode = dragMode ?? dropModeFromEvent(event)
    setDragMode(null)
    onPageDragChange(false)
    const payload = getPageDragPayload(event.dataTransfer)
    if (!payload) return
    if (mode === 'before' || mode === 'after') {
      await dropAsSibling(payload, mode)
      return
    }
    if (!validMove(payload, node.path)) return
    const newPath = joinPath(node.path, basename(payload.path))
    await api.movePage(payload.path, newPath)
    await onRefresh()
    setOpen(true)
    navigate(pageUrl(newPath))
  }

  return (
    <div
      className={`${dragMode === 'inside' ? 'rounded-md bg-accent/10 ring-1 ring-accent/40' : ''} ${dragging ? 'opacity-60' : ''} ${depth > 0 ? 'ml-2 border-l border-border' : ''}`}
      onDragOver={(event) => {
        if (!mayWrite) return
        if (!hasPageDragPayload(event.dataTransfer)) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
        setDragMode(dropModeFromEvent(event))
      }}
      onDragLeave={() => setDragMode(null)}
      onDrop={dropOnNode}
      style={{ paddingLeft: depth * 10 }}
    >
      <div className="group relative flex items-center gap-1 rounded-md border-y-2 border-transparent" ref={rowRef}>
        {(dragMode === 'before' || dragMode === 'after') && (
          <div className={`pointer-events-none absolute left-6 right-2 z-10 flex items-center ${dragMode === 'before' ? '-top-1.5' : '-bottom-1.5'}`}>
            <span className="h-1 flex-1 rounded-full bg-accent shadow-[0_0_12px_var(--color-accent)]" />
            <span className="ml-2 rounded-full border border-control-border bg-panel px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent shadow-sm shadow-shadow">
              {dragMode === 'before' ? 'Place before' : 'Place after'}
            </span>
          </div>
        )}
        <button className={`rounded p-1 text-text-muted hover:bg-accent/10 hover:text-text ${collapsed ? 'lg:hidden' : ''}`} onClick={toggle}>
          <ChevronRight size={14} className={`transition ${open ? 'rotate-90' : ''}`} />
        </button>

        {renaming ? (
          <>
            <form
              ref={renameFormRef}
              className={`min-w-0 flex-1 ${collapsed ? 'lg:hidden' : ''}`}
              onSubmit={(event) => {
                event.preventDefault()
                void submitRename()
              }}
            >
              <div className="flex min-w-0 items-center gap-2 rounded-md border-l-2 border-accent bg-surface-hover px-2 py-1.5 text-sm text-text">
                <PageIcon icon={node.icon} fallback={node.type === 'board' ? 'board' : 'page'} />
                <input
                  autoFocus
                  className="w-full rounded border border-accent bg-input px-2 py-1 text-sm text-text outline-none"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                />
              </div>
            </form>
            <NavLink
              className={({ isActive }) =>
                `${collapsed ? 'hidden lg:flex' : 'hidden'} min-w-0 flex-1 items-center justify-center rounded-md px-0 py-1.5 text-sm hover:bg-surface-hover ${
                  isActive ? 'bg-surface-hover text-text' : 'text-text-muted'
                }`
              }
              to={pageUrl(node.path)}
              title={node.title}
            >
              <PageIcon icon={node.icon} fallback={node.type === 'board' ? 'board' : 'page'} />
            </NavLink>
          </>
        ) : (
          <NavLink
            className={({ isActive }) =>
                `flex min-w-0 flex-1 items-center gap-2 rounded-md border-l-2 px-2 py-1.5 text-sm hover:bg-surface-hover ${mayWrite ? 'cursor-grab active:cursor-grabbing' : ''} ${collapsed ? 'lg:justify-center lg:border-l-0 lg:px-0' : ''} ${
                isActive ? 'border-accent bg-surface-hover text-text' : 'border-transparent text-text-muted'
              }`
            }
            to={pageUrl(node.path)}
            title={collapsed ? node.title : undefined}
            draggable={mayWrite}
            onDragStart={mayWrite ? startPageDrag : undefined}
            onDragEnd={endPageDrag}
          >
            <PageIcon icon={node.icon} fallback={node.type === 'board' ? 'board' : 'page'} />
            <span className={`min-w-0 truncate ${collapsed ? 'lg:hidden' : ''}`}>{node.title}</span>
          </NavLink>
        )}

        {(mayWrite || mayDelete) && (
          <ActionMenu
            align="start"
            buttonClassName={`grid size-9 place-items-center rounded-md text-text-muted opacity-100 hover:bg-accent/10 hover:text-text lg:opacity-0 lg:group-hover:opacity-100 ${collapsed ? 'lg:hidden' : ''}`}
            label="Page actions"
            menuClassName="w-[200px]"
            onClose={() => setConfirmDelete(false)}
            onOpen={() => setConfirmDelete(false)}
          >
            {({ close }) => (
              <>
                {mayWrite && (
                  <>
                    <ActionMenuItem onSelect={() => { startRename(); close() }}>
                      <Pencil size={15} /> Rename
                    </ActionMenuItem>
                    <ActionMenuItem onSelect={() => { setCreating('page'); setCreateValue(''); setOpen(true); close() }}>
                      <PageIcon icon="page" /> New page
                    </ActionMenuItem>
                    <ActionMenuItem onSelect={() => { setCreating('board'); setCreateValue(''); setOpen(true); close() }}>
                      <PageIcon icon="board" /> New board
                    </ActionMenuItem>
                    <ActionMenuItem onSelect={() => { setMoving(true); close() }}>
                      <PageIcon icon="folder" /> Move to...
                    </ActionMenuItem>
                  </>
                )}
                {mayDelete &&
                  (confirmDelete ? (
                    <ActionMenuItem danger onSelect={() => { void remove(); close() }}>
                      <Trash2 size={15} /> Confirm delete
                    </ActionMenuItem>
                  ) : (
                    <ActionMenuItem danger onSelect={() => setConfirmDelete(true)}>
                      <Trash2 size={15} /> Delete
                    </ActionMenuItem>
                  ))}
              </>
            )}
          </ActionMenu>
        )}

      </div>

      {mayWrite && moving && (
        <form
          className={`mt-1 flex items-center gap-2 pl-8 ${collapsed ? 'lg:hidden' : ''}`}
          onSubmit={(event) => {
            event.preventDefault()
            void submitMove()
          }}
        >
          <input
            autoFocus
            className="min-w-0 flex-1 rounded border border-accent bg-input px-2 py-1 text-sm text-text outline-none"
            value={moveValue}
            onChange={(event) => setMoveValue(event.target.value)}
            placeholder="Target parent path"
            onKeyDown={(event) => {
              if (event.key === 'Escape') setMoving(false)
            }}
          />
          <button className="rounded border border-control-border bg-control px-2 py-1 text-xs text-accent hover:bg-control-hover" type="submit">Move</button>
        </form>
      )}

      {mayWrite && creating && (
        <form
          className={`mt-1 flex items-center gap-2 pl-8 ${collapsed ? 'lg:hidden' : ''}`}
          onSubmit={(event) => {
            event.preventDefault()
            void submitCreate()
          }}
        >
          <input
            autoFocus
            className="min-w-0 flex-1 rounded border border-accent bg-input px-2 py-1 text-sm text-text outline-none"
            value={createValue}
            onChange={(event) => setCreateValue(event.target.value)}
            placeholder={creating === 'board' ? 'Board title' : 'Page title'}
            onKeyDown={(event) => {
              if (event.key === 'Escape') cancelCreate()
            }}
          />
          <button className="rounded border border-control-border bg-control px-2 py-1 text-xs text-accent hover:bg-control-hover" type="submit">Add</button>
          <button className="rounded p-1 text-text-muted hover:bg-accent/10 hover:text-text" type="button" onClick={cancelCreate} aria-label="Cancel create">
            <X size={14} />
          </button>
        </form>
      )}

      {open && (
        <div className={collapsed ? 'lg:hidden' : ''}>
          {node.children?.map((child) => <TreeItem key={child.path} node={child} depth={depth + 1} collapsed={collapsed} siblings={node.children ?? []} onRefresh={onRefresh} onPageDragChange={onPageDragChange} />)}
        </div>
      )}
    </div>
  )
}
