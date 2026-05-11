import { ArrowLeft, CheckCircle2, ListChecks, Plus, Settings } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type KanbanBoard as Board, type KanbanCard as Card, type PageBundle } from '../../lib/api'
import { wikiIcons } from '../../lib/icons'
import { breadcrumbsFromPath, findTreeNode, goBack, pageNameFromPath, pageUrl } from '../../lib/paths'
import { canWrite, useAuthStore, useFilesStore, useTaskFiltersStore } from '../../lib/store'
import { compileSearchRegex, defaultTaskFilters, hasAppliedFilters, matchesKanbanCardFilters, type TaskFilterValues } from '../../lib/taskFilters'
import { useMobileTaskPanel } from '../layout/AppLayout'
import { ActionMenu, ActionMenuItem } from '../ui/ActionMenu'
import { Button } from '../ui/Button'
import { PageIcon } from '../ui/PageIcon'
import { KanbanColumn } from './KanbanColumn'

const iconCategories = Array.from(new Set(wikiIcons.map((item) => item.category)))

function defaultColumnIcon(title: string) {
  const clean = title.trim().toLowerCase()
  if (['todo', 'to do', 'backlog'].includes(clean)) return 'todo'
  if (['doing', 'in progress', 'progress'].includes(clean)) return 'doing'
  if (['done', 'complete', 'completed'].includes(clean)) return 'done'
  if (['blocked', 'stuck'].includes(clean)) return 'blocked'
  return undefined
}

