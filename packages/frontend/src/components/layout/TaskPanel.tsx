import { AlertTriangle, ArrowUpRight, Filter, ListChecks, PanelRightClose, PanelRightOpen, Plus, RefreshCw, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type BoardSummary, type CardPriority, type TaskInfo } from '../../lib/api'
import { pageUrl } from '../../lib/paths'
import { priorityColor, priorityLabel, priorityRank } from '../../lib/priority'
import { canWrite, useAuthStore, useFilesStore } from '../../lib/store'
import type { WikiEvent } from '../../lib/websocket'
import { AssigneeCorner, UserIconBadge } from '../ui/AssigneeBadges'
import { PageIcon } from '../ui/PageIcon'

function completion(done: number, total: number) {
  return total > 0 ? Math.round((done / total) * 100) : 0
}

function isChildBoardEvent(pagePath: string, changedPath?: string) {
  if (!changedPath || !changedPath.endsWith('.md')) return false
  if (!pagePath) return true
  return changedPath.startsWith(`${pagePath}/`)
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

function openTasksFirst(tasks: TaskInfo[]) {
  return [...tasks]
    .filter((task) => !task.done)
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.title.localeCompare(b.title))
}

function uniqueAssignees(tasks: TaskInfo[]) {
  return [...new Set(tasks.flatMap((task) => task.assignees ?? []))].sort((a, b) => a.localeCompare(b))
}

type PriorityFilter = 'all' | CardPriority | 'none'

function matchesPriority(task: TaskInfo, filter: PriorityFilter) {
  if (filter === 'all') return true
  if (filter === 'none') return !task.priority
  return task.priority === filter
}

