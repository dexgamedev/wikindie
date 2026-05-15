import { AlertTriangle, ArrowUpRight, Filter, ListChecks, PanelRightClose, PanelRightOpen, Plus, RefreshCw, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type BoardSummary, type TaskInfo, type TaskOverviewScope } from '../../lib/api'
import { isDoneColumn } from '../../lib/kanban'
import { pageUrl } from '../../lib/paths'
import { priorityColor, priorityLabel, priorityRank } from '../../lib/priority'
import { canWrite, useAuthStore, useFilesStore, useTaskFiltersStore } from '../../lib/store'
import { compileSearchRegex, hasAppliedFilters, hasFilterValues, matchesBoardSearch, matchesTaskInfoFilters, type TaskFilterValues } from '../../lib/taskFilters'
import type { WikiEvent } from '../../lib/websocket'
import { AssigneeCorner } from '../ui/AssigneeBadges'
import { PageIcon } from '../ui/PageIcon'

function completion(done: number, total: number) {
  return total > 0 ? Math.round((done / total) * 100) : 0
}

function isTaskOverviewEvent(pagePath: string, scope: TaskOverviewScope, changedPath?: string) {
  if (!changedPath || !changedPath.endsWith('.md')) return false
  if (!pagePath) return true
  const isCurrentPage = changedPath === `${pagePath}.md` || changedPath === `${pagePath}/_Index.md`
  if (scope === 'board') return isCurrentPage
  return isCurrentPage || changedPath.startsWith(`${pagePath}/`)
}

function taskGroupsByBoard(tasks: TaskInfo[]) {
  const groups = new Map<string, TaskInfo[]>()
  for (const task of tasks) {
    const group = groups.get(task.boardPath)
    if (group) group.push(task)
    else groups.set(task.boardPath, [task])
  }
  return groups
}

function uniqueAssignees(tasks: TaskInfo[]) {
  return [...new Set(tasks.flatMap((task) => task.assignees ?? []))].sort((a, b) => a.localeCompare(b))
}

function uniqueLabels(tasks: TaskInfo[]) {
  return [...new Set(tasks.flatMap((task) => task.labels ?? []))].sort((a, b) => a.localeCompare(b))
}

function taskPreviewOrder(tasks: TaskInfo[]) {
  return [...tasks].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.title.localeCompare(b.title))
}

