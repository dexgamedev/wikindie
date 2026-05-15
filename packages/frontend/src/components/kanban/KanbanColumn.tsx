import { Pencil, Plus, Settings, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { KanbanBoard, KanbanCard as Card, KanbanColumn as Column, KanbanColumnStatus } from '../../lib/api'
import { wikiIcons } from '../../lib/icons'
import { getActiveDragSource, kanbanColumnStatusOptions } from '../../lib/kanban'
import { ActionMenu, ActionMenuItem } from '../ui/ActionMenu'
import { Button } from '../ui/Button'
import { PageIcon } from '../ui/PageIcon'
import { KanbanCard } from './KanbanCard'

const iconCategories = Array.from(new Set(wikiIcons.map((icon) => icon.category)))

export function KanbanColumn({
  column,
  columnIndex,
  board,
  editable,
  availableLabels,
  visibleCards,
  users,
  onUpdate,
  onMove,
}: {
  column: Column
  columnIndex: number
  board: KanbanBoard
  editable: boolean
  availableLabels: string[]
  visibleCards?: Array<{ card: Card; cardIndex: number }>
  users: string[]
  onUpdate: (board: KanbanBoard) => void
  onMove: (fromColumn: number, fromCard: number, toColumn: number) => void
}) {
  const [addingCard, setAddingCard] = useState(false)
  const [newCardTitle, setNewCardTitle] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(column.title)
  const [metaEditing, setMetaEditing] = useState(false)
  const [metaTitle, setMetaTitle] = useState(column.title)
  const [metaIcon, setMetaIcon] = useState(column.icon || '')
  const [metaStatus, setMetaStatus] = useState<KanbanColumnStatus>(column.status)

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

  return (
    <div
      className="overflow-hidden rounded-md border border-border bg-surface p-3 sm:p-4"
      onDragOver={(event) => {
        if (editable && getActiveDragSource() !== null && getActiveDragSource() !== columnIndex) event.preventDefault()
      }}
      onDrop={(event) => {
        if (!editable) return
        const [fromColumn, fromCard] = event.dataTransfer.getData('text/plain').split(':').map(Number)
        if (!Number.isNaN(fromColumn) && !Number.isNaN(fromCard) && fromColumn !== columnIndex) onMove(fromColumn, fromCard, columnIndex)
      }}
    >
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
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-text">Column meta</h4>
            <span className="text-xs text-text-muted">Icon, title, and workflow status</span>
          </div>
          <input
            className="mb-3 w-full rounded border border-accent bg-input px-2 py-1.5 text-sm text-text outline-none"
            value={metaTitle}
            onChange={(event) => setMetaTitle(event.target.value)}
            placeholder="Column title"
          />
          <label className="mb-3 grid gap-1 text-xs text-text-muted">
            Workflow status
            <select
              className="w-full rounded border border-border bg-input px-2 py-1.5 text-sm text-text outline-none transition focus:border-accent"
              value={metaStatus}
              onChange={(event) => setMetaStatus(event.target.value as KanbanColumnStatus)}
            >
              {kanbanColumnStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <div className="mb-3 max-h-48 overflow-y-auto rounded-md border border-border bg-input p-2">
            {iconCategories.map((category) => (
              <div key={category} className="mb-3 last:mb-0">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">{category}</div>
                <div className="flex flex-wrap gap-1.5">
                  {wikiIcons.filter((icon) => icon.category === category).map((icon) => (
                    <button
                      key={icon.id}
                      className={`grid size-8 place-items-center rounded-md border text-base transition ${metaIcon === icon.id ? 'border-accent bg-accent/20' : 'border-border bg-card hover:border-accent'}`}
                      onClick={() => setMetaIcon(icon.id)}
                      title={`${icon.label} (${icon.id})`}
                      type="button"
                    >
                      <PageIcon icon={icon.id} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mb-3 flex items-center gap-2 text-xs text-text-muted">
            <span>Selected:</span>
            <PageIcon icon={metaIcon} fallback="column" className="text-base" />
            <span>{metaIcon || 'column'}</span>
          </div>
          <div className="flex gap-2">
            <Button className="py-1.5" onClick={saveMeta}>Save</Button>
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
            users={users}
            onMove={onMove}
            onUpdate={onUpdate}
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
