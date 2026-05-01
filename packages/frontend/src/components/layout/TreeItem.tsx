import { ChevronRight, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { api, type TreeNode } from '../../lib/api'
import { pageUrl } from '../../lib/paths'
import { PageIcon } from '../ui/PageIcon'

interface DragPayload {
  path: string
  type: 'page' | 'board'
}

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

function validMove(source: DragPayload, targetParent: string) {
  if (source.path === targetParent) return false
  if (targetParent.startsWith(`${source.path}/`)) return false
  return joinPath(targetParent, basename(source.path)) !== source.path
}

export function TreeItem({ node, depth = 0, onRefresh }: { node: TreeNode; depth?: number; onRefresh: () => Promise<void> }) {
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
  const navigate = useNavigate()

  const toggle = () => {
    localStorage.setItem(`wikindie:open:${node.path}`, String(!open))
    setOpen(!open)
  }

  const submitRename = async () => {
    const clean = renameValue.trim()
    if (!clean) return
    await api.patchPageMeta(node.path, { title: clean })
    await onRefresh()
    setRenaming(false)
    setMenuOpen(false)
  }

  const submitCreate = async () => {
    if (!creating) return
    const clean = createValue.trim()
    if (!clean) return
    const created = await api.createPage(clean, node.path, creating)
    await onRefresh()
    navigate(pageUrl(created.path))
    setCreating(null)
    setCreateValue('')
    setOpen(true)
  }

  const submitMove = async () => {
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
    await api.removePage(node.path)
    await onRefresh()
    navigate('/page/Home')
  }

  const dropOnNode = async (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDragOver(false)
    const payload = JSON.parse(event.dataTransfer.getData('application/json') || 'null') as DragPayload | null
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
      draggable
      onDragStart={(event) => {
        event.stopPropagation()
        event.dataTransfer.setData('application/json', JSON.stringify({ path: node.path, type: node.type }))
      }}
      onDragOver={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={dropOnNode}
      style={{ paddingLeft: depth * 10 }}
    >
      <div className="group flex items-center gap-1 rounded-md">
        <button className="rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text" onClick={toggle}>
          <ChevronRight size={14} className={`transition ${open ? 'rotate-90' : ''}`} />
        </button>

        {renaming ? (
          <form
            className="min-w-0 flex-1"
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
        ) : (
          <NavLink
            className={({ isActive }) =>
              `flex min-w-0 flex-1 items-center gap-2 rounded-md border-l-2 px-2 py-1.5 text-sm hover:bg-surface-hover ${
                isActive ? 'border-accent bg-surface-hover text-text' : 'border-transparent text-text-muted'
              }`
            }
            to={pageUrl(node.path)}
          >
            <PageIcon icon={node.icon} fallback={node.type === 'board' ? 'board' : 'page'} />
            <span className="min-w-0 truncate">{node.title}</span>
          </NavLink>
        )}

        <button
          className="rounded p-1 text-text-muted opacity-100 hover:bg-surface-hover hover:text-text md:opacity-0 md:group-hover:opacity-100"
          onClick={() => {
            setMenuOpen((v) => !v)
            setConfirmDelete(false)
          }}
        >
          <MoreHorizontal size={15} />
        </button>

      </div>

      {menuOpen && (
        <div className="mt-1 ml-8 w-[200px] rounded-xl border border-border bg-slate-950 p-1 shadow-xl">
          <MenuButton icon={<Pencil size={15} />} label="Rename" onClick={() => { setRenaming(true); setMenuOpen(false) }} />
          <MenuButton icon={<PageIcon icon="page" />} label="New page" onClick={() => { setCreating('page'); setCreateValue(''); setMenuOpen(false); setOpen(true) }} />
          <MenuButton icon={<PageIcon icon="board" />} label="New board" onClick={() => { setCreating('board'); setCreateValue(''); setMenuOpen(false); setOpen(true) }} />
          <MenuButton icon={<PageIcon icon="folder" />} label="Move to..." onClick={() => { setMoving(true); setMenuOpen(false) }} />
          {confirmDelete ? (
            <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-red-300 hover:bg-red-500/10" onClick={remove}>
              <Trash2 size={15} /> Confirm delete
            </button>
          ) : (
            <MenuButton icon={<Trash2 size={15} />} label="Delete" danger onClick={() => setConfirmDelete(true)} />
          )}
        </div>
      )}

      {moving && (
        <form
          className="mt-1 flex items-center gap-2 pl-8"
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

      {creating && (
        <form
          className="mt-1 flex items-center gap-2 pl-8"
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
              if (event.key === 'Escape') setCreating(null)
            }}
          />
          <button className="rounded px-2 py-1 text-xs text-accent" type="submit">Add</button>
        </form>
      )}

      {open && node.children?.map((child) => <TreeItem key={child.path} node={child} depth={depth + 1} onRefresh={onRefresh} />)}
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
