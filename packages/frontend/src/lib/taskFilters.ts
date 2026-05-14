import type { CardPriority, KanbanCard, KanbanColumn, TaskInfo } from './api'

export type TaskPriorityFilter = 'all' | CardPriority | 'none'

export interface TaskFilterValues {
  priorityFilter: TaskPriorityFilter
  assigneeFilter: string
  searchPattern: string
}

export const defaultTaskFilters: TaskFilterValues = {
  priorityFilter: 'all',
  assigneeFilter: 'all',
  searchPattern: '',
}

const MAX_SEARCH_PATTERN_LENGTH = 200

export function compileSearchRegex(pattern: string) {
  const clean = pattern.trim()
  if (!clean) return { regex: undefined, error: '' }
  if (clean.length > MAX_SEARCH_PATTERN_LENGTH) return { regex: undefined, error: `Pattern too long (max ${MAX_SEARCH_PATTERN_LENGTH} chars)` }

  try {
    return { regex: new RegExp(clean, 'i'), error: '' }
  } catch (error) {
    return { regex: undefined, error: error instanceof Error ? error.message : 'Invalid regex' }
  }
}

export function hasFilterValues(filters: TaskFilterValues) {
  return filters.priorityFilter !== 'all' || filters.assigneeFilter !== 'all' || filters.searchPattern.trim() !== ''
}

export function hasAppliedFilters(filters: TaskFilterValues, regex?: RegExp) {
  return filters.priorityFilter !== 'all' || filters.assigneeFilter !== 'all' || Boolean(regex)
}

function matchesPriority(priority: CardPriority | undefined, filter: TaskPriorityFilter) {
  if (filter === 'all') return true
  if (filter === 'none') return !priority
  return priority === filter
}

function matchesAssignee(assignees: string[] | undefined, filter: string) {
  return filter === 'all' || Boolean(assignees?.includes(filter))
}

function matchesRegex(regex: RegExp | undefined, values: Array<string | undefined>) {
  if (!regex) return true
  return regex.test(values.filter(Boolean).join('\n'))
}

export function matchesTaskInfoFilters(task: TaskInfo, filters: TaskFilterValues, regex?: RegExp) {
  return (
    matchesPriority(task.priority, filters.priorityFilter) &&
    matchesAssignee(task.assignees, filters.assigneeFilter) &&
    matchesRegex(regex, [task.id, task.title, task.description, task.columnId, task.columnTitle, task.columnStatus, task.columnIcon, task.priority, ...task.assignees])
  )
}

export function matchesKanbanCardFilters(card: KanbanCard, column: Pick<KanbanColumn, 'id' | 'title' | 'status'>, filters: TaskFilterValues, regex?: RegExp) {
  return (
    matchesPriority(card.priority, filters.priorityFilter) &&
    matchesAssignee(card.assignees, filters.assigneeFilter) &&
    matchesRegex(regex, [card.id, card.title, card.description, column.id, column.title, column.status, card.priority, ...(card.assignees ?? [])])
  )
}

export function matchesBoardSearch(regex: RegExp | undefined, title: string, path: string) {
  return matchesRegex(regex, [title, path])
}
