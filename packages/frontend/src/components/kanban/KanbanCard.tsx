import type { KanbanBoard, KanbanCard as Card } from '../../lib/api'

export function KanbanCard({
  card,
  cardIndex,
  columnIndex,
  board,
  onUpdate,
}: {
  card: Card
  cardIndex: number
  columnIndex: number
  board: KanbanBoard
  onUpdate: (board: KanbanBoard) => void
}) {
  const updateTitle = () => {
    const title = window.prompt('Card title', card.title)
    if (!title) return
    const next = structuredClone(board)
    next.columns[columnIndex].cards[cardIndex].title = title
    onUpdate(next)
  }

  const toggleDone = () => {
    const next = structuredClone(board)
    next.columns[columnIndex].cards[cardIndex].done = !card.done
    onUpdate(next)
  }

  return (
    <article
      draggable
      onDragStart={(event) => event.dataTransfer.setData('text/plain', `${columnIndex}:${cardIndex}`)}
      className="cursor-grab rounded-xl border border-border bg-slate-800 p-3 shadow-lg shadow-black/10 hover:border-accent"
    >
      <label className="flex items-start gap-3">
        <input type="checkbox" checked={card.done} onChange={toggleDone} className="mt-1" />
        <button className={`text-left text-sm ${card.done ? 'text-text-muted line-through' : 'text-text'}`} onClick={updateTitle}>
          {card.title}
        </button>
      </label>
    </article>
  )
}