export function TaskPanel({
  collapsed,
  mobileOpen = false,
  onCloseMobile,
  onToggleCollapsed,
  pagePath,
}: {
  collapsed: boolean
  mobileOpen?: boolean
  onCloseMobile?: () => void
  onToggleCollapsed: () => void
  pagePath: string
}) {
  const [boards, setBoards] = useState<BoardSummary[]>([])
  const [tasks, setTasks] = useState<TaskInfo[]>([])
  const [scope, setScope] = useState<TaskOverviewScope>('page')
  const scopeRef = useRef<TaskOverviewScope>('page')
  const [loading, setLoading] = useState(false)
  const [loadedPath, setLoadedPath] = useState('')
  const [error, setError] = useState('')
  const [newBoardTitle, setNewBoardTitle] = useState('')
  const [creatingBoard, setCreatingBoard] = useState(false)
  const role = useAuthStore((state) => state.role)
  const mayWrite = canWrite(role)
  const setTree = useFilesStore((state) => state.setTree)
  const priorityFilter = useTaskFiltersStore((state) => state.priorityFilter)
  const assigneeFilter = useTaskFiltersStore((state) => state.assigneeFilter)
  const labelFilter = useTaskFiltersStore((state) => state.labelFilter)
  const stateFilter = useTaskFiltersStore((state) => state.stateFilter)
  const searchPattern = useTaskFiltersStore((state) => state.searchPattern)
  const setTaskFilterPath = useTaskFiltersStore((state) => state.setTaskFilterPath)
  const setPriorityFilter = useTaskFiltersStore((state) => state.setPriorityFilter)
  const setAssigneeFilter = useTaskFiltersStore((state) => state.setAssigneeFilter)
  const setLabelFilter = useTaskFiltersStore((state) => state.setLabelFilter)
  const setStateFilter = useTaskFiltersStore((state) => state.setStateFilter)
  const setSearchPattern = useTaskFiltersStore((state) => state.setSearchPattern)
  const clearTaskFilters = useTaskFiltersStore((state) => state.clearTaskFilters)
  const navigate = useNavigate()

  useEffect(() => {
    setNewBoardTitle('')
    setTaskFilterPath(pagePath)
  }, [pagePath, setTaskFilterPath])

  useEffect(() => {
    if (!pagePath) {
      setBoards([])
      setTasks([])
      setScope('page')
      scopeRef.current = 'page'
      setError('')
      setLoading(false)
      setLoadedPath('')
      return
    }

    scopeRef.current = 'page'
    let cancelled = false
    const loadBoards = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await api.taskOverview(pagePath)
        if (!cancelled) {
          setBoards(result.boards)
          setTasks(result.tasks)
          setScope(result.scope)
          scopeRef.current = result.scope
        }
      } catch (err) {
        if (!cancelled) {
          setBoards([])
          setTasks([])
          setScope('page')
          scopeRef.current = 'page'
          setError(err instanceof Error ? err.message : 'Failed to load task overview')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setLoadedPath(pagePath)
        }
      }
    }

    void loadBoards()
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<WikiEvent>).detail
      if (detail.type === 'tree:changed' || (detail.type === 'file:changed' && isTaskOverviewEvent(pagePath, scopeRef.current, detail.path))) void loadBoards()
    }
    window.addEventListener('wikindie:event', handler)
    return () => {
      cancelled = true
      window.removeEventListener('wikindie:event', handler)
    }
  }, [pagePath])

  const isBoardScope = scope === 'board'
  const assigneeOptions = useMemo(() => uniqueAssignees(tasks), [tasks])
  const labelOptions = useMemo(() => uniqueLabels(tasks), [tasks])
  const taskFilters = useMemo<TaskFilterValues>(() => ({ priorityFilter, assigneeFilter, labelFilter, stateFilter, searchPattern }), [assigneeFilter, labelFilter, priorityFilter, searchPattern, stateFilter])
  const search = useMemo(() => compileSearchRegex(searchPattern), [searchPattern])
  const searchRegex = search.regex
  const searchError = search.error
  const hasFilterInput = hasFilterValues(taskFilters)
  const filtersApplied = hasAppliedFilters(taskFilters, searchRegex)
  const hasTaskFilters = priorityFilter !== 'all' || assigneeFilter !== 'all' || labelFilter !== 'all' || stateFilter !== 'active'
  const hasSearchFilter = Boolean(searchRegex)
  const allTasksByBoard = useMemo(() => taskGroupsByBoard(tasks), [tasks])
  const filteredTasks = useMemo(
    () => tasks.filter((task) => {
        if (matchesTaskInfoFilters(task, taskFilters, searchRegex)) return true
        if (hasSearchFilter && hasTaskFilters && matchesBoardSearch(searchRegex, task.boardTitle, task.boardPath)) return matchesTaskInfoFilters(task, taskFilters)
        return false
      }),
    [hasSearchFilter, hasTaskFilters, searchRegex, taskFilters, tasks],
  )
  const filteredTasksByBoard = useMemo(() => taskGroupsByBoard(filteredTasks), [filteredTasks])
  const visibleBoards = useMemo(() => {
    if (isBoardScope || !filtersApplied) return boards

    return boards.filter((board) => {
      const boardTasks = allTasksByBoard.get(board.path) ?? []
      if (!hasSearchFilter) return boardTasks.some((task) => matchesTaskInfoFilters(task, taskFilters))

      const boardMatchesSearch = matchesBoardSearch(searchRegex, board.title, board.path)
      if (boardTasks.some((task) => matchesTaskInfoFilters(task, taskFilters, searchRegex))) return true
      if (!boardMatchesSearch) return false
      if (!hasTaskFilters) return true
      return boardTasks.some((task) => matchesTaskInfoFilters(task, taskFilters))
    })
  }, [allTasksByBoard, boards, filtersApplied, hasSearchFilter, hasTaskFilters, isBoardScope, searchRegex, taskFilters])
  const visibleBoardPaths = useMemo(() => new Set(visibleBoards.map((board) => board.path)), [visibleBoards])
  const visibleScopeTasks = useMemo(
    () => (isBoardScope ? filteredTasks : filteredTasks.filter((task) => visibleBoardPaths.has(task.boardPath))),
    [filteredTasks, isBoardScope, visibleBoardPaths],
  )
  const totals = useMemo(() => {
    if (!isBoardScope && !filtersApplied) {
      const totalTasks = visibleBoards.reduce((sum, board) => sum + board.activeCards, 0)
      const doneTasks = visibleBoards.reduce((sum, board) => sum + board.doneCards, 0)
      return { totalTasks, doneTasks, percent: completion(doneTasks, totalTasks) }
    }

    const totalTasks = visibleScopeTasks.length
    const doneTasks = visibleScopeTasks.filter((task) => task.columnStatus === 'done').length
    return { totalTasks, doneTasks, percent: completion(doneTasks, totalTasks) }
  }, [filtersApplied, isBoardScope, visibleBoards, visibleScopeTasks])
  const highOpenCount = useMemo(() => visibleScopeTasks.filter((task) => task.columnStatus !== 'done' && task.priority === 'high').length, [visibleScopeTasks])
  const waitingForCurrentPath = Boolean(pagePath && loadedPath !== pagePath)

  const createBoard = async (event: FormEvent) => {
    event.preventDefault()
    if (!mayWrite || !pagePath || creatingBoard) return
    const title = newBoardTitle.trim()
    if (!title) return

    setCreatingBoard(true)
    setError('')
    try {
      const created = await api.createPage(title, pagePath, 'board')
      setTree((await api.tree()).tree)
      setNewBoardTitle('')
      navigate(pageUrl(created.path))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create board')
    } finally {
      setCreatingBoard(false)
    }
  }

  const collapsedPanel = (
    <aside className="panel hidden w-[72px] shrink-0 flex-col items-center overflow-hidden p-3 transition-[width,padding] duration-200 xl:flex">
      <button
        className="grid size-9 place-items-center rounded-md text-text-muted transition hover:bg-accent/10 hover:text-text"
        onClick={onToggleCollapsed}
        title="Expand task panel"
        aria-label="Expand task panel"
        type="button"
      >
        <PanelRightOpen size={18} />
      </button>

      <div className="mt-4 flex flex-1 flex-col items-center gap-3">
        <div className="grid size-9 place-items-center rounded-md border border-border bg-card text-text-muted" title="Task overview">
          <ListChecks size={17} />
        </div>
        {loading ? (
          <div className="grid size-9 place-items-center rounded-full border border-border bg-input text-text-muted" title="Loading task overview">
            <RefreshCw size={15} className="animate-spin" />
          </div>
        ) : (
          <div className="grid size-11 place-items-center rounded-full border border-accent/40 bg-accent/10 text-xs font-bold text-text" title={`${totals.percent}% complete`}>
            {totals.percent}%
          </div>
        )}
        <div className="rounded-full border border-border bg-input px-2 py-1 text-[10px] font-semibold text-text-muted" title={isBoardScope ? 'Current board scope' : `${visibleBoards.length} visible boards`}>
          {visibleBoards.length}
        </div>
        {hasFilterInput && <span className="size-2 rounded-full bg-accent" title="Filters active" />}
        {highOpenCount > 0 && (
          <div className="grid size-7 place-items-center rounded-full border border-danger/40 bg-danger/10 text-[10px] font-bold text-danger" title={`${highOpenCount} high-priority cards outside Done`}>
            {highOpenCount}
          </div>
        )}
      </div>
    </aside>
  )

  const expandedPanel = (className: string, mobile = false) => (
    <aside className={className}>
      <div className="border-b border-border p-3">
        <div className="mb-2.5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <button
              className="grid size-9 shrink-0 place-items-center rounded-md text-text-muted transition hover:bg-accent/10 hover:text-text"
              onClick={mobile ? onCloseMobile : onToggleCollapsed}
              title={mobile ? 'Close task panel' : 'Collapse task panel'}
              aria-label={mobile ? 'Close task panel' : 'Collapse task panel'}
              type="button"
            >
              {mobile ? <X size={18} /> : <PanelRightClose size={18} />}
            </button>
            <div className="min-w-0">
              <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <ListChecks size={14} /> Task overview
              </p>
              <h2 className="text-lg font-semibold text-text">{isBoardScope ? 'Current board' : 'Board health'}</h2>
            </div>
          </div>
          {loading && <RefreshCw size={16} className="mt-1 animate-spin text-text-muted" />}
        </div>

        <HealthState
          boardCount={visibleBoards.length}
          doneTasks={totals.doneTasks}
          filtered={filtersApplied}
          highOpenCount={highOpenCount}
          percent={totals.percent}
          scope={scope}
          totalTasks={totals.totalTasks}
        />

        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label={isBoardScope ? 'Board' : 'Boards'} value={visibleBoards.length} />
          <Stat label="Active" value={totals.totalTasks} />
          <Stat label="In Done" value={totals.doneTasks} />
        </div>
      </div>

      {error && <div className="mx-3 mt-3 rounded-md border border-danger/40 bg-danger/10 p-2.5 text-sm text-danger">{error}</div>}

      <div className="workspace-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {!pagePath ? (
          <PanelMessage title="Open a page" body="Task summaries appear when a workspace page is open." />
        ) : waitingForCurrentPath ? (
          <PanelSkeleton />
        ) : boards.length === 0 ? (
          <EmptyBoardsState
            creating={creatingBoard}
            mayWrite={mayWrite}
            newBoardTitle={newBoardTitle}
            onCreateBoard={createBoard}
            onTitleChange={setNewBoardTitle}
          />
        ) : (
          <div className={isBoardScope ? 'flex min-h-full flex-col justify-between gap-3' : 'space-y-3'}>
            <FilteringPanel
              assigneeFilter={assigneeFilter}
              assignees={assigneeOptions}
              hasFilterInput={hasFilterInput}
              labelFilter={labelFilter}
              labels={labelOptions}
              onAssigneeChange={setAssigneeFilter}
              onClear={clearTaskFilters}
              onLabelChange={setLabelFilter}
              onPriorityChange={setPriorityFilter}
              onSearchChange={setSearchPattern}
              onStateChange={setStateFilter}
              priorityFilter={priorityFilter}
              searchError={searchError}
              searchPattern={searchPattern}
              stateFilter={stateFilter}
              scope={scope}
            />
            {isBoardScope && boards[0] && (
              <BoardColumnDistribution
                board={boards[0]}
                filtered={filtersApplied}
                filteredTasks={filteredTasksByBoard.get(boards[0].path) ?? []}
                tasks={allTasksByBoard.get(boards[0].path) ?? []}
              />
            )}
            {!isBoardScope && (
              <section>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-text">Nested boards</h3>
                  <span className="text-xs text-text-muted">{visibleBoards.length}/{boards.length}</span>
                </div>
                {visibleBoards.length > 0 ? (
                  <div className="space-y-3">
                    {visibleBoards.map((board) => (
                      <BoardOverview
                        key={board.path}
                        board={board}
                        filteredTasks={filteredTasksByBoard.get(board.path) ?? []}
                        showFilteredTasks={filtersApplied}
                        tasks={allTasksByBoard.get(board.path) ?? []}
                      />
                    ))}
                  </div>
                ) : (
                  <PanelMessage title="No matching boards" body="No nested board matches the current filters." />
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </aside>

  )

  return (
    <>
      {mobileOpen && (
        <>
          <button className="fixed inset-0 z-30 bg-overlay xl:hidden" onClick={onCloseMobile ?? (() => {})} aria-label="Close task panel" type="button" />
          {expandedPanel('panel fixed right-0 top-0 z-40 flex h-dvh w-[min(340px,calc(100vw-1.5rem))] flex-col overflow-hidden xl:hidden', true)}
        </>
      )}
      {collapsed ? collapsedPanel : expandedPanel('panel hidden w-[320px] shrink-0 flex-col overflow-hidden transition-[width,padding] duration-200 xl:flex')}
    </>
  )
}

function HealthState({
  boardCount,
  doneTasks,
  filtered,
  highOpenCount,
  percent,
  scope,
  totalTasks,
}: {
  boardCount: number
  doneTasks: number
  filtered: boolean
  highOpenCount: number
  percent: number
  scope: TaskOverviewScope
  totalTasks: number
}) {
  const clamped = Math.max(0, Math.min(100, percent))
  const openTasks = Math.max(0, totalTasks - doneTasks)
  const scopeLabel = filtered ? (scope === 'board' ? 'Filtered cards' : 'Filtered boards') : scope === 'board' ? 'Current board' : 'All nested boards'
  const boardCountLabel = scope === 'board' && boardCount === 1 ? '1 board' : `${boardCount.toLocaleString()} boards`

  return (
    <section className="mb-2.5 rounded-md border border-border bg-card p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">State</p>
          <p className="text-xl font-bold text-text">{clamped}%</p>
        </div>
        <div className="text-right text-xs text-text-muted">
          <p>{scopeLabel}</p>
          <p>{boardCountLabel}</p>
        </div>
      </div>
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-input">
        <div
          className="h-full rounded-full bg-accent-warm transition-[width] duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-text-muted">
        <span>{doneTasks.toLocaleString()}/{totalTasks.toLocaleString()} in Done</span>
        {highOpenCount > 0 ? (
          <span className="flex items-center gap-1 text-danger"><AlertTriangle size={13} /> {highOpenCount.toLocaleString()} high open</span>
        ) : (
          <span>{openTasks.toLocaleString()} outside Done</span>
        )}
      </div>
    </section>
  )
}

function FilteringPanel({
  assigneeFilter,
  assignees,
  hasFilterInput,
  labelFilter,
  labels,
  onAssigneeChange,
  onClear,
  onLabelChange,
  onPriorityChange,
  onSearchChange,
  onStateChange,
  priorityFilter,
  searchError,
  searchPattern,
  stateFilter,
  scope,
}: {
  assigneeFilter: string
  assignees: string[]
  hasFilterInput: boolean
  labelFilter: string
  labels: string[]
  onAssigneeChange: (value: string) => void
  onClear: () => void
  onLabelChange: (value: string) => void
  onPriorityChange: (value: TaskFilterValues['priorityFilter']) => void
  onSearchChange: (value: string) => void
  onStateChange: (value: TaskFilterValues['stateFilter']) => void
  priorityFilter: TaskFilterValues['priorityFilter']
  searchError: string
  searchPattern: string
  stateFilter: TaskFilterValues['stateFilter']
  scope: TaskOverviewScope
}) {
  return (
    <section className="rounded-md border border-border bg-card p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
          <Filter size={15} className="text-accent" /> Filtering
        </h3>
        {hasFilterInput && (
          <button className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted hover:bg-accent/10 hover:text-text" onClick={onClear} type="button">
            <X size={13} /> Clear
          </button>
        )}
      </div>
      <div className="grid gap-1.5">
        <label className="grid gap-1 text-xs text-text-muted">
          State
          <select
            className="w-full rounded-md border border-border bg-input px-2 py-1.5 text-sm text-text outline-none transition focus:border-accent"
            value={stateFilter}
            onChange={(event) => onStateChange(event.target.value as TaskFilterValues['stateFilter'])}
          >
            <option value="active">Active cards</option>
            <option value="archived">Archived cards</option>
            <option value="all">All cards</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-text-muted">
          Priority
          <select
            className="w-full rounded-md border border-border bg-input px-2 py-1.5 text-sm text-text outline-none transition focus:border-accent"
            value={priorityFilter}
            onChange={(event) => onPriorityChange(event.target.value as TaskFilterValues['priorityFilter'])}
          >
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="none">No priority</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-text-muted">
          Assignee
          <select
            className="w-full rounded-md border border-border bg-input px-2 py-1.5 text-sm text-text outline-none transition focus:border-accent"
            value={assigneeFilter}
            onChange={(event) => onAssigneeChange(event.target.value)}
          >
            <option value="all">All assignees</option>
            {assignees.map((assignee) => (
              <option key={assignee} value={assignee}>@{assignee}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-text-muted">
          Label / sprint
          <select
            className="w-full rounded-md border border-border bg-input px-2 py-1.5 text-sm text-text outline-none transition focus:border-accent"
            value={labelFilter}
            onChange={(event) => onLabelChange(event.target.value)}
          >
            <option value="all">All labels</option>
            <option value="none">No label</option>
            {labels.map((label) => (
              <option key={label} value={label}>#{label}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-text-muted">
          Search regex
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              className={`w-full rounded-md border bg-input py-1.5 pl-8 pr-2 text-sm text-text outline-none transition focus:border-accent ${searchError ? 'border-danger' : 'border-border'}`}
              value={searchPattern}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={scope === 'board' ? 'Card, column, assignee, label' : 'Board or card regex'}
            />
          </div>
          {searchError && <span className="text-danger">Regex ignored: {searchError}</span>}
        </label>
      </div>
      {!assignees.length && (
        <p className="mt-1.5 text-xs text-text-muted">No assigned cards found {scope === 'board' ? 'in this board.' : 'in nested boards.'}</p>
      )}
      {!labels.length && (
        <p className="mt-1.5 text-xs text-text-muted">No labels found {scope === 'board' ? 'in this board.' : 'in nested boards.'}</p>
      )}
    </section>
  )
}

function columnKey(id: string) {
  return id
}

function taskGroupsByColumn(tasks: TaskInfo[]) {
  const groups = new Map<string, TaskInfo[]>()
  for (const task of tasks) {
    const key = columnKey(task.columnId)
    const group = groups.get(key)
    if (group) group.push(task)
    else groups.set(key, [task])
  }
  return groups
}

function BoardColumnDistribution({
  board,
  filtered,
  filteredTasks,
  tasks,
}: {
  board: BoardSummary
  filtered: boolean
  filteredTasks: TaskInfo[]
  tasks: TaskInfo[]
}) {
  const activeTasks = tasks.filter((task) => !task.archived)
  const tasksByColumn = taskGroupsByColumn(activeTasks)
  const filteredTasksByColumn = taskGroupsByColumn(filteredTasks)
  const denominator = Math.max(1, filtered ? filteredTasks.length : board.activeCards)
  const totalLabel = filtered ? `${filteredTasks.length.toLocaleString()}/${board.totalCards.toLocaleString()} shown` : `${board.activeCards.toLocaleString()} active`

  return (
    <section className="rounded-md border border-border bg-card p-2">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-text">Column distribution</h3>
          <p className="mt-0.5 text-[11px] text-text-muted">Workload and progress across this board.</p>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-input px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          {totalLabel}
        </span>
      </div>

      <div className="space-y-2">
        {board.columns.map((column, index) => {
          const columnTasks = tasksByColumn.get(columnKey(column.id)) ?? []
          const visibleTasks = filtered ? filteredTasksByColumn.get(columnKey(column.id)) ?? [] : columnTasks
          const shown = filtered ? visibleTasks.length : column.active
          const done = filtered ? (isDoneColumn(column) ? visibleTasks.length : 0) : column.done
          const open = Math.max(0, shown - done)
          const highOpen = visibleTasks.filter((task) => task.columnStatus !== 'done' && task.priority === 'high').length
          const width = `${Math.round((shown / denominator) * 100)}%`

          return (
            <div key={`${column.title}-${index}`}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <div className="flex min-w-0 items-center gap-1.5 font-medium text-text">
                  <PageIcon icon={column.icon} fallback="column" className="size-3.5 shrink-0" />
                  <span className="min-w-0 truncate">{column.title}</span>
                </div>
                <span className="shrink-0 text-text-muted">
                  {filtered ? `${shown}/${column.total} shown` : `${shown} cards`}
                </span>
              </div>
              <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-input">
                <div className="h-full rounded-full bg-accent-warm transition-[width] duration-300" style={{ width }} />
              </div>
              <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                <span>{done}/{shown} in Done</span>
                {highOpen > 0 ? (
                  <span className="text-danger">{highOpen} high</span>
                ) : (
                  <span>{open} open</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function BoardOverview({
  board,
  filteredTasks,
  showFilteredTasks,
  tasks,
}: {
  board: BoardSummary
  filteredTasks: TaskInfo[]
  showFilteredTasks: boolean
  tasks: TaskInfo[]
}) {
  const totalCards = board.activeCards
  const doneCards = board.doneCards
  const percent = completion(doneCards, totalCards)
  const openCount = Math.max(0, totalCards - doneCards)
  const activeTasks = tasks.filter((task) => !task.archived)
  const highOpen = activeTasks.filter((task) => task.columnStatus !== 'done' && task.priority === 'high').length
  const mediumOpen = activeTasks.filter((task) => task.columnStatus !== 'done' && task.priority === 'medium').length
  const matchingTasks = taskPreviewOrder(filteredTasks)
  const previewTasks = matchingTasks.slice(0, 5)
  const status = totalCards === 0 ? 'No cards' : doneCards === totalCards ? 'Complete' : highOpen > 0 ? `${highOpen} high` : 'Active'
  const statusClass = totalCards === 0 ? 'text-text-muted' : doneCards === totalCards ? 'text-success' : highOpen > 0 ? 'text-danger' : 'text-accent'

  return (
    <article className="rounded-md border border-border bg-surface p-2.5 shadow-sm shadow-shadow">
      <div className="mb-2.5 flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <PageIcon icon={board.icon} fallback="board" className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-text">{board.title}</h4>
            <p className="truncate text-xs text-text-muted">{board.path}</p>
          </div>
        </div>
        <Link to={pageUrl(board.path)} className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-input text-text-muted transition hover:border-accent hover:text-text" title="Open board">
          <ArrowUpRight size={15} />
        </Link>
      </div>

      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        <span className={`font-semibold ${statusClass}`}>{status}</span>
        <span className="text-text-muted">
          {doneCards}/{totalCards} in Done
        </span>
      </div>
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-input">
        <div className="h-full rounded-full bg-accent-warm" style={{ width: `${percent}%` }} />
      </div>

      <div className="mb-2.5 flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
        <span className="rounded-full border border-border bg-input px-2 py-1 text-text-muted">{openCount} outside Done</span>
        <span className="rounded-full border border-border bg-input px-2 py-1 text-text-muted">{board.columns.length} columns</span>
        {highOpen > 0 && <span className="rounded-full border border-danger/30 bg-danger/10 px-2 py-1 text-danger">{highOpen} high</span>}
        {mediumOpen > 0 && <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-1 text-warning">{mediumOpen} medium</span>}
      </div>

      {showFilteredTasks && (
        <div className="space-y-1 border-t border-border pt-2.5">
          {previewTasks.length > 0 ? (
            <>
              {previewTasks.map((task, index) => (
                <TaskPreview key={task.id ?? `${task.title}-${task.columnTitle}-${index}`} task={task} />
              ))}
              {matchingTasks.length > previewTasks.length && (
                <Link to={pageUrl(board.path)} className="block rounded-md px-2 py-1 text-xs text-text-muted hover:bg-accent/10 hover:text-text">
                  +{matchingTasks.length - previewTasks.length} more matching cards
                </Link>
              )}
            </>
          ) : (
            <p className="px-2 py-1 text-xs text-text-muted">Board matched the search, but no cards matched the task filters.</p>
          )}
        </div>
      )}
    </article>
  )
}

function TaskPreview({ task }: { task: TaskInfo }) {
  const assignees = task.assignees ?? []

  return (
    <Link to={pageUrl(task.boardPath)} className={`relative block rounded-md px-2 pt-1 transition hover:bg-accent/10 ${assignees.length ? 'pb-7' : 'pb-1'}`}>
      <div className="flex min-w-0 items-start gap-2">
        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${priorityColor(task.priority)}`} title={priorityLabel(task.priority)} />
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm text-text">{task.id ? `[${task.id}] ` : ''}{task.title}</p>
          <p className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-xs text-text-muted">
            <PageIcon icon={task.columnIcon} fallback="column" className="size-3 shrink-0" />
            <span className="min-w-0 truncate">{task.columnTitle}</span>
          </p>
        </div>
      </div>
      <AssigneeCorner assignees={assignees} />
    </Link>
  )
}

function EmptyBoardsState({
  creating,
  mayWrite,
  newBoardTitle,
  onCreateBoard,
  onTitleChange,
}: {
  creating: boolean
  mayWrite: boolean
  newBoardTitle: string
  onCreateBoard: (event: FormEvent) => void
  onTitleChange: (value: string) => void
}) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface/60 p-3">
      <div className="mb-2.5 flex items-start gap-2.5">
        <PageIcon icon="board" fallback="board" className="size-8 shrink-0" />
        <div>
          <h3 className="text-base font-semibold text-text">No nested boards yet</h3>
          <p className="mt-1 text-sm text-text-muted">Create a board below this page and it will appear here as a progress summary.</p>
        </div>
      </div>

      {mayWrite ? (
        <form className="mt-3 space-y-1.5" onSubmit={onCreateBoard}>
          <input
            className="w-full rounded-md border border-border bg-input px-3 py-1.5 text-sm text-text outline-none transition focus:border-accent"
            value={newBoardTitle}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Board title"
          />
          <button
            className="flex w-full items-center justify-center gap-2 rounded-md border border-control-border bg-control px-3 py-1.5 text-sm font-medium text-text transition hover:border-accent hover:bg-control-hover disabled:cursor-not-allowed disabled:opacity-50"
            disabled={creating || !newBoardTitle.trim()}
            type="submit"
          >
            {creating ? <RefreshCw size={15} className="animate-spin" /> : <Plus size={15} />}
            Create board
          </button>
        </form>
      ) : (
        <p className="mt-3 rounded-md border border-border bg-card p-2.5 text-sm text-text-muted">You have read-only access, so board creation is unavailable.</p>
      )}
    </div>
  )
}

function PanelSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="animate-pulse rounded-md border border-border bg-surface p-2.5">
          <div className="mb-2 h-4 w-2/3 rounded bg-border" />
          <div className="mb-2 h-2 rounded-full bg-border" />
          <div className="h-3 w-1/2 rounded bg-border" />
        </div>
      ))}
    </div>
  )
}

function PanelMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface/60 p-3">
      <h3 className="text-base font-semibold text-text">{title}</h3>
      <p className="mt-1 text-sm text-text-muted">{body}</p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-card px-2 py-1">
      <div className="text-sm font-semibold text-text">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-text-muted">{label}</div>
    </div>
  )
}