export function TaskPanel({
  collapsed,
  onToggleCollapsed,
  pagePath,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
  pagePath: string
}) {
  const [boards, setBoards] = useState<BoardSummary[]>([])
  const [tasks, setTasks] = useState<TaskInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [loadedPath, setLoadedPath] = useState('')
  const [error, setError] = useState('')
  const [newBoardTitle, setNewBoardTitle] = useState('')
  const [creatingBoard, setCreatingBoard] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const role = useAuthStore((state) => state.role)
  const mayWrite = canWrite(role)
  const setTree = useFilesStore((state) => state.setTree)
  const navigate = useNavigate()

  useEffect(() => {
    setNewBoardTitle('')
    setPriorityFilter('all')
    setAssigneeFilter('all')
  }, [pagePath])

  useEffect(() => {
    if (!pagePath) {
      setBoards([])
      setTasks([])
      setError('')
      setLoading(false)
      setLoadedPath('')
      return
    }

    let cancelled = false
    const loadBoards = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await api.childBoards(pagePath)
        if (!cancelled) {
          setBoards(result.boards)
          setTasks(result.tasks)
        }
      } catch (err) {
        if (!cancelled) {
          setBoards([])
          setTasks([])
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
      if (detail.type === 'tree:changed' || (detail.type === 'file:changed' && isChildBoardEvent(pagePath, detail.path))) void loadBoards()
    }
    window.addEventListener('wikindie:event', handler)
    return () => {
      cancelled = true
      window.removeEventListener('wikindie:event', handler)
    }
  }, [pagePath])

  const assigneeOptions = useMemo(() => uniqueAssignees(tasks), [tasks])
  const hasActiveFilters = priorityFilter !== 'all' || assigneeFilter !== 'all'
  const filteredTasks = useMemo(
    () => tasks.filter((task) => matchesPriority(task, priorityFilter) && (assigneeFilter === 'all' || task.assignees.includes(assigneeFilter))),
    [assigneeFilter, priorityFilter, tasks],
  )
  const visibleBoardPaths = useMemo(() => new Set(filteredTasks.map((task) => task.boardPath)), [filteredTasks])
  const visibleBoards = useMemo(
    () => (hasActiveFilters ? boards.filter((board) => visibleBoardPaths.has(board.path)) : boards),
    [boards, hasActiveFilters, visibleBoardPaths],
  )
  const scopedTasks = hasActiveFilters ? filteredTasks : tasks
  const totals = useMemo(() => {
    const totalTasks = scopedTasks.length
    const doneTasks = scopedTasks.filter((task) => task.done).length
    return { totalTasks, doneTasks, percent: completion(doneTasks, totalTasks) }
  }, [scopedTasks])
  const tasksByBoard = useMemo(() => taskGroupsByBoard(scopedTasks), [scopedTasks])
  const highOpenCount = useMemo(() => scopedTasks.filter((task) => !task.done && task.priority === 'high').length, [scopedTasks])
  const waitingForCurrentPath = Boolean(pagePath && loadedPath !== pagePath)
  const clearFilters = () => {
    setPriorityFilter('all')
    setAssigneeFilter('all')
  }

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

  if (collapsed) {
    return (
      <aside className="panel hidden w-[72px] shrink-0 flex-col items-center overflow-hidden p-3 transition-[width,padding] duration-200 xl:flex">
        <button
          className="grid size-9 place-items-center rounded-lg text-text-muted transition hover:bg-accent/10 hover:text-text"
          onClick={onToggleCollapsed}
          title="Expand task panel"
          aria-label="Expand task panel"
          type="button"
        >
          <PanelRightOpen size={18} />
        </button>

        <div className="mt-4 flex flex-1 flex-col items-center gap-3">
          <div className="grid size-9 place-items-center rounded-lg border border-border bg-card text-text-muted" title="Task overview">
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
          <div className="rounded-full border border-border bg-input px-2 py-1 text-[10px] font-semibold text-text-muted" title={`${visibleBoards.length} visible boards`}>
            {visibleBoards.length}
          </div>
          {hasActiveFilters && <span className="size-2 rounded-full bg-accent" title="Filters active" />}
          {highOpenCount > 0 && (
            <div className="grid size-7 place-items-center rounded-full border border-danger/40 bg-danger/10 text-[10px] font-bold text-danger" title={`${highOpenCount} high-priority open cards`}>
              {highOpenCount}
            </div>
          )}
        </div>
      </aside>
    )
  }

  return (
    <aside className="panel hidden w-[320px] shrink-0 flex-col overflow-hidden transition-[width,padding] duration-200 xl:flex">
      <div className="border-b border-border p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-2">
            <button
              className="grid size-8 shrink-0 place-items-center rounded-lg text-text-muted transition hover:bg-accent/10 hover:text-text"
              onClick={onToggleCollapsed}
              title="Collapse task panel"
              aria-label="Collapse task panel"
              type="button"
            >
              <PanelRightClose size={18} />
            </button>
            <div className="min-w-0">
              <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <ListChecks size={14} /> Task overview
              </p>
              <h2 className="text-xl font-semibold text-text">Board health</h2>
            </div>
          </div>
          {loading && <RefreshCw size={16} className="mt-1 animate-spin text-text-muted" />}
        </div>

        <HealthState
          boardCount={visibleBoards.length}
          doneTasks={totals.doneTasks}
          filtered={hasActiveFilters}
          highOpenCount={highOpenCount}
          percent={totals.percent}
          totalTasks={totals.totalTasks}
        />

        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Boards" value={visibleBoards.length} />
          <Stat label="Tasks" value={totals.totalTasks} />
          <Stat label="Done" value={totals.doneTasks} />
        </div>
      </div>

      {error && <div className="mx-4 mt-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</div>}

      <div className="workspace-scroll min-h-0 flex-1 overflow-y-auto p-4">
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
          <div className="space-y-4">
            <FilteringPanel
              assigneeFilter={assigneeFilter}
              assignees={assigneeOptions}
              hasActiveFilters={hasActiveFilters}
              onAssigneeChange={setAssigneeFilter}
              onClear={clearFilters}
              onPriorityChange={setPriorityFilter}
              priorityFilter={priorityFilter}
            />
            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-text">Boards</h3>
                <span className="text-xs text-text-muted">{visibleBoards.length}/{boards.length}</span>
              </div>
              {visibleBoards.length > 0 ? (
                <div className="space-y-3">
                  {visibleBoards.map((board) => (
                    <BoardOverview key={board.path} board={board} filtered={hasActiveFilters} tasks={tasksByBoard.get(board.path) ?? []} />
                  ))}
                </div>
              ) : (
                <PanelMessage title="No matching boards" body="No nested board has tasks matching the current filters." />
              )}
            </section>
          </div>
        )}
      </div>
    </aside>
  )
}

