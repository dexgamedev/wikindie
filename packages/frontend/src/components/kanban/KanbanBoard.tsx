import { ArrowLeft, Check, CheckCircle2, ListChecks, Plus, Settings } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type CardPriority, type KanbanBoard as Board, type KanbanCard as Card, type PageBundle, type TaskIdSettings } from '../../lib/api'
import { wikiIcons } from '../../lib/icons'
import { createKanbanColumn, isDoneColumn, sortBoardByPriority } from '../../lib/kanban'
import { breadcrumbsFromPath, findTreeNode, goBack, pageNameFromPath, pageUrl } from '../../lib/paths'
import { priorityColor, priorityLabel, priorityRank } from '../../lib/priority'
import { canWrite, useAuthStore, useFilesStore, useTaskFiltersStore } from '../../lib/store'
import { compileSearchRegex, defaultTaskFilters, hasAppliedFilters, matchesKanbanCardFilters, type TaskFilterValues } from '../../lib/taskFilters'
import { useMobileTaskPanel } from '../layout/AppLayout'
import { ActionMenu, ActionMenuItem } from '../ui/ActionMenu'
import { UserIconBadge } from '../ui/AssigneeBadges'
import { Button } from '../ui/Button'
import { PageIcon } from '../ui/PageIcon'
import { KanbanCardDialog } from './KanbanCardDialog'
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

function normalizeTaskIdPrefix(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'TASK'
}

function defaultTaskIdPrefix(value: string) {
  const parts = value.split('/').filter(Boolean)
  return normalizeTaskIdPrefix(parts[parts.length - 1] ?? value)
}

function uniqueLabels(board: Board) {
  return [...new Set(board.columns.flatMap((column) => column.cards.flatMap((card) => card.labels ?? [])))].sort((a, b) => a.localeCompare(b))
}

function taskIdSettingsFromFrontmatter(frontmatter: Record<string, unknown> | undefined, fallback: string): TaskIdSettings {
  const raw = frontmatter?.taskIds
  if (!raw || typeof raw !== 'object') return { enabled: false, prefix: defaultTaskIdPrefix(fallback) }
  const data = raw as Record<string, unknown>
  return {
    enabled: data.enabled === true,
    prefix: normalizeTaskIdPrefix(String(data.prefix ?? fallback)),
  }
}

