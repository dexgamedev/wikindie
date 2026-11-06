import { Archive, Check, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { KanbanBoard, KanbanCard as Card } from '../../lib/api'
import { cardTypeLabel } from '../../lib/cardType'
import { setActiveDragSource } from '../../lib/kanban'
import { priorityColor, priorityDotClass, priorityLabel } from '../../lib/priority'
import { ActionMenu, ActionMenuItem } from '../ui/ActionMenu'
import { AssigneeStack } from '../ui/AssigneeBadges'
import { CardTypeIcon } from '../ui/CardTypeIcon'
import { PageIcon } from '../ui/PageIcon'
import { KanbanCardDialog } from './KanbanCardDialog'

export function KanbanCard({
  card,
  cardIndex,
  columnIndex,
  board,
  editable,
  availableLabels,
  showAssignees,
  users,
  onMove,
  onUpdate,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
}: {
  card: Card
  cardIndex: number
  columnIndex: number
  board: KanbanBoard
  editable: boolean
  availableLabels: string[]
  showAssignees: boolean
  users: string[]
  onMove: (fromColumn: number, fromCard: number, toColumn: number) => void
  onUpdate: (board: KanbanBoard) => void
  onAddComment: (input: { taskId?: string; cardUid?: string; columnId?: string; index?: number; body: string }) => Promise<void>
  onUpdateComment: (commentId: string, body: string) => Promise<void>
  onDeleteComment: (commentId: string) => Promise<void>
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const suppressNextClick = useRef(false)
  const assignees = showAssignees ? card.assignees ?? [] : []
  const labels = card.labels ?? []
  const commentCount = card.comments?.length ?? 0

  const updateCard = (patch: Partial<Card>) => {
    if (!editable) return
    const next = structuredClone(board)
    const current = next.columns[columnIndex].cards[cardIndex]
    next.columns[columnIndex].cards[cardIndex] = { ...current, assignees: current.assignees ?? [], labels: current.labels ?? [], ...patch }
    onUpdate(next)
  }

  const removeCard = () => {
    if (!editable) return
    const next = structuredClone(board)
    next.columns[columnIndex].cards.splice(cardIndex, 1)
    onUpdate(next)
  }

  const toggleArchived = () => {
    updateCard({ archived: card.archived ? undefined : true })
  }

  const moveToColumn = (targetColumnIndex: number) => {
    if (!editable || targetColumnIndex === columnIndex) return
    onMove(columnIndex, cardIndex, targetColumnIndex)
  }

  const openDialog = () => {
    if (suppressNextClick.current) {
      suppressNextClick.current = false
      return
    }
    setDialogOpen(true)
  }

  return (
    <>
      <article
        className="relative rounded-lg border border-border bg-card px-3 py-2.5 shadow-none transition-colors hover:border-text-muted/40"
        draggable={editable}
        onClick={openDialog}
        onDragEnd={(event) => {
          event.stopPropagation()
          setActiveDragSource(null)
          window.setTimeout(() => {
            suppressNextClick.current = false
          }, 120)
        }}
        onDragStart={(event) => {
          if (!editable) return
          event.stopPropagation()
          setActiveDragSource(columnIndex)
          suppressNextClick.current = true
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', `${columnIndex}:${cardIndex}`)
        }}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="block min-w-0 text-left text-sm text-text">
              {(card.id || card.archived || labels.length > 0) && (
                <span className="mb-1 flex flex-wrap gap-1">
                  {card.id && <span className="rounded border border-border bg-surface px-1 py-0.5 font-mono text-[10px] text-text-muted">{card.id}</span>}
                  {card.archived && <span className="rounded border border-border bg-surface px-1 py-0.5 font-mono text-[10px] text-text-muted">Archived</span>}
                  {labels.slice(0, 3).map((label) => <span key={label} className="rounded border border-border bg-surface px-1 py-0.5 font-mono text-[10px] text-text-muted">#{label}</span>)}
                  {labels.length > 3 && <span className="rounded border border-border bg-surface px-1 py-0.5 font-mono text-[10px] text-text-muted">+{labels.length - 3}</span>}
                </span>
              )}
              <span className="flex min-w-0 items-start gap-1.5">
                {card.priority && <span className={`${priorityDotClass} ${priorityColor(card.priority)}`} title={priorityLabel(card.priority)} />}
                <CardTypeIcon className="mt-[3px] size-3.5" title={`${cardTypeLabel(card.type)} card`} type={card.type} />
                <span className="block min-w-0 break-words">{card.title}</span>
              </span>
              {(card.description || commentCount > 0) && (
                <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-text-muted">
                  {card.description && <span className="whitespace-nowrap">Has details</span>}
                  {commentCount > 0 && <span className="whitespace-nowrap">{commentCount} comment{commentCount === 1 ? '' : 's'}</span>}
                </span>
              )}
            </div>
          </div>
          {(editable || assignees.length > 0) && (
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {editable && (
                <div onClick={(event) => event.stopPropagation()}>
                  <ActionMenu label="Card actions">
                    {({ close }) => (
                      <>
                        <ActionMenuItem onSelect={() => { setDialogOpen(true); close() }}>
                          <Pencil size={14} /> Edit details
                        </ActionMenuItem>

                        {board.columns.length > 1 && (
                          <>
                            <div className="my-1 border-t border-border" />
                            <div className="px-2 pb-1 pt-1 text-[10px] font-medium text-text-muted">Move to column</div>
                            {board.columns.map((column, targetIndex) => (
                              <button
                                key={`${column.id}-${targetIndex}`}
                                className="flex h-7 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-sm text-text hover:bg-surface-hover disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
                                disabled={targetIndex === columnIndex}
                                onClick={() => { moveToColumn(targetIndex); close() }}
                                type="button"
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <PageIcon icon={column.icon} fallback="column" className="size-4 shrink-0" />
                                  <span className="min-w-0 truncate">{column.title}</span>
                                </span>
                                {targetIndex === columnIndex && <Check size={13} className="shrink-0 text-accent" />}
                              </button>
                            ))}
                          </>
                        )}

                        <div className="my-1 border-t border-border" />
                        <ActionMenuItem onSelect={() => { toggleArchived(); close() }}>
                          {card.archived ? <RotateCcw size={14} /> : <Archive size={14} />} {card.archived ? 'Restore' : 'Archive'}
                        </ActionMenuItem>

                        <div className="my-1 border-t border-border" />
                        <ActionMenuItem danger onSelect={() => { removeCard(); close() }}>
                          <Trash2 size={14} /> Remove
                        </ActionMenuItem>
                      </>
                    )}
                  </ActionMenu>
                </div>
              )}
              <AssigneeStack assignees={assignees} />
            </div>
          )}
        </div>
      </article>
      <KanbanCardDialog
        card={card}
        editable={editable}
        availableLabels={availableLabels}
        onClose={() => setDialogOpen(false)}
        onAddComment={(body) => onAddComment({ taskId: card.id, cardUid: card.uid, columnId: board.columns[columnIndex].id, index: cardIndex, body })}
        onUpdateComment={onUpdateComment}
        onDeleteComment={onDeleteComment}
        onSave={updateCard}
        open={dialogOpen}
        showAssignees={showAssignees}
        users={users}
      />
    </>
  )
}