function HealthState({
  boardCount,
  doneTasks,
  filtered,
  highOpenCount,
  percent,
  totalTasks,
}: {
  boardCount: number
  doneTasks: number
  filtered: boolean
  highOpenCount: number
  percent: number
  totalTasks: number
}) {
  const clamped = Math.max(0, Math.min(100, percent))
  const openTasks = Math.max(0, totalTasks - doneTasks)

  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">State</p>
          <p className="text-2xl font-bold text-text">{clamped}%</p>
        </div>
        <div className="text-right text-xs text-text-muted">
          <p>{filtered ? 'Filtered scope' : 'All nested boards'}</p>
          <p>{boardCount.toLocaleString()} boards</p>
        </div>
      </div>
      <div className="relative mb-3 h-3 overflow-hidden rounded-full bg-input ring-1 ring-border">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-info), var(--color-success))', width: `${clamped}%` }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 18px, rgba(255,255,255,0.35) 18px 19px)' }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-text-muted">
        <span>{doneTasks.toLocaleString()}/{totalTasks.toLocaleString()} done</span>
        {highOpenCount > 0 ? (
          <span className="flex items-center gap-1 text-danger"><AlertTriangle size={13} /> {highOpenCount.toLocaleString()} high open</span>
        ) : (
          <span>{openTasks.toLocaleString()} open</span>
        )}
      </div>
    </section>
  )
}

function FilteringPanel({
  assigneeFilter,
  assignees,
  hasActiveFilters,
  onAssigneeChange,
  onClear,
  onPriorityChange,
  priorityFilter,
}: {
  assigneeFilter: string
  assignees: string[]
  hasActiveFilters: boolean
  onAssigneeChange: (value: string) => void
  onClear: () => void
  onPriorityChange: (value: PriorityFilter) => void
  priorityFilter: PriorityFilter
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
          <Filter size={15} className="text-accent" /> Filtering
        </h3>
        {hasActiveFilters && (
          <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-text-muted hover:bg-accent/10 hover:text-text" onClick={onClear} type="button">
            <X size={13} /> Clear
          </button>
        )}
      </div>
      <div className="grid gap-2">
        <label className="grid gap-1 text-xs text-text-muted">
          Priority
          <select
            className="w-full rounded-lg border border-border bg-input px-2 py-2 text-sm text-text outline-none transition focus:border-accent"
            value={priorityFilter}
            onChange={(event) => onPriorityChange(event.target.value as PriorityFilter)}
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
            className="w-full rounded-lg border border-border bg-input px-2 py-2 text-sm text-text outline-none transition focus:border-accent"
            value={assigneeFilter}
            onChange={(event) => onAssigneeChange(event.target.value)}
          >
            <option value="all">All assignees</option>
            {assignees.map((assignee) => (
              <option key={assignee} value={assignee}>@{assignee}</option>
            ))}
          </select>
        </label>
      </div>
      {!assignees.length && (
        <p className="mt-2 text-xs text-text-muted">No assigned cards found in nested boards.</p>
      )}
    </section>
  )
}

