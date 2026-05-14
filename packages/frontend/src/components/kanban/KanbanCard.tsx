import { Check, Pencil, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { CardPriority, KanbanBoard, KanbanCard as Card } from '../../lib/api'
import { setActiveDragSource } from '../../lib/kanban'
import { priorityColor, priorityLabel } from '../../lib/priority'
import { ActionMenu, ActionMenuItem } from '../ui/ActionMenu'
import { AssigneeStack, UserIconBadge } from '../ui/AssigneeBadges'
import { PageIcon } from '../ui/PageIcon'
import { KanbanCardDialog } from './KanbanCardDialog'

const priorityOptions: Array<{ value: CardPriority | undefined; label: string }> = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: undefined, label: 'None' },
]

export function KanbanCard({
  card,
  cardIndex,
  columnIndex,
  board,
  editable,
  users,
  onMove,
  onUpdate,
}: {
  card: Card
  cardIndex: number
  columnIndex: number
  board: KanbanBoard
  editable: boolean
  users: string[]
  onMove: (fromColumn: number, fromCard: number, toColumn: number) => void
  onUpdate: (board: KanbanBoard) => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const suppressNextClick = useRef(false)
  const assignees = card.assignees ?? []

  const updateCard = (patch: Partial<Card>) => {
    if (!editable) return
    const next = structuredClone(board)
    const current = next.columns[columnIndex].cards[cardIndex]
    next.columns[columnIndex].cards[cardIndex] = { ...current, assignees: current.assignees ?? [], ...patch }
    onUpdate(next)
  }

  const setPriority = (priority?: CardPriority) => {
    updateCard({ priority })
  }

  const toggleAssignee = (username: string) => {
    const nextAssignees = assignees.includes(username) ? assignees.filter((assignee) => assignee !== username) : [...assignees, username]
    updateCard({ assignees: nextAssignees })
  }

  const removeCard = () => {
    if (!editable) return
    const next = structuredClone(board)
    next.columns[columnIndex].cards.splice(cardIndex, 1)
    onUpdate(next)
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
        className="relative rounded-md border border-border bg-card px-3 py-3 shadow-sm shadow-shadow hover:border-accent sm:px-4 sm:py-4"
        draggable={editable}
        onClick={openDialog}
        onDragEnd={() => {
          setActiveDragSource(null)
          window.setTimeout(() => {
            suppressNextClick.current = false
          }, 120)
        }}
        onDragStart={(event) => {
          if (!editable) return
          setActiveDragSource(columnIndex)
          suppressNextClick.current = true
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', `${columnIndex}:${cardIndex}`)
        }}
      >
        <div className="flex items-start gap-3">
          {card.priority && <span className={`mt-2 size-2 shrink-0 rounded-full ${priorityColor(card.priority)}`} title={priorityLabel(card.priority)} />}
          <div className="min-w-0 flex-1">
            <div className="block min-w-0 text-left text-sm text-text">
              {card.id && <span className="mb-1 inline-flex rounded-full border border-accent/35 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">{card.id}</span>}
              <span className="block min-w-0 break-words">{card.title}</span>
              {card.description && <span className="mt-1 block text-xs text-text-muted">Has details</span>}
            </div>
          </div>
          {(editable || assignees.length > 0) && (
            <div className="flex shrink-0 flex-col items-end gap-2">
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
                            <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">Move to column</div>
                            {board.columns.map((column, targetIndex) => (
                              <button
                                key={`${column.id}-${targetIndex}`}
                                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-text hover:bg-accent/10 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
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
                        <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">Set priority</div>
                        {priorityOptions.map((option) => (
                          <button
                            key={option.label}
                            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/10"
                            onClick={() => { setPriority(option.value); close() }}
                            type="button"
                          >
                            <span className="flex items-center gap-2">
                              <span className={`size-2 rounded-full ${priorityColor(option.value)}`} /> {option.label}
                            </span>
                            {card.priority === option.value && <Check size={13} className="text-accent" />}
                          </button>
                        ))}

                        <div className="my-1 border-t border-border" />
                        <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">Assign</div>
                        {users.length > 0 ? (
                          users.map((username) => {
                            const selected = assignees.includes(username)
                            return (
                              <button
                                key={username}
                                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/10"
                                onClick={() => toggleAssignee(username)}
                                type="button"
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <UserIconBadge username={username} className="size-5 shrink-0" />
                                  <span className="min-w-0 truncate">{username}</span>
                                </span>
                                {selected && <Check size={13} className="shrink-0 text-accent" />}
                              </button>
                            )
                          })
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-text-muted">No users found</div>
                        )}

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
        onClose={() => setDialogOpen(false)}
        onSave={updateCard}
        open={dialogOpen}
        users={users}
      />
    </>
  )
}
