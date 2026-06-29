import { randomUUID } from 'node:crypto'

export type CardPriority = 'high' | 'medium' | 'low'
export type KanbanColumnStatus = 'backlog' | 'next' | 'in_progress' | 'done' | 'custom'

export interface TaskComment {
  id: string
  author?: string
  body: string
  createdAt: string
  updatedAt?: string
  editedBy?: string
}

export interface TaskIdSettings {
  enabled: boolean
  prefix: string
}

export interface KanbanColumnMetadata {
  id: string
  status: KanbanColumnStatus
}

export interface KanbanCard {
  uid?: string
  id?: string
  title: string
  description?: string
  comments?: TaskComment[]
  priority?: CardPriority
  assignees: string[]
  labels: string[]
  archived?: boolean
}

export interface KanbanColumn {
  id: string
  title: string
  status: KanbanColumnStatus
  icon?: string
  cards: KanbanCard[]
}

export interface KanbanBoard {
  columns: KanbanColumn[]
}

const defaultTaskIdPrefix = 'TASK'
const columnStatuses = new Set<KanbanColumnStatus>(['backlog', 'next', 'in_progress', 'done', 'custom'])
const reservedLabelNames = new Set(['high', 'medium', 'low'])

const taskIdPattern = /^([A-Za-z][A-Za-z0-9-]*-\d+)$/
const cardUidPattern = /^card_[a-f0-9]{32}$/
const commentIdPattern = /^cmt_[a-f0-9]{32}$/
const labelPattern = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/
const cardUidMarkerPattern = /^<!--\s*wikindie-card-uid:\s*(card_[a-f0-9]{32})\s*-->$/

export const defaultKanbanColumns: Array<KanbanColumnMetadata & { title: string; icon?: string }> = [
  { id: 'backlog', status: 'backlog', title: 'Backlog', icon: 'todo' },
  { id: 'next', status: 'next', title: 'Next Up', icon: 'idea' },
  { id: 'in-progress', status: 'in_progress', title: 'In Progress', icon: 'doing' },
  { id: 'done', status: 'done', title: 'Done', icon: 'done' },
]

function priorityRank(priority?: CardPriority) {
  if (priority === 'high') return 0
  if (priority === 'medium') return 1
  if (priority === 'low') return 2
  return 3
}

function slugifyColumnId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'column'
}

function normalizeColumnId(value: unknown) {
  return slugifyColumnId(String(value ?? ''))
}

function normalizeColumnStatus(value: unknown): KanbanColumnStatus | undefined {
  const status = String(value ?? '').trim() as KanbanColumnStatus
  return columnStatuses.has(status) ? status : undefined
}

function defaultColumnId(title: string, status: KanbanColumnStatus) {
  return status === 'custom' ? slugifyColumnId(title) : status.replace('_', '-')
}

function uniqueColumnId(base: string, used: Set<string>) {
  let id = normalizeColumnId(base)
  let next = 2
  while (used.has(id)) {
    id = `${normalizeColumnId(base)}-${next++}`
  }
  used.add(id)
  return id
}

export function inferColumnStatus(title: string): KanbanColumnStatus {
  const clean = title.trim().toLowerCase()
  if (clean === 'backlog') return 'backlog'
  if (clean === 'next up') return 'next'
  if (clean === 'in progress') return 'in_progress'
  if (clean === 'done') return 'done'
  return 'custom'
}

export function isDoneColumn(column: Pick<KanbanColumn, 'status'>) {
  return column.status === 'done'
}

export function normalizeTaskIdPrefix(value: unknown) {
  const prefix = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return prefix || defaultTaskIdPrefix
}

export function parseTaskIdSettings(frontmatter: Record<string, unknown>): TaskIdSettings {
  const raw = frontmatter.taskIds
  if (!raw || typeof raw !== 'object') return { enabled: false, prefix: defaultTaskIdPrefix }
  const data = raw as Record<string, unknown>
  return {
    enabled: data.enabled === true,
    prefix: normalizeTaskIdPrefix(data.prefix),
  }
}