export function KanbanBoard({
  path,
  initial,
  title,
  icon,
  onPageChange,
}: {
  path: string
  initial: Board
  title?: string
  icon?: string
  onPageChange?: (page: PageBundle) => void
}) {
  const navigate = useNavigate()
  const tree = useFilesStore((state) => state.tree)
  const role = useAuthStore((state) => state.role)
  const filterPagePath = useTaskFiltersStore((state) => state.pagePath)
  const priorityFilter = useTaskFiltersStore((state) => state.priorityFilter)
  const assigneeFilter = useTaskFiltersStore((state) => state.assigneeFilter)
  const searchPattern = useTaskFiltersStore((state) => state.searchPattern)
  const mayWrite = canWrite(role)
  const { openTasks } = useMobileTaskPanel()
  const [board, setBoard] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<string[]>([])
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const [metaEditing, setMetaEditing] = useState(false)
  const [metaTitle, setMetaTitle] = useState(title || pageNameFromPath(path))
  const [metaIcon, setMetaIcon] = useState(icon || '')
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
  const taskFilters = useMemo<TaskFilterValues>(
    () => (filterPagePath === path ? { priorityFilter, assigneeFilter, searchPattern } : defaultTaskFilters),
    [assigneeFilter, filterPagePath, path, priorityFilter, searchPattern],
  )
  const search = useMemo(() => compileSearchRegex(taskFilters.searchPattern), [taskFilters.searchPattern])
  const filtersApplied = hasAppliedFilters(taskFilters, search.regex)
  const cardMatchesFilter = useMemo(
    () => (filtersApplied ? (card: Card, columnTitle: string) => matchesKanbanCardFilters(card, columnTitle, taskFilters, search.regex) : undefined),
    [filtersApplied, search.regex, taskFilters],
  )
  const visibleColumns = useMemo(
    () => board.columns
      .map((column, columnIndex) => ({
        column,
        columnIndex,
        cards: column.cards
          .map((card, cardIndex) => ({ card, cardIndex }))
          .filter(({ card }) => !cardMatchesFilter || cardMatchesFilter(card, column.title)),
      })),
    [board.columns, cardMatchesFilter],
  )
  const shownCardCount = useMemo(
    () => (filtersApplied ? visibleColumns.reduce((sum, column) => sum + column.cards.length, 0) : cardCount),
    [cardCount, filtersApplied, visibleColumns],
  )

  useEffect(() => {
    setBoard(initial)
  }, [initial, path])

  useEffect(() => {
    setMetaTitle(title || pageNameFromPath(path))
    setMetaIcon(icon || '')
    setMetaEditing(false)
  }, [icon, path, title])

  useEffect(() => {
    let cancelled = false
    api.users()
      .then((result) => {
        if (!cancelled) setUsers(result.users.map((user) => user.username))
      })
      .catch(() => {
        if (!cancelled) setUsers([])
      })
    return () => {
      cancelled = true
    }
  }, [])

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
    void update({ columns: [...board.columns, { title, icon: defaultColumnIcon(title), cards: [] }] })
    setAddingColumn(false)
    setNewColumnTitle('')
  }

  const saveMeta = async () => {
    if (!mayWrite) return
    const cleanTitle = metaTitle.trim()
    if (!cleanTitle) return
    setSaving(true)
    try {
      const updated = await api.patchPageMeta(path, { title: cleanTitle, icon: metaIcon || undefined })
      onPageChange?.({ ...updated, board: updated.board ?? board })
      setMetaEditing(false)
    } finally {
      setSaving(false)
    }
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
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-panel px-3 md:px-4">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <button
            className="grid size-8 shrink-0 place-items-center rounded-md text-text-muted transition hover:bg-accent/10 hover:text-text"
            onClick={() => goBack(navigate)}
            title="Go back"
            aria-label="Go back"
          >
            <ArrowLeft size={16} />
          </button>
          <PageIcon icon={icon} fallback="board" className="hidden size-5 shrink-0 sm:inline-flex" />
          <nav className="flex min-w-0 items-center gap-1 overflow-hidden text-sm text-text-muted" aria-label="Page breadcrumbs">
            {(showBreadcrumbs ? breadcrumbs : [{ label: displayTitle, path }]).map((crumb, index) => (
              <Fragment key={crumb.path}>
                {showBreadcrumbs && breadcrumbs.length > 2 && index === breadcrumbs.length - 2 && <span className="shrink-0 rounded px-1 py-1 text-text-muted/70 sm:hidden">...</span>}
                <span className={`flex min-w-0 items-center gap-1 ${showBreadcrumbs && breadcrumbs.length > 2 && index < breadcrumbs.length - 2 ? 'hidden sm:flex' : ''}`}>
                  {index > 0 && <span className="text-text-muted/50">/</span>}
                  <Link className="max-w-[110px] truncate rounded px-1.5 py-1 hover:bg-accent/10 hover:text-text sm:max-w-[130px] md:max-w-[180px]" to={pageUrl(crumb.path)}>
                    {crumb.label}
                  </Link>
                </span>
              </Fragment>
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-text-muted sm:flex">
            <span className={`size-1.5 rounded-full ${saving ? 'bg-warning' : 'bg-success'}`} />
            {mayWrite ? (saving ? 'Saving...' : 'Saved') : 'Read only'}
          </span>
          {mayWrite && <Button className="hidden py-1.5 sm:inline-flex" onClick={() => setAddingColumn((v) => !v)}>{addingColumn ? 'Close' : 'Add column'}</Button>}
          <button
            className="grid size-9 shrink-0 place-items-center rounded-md text-text-muted transition hover:bg-accent/10 hover:text-text xl:hidden"
            onClick={openTasks}
            title="Task overview"
            aria-label="Open task overview"
            type="button"
          >
            <ListChecks size={16} />
          </button>
          <ActionMenu
            buttonClassName="grid size-9 place-items-center rounded-md text-text-muted transition hover:bg-accent/10 hover:text-text"
            iconSize={18}
            label="Board actions"
            menuClassName="w-48"
          >
            {({ close }) =>
              mayWrite ? (
                <>
                  <ActionMenuItem onSelect={() => { setMetaEditing((open) => !open); close() }}>
                    <Settings size={15} /> {metaEditing ? 'Close page meta' : 'Page meta'}
                  </ActionMenuItem>
                  <ActionMenuItem onSelect={() => { setAddingColumn((open) => !open); close() }}>
                    <Plus size={15} /> {addingColumn ? 'Close column form' : 'Add column'}
                  </ActionMenuItem>
                </>
              ) : (
                <div className="px-3 py-2 text-sm text-text-muted">Read only</div>
              )
            }
          </ActionMenu>
        </div>
      </header>

      <div className="board-scroll flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-content p-3 sm:p-4 md:p-6 xl:p-8">
      {mayWrite && metaEditing && (
        <article className="mb-4 max-w-3xl rounded-md border border-border bg-card p-4 shadow-sm shadow-shadow sm:mb-6 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-semibold">Board meta</h3>
            <span className="text-xs text-text-muted">Title and sidebar icon</span>
          </div>
          <div className="mb-4 grid max-h-72 gap-4 overflow-y-auto rounded-md border border-border bg-input p-3">
            {iconCategories.map((category) => (
              <div key={category}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{category}</div>
                <div className="flex flex-wrap gap-2">
                  {wikiIcons.filter((item) => item.category === category).map((item) => (
                    <button
                      key={item.id}
                      className={`grid size-9 place-items-center rounded-md border text-lg transition ${metaIcon === item.id ? 'border-accent bg-accent/20' : 'border-border bg-card hover:border-accent'}`}
                      onClick={() => setMetaIcon(item.id)}
                      title={`${item.label} (${item.id})`}
                      type="button"
                    >
                      <PageIcon icon={item.id} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mb-4 flex items-center gap-2 text-sm text-text-muted">
            <span>Selected:</span>
            <PageIcon icon={metaIcon} className="text-lg" />
            <span>{metaIcon || 'board'}</span>
          </div>
          <input
            value={metaTitle}
            onChange={(event) => setMetaTitle(event.target.value)}
            className="mb-4 w-full rounded border border-accent bg-input px-3 py-2 text-lg font-semibold text-text outline-none"
          />
          <div className="flex gap-2">
            <Button onClick={() => void saveMeta()}>Save title</Button>
            <Button onClick={() => setMetaEditing(false)}>Cancel</Button>
          </div>
        </article>
      )}
      {mayWrite && addingColumn && (
        <form
          className="mb-4 flex max-w-md flex-col gap-3 rounded-md border border-border bg-card p-4 shadow-sm shadow-shadow sm:mb-6 sm:flex-row sm:items-center"
          onSubmit={(event) => {
            event.preventDefault()
            addColumn()
          }}
        >
          <input
            autoFocus
            className="min-w-0 flex-1 rounded border border-accent bg-input px-3 py-2 text-sm text-text outline-none"
            value={newColumnTitle}
            onChange={(event) => setNewColumnTitle(event.target.value)}
            placeholder="Column title"
          />
          <Button className="w-full justify-center sm:w-auto" type="submit">Add</Button>
        </form>
      )}
      <div className="workspace-scroll min-h-0 flex-1 overflow-x-auto overflow-y-visible pb-2">
        <div className="grid min-w-0 grid-cols-1 items-start gap-3 sm:w-max sm:grid-flow-col sm:auto-cols-[280px] sm:grid-cols-none sm:gap-4">
          {visibleColumns.map(({ column, columnIndex, cards }) => (
            <KanbanColumn
              key={`${column.title}-${columnIndex}`}
              column={column}
              columnIndex={columnIndex}
              board={board}
              editable={mayWrite}
              visibleCards={cards}
              users={users}
              onUpdate={update}
              onMove={moveCard}
            />
          ))}
        </div>
      </div>
      {filtersApplied && shownCardCount === 0 && (
        <div className="mt-5 rounded-md border border-dashed border-border bg-surface/70 p-6 text-center text-sm text-text-muted">
          No cards match the current task filters.
        </div>
      )}
      </div>

      <footer className="flex min-h-10 shrink-0 items-center justify-between gap-3 border-t border-border bg-panel px-3 text-xs text-text-muted md:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span>{board.columns.length.toLocaleString()} columns</span>
          <span>{filtersApplied ? `${shownCardCount.toLocaleString()}/${cardCount.toLocaleString()} shown` : `${cardCount.toLocaleString()} cards`}</span>
          <span>{doneCount.toLocaleString()} done</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden items-center gap-1.5 sm:flex">
            <CheckCircle2 size={13} className={saving ? 'text-text-muted' : 'text-success'} /> Kanban
          </span>
          <span>Board View</span>
        </div>
      </footer>
    </section>
  )
}
