import type { KanbanBoard, KanbanColumn, KanbanColumnStatus } from './api'
import { priorityRank } from './priority'

let activeDragSourceColumn: number | null = null

export const kanbanColumnStatusOptions: Array<{ value: KanbanColumnStatus; label: string }> = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'next', label: 'Next Up' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'custom', label: 'Custom' },
]

export function inferColumnStatus(title: string): KanbanColumnStatus {
  const clean = title.trim().toLowerCase()
  if (clean === 'backlog') return 'backlog'
  if (clean === 'next up') return 'next'
  if (clean === 'in progress') return 'in_progress'
  if (clean === 'done') return 'done'
  return 'custom'
}

function slugifyColumnId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'column'
}

function columnIdForStatus(title: string, status: KanbanColumnStatus) {
  return status === 'custom' ? slugifyColumnId(title) : status.replace('_', '-')
}

function uniqueColumnId(base: string, columns: KanbanColumn[]) {
  const used = new Set(columns.map((column) => column.id))
  let id = slugifyColumnId(base)
  let next = 2
  while (used.has(id)) id = `${slugifyColumnId(base)}-${next++}`
  return id
}

export function createKanbanColumn(title: string, columns: KanbanColumn[]): KanbanColumn {
  const status = inferColumnStatus(title)
  return {
    id: uniqueColumnId(columnIdForStatus(title, status), columns),
    title,
    status,
    cards: [],
  }
}

export function isDoneColumn(column: Pick<KanbanColumn, 'status'>) {
  return column.status === 'done'
}

export function setActiveDragSource(columnIndex: number | null) {
  activeDragSourceColumn = columnIndex
}

export function getActiveDragSource() {
  return activeDragSourceColumn
}

export function sortBoardByPriority(board: KanbanBoard): KanbanBoard {
  return {
    columns: board.columns.map((column) => ({
      ...column,
      cards: column.cards
        .map((card, index) => ({ card, index }))
        .sort((a, b) => priorityRank(a.card.priority) - priorityRank(b.card.priority) || a.index - b.index)
        .map(({ card }) => card),
    })),
  }
}
