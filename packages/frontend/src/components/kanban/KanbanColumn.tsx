import { Pencil, Plus, Settings, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { KanbanBoard, KanbanCard as Card, KanbanColumn as Column, KanbanColumnStatus } from '../../lib/api'
import { setDragPreview } from '../../lib/dragPreview'
import { getActiveColumnReorderSource, getActiveDragSource, getColumnDragPayload, hasColumnDragPayload, kanbanColumnStatusOptions, setActiveColumnReorderSource, setColumnDragPayload } from '../../lib/kanban'
import { ActionMenu, ActionMenuItem } from '../ui/ActionMenu'
import { Button } from '../ui/Button'
import { IconPicker } from '../ui/IconPicker'
import { PageIcon } from '../ui/PageIcon'
import { KanbanCard } from './KanbanCard'

export function KanbanColumn({
  column,
  columnIndex,
  board,
  editable,
  availableLabels,
  visibleCards,
  showAssignees,
  users,
  onUpdate,
  onMove,
  onMoveColumn,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
}: {
  column: Column
  columnIndex: number
  board: KanbanBoard
  editable: boolean
  availableLabels: string[]
  visibleCards?: Array<{ card: Card; cardIndex: number }>
  showAssignees: boolean
  users: string[]
  onUpdate: (board: KanbanBoard) => void
  onMove: (fromColumn: number, fromCard: number, toColumn: number) => void
  onMoveColumn: (fromColumn: number, targetColumn: number, position: 'before' | 'after') => void
  onAddComment: (input: { taskId?: string; cardUid?: string; columnId?: string; index?: number; body: string }) => Promise<void>
  onUpdateComment: (commentId: string, body: string) => Promise<void>
  onDeleteComment: (commentId: string) => Promise<void>
}) {
  const [addingCard, setAddingCard] = useState(false)
  const [newCardTitle, setNewCardTitle] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(column.title)
  const [metaEditing, setMetaEditing] = useState(false)
  const [metaTitle, setMetaTitle] = useState(column.title)
  const [metaIcon, setMetaIcon] = useState(column.icon || '')
  const [metaStatus, setMetaStatus] = useState<KanbanColumnStatus>(column.status)
  const [columnDropPosition, setColumnDropPosition] = useState<'before' | 'after' | null>(null)
  const [draggingColumn, setDraggingColumn] = useState(false)
  const columnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!renaming) setRenameValue(column.title)
    if (!metaEditing) {
      setMetaTitle(column.title)
      setMetaIcon(column.icon || '')
      setMetaStatus(column.status)
    }
  }, [column.icon, column.status, column.title, metaEditing, renaming])

  const addCard = () => {
    if (!editable) return
    const title = newCardTitle.trim()
    if (!title) return
    const next = structuredClone(board)
    next.columns[columnIndex].cards.push({ title, assignees: [], labels: [] })
    onUpdate(next)
    setAddingCard(false)
    setNewCardTitle('')
  }

  const saveRename = () => {
    if (!editable) return
    const title = renameValue.trim()
    if (!title) return
    const next = structuredClone(board)
    next.columns[columnIndex].title = title
    onUpdate(next)
    setRenaming(false)
  }

  const saveMeta = () => {
    if (!editable) return
    const title = metaTitle.trim()
    if (!title) return
    const next = structuredClone(board)
    next.columns[columnIndex].title = title
    next.columns[columnIndex].icon = metaIcon || undefined
    next.columns[columnIndex].status = metaStatus
    onUpdate(next)
    setMetaEditing(false)
  }

  const removeColumn = () => {
    if (!editable) return
    const next = structuredClone(board)
    next.columns.splice(columnIndex, 1)
    onUpdate(next)
  }

  const cardsToRender = visibleCards ?? column.cards.map((card, cardIndex) => ({ card, cardIndex }))

  const dropPositionFromEvent = (event: React.DragEvent) => {
    const rect = columnRef.current?.getBoundingClientRect()
    if (!rect) return 'after'
    return event.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
  }

  const startColumnDrag = (event: React.DragEvent) => {
    if (!editable) return
    const target = event.target
    if (target instanceof HTMLElement && target.closest('button, input, textarea, select, a')) {
      event.preventDefault()
      return
    }
    event.stopPropagation()
    setColumnDragPayload(event.dataTransfer, columnIndex)
    setDragPreview(event.dataTransfer, 'Move column', column.title)
    setDraggingColumn(true)
  }

  const endColumnDrag = () => {
    setDraggingColumn(false)
    setColumnDropPosition(null)
    setActiveColumnReorderSource(null)
  }

  return (
    <div
      className={`relative overflow-hidden rounded-md border border-border bg-surface p-3 transition sm:p-4 ${editable ? 'cursor-grab active:cursor-grabbing' : ''} ${draggingColumn ? 'opacity-60 ring-2 ring-accent/40' : ''} ${columnDropPosition ? 'ring-1 ring-accent/30' : ''}`}
      draggable={editable}
      ref={columnRef}
      onDragEnd={endColumnDrag}
      onDragOver={(event) => {
        if (!editable) return
        const activeColumnSource = getActiveColumnReorderSource()
        if (activeColumnSource !== null || hasColumnDragPayload(event.dataTransfer)) {
          event.preventDefault()
          event.stopPropagation()
          event.dataTransfer.dropEffect = 'move'
          setColumnDropPosition(activeColumnSource === columnIndex ? null : dropPositionFromEvent(event))
          return
        }
        if (getActiveDragSource() !== null && getActiveDragSource() !== columnIndex) event.preventDefault()
      }}
      onDragLeave={() => setColumnDropPosition(null)}
      onDrop={(event) => {
        if (!editable) return
        const columnSource = getColumnDragPayload(event.dataTransfer)
        if (columnSource !== null) {
          event.preventDefault()
          event.stopPropagation()
          if (columnSource !== columnIndex) onMoveColumn(columnSource, columnIndex, columnDropPosition ?? dropPositionFromEvent(event))
          setColumnDropPosition(null)
          setActiveColumnReorderSource(null)
          return
        }
        const [fromColumn, fromCard] = event.dataTransfer.getData('text/plain').split(':').map(Number)
        if (!Number.isNaN(fromColumn) && !Number.isNaN(fromCard) && fromColumn !== columnIndex) onMove(fromColumn, fromCard, columnIndex)
      }}
      onDragStart={startColumnDrag}
    >
      {columnDropPosition && (
        <div className={`pointer-events-none absolute inset-y-3 z-10 flex items-center ${columnDropPosition === 'before' ? 'left-0' : 'right-0'}`}>
          <span className="h-full w-1 rounded-full bg-accent shadow-[0_0_14px_var(--color-accent)]" />
          <span className={`${columnDropPosition === 'before' ? 'ml-2' : 'order-first mr-2'} rounded-full border border-control-border bg-panel px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent shadow-sm shadow-shadow`}>
            {columnDropPosition === 'before' ? 'Before' : 'After'}
          </span>
        </div>
      )}
      <div className="mb-4 flex items-center justify-between gap-3">
        {editable && renaming ? (
          <form
            className="min-w-0 flex-1"
            onSubmit={(event) => {
              event.preventDefault()
              saveRename()
            }}
          >
            <input
              autoFocus
              className="w-full rounded border border-accent bg-input px-2 py-1 text-sm text-text outline-none"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
            />
          </form>
        ) : (
          <h3 className="flex min-w-0 items-center gap-2 font-semibold">
            <PageIcon icon={column.icon} fallback="column" className="size-5 shrink-0" />
            <span className="min-w-0 truncate">{column.title}</span>
          </h3>
        )}
        {editable && (
          <div className="relative flex items-center gap-0.5">
            <ActionMenu label="Column actions" menuClassName="w-40">
              {({ close }) => (
                <>
                  <ActionMenuItem onSelect={() => { setRenaming(true); close() }}>
                    <Pencil size={14} /> Rename
                  </ActionMenuItem>
                  <ActionMenuItem onSelect={() => { setMetaEditing((open) => !open); close() }}>
                    <Settings size={14} /> Column meta
                  </ActionMenuItem>
                  <ActionMenuItem danger onSelect={() => { removeColumn(); close() }}>
                    <Trash2 size={14} /> Remove
                  </ActionMenuItem>
                </>
              )}
            </ActionMenu>
          </div>
          )}
      </div>
      {editable && metaEditing && (
        <article className="mb-4 rounded-md border border-border bg-card p-3">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-text">Column meta</h4>
              <p className="text-xs text-text-muted">Title, workflow status, and icon.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="column-meta-title" className="block text-xs font-semibold uppercase tracking-wide text-text-muted">Title</label>
              <input
                id="column-meta-title"
                className="w-full rounded border border-border bg-input px-2.5 py-1.5 text-sm font-semibold text-text outline-none transition focus:border-accent"
                value={metaTitle}
                onChange={(event) => setMetaTitle(event.target.value)}
                placeholder="Column title"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="column-meta-status" className="block text-xs font-semibold uppercase tracking-wide text-text-muted">Workflow status</label>
              <select
                id="column-meta-status"
                className="w-full rounded border border-border bg-input px-2.5 py-1.5 text-sm text-text outline-none transition focus:border-accent"
                value={metaStatus}
                onChange={(event) => setMetaStatus(event.target.value as KanbanColumnStatus)}
              >
                {kanbanColumnStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="block text-xs font-semibold uppercase tracking-wide text-text-muted">Icon</label>
                <span className="flex items-center gap-2 text-xs text-text-muted">
                  Selected
                  <span className="grid size-8 place-items-center rounded-md border border-border bg-input text-lg">
                    <PageIcon icon={metaIcon} fallback="column" />
                  </span>
                </span>
              </div>
              <div className="rounded-md border border-border bg-input p-2">
                <IconPicker onSelect={setMetaIcon} />
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2 border-t border-border pt-3">
            <Button variant="primary" className="py-1.5" onClick={saveMeta}>Save changes</Button>
            <Button className="py-1.5" onClick={() => setMetaEditing(false)}>Cancel</Button>
          </div>
        </article>
      )}
      <div className="space-y-4">
        {cardsToRender.map(({ card, cardIndex }) => (
          <KanbanCard
            key={card.id ?? `${card.title}-${cardIndex}`}
            card={card}
            cardIndex={cardIndex}
            columnIndex={columnIndex}
            board={board}
            editable={editable}
            availableLabels={availableLabels}
            showAssignees={showAssignees}
            users={users}
            onMove={onMove}
            onUpdate={onUpdate}
            onAddComment={onAddComment}
            onUpdateComment={onUpdateComment}
            onDeleteComment={onDeleteComment}
          />
        ))}
      </div>
      {editable && (
        <div className={`-mx-3 -mb-3 mt-4 border-t border-border bg-panel sm:-mx-4 sm:-mb-4 ${addingCard ? 'p-3' : ''}`}>
          {addingCard ? (
            <form
              className="grid gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                addCard()
              }}
            >
              <input
                autoFocus
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-text outline-none transition focus:border-accent"
                value={newCardTitle}
                onChange={(event) => setNewCardTitle(event.target.value)}
                placeholder="Task title"
              />
              <div className="flex justify-end gap-2">
                <Button onClick={() => { setAddingCard(false); setNewCardTitle('') }} type="button">Cancel</Button>
                <Button type="submit" variant="primary">Add task</Button>
              </div>
            </form>
          ) : (
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-text-muted transition hover:bg-accent/8 hover:text-text"
              onClick={() => setAddingCard(true)}
              type="button"
            >
              <Plus size={14} /> Add task
            </button>
          )}
        </div>
      )}
    </div>
  )
}
