import { useState } from 'react'
import { api, type KanbanBoard as Board } from '../../lib/api'
import { Button } from '../ui/Button'
import { KanbanColumn } from './KanbanColumn'

export function KanbanBoard({ path, initial }: { path: string; initial: Board }) {
  const [board, setBoard] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColumnTitle, setNewColumnTitle] = useState('')

  const update = async (next: Board) => {
    setBoard(next)
    setSaving(true)
    await api.saveKanban(path, next)
    setSaving(false)
  }

  const addColumn = () => {
    const title = newColumnTitle.trim()
    if (!title) return
    void update({ columns: [...board.columns, { title, cards: [] }] })
    setAddingColumn(false)
    setNewColumnTitle('')
  }

  const moveCard = (fromColumn: number, fromCard: number, toColumn: number) => {
    const next = structuredClone(board)
    const [card] = next.columns[fromColumn].cards.splice(fromCard, 1)
    next.columns[toColumn].cards.push(card)
    void update(next)
  }

  return (
    <section className="p-4 md:p-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-text-muted">{path}</p>
          <h2 className="text-2xl font-semibold">Kanban board</h2>
        </div>
        <div className="flex items-center gap-3 text-sm text-text-muted">
          <span>{saving ? 'Saving...' : 'Saved'}</span>
          <Button onClick={() => setAddingColumn((v) => !v)}>{addingColumn ? 'Close' : 'Add column'}</Button>
        </div>
      </div>
      {addingColumn && (
        <form
          className="mb-4 flex max-w-md items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            addColumn()
          }}
        >
          <input
            autoFocus
            className="min-w-0 flex-1 rounded border border-accent bg-slate-950 px-3 py-2 text-sm text-text outline-none"
            value={newColumnTitle}
            onChange={(event) => setNewColumnTitle(event.target.value)}
            placeholder="Column title"
          />
          <Button type="submit">Add</Button>
        </form>
      )}
      <div className="grid gap-4 lg:grid-flow-col lg:auto-cols-[minmax(280px,1fr)] lg:overflow-x-auto">
        {board.columns.map((column, columnIndex) => (
          <KanbanColumn key={`${column.title}-${columnIndex}`} column={column} columnIndex={columnIndex} board={board} onUpdate={update} onMove={moveCard} />
        ))}
      </div>
    </section>
  )
}
