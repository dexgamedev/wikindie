import { ChevronRight, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useNavigate } from 'react-router-dom'
import { api, type TreeNode } from '../../lib/api'
import { getPageDragPayload, hasPageDragPayload, setPageDragPayload, type PageDragPayload } from '../../lib/pageDrag'
import { pageUrl } from '../../lib/paths'
import { canDelete, canWrite, useAuthStore } from '../../lib/store'
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

function floatingMenuPosition(button: HTMLElement) {
  const rect = button.getBoundingClientRect()
  const gap = 8
  const menuWidth = 200
  const menuHeight = 240
  const rightSide = rect.right + gap
  const left = rightSide + menuWidth <= window.innerWidth - gap ? rightSide : Math.max(gap, rect.left - menuWidth - gap)
  const maxTop = Math.max(gap, window.innerHeight - menuHeight - gap)
  const top = Math.min(Math.max(gap, rect.top - 4), maxTop)
  return { left, top }
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(node.title)
  const [moving, setMoving] = useState(false)
  const [moveValue, setMoveValue] = useState(dirname(node.path))
  const [creating, setCreating] = useState<null | 'page' | 'board'>(null)
  const [createValue, setCreateValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const role = useAuthStore((state) => state.role)
  const mayWrite = canWrite(role)
  const mayDelete = canDelete(role)

  const closeMenu = () => {
    setMenuOpen(false)
    setConfirmDelete(false)
  }

  useEffect(() => {
    if (!menuOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (menuRef.current?.contains(event.target)) return
      if (menuButtonRef.current?.contains(event.target)) return
      closeMenu()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [menuOpen])

  const toggle = () => {
    localStorage.setItem(`wikindie:open:${node.path}`, String(!open))
    setOpen(!open)
  }

  const submitRename = async () => {
    if (!mayWrite) return
    const clean = renameValue.trim()
    if (!clean) return
    await api.patchPageMeta(node.path, { title: clean })
    await onRefresh()
    setRenaming(false)
    setMenuOpen(false)
  }

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
    setMenuOpen(false)
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
      className={`${dragOver ? 'rounded-md bg-accent/10' : ''} ${depth > 0 ? 'ml-2 border-l border-slate-800' : ''}`}
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
        <button className={`rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text ${collapsed ? 'md:hidden' : ''}`} onClick={toggle}>
          <ChevronRight size={14} className={`transition ${open ? 'rotate-90' : ''}`} />
        </button>

        {renaming ? (
          <>
            <form
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
                  className="w-full rounded border border-accent bg-slate-950 px-2 py-1 text-sm text-text outline-none"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setRenaming(false)
                  }}
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
          <button
            ref={menuButtonRef}
            className={`rounded p-1 text-text-muted opacity-100 hover:bg-surface-hover hover:text-text md:opacity-0 md:group-hover:opacity-100 ${collapsed ? 'md:hidden' : ''}`}
            onClick={(event) => {
              if (menuOpen) {
                closeMenu()
                return
              }
              setMenuPosition(floatingMenuPosition(event.currentTarget))
              setMenuOpen(true)
              setConfirmDelete(false)
            }}
          >
            <MoreHorizontal size={15} />
          </button>
        )}

      </div>

      {menuOpen && menuPosition && createPortal(
        <div ref={menuRef} className="fixed z-50 w-[200px] rounded-xl border border-border bg-slate-950 p-1 shadow-2xl" style={menuPosition}>
          {mayWrite && (
            <>
              <MenuButton icon={<Pencil size={15} />} label="Rename" onClick={() => { setRenaming(true); closeMenu() }} />
              <MenuButton icon={<PageIcon icon="page" />} label="New page" onClick={() => { setCreating('page'); setCreateValue(''); setOpen(true); closeMenu() }} />
              <MenuButton icon={<PageIcon icon="board" />} label="New board" onClick={() => { setCreating('board'); setCreateValue(''); setOpen(true); closeMenu() }} />
              <MenuButton icon={<PageIcon icon="folder" />} label="Move to..." onClick={() => { setMoving(true); closeMenu() }} />
            </>
          )}
          {mayDelete && (confirmDelete ? (
              <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-red-300 hover:bg-red-500/10" onClick={() => void remove()}>
                <Trash2 size={15} /> Confirm delete
              </button>
            ) : (
              <MenuButton icon={<Trash2 size={15} />} label="Delete" danger onClick={() => setConfirmDelete(true)} />
            )
          )}
        </div>,
        document.body,
      )}

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
            className="min-w-0 flex-1 rounded border border-accent bg-slate-950 px-2 py-1 text-sm text-text outline-none"
            value={moveValue}
            onChange={(event) => setMoveValue(event.target.value)}
            placeholder="Target parent path"
            onKeyDown={(event) => {
              if (event.key === 'Escape') setMoving(false)
            }}
          />
          <button className="rounded px-2 py-1 text-xs text-accent" type="submit">Move</button>
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
            className="min-w-0 flex-1 rounded border border-accent bg-slate-950 px-2 py-1 text-sm text-text outline-none"
            value={createValue}
            onChange={(event) => setCreateValue(event.target.value)}
            placeholder={creating === 'board' ? 'Board title' : 'Page title'}
            onKeyDown={(event) => {
              if (event.key === 'Escape') cancelCreate()
            }}
          />
          <button className="rounded px-2 py-1 text-xs text-accent" type="submit">Add</button>
          <button className="rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text" type="button" onClick={cancelCreate} aria-label="Cancel create">
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

function MenuButton({ icon, label, onClick, danger = false }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-hover ${danger ? 'text-red-300' : 'text-text'}`} onClick={onClick}>
      {icon}
      {label}
    </button>
  )
}
