import { ArrowLeft } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type KanbanBoard as Board } from '../../lib/api'
import { breadcrumbsFromPath, findTreeNode, goBack, pageNameFromPath, pageUrl } from '../../lib/paths'
import { useFilesStore } from '../../lib/store'
import { Button } from '../ui/Button'
import { PageIcon } from '../ui/PageIcon'
import { KanbanColumn } from './KanbanColumn'

export function KanbanBoard({ path, initial, title, icon }: { path: string; initial: Board; title?: string; icon?: string }) {
  const navigate = useNavigate()
  const tree = useFilesStore((state) => state.tree)
  const [board, setBoard] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const breadcrumbs = useMemo(
    () => breadcrumbsFromPath(path).map((c) => ({
      ...c,
      label: findTreeNode(tree, c.path)?.title ?? c.label,
    })),
    [path, tree],
  )
  const showBreadcrumbs = breadcrumbs.length > 1
  const displayTitle = title || pageNameFromPath(path)

  const update = async (next: Board) => {
    setBoard(next)
    setSaving(true)
    await api.saveKanban(path, next)
    setSaving(false)
  }

  const addColumn = () => {
    const title = newColumnTitle.trim()
    if (!title) return
    void update({ columns: [...board.columns, { title, cards: [] }] })
    setAddingColumn(false)
    setNewColumnTitle('')
  }

  const moveCard = (fromColumn: number, fromCard: number, toColumn: number) => {
    const next = structuredClone(board)
    const [card] = next.columns[fromColumn].cards.splice(fromCard, 1)
    next.columns[toColumn].cards.push(card)
    void update(next)
  }

  return (
    <section className="p-4 md:p-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex min-w-0 items-center gap-2 text-sm text-text-muted">
            <button
              className="rounded-md border border-border bg-surface px-2 py-1 text-text-muted transition hover:border-accent hover:text-text"
              onClick={() => goBack(navigate)}
              title="Go back"
              aria-label="Go back"
            >
              <ArrowLeft size={15} />
            </button>
            {showBreadcrumbs && (
              <nav className="flex min-w-0 flex-wrap items-center gap-1" aria-label="Page breadcrumbs">
                {breadcrumbs.map((crumb, index) => (
                  <span key={crumb.path} className="flex min-w-0 items-center gap-1">
                    {index > 0 && <span className="text-text-muted/60">/</span>}
                    <Link className="max-w-[160px] truncate rounded px-1 py-0.5 hover:bg-surface-hover hover:text-text" to={pageUrl(crumb.path)}>
                      {crumb.label}
                    </Link>
                  </span>
                ))}
              </nav>
            )}
          </div>
          <h2 className="flex min-w-0 items-center gap-2 text-2xl font-semibold">
            <PageIcon icon={icon} fallback="board" className="size-6 shrink-0" />
            <span className="truncate">{displayTitle}</span>
          </h2>
        </div>
        <div className="flex items-center gap-3 text-sm text-text-muted">
          <span>{saving ? 'Saving...' : 'Saved'}</span>
          <Button onClick={() => setAddingColumn((v) => !v)}>{addingColumn ? 'Close' : 'Add column'}</Button>
        </div>
      </div>
      {addingColumn && (
        <form
          className="mb-4 flex max-w-md items-center gap-2"
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
          <KanbanColumn key={`${column.title}-${columnIndex}`} column={column} columnIndex={columnIndex} board={board} onUpdate={update} onMove={moveCard} />
        ))}
      </div>
    </section>
  )
}
