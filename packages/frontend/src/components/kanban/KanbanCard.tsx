import type { KanbanBoard, KanbanCard as Card } from '../../lib/api'

export function KanbanCard({
  card,
  cardIndex,
  columnIndex,
  board,
  editable,
  onUpdate,
}: {
  card: Card
  cardIndex: number
  columnIndex: number
  board: KanbanBoard
  editable: boolean
  onUpdate: (board: KanbanBoard) => void
}) {
  const updateTitle = () => {
    if (!editable) return
    const title = window.prompt('Card title', card.title)
    if (!title) return
    const next = structuredClone(board)
    next.columns[columnIndex].cards[cardIndex].title = title
    onUpdate(next)
  }

  const toggleDone = () => {
    if (!editable) return
    const next = structuredClone(board)
    next.columns[columnIndex].cards[cardIndex].done = !card.done
    onUpdate(next)
  }

  return (
    <article
      draggable={editable}
      onDragStart={(event) => {
        if (editable) event.dataTransfer.setData('text/plain', `${columnIndex}:${cardIndex}`)
      }}
      className={`rounded-lg border border-border bg-card p-4 shadow-lg shadow-shadow hover:border-accent ${editable ? 'cursor-grab' : ''}`}
    >
      <label className="flex items-start gap-3">
        <input type="checkbox" checked={card.done} onChange={toggleDone} className="mt-1" disabled={!editable} />
        <button className={`text-left text-sm disabled:cursor-default ${card.done ? 'text-text-muted line-through' : 'text-text'}`} onClick={updateTitle} disabled={!editable}>
          {card.title}
        </button>
      </label>
    </article>
  )
}