function BoardOverview({ board, filtered, tasks }: { board: BoardSummary; filtered: boolean; tasks: TaskInfo[] }) {
  const totalCards = filtered ? tasks.length : board.totalCards
  const doneCards = filtered ? tasks.filter((task) => task.done).length : board.doneCards
  const percent = completion(doneCards, totalCards)
  const openTasks = openTasksFirst(tasks)
  const previewTasks = openTasks.slice(0, 4)
  const assignees = uniqueAssignees(tasks).slice(0, 5)
  const highOpen = openTasks.filter((task) => task.priority === 'high').length
  const mediumOpen = openTasks.filter((task) => task.priority === 'medium').length
  const status = totalCards === 0 ? 'No cards' : doneCards === totalCards ? 'Complete' : highOpen > 0 ? `${highOpen} high` : 'Active'
  const statusClass = totalCards === 0 ? 'text-text-muted' : doneCards === totalCards ? 'text-success' : highOpen > 0 ? 'text-danger' : 'text-accent'

  return (
    <article className="rounded-xl border border-border bg-surface p-3 shadow-sm shadow-shadow">
      <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <PageIcon icon={board.icon} fallback="board" className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-text">{board.title}</h4>
            <p className="truncate text-xs text-text-muted">{board.path}</p>
          </div>
        </div>
        <Link to={pageUrl(board.path)} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-input text-text-muted transition hover:border-accent hover:text-text" title="Open board">
          <ArrowUpRight size={15} />
        </Link>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3 text-xs">
        <span className={`font-semibold ${statusClass}`}>{status}</span>
        <span className="text-text-muted">
          {doneCards}/{totalCards} done
        </span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-input">
        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
        <span className="rounded-full border border-border bg-input px-2 py-1 text-text-muted">{openTasks.length} open</span>
        {highOpen > 0 && <span className="rounded-full border border-danger/30 bg-danger/10 px-2 py-1 text-danger">{highOpen} high</span>}
        {mediumOpen > 0 && <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-1 text-warning">{mediumOpen} medium</span>}
      </div>

      {assignees.length > 0 && (
        <div className="mb-3 flex items-center gap-1.5">
          {assignees.map((assignee) => (
            <UserIconBadge key={assignee} username={assignee} className="size-5" />
          ))}
        </div>
      )}

      {previewTasks.length > 0 ? (
        <div className="space-y-1.5 border-t border-border pt-3">
          {previewTasks.map((task, index) => (
            <TaskPreview key={`${task.title}-${index}`} task={task} />
          ))}
          {openTasks.length > previewTasks.length && (
            <Link to={pageUrl(board.path)} className="block rounded-lg px-2 py-1.5 text-xs text-text-muted hover:bg-accent/10 hover:text-text">
              +{openTasks.length - previewTasks.length} more open cards
            </Link>
          )}
        </div>
      ) : (
        <p className="border-t border-border pt-3 text-sm text-text-muted">No open cards here.</p>
      )}
    </article>
  )
}

function TaskPreview({ task, compact = false }: { task: TaskInfo; compact?: boolean }) {
  const context = compact ? `${task.boardTitle} / ${task.columnTitle}` : task.columnTitle
  const assignees = task.assignees ?? []

  return (
    <Link to={pageUrl(task.boardPath)} className={`relative block rounded-lg transition hover:bg-accent/10 ${compact ? 'px-2 py-2' : 'px-2 py-1.5'} ${assignees.length ? 'pb-8' : ''}`}>
      <div className="flex min-w-0 items-start gap-2">
        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${priorityColor(task.priority)}`} title={priorityLabel(task.priority)} />
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm text-text">{task.title}</p>
          <p className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-xs text-text-muted">
            <PageIcon icon={task.columnIcon} fallback="column" className="size-3 shrink-0" />
            <span className="min-w-0 truncate">{context}</span>
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
    <div className="rounded-xl border border-dashed border-border bg-surface/60 p-4">
      <div className="mb-3 flex items-start gap-3">
        <PageIcon icon="board" fallback="board" className="size-8 shrink-0" />
        <div>
          <h3 className="text-base font-semibold text-text">No nested boards yet</h3>
          <p className="mt-1 text-sm text-text-muted">Create a board below this page and it will appear here with progress, priority, and assignee signals.</p>
        </div>
      </div>

      {mayWrite ? (
        <form className="mt-4 space-y-2" onSubmit={onCreateBoard}>
          <input
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-text outline-none transition focus:border-accent"
            value={newBoardTitle}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Board title"
          />
          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-control-border bg-control px-3 py-2 text-sm font-medium text-text transition hover:border-accent hover:bg-control-hover disabled:cursor-not-allowed disabled:opacity-50"
            disabled={creating || !newBoardTitle.trim()}
            type="submit"
          >
            {creating ? <RefreshCw size={15} className="animate-spin" /> : <Plus size={15} />}
            Create board
          </button>
        </form>
      ) : (
        <p className="mt-4 rounded-lg border border-border bg-card p-3 text-sm text-text-muted">You have read-only access, so board creation is unavailable.</p>
      )}
    </div>
  )
}

function PanelSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="animate-pulse rounded-xl border border-border bg-surface p-3">
          <div className="mb-3 h-4 w-2/3 rounded bg-border" />
          <div className="mb-3 h-2 rounded-full bg-border" />
          <div className="h-3 w-1/2 rounded bg-border" />
        </div>
      ))}
    </div>
  )
}

function PanelMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface/60 p-4">
      <h3 className="text-base font-semibold text-text">{title}</h3>
      <p className="mt-1 text-sm text-text-muted">{body}</p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-2 py-2">
      <div className="text-base font-semibold text-text">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-text-muted">{label}</div>
    </div>
  )
}
