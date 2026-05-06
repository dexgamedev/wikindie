import { ChevronRight, Pencil, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { api, type TreeNode } from '../../lib/api'
import { getPageDragPayload, hasPageDragPayload, setPageDragPayload, type PageDragPayload } from '../../lib/pageDrag'
import { pageUrl } from '../../lib/paths'
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

export function TreeItem({
  node,
  depth = 0,
  collapsed,
  onRefresh,
  onPageDragChange,
}: {
  node: TreeNode
  depth?: number
  collapsed: boolean
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
  const [dragOver, setDragOver] = useState(false)
  const renameFormRef = useRef<HTMLFormElement>(null)
  const navigate = useNavigate()
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
    await api.patchPageMeta(node.path, { title: clean })
    await onRefresh()
    setRenaming(false)
  }, [cancelRename, mayWrite, node.path, onRefresh, renameValue])

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

  const startPageDrag = (event: React.DragEvent) => {
    if (!mayWrite) return
    event.stopPropagation()
    setPageDragPayload(event.dataTransfer, { path: node.path, type: node.type })
    onPageDragChange(true)
  }

  const endPageDrag = () => {
    setDragOver(false)
    onPageDragChange(false)
  }

  const dropOnNode = async (event: React.DragEvent) => {
    event.preventDefault()
    if (!mayWrite) return
    event.stopPropagation()
    setDragOver(false)
    onPageDragChange(false)
    const payload = getPageDragPayload(event.dataTransfer)
    if (!payload || !validMove(payload, node.path)) return
    const newPath = joinPath(node.path, basename(payload.path))
    await api.movePage(payload.path, newPath)
    await onRefresh()
    setOpen(true)
    navigate(pageUrl(newPath))
  }

  return (
    <div
      className={`${dragOver ? 'rounded-md bg-accent/10' : ''} ${depth > 0 ? 'ml-2 border-l border-border' : ''}`}
      onDragOver={(event) => {
        if (!mayWrite) return
        if (!hasPageDragPayload(event.dataTransfer)) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={dropOnNode}
      style={{ paddingLeft: depth * 10 }}
    >
      <div className="group flex items-center gap-1 rounded-md">
        <button className={`rounded p-1 text-text-muted hover:bg-accent/10 hover:text-text ${collapsed ? 'md:hidden' : ''}`} onClick={toggle}>
          <ChevronRight size={14} className={`transition ${open ? 'rotate-90' : ''}`} />
        </button>

        {renaming ? (
          <>
            <form
              ref={renameFormRef}
              className={`min-w-0 flex-1 ${collapsed ? 'md:hidden' : ''}`}
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
                `${collapsed ? 'hidden md:flex' : 'hidden'} min-w-0 flex-1 items-center justify-center rounded-md px-0 py-1.5 text-sm hover:bg-surface-hover ${
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
              `flex min-w-0 flex-1 items-center gap-2 rounded-md border-l-2 px-2 py-1.5 text-sm hover:bg-surface-hover ${collapsed ? 'md:justify-center md:border-l-0 md:px-0' : ''} ${
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
            <span className={`min-w-0 truncate ${collapsed ? 'md:hidden' : ''}`}>{node.title}</span>
          </NavLink>
        )}

        {(mayWrite || mayDelete) && (
          <ActionMenu
            align="start"
            buttonClassName={`rounded p-1 text-text-muted opacity-100 hover:bg-accent/10 hover:text-text md:opacity-0 md:group-hover:opacity-100 ${collapsed ? 'md:hidden' : ''}`}
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
          className={`mt-1 flex items-center gap-2 pl-8 ${collapsed ? 'md:hidden' : ''}`}
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
          className={`mt-1 flex items-center gap-2 pl-8 ${collapsed ? 'md:hidden' : ''}`}
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
        <div className={collapsed ? 'md:hidden' : ''}>
          {node.children?.map((child) => <TreeItem key={child.path} node={child} depth={depth + 1} collapsed={collapsed} onRefresh={onRefresh} onPageDragChange={onPageDragChange} />)}
        </div>
      )}
    </div>
  )
}