export function generateCardUid() {
  return `card_${randomUUID().replaceAll('-', '')}`
}

function generateCommentId() {
  return `cmt_${randomUUID().replaceAll('-', '')}`
}

function validDateString(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return false
  return !Number.isNaN(Date.parse(value))
}

function normalizeComment(comment: unknown): TaskComment | null {
  if (!comment || typeof comment !== 'object') return null
  const data = comment as Record<string, unknown>
  const body = String(data.body ?? '').trim()
  if (!body) return null
  const id = typeof data.id === 'string' && commentIdPattern.test(data.id) ? data.id : generateCommentId()
  const createdAt = validDateString(data.createdAt) ? String(data.createdAt) : new Date().toISOString()
  const author = typeof data.author === 'string' && data.author.trim() ? data.author.trim() : undefined
  const updatedAt = validDateString(data.updatedAt) ? String(data.updatedAt) : undefined
  const editedBy = typeof data.editedBy === 'string' && data.editedBy.trim() ? data.editedBy.trim() : undefined
  return {
    id,
    ...(author ? { author } : {}),
    body,
    createdAt,
    ...(updatedAt ? { updatedAt } : {}),
    ...(editedBy ? { editedBy } : {}),
  }
}

function normalizeComments(comments: unknown): TaskComment[] {
  if (!Array.isArray(comments)) return []
  return comments.map(normalizeComment).filter((comment): comment is TaskComment => Boolean(comment))
}

export function createTaskComment(body: string, author?: string): TaskComment {
  const cleanBody = body.trim()
  if (!cleanBody) throw new Error('Comment body is required')
  const cleanAuthor = author?.trim()
  return {
    id: generateCommentId(),
    ...(cleanAuthor ? { author: cleanAuthor } : {}),
    body: cleanBody,
    createdAt: new Date().toISOString(),
  }
}

export function parseTaskComments(frontmatter: Record<string, unknown>) {
  const raw = frontmatter.taskComments
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const comments: Record<string, TaskComment[]> = {}
  for (const [uid, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!cardUidPattern.test(uid)) continue
    const normalized = normalizeComments(value)
    if (normalized.length) comments[uid] = normalized
  }
  return comments
}

export function parseKanbanColumnMetadata(frontmatter: Record<string, unknown>): KanbanColumnMetadata[] {
  const raw = frontmatter.kanbanColumns
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const data = item as Record<string, unknown>
      const status = normalizeColumnStatus(data.status)
      if (!status) return null
      return { id: normalizeColumnId(data.id), status }
    })
    .filter((item): item is KanbanColumnMetadata => Boolean(item))
}

export function kanbanColumnMetadata(board: KanbanBoard): KanbanColumnMetadata[] {
  return board.columns.map((column) => ({ id: column.id, status: column.status }))
}

function kanbanTaskComments(board: KanbanBoard) {
  const comments: Record<string, TaskComment[]> = {}
  for (const column of board.columns) {
    for (const card of column.cards) {
      const normalized = normalizeComments(card.comments)
      if (card.uid && normalized.length) comments[card.uid] = normalized
    }
  }
  return comments
}

export function withKanbanColumnMetadata(frontmatter: Record<string, unknown>, board: KanbanBoard) {
  const { taskComments: _taskComments, ...rest } = frontmatter
  const comments = kanbanTaskComments(board)
  return {
    ...rest,
    kanban: true,
    kanbanColumns: kanbanColumnMetadata(board),
    ...(Object.keys(comments).length ? { taskComments: comments } : {}),
  }
}

export function defaultKanbanBoard(): KanbanBoard {
  return {
    columns: defaultKanbanColumns.map((column, index) => ({
      ...column,
      cards: index === 0 ? [{ title: 'New card', assignees: [], labels: [] }] : [],
    })),
  }
}

export function defaultKanbanFrontmatter() {
  return withKanbanColumnMetadata({ kanban: true }, defaultKanbanBoard())
}

