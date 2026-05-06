export type CardPriority = 'high' | 'medium' | 'low'

export interface KanbanCard {
  title: string
  done: boolean
  priority?: CardPriority
  assignees: string[]
}

export interface KanbanColumn {
  title: string
  icon?: string
  cards: KanbanCard[]
}

export interface KanbanBoard {
  columns: KanbanColumn[]
}

function parseMetadataBlock(raw: string): { priority?: CardPriority; assignees: string[] } | null {
  const tokens = raw.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return null

  let priority: CardPriority | undefined
  const assignees: string[] = []

  for (const token of tokens) {
    const priorityMatch = token.match(/^#(high|medium|low)$/i)
    if (priorityMatch) {
      priority = priorityMatch[1].toLowerCase() as CardPriority
      continue
    }

    const simpleAssignee = token.match(/^@([A-Za-z0-9_.-]+)$/)
    if (simpleAssignee) {
      assignees.push(simpleAssignee[1])
      continue
    }

    const encodedAssignee = token.match(/^@<([^>]+)>$/)
    if (encodedAssignee) {
      try {
        const decoded = decodeURIComponent(encodedAssignee[1])
        if (!decoded.trim()) return null
        assignees.push(decoded)
        continue
      } catch {
        return null
      }
    }

    return null
  }

  return { priority, assignees }
}

function parseCardTags(raw: string): { title: string; priority?: CardPriority; assignees: string[] } {
  const trimmed = raw.trim()
  if (!trimmed) return { title: '', assignees: [] }

  // Prefer double-space separator for explicit metadata blocks.
  const separators = [...trimmed.matchAll(/\s{2,}/g)]
  for (let index = separators.length - 1; index >= 0; index -= 1) {
    const separator = separators[index]
    if (separator.index === undefined) continue
    const title = trimmed.slice(0, separator.index).trimEnd()
    const metadata = parseMetadataBlock(trimmed.slice(separator.index + separator[0].length))
    if (title && metadata) return { title, ...metadata }
  }

  // Fallback: try trailing single-space tokens when they form a valid metadata-only run.
  const tokens = trimmed.split(/\s+/)
  let tokensConsumed = 0
  let priority: CardPriority | undefined
  const assignees: string[] = []
  for (let i = tokens.length - 1; i >= 1; i -= 1) {
    const block = parseMetadataBlock(tokens[i])
    if (!block) break
    if (block.priority) priority = block.priority
    if (block.assignees.length) assignees.unshift(...block.assignees)
    tokensConsumed = tokens.length - i
  }
  if (tokensConsumed > 0) {
    const title = tokens.slice(0, tokens.length - tokensConsumed).join(' ')
    if (title) return { title, priority, assignees }
  }

  return { title: trimmed, assignees: [] }
}

function formatAssigneeTag(assignee: string) {
  return /^[A-Za-z0-9_.-]+$/.test(assignee) ? `@${assignee}` : `@<${encodeURIComponent(assignee)}>`
}

function parseColumnHeading(raw: string): { title: string; icon?: string } {
  const trimmed = raw.trim()
  const icon = trimmed.match(/^:([a-z0-9_-]+):\s+(.+)$/i)
  if (icon) return { icon: icon[1].toLowerCase(), title: icon[2].trim() }
  return { title: trimmed }
}

export function parseKanban(markdown: string): KanbanBoard {
  const columns: KanbanColumn[] = []
  let current: KanbanColumn | undefined

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+)$/)
    if (heading) {
      current = { ...parseColumnHeading(heading[1]), cards: [] }
      columns.push(current)
      continue
    }

    const card = line.match(/^- \[( |x|X)\]\s+(.+)$/)
    if (card && current) current.cards.push({ done: card[1].toLowerCase() === 'x', ...parseCardTags(card[2]) })
  }

  return { columns }
}

export function serializeKanban(board: KanbanBoard) {
  return board.columns
    .map((column) =>
      [
        `## ${column.icon ? `:${column.icon}: ` : ''}${column.title}`,
        ...column.cards.map((card) => {
          const tagSuffix = [
            ...(card.assignees ?? []).map(formatAssigneeTag),
            card.priority ? `#${card.priority}` : '',
          ]
            .filter(Boolean)
            .join(' ')
          return `- [${card.done ? 'x' : ' '}] ${card.title}${tagSuffix ? `  ${tagSuffix}` : ''}`
        }),
      ].join('\n'),
    )
    .join('\n')
}
