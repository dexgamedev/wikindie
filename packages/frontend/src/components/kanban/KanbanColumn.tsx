import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { KanbanBoard, KanbanColumn as Column } from '../../lib/api'
import { Button } from '../ui/Button'
import { KanbanCard } from './KanbanCard'

export function KanbanColumn({
  column,
  columnIndex,
  board,
  editable,
  onUpdate,
  onMove,
}: {
  column: Column
  columnIndex: number
  board: KanbanBoard
  editable: boolean
  onUpdate: (board: KanbanBoard) => void
  onMove: (fromColumn: number, fromCard: number, toColumn: number) => void
}) {
  const [addingCard, setAddingCard] = useState(false)
  const [newCardTitle, setNewCardTitle] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(column.title)

  const addCard = () => {
    if (!editable) return
    const title = newCardTitle.trim()
    if (!title) return
    const next = structuredClone(board)
    next.columns[columnIndex].cards.push({ title, done: false })
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
    setMenuOpen(false)
  }

  const removeColumn = () => {
    if (!editable) return
    const next = structuredClone(board)
    next.columns.splice(columnIndex, 1)
    onUpdate(next)
  }

  return (
    <div
      className="rounded-2xl border border-border bg-surface/70 p-3"
      onDragOver={(event) => {
        if (editable) event.preventDefault()
      }}
      onDrop={(event) => {
        if (!editable) return
        const [fromColumn, fromCard] = event.dataTransfer.getData('text/plain').split(':').map(Number)
        if (!Number.isNaN(fromColumn) && !Number.isNaN(fromCard)) onMove(fromColumn, fromCard, columnIndex)
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
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
              className="w-full rounded border border-accent bg-slate-950 px-2 py-1 text-sm text-text outline-none"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
            />
          </form>
        ) : (
          <h3 className="font-semibold">{column.title}</h3>
        )}
        {editable && (
          <div className="relative flex items-center gap-1">
            <Button onClick={() => setAddingCard((v) => !v)}>{addingCard ? 'Close' : '+'}</Button>
            <button className="rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text" onClick={() => setMenuOpen((v) => !v)}>
              <MoreHorizontal size={15} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 z-20 w-40 rounded-xl border border-border bg-slate-950 p-1 shadow-2xl">
                <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-hover" onClick={() => { setRenaming(true); setMenuOpen(false) }}>
                  <Pencil size={14} /> Rename
                </button>
                <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-red-300 hover:bg-red-500/10" onClick={removeColumn}>
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            )}
          </div>
          )}
      </div>
      {editable && addingCard && (
        <form
          className="mb-3 flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            addCard()
          }}
        >
          <input
            autoFocus
            className="min-w-0 flex-1 rounded border border-accent bg-slate-950 px-2 py-1.5 text-sm text-text outline-none"
            value={newCardTitle}
            onChange={(event) => setNewCardTitle(event.target.value)}
            placeholder="Card title"
          />
          <Button type="submit">Add</Button>
        </form>
      )}
      <div className="space-y-3">
        {column.cards.map((card, cardIndex) => (
          <KanbanCard key={`${card.title}-${cardIndex}`} card={card} cardIndex={cardIndex} columnIndex={columnIndex} board={board} editable={editable} onUpdate={onUpdate} />
        ))}
      </div>
    </div>
  )
}
