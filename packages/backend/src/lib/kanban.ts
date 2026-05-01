export interface KanbanCard {
  title: string
  done: boolean
}

export interface KanbanColumn {
  title: string
  cards: KanbanCard[]
}

export interface KanbanBoard {
  columns: KanbanColumn[]
}

export function parseKanban(markdown: string): KanbanBoard {
  const columns: KanbanColumn[] = []
  let current: KanbanColumn | undefined

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+)$/)
    if (heading) {
      current = { title: heading[1].trim(), cards: [] }
      columns.push(current)
      continue
    }

    const card = line.match(/^- \[( |x|X)\]\s+(.+)$/)
    if (card && current) current.cards.push({ done: card[1].toLowerCase() === 'x', title: card[2].trim() })
  }

  return { columns }
}

export function serializeKanban(board: KanbanBoard) {
  return board.columns
    .map((column) => [`## ${column.title}`, ...column.cards.map((card) => `- [${card.done ? 'x' : ' '}] ${card.title}`)].join('\n'))
    .join('\n')
}