export function isReservedLabelName(label: string) {
  return reservedLabelNames.has(label.trim().toLowerCase())
}

function parseMetadataBlock(raw: string): { priority?: CardPriority; assignees: string[]; labels: string[]; archived?: boolean } | null {
  const tokens = raw.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return null

  let priority: CardPriority | undefined
  const assignees: string[] = []
  const labels: string[] = []
  let archived = false

  for (const token of tokens) {
    if (token === '!archived') {
      archived = true
      continue
    }

    const priorityMatch = token.match(/^#(high|medium|low)$/i)
    if (priorityMatch) {
      priority = priorityMatch[1].toLowerCase() as CardPriority
      continue
    }

    const labelMatch = token.match(/^#(.+)$/)
    if (labelMatch && labelPattern.test(labelMatch[1]) && !isReservedLabelName(labelMatch[1])) {
      labels.push(labelMatch[1].toLowerCase())
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

  return { priority, assignees, labels, archived: archived || undefined }
}

function uniqueLabels(labels: string[]) {
  return [...new Set(labels.map((label) => label.trim().toLowerCase()).filter((label) => label && !isReservedLabelName(label)))]
}

function parseCardTags(raw: string): { title: string; priority?: CardPriority; assignees: string[]; labels: string[]; archived?: boolean } {
  const trimmed = raw.trim()
  if (!trimmed) return { title: '', assignees: [], labels: [] }

  // Prefer double-space separator for explicit metadata blocks.
  const separators = [...trimmed.matchAll(/\s{2,}/g)]
  for (let index = separators.length - 1; index >= 0; index -= 1) {
    const separator = separators[index]
    if (separator.index === undefined) continue
    const title = trimmed.slice(0, separator.index).trimEnd()
    const metadata = parseMetadataBlock(trimmed.slice(separator.index + separator[0].length))
    if (title && metadata) return { title, ...metadata, labels: uniqueLabels(metadata.labels) }
  }

  // Fallback: try trailing single-space tokens when they form a valid metadata-only run.
  const tokens = trimmed.split(/\s+/)
  let tokensConsumed = 0
  let priority: CardPriority | undefined
  const assignees: string[] = []
  const labels: string[] = []
  let archived = false
  for (let i = tokens.length - 1; i >= 1; i -= 1) {
    const block = parseMetadataBlock(tokens[i])
    if (!block) break
    if (block.priority) priority = block.priority
    if (block.assignees.length) assignees.unshift(...block.assignees)
    if (block.labels.length) labels.unshift(...block.labels)
    if (block.archived) archived = true
    tokensConsumed = tokens.length - i
  }
  if (tokensConsumed > 0) {
    const title = tokens.slice(0, tokens.length - tokensConsumed).join(' ')
    if (title) return { title, priority, assignees, labels: uniqueLabels(labels), archived: archived || undefined }
  }

  return { title: trimmed, assignees: [], labels: [] }
}

function parseCardText(raw: string): KanbanCard {
  const trimmed = raw.trim()
  const idMatch = trimmed.match(/^\[([^\]]+)\]\s+(.+)$/)
  const id = idMatch && taskIdPattern.test(idMatch[1]) ? idMatch[1] : undefined
  const titleSource = id ? idMatch?.[2] ?? '' : trimmed
  const parsed = parseCardTags(titleSource)
  return { id, ...parsed }
}

function formatAssigneeTag(assignee: string) {
  return /^[A-Za-z0-9_.-]+$/.test(assignee) ? `@${assignee}` : `@<${encodeURIComponent(assignee)}>`
}

function parseColumnHeading(raw: string): Omit<KanbanColumn, 'cards'> {
  const trimmed = raw.trim()
  // Accept any non-colon, non-whitespace icon token so raw emoji glyphs (e.g.
  // :🚀:) round-trip the same way as shortcode ids like :todo:.
  const icon = trimmed.match(/^:([^:\s]+):\s+(.+)$/)
  const title = icon ? icon[2].trim() : trimmed
  const status = inferColumnStatus(title)
  return {
    id: defaultColumnId(title, status),
    title,
    status,
    icon: icon ? icon[1].toLowerCase() : undefined,
  }
}

export function parseKanban(markdown: string): KanbanBoard {
  const columns: KanbanColumn[] = []
  let current: KanbanColumn | undefined
  let currentCard: KanbanCard | undefined
  let descriptionLines: string[] = []

  const flushDescription = () => {
    if (currentCard && descriptionLines.length) {
      const description = descriptionLines.join('\n').trimEnd()
      if (description) currentCard.description = description
    }
    descriptionLines = []
  }

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+)$/)
    if (heading) {
      flushDescription()
      current = { ...parseColumnHeading(heading[1]), cards: [] }
      currentCard = undefined
      columns.push(current)
      continue
    }

    const card = line.match(/^- (.+)$/)
    if (card && current) {
      flushDescription()
      currentCard = parseCardText(card[1])
      current.cards.push(currentCard)
      continue
    }

    const description = line.match(/^(?: {2}|\t)(.*)$/)
    if (description && currentCard) {
      const uidMarker = description[1].trim().match(cardUidMarkerPattern)
      if (uidMarker) {
        currentCard.uid = uidMarker[1]
        continue
      }
      descriptionLines.push(description[1])
      continue
    }

    if (!line.trim() && currentCard && descriptionLines.length) descriptionLines.push('')
  }

  flushDescription()

  return { columns }
}

