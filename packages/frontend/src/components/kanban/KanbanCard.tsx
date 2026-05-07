import { Check, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CardPriority, KanbanBoard, KanbanCard as Card } from '../../lib/api'
import { priorityColor, priorityLabel } from '../../lib/priority'
import { ActionMenu, ActionMenuItem } from '../ui/ActionMenu'
import { AssigneeCorner, UserIconBadge } from '../ui/AssigneeBadges'
import { PageIcon } from '../ui/PageIcon'

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
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(card.title)
  const assignees = card.assignees ?? []

  useEffect(() => {
    if (!editing) setEditValue(card.title)
  }, [card.title, editing])

  const updateCard = (patch: Partial<Card>) => {
    if (!editable) return
    const next = structuredClone(board)
    const current = next.columns[columnIndex].cards[cardIndex]
    next.columns[columnIndex].cards[cardIndex] = { ...current, assignees: current.assignees ?? [], ...patch }
    onUpdate(next)
  }

  const startEditing = () => {
    if (!editable) return
    setEditValue(card.title)
    setEditing(true)
  }

  const commitEdit = () => {
    if (!editable) return
    const title = editValue.trim().replace(/\s+/g, ' ')
    setEditing(false)
    if (!title || title === card.title) return
    updateCard({ title })
  }

  const cancelEdit = () => {
    setEditValue(card.title)
    setEditing(false)
  }

  const toggleDone = () => {
    updateCard({ done: !card.done })
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

  return (
    <article
      draggable={editable && !editing}
      onDragStart={(event) => {
        if (editable && !editing) event.dataTransfer.setData('text/plain', `${columnIndex}:${cardIndex}`)
      }}
      className={`relative rounded-lg border border-border bg-card p-3 shadow-lg shadow-shadow hover:border-accent sm:p-4 ${assignees.length ? 'pb-10' : ''} ${editable ? 'cursor-grab' : ''}`}
    >
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={card.done} onChange={toggleDone} className="mt-0.5 size-5 accent-accent" disabled={!editable} />
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault()
                commitEdit()
              }}
            >
              <textarea
                autoFocus
                className="min-h-16 w-full resize-y rounded border border-accent bg-input px-2 py-1.5 text-sm text-text outline-none"
                rows={2}
                value={editValue}
                onChange={(event) => setEditValue(event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    commitEdit()
                  }
                  if (event.key === 'Escape') cancelEdit()
                }}
              />
              <div className="flex flex-wrap gap-2">
                <button className="rounded-lg border border-control-border bg-control px-2.5 py-1.5 text-xs font-medium text-text hover:border-accent hover:bg-control-hover" type="submit">Save</button>
                <button className="rounded-lg px-2.5 py-1.5 text-xs text-text-muted hover:bg-accent/10 hover:text-text" onClick={cancelEdit} type="button">Cancel</button>
              </div>
            </form>
          ) : (
            <button
              className={`flex min-w-0 items-start gap-2 text-left text-sm disabled:cursor-default ${card.done ? 'text-text-muted line-through' : 'text-text'}`}
              onDoubleClick={startEditing}
              disabled={!editable}
              type="button"
            >
              {card.priority && <span className={`mt-1.5 size-2 shrink-0 rounded-full ${priorityColor(card.priority)}`} title={priorityLabel(card.priority)} />}
              <span className="min-w-0 break-words">{card.title}</span>
            </button>
          )}

        </div>

        {editable && (
          <ActionMenu label="Card actions">
            {({ close }) => (
              <>
                <ActionMenuItem onSelect={() => { startEditing(); close() }}>
                  <Pencil size={14} /> Rename
                </ActionMenuItem>

                {board.columns.length > 1 && (
                  <>
                    <div className="my-1 border-t border-border" />
                    <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">Move to column</div>
                    {board.columns.map((column, targetIndex) => (
                      <button
                        key={`${column.title}-${targetIndex}`}
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-text hover:bg-accent/10 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
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
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent/10"
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
                        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent/10"
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
        )}
      </div>
      <AssigneeCorner assignees={assignees} />
    </article>
  )
}
