import { ArrowLeft, CheckCircle2, MoreHorizontal, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type KanbanBoard as Board } from '../../lib/api'
import { useDropdown } from '../../hooks/useDropdown'
import { breadcrumbsFromPath, findTreeNode, goBack, pageNameFromPath, pageUrl } from '../../lib/paths'
import { canWrite, useAuthStore, useFilesStore } from '../../lib/store'
import { Button } from '../ui/Button'
import { PageIcon } from '../ui/PageIcon'
import { KanbanColumn } from './KanbanColumn'

export function KanbanBoard({ path, initial, title, icon }: { path: string; initial: Board; title?: string; icon?: string }) {
  const navigate = useNavigate()
  const tree = useFilesStore((state) => state.tree)
  const role = useAuthStore((state) => state.role)
  const mayWrite = canWrite(role)
  const [board, setBoard] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const actions = useDropdown()
  const breadcrumbs = useMemo(
    () => breadcrumbsFromPath(path).map((c) => ({
      ...c,
      label: findTreeNode(tree, c.path)?.title ?? c.label,
    })),
    [path, tree],
  )
  const showBreadcrumbs = breadcrumbs.length > 1
  const displayTitle = title || pageNameFromPath(path)
  const cardCount = useMemo(() => board.columns.reduce((sum, column) => sum + column.cards.length, 0), [board])
  const doneCount = useMemo(() => board.columns.reduce((sum, column) => sum + column.cards.filter((card) => card.done).length, 0), [board])

  useEffect(() => {
    setBoard(initial)
  }, [initial, path])

  const update = async (next: Board) => {
    if (!mayWrite) return
    setBoard(next)
    setSaving(true)
    await api.saveKanban(path, next)
    setSaving(false)
  }

  const addColumn = () => {
    if (!mayWrite) return
    const title = newColumnTitle.trim()
    if (!title) return
    void update({ columns: [...board.columns, { title, cards: [] }] })
    setAddingColumn(false)
    setNewColumnTitle('')
  }

  const moveCard = (fromColumn: number, fromCard: number, toColumn: number) => {
    if (!mayWrite) return
    const next = structuredClone(board)
    const [card] = next.columns[fromColumn].cards.splice(fromCard, 1)
    next.columns[toColumn].cards.push(card)
    void update(next)
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-panel/95 px-3 backdrop-blur md:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface/70 text-text-muted transition hover:border-accent hover:text-text"
            onClick={() => goBack(navigate)}
            title="Go back"
            aria-label="Go back"
          >
            <ArrowLeft size={16} />
          </button>
          <PageIcon icon={icon} fallback="board" className="hidden size-5 shrink-0 sm:inline-flex" />
          <nav className="flex min-w-0 items-center gap-1 text-sm text-text-muted" aria-label="Page breadcrumbs">
            {(showBreadcrumbs ? breadcrumbs : [{ label: displayTitle, path }]).map((crumb, index) => (
              <span key={crumb.path} className="flex min-w-0 items-center gap-1">
                {index > 0 && <span className="text-text-muted/50">/</span>}
                <Link className="max-w-[130px] truncate rounded px-1.5 py-1 hover:bg-surface-hover hover:text-text md:max-w-[180px]" to={pageUrl(crumb.path)}>
                  {crumb.label}
                </Link>
              </span>
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-slate-950/50 px-2.5 py-1 text-xs text-text-muted sm:flex">
            <span className={`size-1.5 rounded-full ${saving ? 'bg-amber-300' : 'bg-emerald-400'}`} />
            {mayWrite ? (saving ? 'Saving...' : 'Saved') : 'Read only'}
          </span>
          {mayWrite && <Button className="hidden py-1.5 sm:inline-flex" onClick={() => setAddingColumn((v) => !v)}>{addingColumn ? 'Close' : 'Add column'}</Button>}
          <div ref={actions.ref} className="relative">
            <button
              className="grid size-9 place-items-center rounded-lg border border-border bg-surface/70 text-text-muted transition hover:border-accent hover:text-text"
              onClick={() => actions.setOpen((open) => !open)}
              title="Board actions"
              aria-label="Board actions"
              type="button"
            >
              <MoreHorizontal size={18} />
            </button>
            {actions.open && (
              <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl border border-border bg-slate-950 p-1.5 shadow-2xl shadow-black/40">
                {mayWrite ? (
                  <button
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text-muted transition hover:bg-surface-hover hover:text-text"
                    onClick={() => {
                      setAddingColumn((open) => !open)
                      actions.setOpen(false)
                    }}
                    type="button"
                  >
                    <Plus size={15} /> {addingColumn ? 'Close column form' : 'Add column'}
                  </button>
                ) : (
                  <div className="px-3 py-2 text-sm text-text-muted">Read only</div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="workspace-scroll min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.12),transparent_32rem)] p-4 md:p-6">
      {mayWrite && addingColumn && (
        <form
          className="mb-4 flex max-w-md items-center gap-2 rounded-2xl border border-border bg-slate-950/55 p-3 shadow-lg shadow-black/10"
          onSubmit={(event) => {
            event.preventDefault()
            addColumn()
          }}
        >
          <input
            autoFocus
            className="min-w-0 flex-1 rounded border border-accent bg-slate-950 px-3 py-2 text-sm text-text outline-none"
            value={newColumnTitle}
            onChange={(event) => setNewColumnTitle(event.target.value)}
            placeholder="Column title"
          />
          <Button type="submit">Add</Button>
        </form>
      )}
      <div className="grid gap-4 lg:grid-flow-col lg:auto-cols-[minmax(280px,1fr)] lg:overflow-x-auto">
        {board.columns.map((column, columnIndex) => (
          <KanbanColumn key={`${column.title}-${columnIndex}`} column={column} columnIndex={columnIndex} board={board} editable={mayWrite} onUpdate={update} onMove={moveCard} />
        ))}
      </div>
      </div>

      <footer className="flex min-h-10 shrink-0 items-center justify-between gap-3 border-t border-border bg-panel/95 px-3 text-xs text-text-muted md:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span>{board.columns.length.toLocaleString()} columns</span>
          <span>{cardCount.toLocaleString()} cards</span>
          <span>{doneCount.toLocaleString()} done</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden items-center gap-1.5 sm:flex">
            <CheckCircle2 size={13} className={saving ? 'text-text-muted' : 'text-emerald-400'} /> Kanban
          </span>
          <span>Board View</span>
        </div>
      </footer>
    </section>
  )
}