function normalizeCard(card: KanbanCard): KanbanCard {
  const uid = typeof card.uid === 'string' && cardUidPattern.test(card.uid) ? card.uid : undefined
  const id = typeof card.id === 'string' && taskIdPattern.test(card.id) ? card.id : undefined
  const title = String(card.title ?? '').trim().replace(/\s+/g, ' ')
  const description = typeof card.description === 'string' ? card.description.trimEnd() : undefined
  const comments = normalizeComments(card.comments)
  const priority = card.priority === 'high' || card.priority === 'medium' || card.priority === 'low' ? card.priority : undefined
  const assignees = Array.isArray(card.assignees) ? card.assignees.map((assignee) => String(assignee).trim()).filter(Boolean) : []
  const labels = Array.isArray(card.labels) ? uniqueLabels(card.labels.map(String).filter((label) => labelPattern.test(label))) : []
  return { uid, id, title, description: description || undefined, comments: comments.length ? comments : undefined, priority, assignees, labels, archived: card.archived === true || undefined }
}

export function normalizeKanbanBoard(
  board: KanbanBoard,
  taskIds: TaskIdSettings = { enabled: false, prefix: defaultTaskIdPrefix },
  columnMetadata: KanbanColumnMetadata[] = [],
  preferMetadata = true,
  taskComments: Record<string, TaskComment[]> = {},
): KanbanBoard {
  const usedColumnIds = new Set<string>()
  const next: KanbanBoard = {
    columns: (board.columns ?? []).map((column, index) => {
      const title = String(column.title ?? '').trim() || 'Untitled'
      const metadata = columnMetadata[index]
      const boardStatus = normalizeColumnStatus(column.status)
      const inferredStatus = inferColumnStatus(title)
      const status = (preferMetadata ? metadata?.status ?? boardStatus : boardStatus ?? metadata?.status) ?? inferredStatus
      const boardId = typeof column.id === 'string' && column.id.trim() ? column.id : undefined
      const id = uniqueColumnId((preferMetadata ? metadata?.id ?? boardId : boardId ?? metadata?.id) ?? defaultColumnId(title, status), usedColumnIds)

      return {
        id,
        title,
        status,
        icon: typeof column.icon === 'string' && column.icon.trim() ? column.icon.trim() : undefined,
        cards: (column.cards ?? []).map(normalizeCard).filter((card) => card.title),
      }
    }),
  }

  for (const column of next.columns) {
    for (const card of column.cards) {
      if (card.comments?.length && !card.uid) card.uid = generateCardUid()
      if (!card.comments?.length && card.uid && taskComments[card.uid]?.length) card.comments = taskComments[card.uid]
      if (card.comments?.length && !card.uid) card.uid = generateCardUid()
    }
  }

  if (taskIds.enabled) {
    let highestIndex = 0
    for (const column of next.columns) {
      for (const card of column.cards) {
        const match = card.id?.match(/-(\d+)$/)
        if (match) highestIndex = Math.max(highestIndex, Number(match[1]))
      }
    }

    let nextIndex = highestIndex + 1
    const prefix = normalizeTaskIdPrefix(taskIds.prefix)
    for (const column of next.columns) {
      for (const card of column.cards) {
        if (!card.id) card.id = `${prefix}-${nextIndex++}`
      }
    }
  }

  return {
    columns: next.columns.map((column) => ({
      ...column,
      cards: column.cards
        .map((card, index) => ({ card, index }))
        .sort((a, b) => priorityRank(a.card.priority) - priorityRank(b.card.priority) || a.index - b.index)
        .map(({ card }) => card),
    })),
  }
}