export function KanbanBoard({
  path,
  initial,
  title,
  icon,
  frontmatter,
  onPageChange,
}: {
  path: string
  initial: Board
  title?: string
  icon?: string
  frontmatter?: Record<string, unknown>
  onPageChange?: (page: PageBundle) => void
}) {
  const navigate = useNavigate()
  const tree = useFilesStore((state) => state.tree)
  const role = useAuthStore((state) => state.role)
  const filterPagePath = useTaskFiltersStore((state) => state.pagePath)
  const priorityFilter = useTaskFiltersStore((state) => state.priorityFilter)
  const assigneeFilter = useTaskFiltersStore((state) => state.assigneeFilter)
  const labelFilter = useTaskFiltersStore((state) => state.labelFilter)
  const stateFilter = useTaskFiltersStore((state) => state.stateFilter)
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
  const [taskIdsEnabled, setTaskIdsEnabled] = useState(() => taskIdSettingsFromFrontmatter(frontmatter, title || path).enabled)
  const [taskIdPrefix, setTaskIdPrefix] = useState(() => taskIdSettingsFromFrontmatter(frontmatter, title || path).prefix)
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board')
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
  const doneCount = useMemo(() => board.columns.reduce((sum, column) => sum + (isDoneColumn(column) ? column.cards.filter((card) => !card.archived).length : 0), 0), [board])
  const archivedCount = useMemo(() => board.columns.reduce((sum, column) => sum + column.cards.filter((card) => card.archived).length, 0), [board])
  const labelOptions = useMemo(() => uniqueLabels(board), [board])
  const taskFilters = useMemo<TaskFilterValues>(
    () => (filterPagePath === path ? { priorityFilter, assigneeFilter, labelFilter, stateFilter, searchPattern } : defaultTaskFilters),
    [assigneeFilter, filterPagePath, labelFilter, path, priorityFilter, searchPattern, stateFilter],
  )
  const search = useMemo(() => compileSearchRegex(taskFilters.searchPattern), [taskFilters.searchPattern])
  const filtersApplied = hasAppliedFilters(taskFilters, search.regex)
  const cardMatchesFilter = useMemo(
    () => (card: Card, column: Board['columns'][number]) => matchesKanbanCardFilters(card, column, taskFilters, search.regex),
    [search.regex, taskFilters],
  )
  const visibleColumns = useMemo(
    () => board.columns
      .map((column, columnIndex) => ({
        column,
        columnIndex,
        cards: column.cards
          .map((card, cardIndex) => ({ card, cardIndex }))
          .filter(({ card }) => cardMatchesFilter(card, column)),
      })),
    [board.columns, cardMatchesFilter],
  )
  const shownCardCount = useMemo(
    () => visibleColumns.reduce((sum, column) => sum + column.cards.length, 0),
    [visibleColumns],
  )
  const showFilteredCount = filtersApplied || shownCardCount !== cardCount
  const tableCards = useMemo(
    () => visibleColumns
      .flatMap(({ column, columnIndex, cards }) => cards.map(({ card, cardIndex }) => ({ card, cardIndex, column, columnIndex })))
      .sort((a, b) => priorityRank(a.card.priority) - priorityRank(b.card.priority) || a.card.title.localeCompare(b.card.title)),
    [visibleColumns],
  )

  useEffect(() => {
    setBoard(initial)
  }, [initial, path])

  useEffect(() => {
    setMetaTitle(title || pageNameFromPath(path))
    setMetaIcon(icon || '')
    const taskIdSettings = taskIdSettingsFromFrontmatter(frontmatter, title || path)
    setTaskIdsEnabled(taskIdSettings.enabled)
    setTaskIdPrefix(taskIdSettings.prefix)
    setMetaEditing(false)
  }, [frontmatter, icon, path, title])

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
    const sorted = sortBoardByPriority(next)
    setBoard(sorted)
    setSaving(true)
    try {
      const updated = await api.saveKanban(path, sorted)
      setBoard(updated.board)
      onPageChange?.(updated)
    } finally {
      setSaving(false)
    }
  }

  const addColumn = () => {
    if (!mayWrite) return
    const title = newColumnTitle.trim()
    if (!title) return
    void update({ columns: [...board.columns, { ...createKanbanColumn(title, board.columns), icon: defaultColumnIcon(title) }] })
    setAddingColumn(false)
    setNewColumnTitle('')
  }

  const saveMeta = async () => {
    if (!mayWrite) return
    const cleanTitle = metaTitle.trim()
    if (!cleanTitle) return
    setSaving(true)
    try {
      const currentTaskIdSettings = taskIdSettingsFromFrontmatter(frontmatter, title || path)
      const nextTaskIdSettings = { enabled: taskIdsEnabled, prefix: normalizeTaskIdPrefix(taskIdPrefix || cleanTitle) }
      const patch: Record<string, unknown> = {
        title: cleanTitle,
        icon: metaIcon || undefined,
      }
      if (currentTaskIdSettings.enabled !== nextTaskIdSettings.enabled || currentTaskIdSettings.prefix !== nextTaskIdSettings.prefix) patch.taskIds = nextTaskIdSettings

      const updated = await api.patchPageMeta(path, patch)
      if (updated.board) setBoard(updated.board)
      onPageChange?.({ ...updated, board: updated.board ?? board })
      setMetaEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const moveCard = (fromColumn: number, fromCard: number, toColumn: number) => {
    if (!mayWrite || fromColumn === toColumn) return
    const next = structuredClone(board)
    const [card] = next.columns[fromColumn].cards.splice(fromCard, 1)
    next.columns[toColumn].cards.push(card)
    void update(next)
  }

  const archiveDone = () => {
    if (!mayWrite) return
    const next = structuredClone(board)
    let changed = false
    for (const column of next.columns) {
      if (!isDoneColumn(column)) continue
      for (const card of column.cards) {
        if (!card.archived) {
          card.archived = true
          changed = true
        }
      }
    }
    if (changed) void update(next)
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
          <div className="hidden rounded-md border border-border bg-input p-0.5 sm:flex">
            <button className={`rounded px-2 py-1 text-xs font-medium transition ${viewMode === 'board' ? 'bg-card text-text' : 'text-text-muted hover:text-text'}`} onClick={() => setViewMode('board')} type="button">Board</button>
            <button className={`rounded px-2 py-1 text-xs font-medium transition ${viewMode === 'table' ? 'bg-card text-text' : 'text-text-muted hover:text-text'}`} onClick={() => setViewMode('table')} type="button">Table</button>
          </div>
          {mayWrite && viewMode === 'board' && <Button className="hidden py-1.5 sm:inline-flex" onClick={() => setAddingColumn((v) => !v)}>{addingColumn ? 'Close' : 'Add column'}</Button>}
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
            {({ close }) => (
              <>
                <ActionMenuItem onSelect={() => { setViewMode((mode) => mode === 'board' ? 'table' : 'board'); close() }}>
                  <ListChecks size={15} /> {viewMode === 'board' ? 'Table view' : 'Board view'}
                </ActionMenuItem>
                {mayWrite ? (
                  <>
                    <ActionMenuItem onSelect={() => { setMetaEditing((open) => !open); close() }}>
                      <Settings size={15} /> {metaEditing ? 'Close board meta' : 'Board meta'}
                    </ActionMenuItem>
                    <ActionMenuItem onSelect={() => { archiveDone(); close() }}>
                      <CheckCircle2 size={15} /> Archive Done
                    </ActionMenuItem>
                    <ActionMenuItem onSelect={() => { setAddingColumn((open) => !open); setViewMode('board'); close() }}>
                      <Plus size={15} /> {addingColumn ? 'Close column form' : 'Add column'}
                    </ActionMenuItem>
                  </>
                ) : (
                  <div className="px-3 py-2 text-sm text-text-muted">Read only</div>
                )}
              </>
            )}
          </ActionMenu>
        </div>
      </header>

      <div className="board-scroll flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-content p-3 sm:p-4 md:p-6 xl:p-8">
      {mayWrite && metaEditing && (
        <article className="mb-4 max-w-3xl rounded-md border border-border bg-card p-4 shadow-sm shadow-shadow sm:mb-6 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-semibold">Board meta</h3>
            <span className="text-xs text-text-muted">Title, icon, and task IDs</span>
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
          <div className="mb-4 rounded-md border border-border bg-input p-3">
            <label className="mb-3 flex items-start gap-3 text-sm text-text">
              <input
                checked={taskIdsEnabled}
                className="mt-1 size-4 accent-accent"
                onChange={(event) => setTaskIdsEnabled(event.target.checked)}
                type="checkbox"
              />
              <span>
                <span className="block font-semibold">Automatic task IDs</span>
                <span className="block text-xs text-text-muted">Disabled by default. Existing IDs stay unchanged; new IDs use this board prefix.</span>
              </span>
            </label>
            <label className="grid gap-1 text-xs text-text-muted">
              ID prefix
              <input
                value={taskIdPrefix}
                onChange={(event) => setTaskIdPrefix(event.target.value.toUpperCase())}
                className="w-full rounded border border-border bg-card px-3 py-2 text-sm font-semibold tracking-wide text-text outline-none transition focus:border-accent"
                placeholder="TASK"
              />
            </label>
            <p className="mt-2 text-xs text-text-muted">Example next ID format: <span className="font-semibold text-text">[{normalizeTaskIdPrefix(taskIdPrefix || metaTitle)}-1]</span></p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void saveMeta()}>Save meta</Button>
            <Button onClick={() => setMetaEditing(false)}>Cancel</Button>
          </div>
        </article>
      )}
      {mayWrite && addingColumn && viewMode === 'board' && (
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
      {viewMode === 'board' ? (
        <div className="workspace-scroll min-h-0 flex-1 overflow-x-auto overflow-y-visible pb-2">
          <div className="grid min-w-0 grid-cols-1 items-start gap-3 sm:w-max sm:grid-flow-col sm:auto-cols-[280px] sm:grid-cols-none sm:gap-4">
            {visibleColumns.map(({ column, columnIndex, cards }) => (
              <KanbanColumn
                key={`${column.id}-${columnIndex}`}
                column={column}
                columnIndex={columnIndex}
                board={board}
                editable={mayWrite}
                availableLabels={labelOptions}
                visibleCards={cards}
                users={users}
                onUpdate={update}
                onMove={moveCard}
              />
            ))}
          </div>
        </div>
      ) : (
        <KanbanTableView board={board} editable={mayWrite} availableLabels={labelOptions} rows={tableCards} users={users} onUpdate={update} />
      )}
      {shownCardCount === 0 && (
        <div className="mt-5 rounded-md border border-dashed border-border bg-surface/70 p-6 text-center text-sm text-text-muted">
          No cards match the current task filters.
        </div>
      )}
      </div>

      <footer className="flex min-h-10 shrink-0 items-center justify-between gap-3 border-t border-border bg-panel px-3 text-xs text-text-muted md:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span>{board.columns.length.toLocaleString()} columns</span>
          <span>{showFilteredCount ? `${shownCardCount.toLocaleString()}/${cardCount.toLocaleString()} shown` : `${cardCount.toLocaleString()} cards`}</span>
          <span>{doneCount.toLocaleString()} in Done</span>
          {archivedCount > 0 && <span>{archivedCount.toLocaleString()} archived</span>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden items-center gap-1.5 sm:flex">
            <CheckCircle2 size={13} className={saving ? 'text-text-muted' : 'text-success'} /> Kanban
          </span>
          <span>{viewMode === 'board' ? 'Board View' : 'Table View'}</span>
        </div>
      </footer>
    </section>
  )
}

function KanbanTableView({
  board,
  editable,
  availableLabels,
  rows,
  users,
  onUpdate,
}: {
  board: Board
  editable: boolean
  availableLabels: string[]
  rows: Array<{ card: Card; cardIndex: number; column: Board['columns'][number]; columnIndex: number }>
  users: string[]
  onUpdate: (board: Board) => void
}) {
  const [editing, setEditing] = useState<null | { card: Card; cardIndex: number; columnIndex: number }>(null)
  const defaultColumnIndex = Math.max(0, board.columns.findIndex((column) => column.status === 'backlog'))
  const [adding, setAdding] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskColumn, setNewTaskColumn] = useState(defaultColumnIndex)
  const [newTaskPriority, setNewTaskPriority] = useState<CardPriority | undefined>()
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([])

  const updateCard = (patch: Partial<Card>) => {
    if (!editable || !editing) return
    const next = structuredClone(board)
    const current = next.columns[editing.columnIndex].cards[editing.cardIndex]
    next.columns[editing.columnIndex].cards[editing.cardIndex] = { ...current, assignees: current.assignees ?? [], labels: current.labels ?? [], ...patch }
    onUpdate(next)
  }

  const addTask = () => {
    if (!editable) return
    const title = newTaskTitle.trim()
    if (!title || !board.columns[newTaskColumn]) return
    const next = structuredClone(board)
    next.columns[newTaskColumn].cards.push({ title, priority: newTaskPriority, assignees: newTaskAssignees, labels: [] })
    onUpdate(next)
    setNewTaskTitle('')
    setNewTaskPriority(undefined)
    setNewTaskAssignees([])
    setAdding(false)
  }

  const resetAddTask = () => {
    setAdding(false)
    setNewTaskTitle('')
    setNewTaskColumn(defaultColumnIndex)
    setNewTaskPriority(undefined)
    setNewTaskAssignees([])
  }

  const toggleNewAssignee = (username: string) => {
    setNewTaskAssignees((current) => current.includes(username) ? current.filter((name) => name !== username) : [...current, username])
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-surface">
      <div className="workspace-scroll min-h-0 flex-1 overflow-auto">
      <table className="min-w-[680px] w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-panel text-xs uppercase tracking-wide text-text-muted">
          <tr>
            <th className="border-b border-border px-3 py-2 font-semibold">Task</th>
            <th className="border-b border-border px-3 py-2 font-semibold">Column</th>
            <th className="border-b border-border px-3 py-2 font-semibold">Priority</th>
            <th className="border-b border-border px-3 py-2 font-semibold">Assignees</th>
            <th className="border-b border-border px-3 py-2 font-semibold">State</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ card, cardIndex, column, columnIndex }) => (
            <tr
              key={`${column.id}-${card.id ?? `${card.title}-${cardIndex}`}`}
              className="cursor-pointer border-b border-border/70 transition hover:bg-accent/8"
              onClick={() => setEditing({ card, cardIndex, columnIndex })}
            >
              <td className="max-w-[320px] px-3 py-2 align-middle">
                <span className="mb-1 flex flex-wrap gap-1">
                  {card.id && <span className="rounded-full border border-accent/35 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">{card.id}</span>}
                  {card.labels?.map((label) => <span key={label} className="rounded-full border border-border bg-input px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">#{label}</span>)}
                </span>
                <span className="break-words text-text">{card.title}</span>
                {card.description && <span className="ml-2 text-xs text-text-muted">Details</span>}
              </td>
              <td className="px-3 py-2 align-middle text-text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <PageIcon icon={column.icon} fallback="column" className="size-4" /> {column.title}
                </span>
              </td>
              <td className="px-3 py-2 align-middle">
                <span className="inline-flex items-center gap-1.5 text-text-muted">
                  <span className={`size-2 rounded-full ${priorityColor(card.priority)}`} /> {priorityLabel(card.priority)}
                </span>
              </td>
              <td className="px-3 py-2 align-middle text-text-muted">{card.assignees?.length ? card.assignees.map((assignee) => `@${assignee}`).join(', ') : 'Unassigned'}</td>
              <td className="px-3 py-2 align-middle text-text-muted">{card.archived ? 'Archived' : 'Active'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="p-6 text-center text-sm text-text-muted">No cards match the current filters.</div>}
      </div>
      {editable && (
        <div className={`shrink-0 border-t border-border bg-panel ${adding ? 'max-h-[60%] overflow-y-auto p-3' : ''}`}>
          {adding ? (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                addTask()
              }}
            >
              <label className="grid gap-1.5 text-sm font-medium text-text">
                Title
                <input
                  autoFocus
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm font-normal text-text outline-none transition focus:border-accent"
                  onChange={(event) => setNewTaskTitle(event.target.value)}
                  placeholder="Task title"
                  value={newTaskTitle}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium text-text">
                  Column
                  <select
                    className="min-w-0 rounded-md border border-border bg-card px-3 py-2 text-sm font-normal text-text outline-none transition focus:border-accent"
                    onChange={(event) => setNewTaskColumn(Number(event.target.value))}
                    value={newTaskColumn}
                  >
                    {board.columns.map((column, index) => <option key={`${column.id}-${index}`} value={index}>{column.title}</option>)}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-text">
                  Priority
                  <div className="flex items-center gap-2">
                    <span aria-hidden className={`inline-block size-3 shrink-0 rounded-full ${priorityColor(newTaskPriority)}`} />
                    <select
                      className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm font-normal text-text outline-none transition focus:border-accent"
                      onChange={(event) => setNewTaskPriority(event.target.value === 'none' ? undefined : event.target.value as CardPriority)}
                      value={newTaskPriority ?? 'none'}
                    >
                      <option value="none">No priority</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </label>
              </div>
              {users.length > 0 && (
                <div className="grid gap-1.5 text-sm font-medium text-text">
                  Assignees
                  <div className="flex flex-wrap gap-1.5">
                    {users.map((username) => {
                      const selected = newTaskAssignees.includes(username)
                      return (
                        <button
                          key={username}
                          className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-normal transition ${selected ? 'border-accent bg-accent/15 text-text' : 'border-border text-text-muted hover:border-accent hover:text-text'}`}
                          onClick={() => toggleNewAssignee(username)}
                          type="button"
                        >
                          <UserIconBadge username={username} className="size-5" />
                          <span>{username}</span>
                          {selected && <Check size={12} className="text-accent" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button onClick={resetAddTask} type="button">Cancel</Button>
                <Button type="submit" variant="primary">Add task</Button>
              </div>
            </form>
          ) : (
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-text-muted transition hover:bg-accent/8 hover:text-text"
              onClick={() => { setNewTaskColumn(defaultColumnIndex); setAdding(true) }}
              type="button"
            >
              <Plus size={14} /> Add task
            </button>
          )}
        </div>
      )}
      {editing && (
        <KanbanCardDialog
          card={editing.card}
          editable={editable}
          availableLabels={availableLabels}
          onClose={() => setEditing(null)}
          onSave={updateCard}
          open
          users={users}
        />
      )}
    </div>
  )
}