function formatDescription(description: string | undefined) {
  const clean = description?.trimEnd()
  if (!clean) return []
  return clean.split('\n').map((line) => (line ? `  ${line}` : ''))
}

function formatCardUid(uid: string | undefined) {
  return uid ? [`  <!-- wikindie-card-uid: ${uid} -->`] : []
}

export function serializeKanban(board: KanbanBoard) {
  return board.columns
    .map((column) =>
      [
        `## ${column.icon ? `:${column.icon}: ` : ''}${column.title}`,
        ...column.cards.flatMap((card) => {
          const tagSuffix = [
            ...(card.assignees ?? []).map(formatAssigneeTag),
            ...(card.labels ?? []).map((label) => `#${label}`),
            card.priority ? `#${card.priority}` : '',
            card.archived ? '!archived' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return [
            `- ${card.id ? `[${card.id}] ` : ''}${card.title}${tagSuffix ? `  ${tagSuffix}` : ''}`,
            ...formatCardUid(card.uid),
            ...formatDescription(card.description),
          ]
        }),
      ].join('\n'),
    )
    .join('\n')
}

export interface KanbanCardMatch {
  column: KanbanColumn
  columnIndex: number
  card: KanbanCard
  cardIndex: number
}

export function findKanbanCard(board: KanbanBoard, locator: { taskId?: string; cardUid?: string; columnId?: string; index?: number }): KanbanCardMatch | null {
  if (locator.cardUid) {
    for (const [columnIndex, column] of board.columns.entries()) {
      const cardIndex = column.cards.findIndex((card) => card.uid === locator.cardUid)
      if (cardIndex >= 0) return { column, columnIndex, card: column.cards[cardIndex], cardIndex }
    }
  }

  if (locator.taskId) {
    for (const [columnIndex, column] of board.columns.entries()) {
      const cardIndex = column.cards.findIndex((card) => card.id === locator.taskId)
      if (cardIndex >= 0) return { column, columnIndex, card: column.cards[cardIndex], cardIndex }
    }
  }

  if (locator.columnId && locator.index !== undefined) {
    const columnIndex = board.columns.findIndex((column) => column.id === locator.columnId)
    const column = columnIndex >= 0 ? board.columns[columnIndex] : undefined
    const card = column?.cards[locator.index]
    if (column && card) return { column, columnIndex, card, cardIndex: locator.index }
  }

  return null
}

export function findKanbanComment(board: KanbanBoard, commentId: string) {
  for (const match of board.columns.flatMap((column, columnIndex) => column.cards.map((card, cardIndex) => ({ column, columnIndex, card, cardIndex })))) {
    const commentIndex = match.card.comments?.findIndex((comment) => comment.id === commentId) ?? -1
    if (commentIndex >= 0 && match.card.comments) return { ...match, comment: match.card.comments[commentIndex], commentIndex }
  }
  return null
}
